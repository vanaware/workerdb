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

  it("allows inserting a record that passes validation", async () => {
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

  it("rejects inserting a record that fails the validator", async () => {
    await assertRejects(
      async () => {
        await validatedDb.set("u2", {
          username: "Bob",
          age: 16, // invalid (< 18)
        },);
      },
      Error,
      "Validation failed",
    );
  });

  it("rejects a patch that would make the record invalid", async () => {
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

  it("retrieves records filtered by index", async () => {
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

  it("retrieves multiple index values in batch with getManyByIndex", async () => {
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

  it("filters an indexed subset with getSomeByIndex without scanning the whole store", async () => {
    // Filter electronics with price > 500
    const expensiveElectronics = await productStore.getSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price > 500),
    );
    assertEquals(expensiveElectronics.length, 1,);
    assertEquals(expensiveElectronics[0]?.title, "Laptop",);
  });

  it("computes aggregations over the indexed subset with queryByIndex", async () => {
    // Compute the total amount spent on electronics
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

  it("updates only the records selected from the index with setSomeByIndex", async () => {
    // Apply a 10% discount only to electronics priced >= 1000
    await productStore.setSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price >= 1000),
      (item,) => ({ ...item, price: item.price * 0.9, }),
    );

    const laptop = await productStore.get<Product>("p1",);
    assertEquals(laptop?.price, 1080,);

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard?.price, 100,); // not modified
  });

  it("removes selected items from the indexed subset with delSomeByIndex", async () => {
    // Delete electronics priced <= 150
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

  it("removes every record matching an index value with deleteByIndex", async () => {
    await productStore.deleteByIndex("category", "furniture",);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);

    const cadeira = await productStore.get<Product>("p3",);
    assertEquals(cadeira, undefined,);
  });

  it("removes multiple index groups with deleteManyByIndex", async () => {
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

  it("writes and reads a file via ReadableStream", async () => {
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
