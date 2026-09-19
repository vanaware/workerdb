import { assert, assertEquals, assertRejects, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { db, opfs, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

describe("WorkerDB Phase 1 - Schema Validation", () => {
  interface UserProfile {
    _id?: string;
    username: string;
    age: number;
  }

  const validatedDb = db<UserProfile>({
    dbName: "VALIDATION_DB",
    storeName: "users",
    prefix: "USR_",
    validator: (item: unknown,) => {
      if (!item || typeof item !== "object") return false;
      const u = item as Record<string, unknown>;
      return typeof u.username === "string" && typeof u.age === "number" &&
        u.age >= 18;
    },
  },);

  it("permite inserir registro que passa na validação", async () => {
    await validatedDb.clear();
    const id = await validatedDb.set("u1", {
      username: "Alice",
      age: 25,
    },);
    assertEquals(id, "USR_u1",);
    const item = await validatedDb.get("u1",);
    assertEquals(item?.username, "Alice",);
    assertEquals(item?.age, 25,);
  });

  it("rejeita inserção de registro inválido pelo validador", async () => {
    await assertRejects(
      async () => {
        await validatedDb.set("u2", {
          username: "Bob",
          age: 16, // inválido (< 18)
        },);
      },
      Error,
      "Validation failed",
    );
  });

  it("rejeita patch que torna o registro inválido", async () => {
    await assertRejects(
      async () => {
        await validatedDb.patch("u1", { age: 10, },);
      },
      Error,
      "Validation failed",
    );
  });
});

describe("WorkerDB Phase 1 - Indexed Queries (getByIndex)", () => {
  interface Product {
    _id?: string;
    title: string;
    category: string;
    price: number;
  }

  const productStore = db<Product>({
    dbName: "CATALOG_DB",
    storeName: "products",
    indexes: ["category",],
  },);

  it("recupera registros filtrando pelo índice", async () => {
    await productStore.clear();
    await productStore.set("p1", {
      title: "Laptop",
      category: "electronics",
      price: 1200,
    },);
    await productStore.set("p2", {
      title: "Teclado",
      category: "electronics",
      price: 100,
    },);
    await productStore.set("p3", {
      title: "Cadeira",
      category: "furniture",
      price: 300,
    },);

    const electronics = await productStore.getByIndex<Product>(
      "category",
      "electronics",
    );
    assertEquals(electronics.length, 2,);
    assert(electronics.some((p,) => p.title === "Laptop"),);
    assert(electronics.some((p,) => p.title === "Teclado"),);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 1,);
    assertEquals(furniture[0]?.title, "Cadeira",);
  });

  it("recupera múltiplos valores de índice em lote com getManyByIndex", async () => {
    await productStore.set("p4", {
      title: "Livro",
      category: "books",
      price: 50,
    },);

    const multi = await productStore.getManyByIndex<Product>(
      "category",
      ["electronics", "books",],
    );
    assertEquals(multi.length, 3,);
    assert(multi.some((p,) => p.title === "Laptop"),);
    assert(multi.some((p,) => p.title === "Teclado"),);
    assert(multi.some((p,) => p.title === "Livro"),);
  });

  it("filtra subconjunto indexado com getSomeByIndex sem escanear o banco inteiro", async () => {
    // Filtra eletrônicos com preço > 500
    const expensiveElectronics = await productStore.getSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price > 500),
    );
    assertEquals(expensiveElectronics.length, 1,);
    assertEquals(expensiveElectronics[0]?.title, "Laptop",);
  });

  it("calcula agregações sobre o subconjunto indexado com queryByIndex", async () => {
    // Calcula o total gasto em eletrônicos
    const totalElectronicsPrice = await productStore.queryByIndex<
      Product,
      number
    >(
      "category",
      "electronics",
      (items,) => items.reduce((acc, p,) => acc + p.price, 0,),
    );
    assertEquals(totalElectronicsPrice, 1300,);
  });

  it("atualiza apenas registros do índice selecionados com setSomeByIndex", async () => {
    // Aplica desconto de 10% apenas em eletrônicos com preço >= 1000
    await productStore.setSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price >= 1000),
      (item,) => ({ ...item, price: item.price * 0.9, }),
    );

    const laptop = await productStore.get<Product>("p1",);
    assertEquals(laptop?.price, 1080,);

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard?.price, 100,); // Não foi alterado
  });

  it("remove itens selecionados do subconjunto indexado com delSomeByIndex", async () => {
    // Deleta eletrônicos com preço <= 150
    await productStore.delSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price <= 150),
    );

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard, undefined,);

    const laptop = await productStore.get<Product>("p1",);
    assert(laptop !== undefined,);
  });

  it("remove todos os registros de um valor de índice com deleteByIndex", async () => {
    await productStore.deleteByIndex("category", "furniture",);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);

    const cadeira = await productStore.get<Product>("p3",);
    assertEquals(cadeira, undefined,);
  });

  it("remove múltiplos grupos de índice com deleteManyByIndex", async () => {
    await productStore.set("p5", {
      title: "Mesa",
      category: "furniture",
      price: 400,
    },);
    await productStore.set("p6", {
      title: "Revista",
      category: "books",
      price: 15,
    },);

    await productStore.deleteManyByIndex("category", ["furniture", "books",],);

    const books = await productStore.getByIndex<Product>("category", "books",);
    assertEquals(books.length, 0,);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);
  });
});

describe("WorkerDB Phase 1 - OPFS Streams (addFileStream & getFileStream)", () => {
  const streamDrive = opfs({
    dbName: "STREAM_DRIVE",
    storeName: "media",
    prefix: "MED_",
  },);

  it("grava e lê arquivo via ReadableStream", async () => {
    FakeOPFSDirectory.clear();
    await streamDrive.clear();

    const recordKey = await streamDrive.set("auto", {
      title: "Video Stream",
    },);

    const chunk1 = new Uint8Array([1, 2, 3, 4, 5,],);
    const chunk2 = new Uint8Array([6, 7, 8, 9, 10,],);

    const inputStream = new ReadableStream<Uint8Array>({
      start(controller,) {
        controller.enqueue(chunk1,);
        controller.enqueue(chunk2,);
        controller.close();
      },
    },);

    await streamDrive.addFileStream(recordKey, "data.bin", inputStream,);

    const files = await streamDrive.listFiles(recordKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "data.bin",);

    const outputStream = await streamDrive.getFileStream(
      recordKey,
      "data.bin",
    );
    assert(outputStream instanceof ReadableStream,);

    const reader = outputStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value, } = await reader.read();
      if (done) break;
      if (value) chunks.push(value,);
    }

    const totalLength = chunks.reduce((acc, c,) => acc + c.length, 0,);
    const combined = new Uint8Array(totalLength,);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset,);
      offset += c.length;
    }

    assertEquals(combined, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10,],),);
  });
});
