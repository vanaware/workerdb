import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
  db,
} from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

interface Fatura {
  tag: string;
  amount: number;
  status: string;
  code: string;
}

interface Funcionario {
  _id: string;
  name: string;
  department: string;
  level: number | string;
  active: boolean;
}

Deno.test({
  name: "DB Advanced - Execução de Métodos de Array no Worker (query, getSome)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("FINANCAS", "faturas", "FAT_",);
    await store.clear();

    await store.importDB({
      FAT_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      FAT_f2: { tag: "personal", amount: 300, status: "pending", code: "y", },
      FAT_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      FAT_f4: { tag: "home", amount: 80, status: "pending", code: "w", },
      FAT_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Valida execução de funções avançadas dentro do Worker de Banco de Dados
    const result = await store.query((items: Fatura[],) => {
      return {
        count: items.length, // length
        total: items.reduce((acc: number, i: Fatura,) => acc + i.amount, 0,), // reduce
        firstWork: items.find((i: Fatura,) => i.tag === "work"), // find
        lastWork: items.findLast((i: Fatura,) => i.tag === "work"), // findLast
        lastItem: items.at(-1,), // at
        hasPending: items.some((i: Fatura,) => i.status === "pending"), // some
        allPositive: items.every((i: Fatura,) => i.amount > 0), // every
        tagsHaveHome: items.map((i: Fatura,) => i.tag).includes("home",), // map e includes
        idxPersonal: items.findIndex((i: Fatura,) => i.tag === "personal"), // findIndex
        lastIdxWork: items.findLastIndex((i: Fatura,) => i.tag === "work"), // findLastIndex
        indexOfZ: items.map((i: Fatura,) => i.code).indexOf("z",), // indexOf
        paidItems: items.filter((i: Fatura,) => i.status === "paid"), // filter
        sliced: items.slice(1, 4,), // slice
        sortedByAmount: items.toSorted((a: Fatura, b: Fatura,) =>
          a.amount - b.amount
        ), // toSorted
        reversed: items.toReversed(), // toReversed
        spliced: items.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Fatura).amount, 150,);
    assertEquals((result.lastWork as Fatura).amount, 200,);
    assertEquals((result.lastItem as Fatura).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals((result.sortedByAmount[0] as Fatura).amount, 80,);
    assertEquals((result.reversed[0] as Fatura).code, "k",);
    assertEquals(result.spliced.length, 3,);
  },
},);

Deno.test({
  name:
    "DB Advanced - Erros em tempo de execução no Worker (Retornos Inválidos)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("ERROS_WORKER", "testes", "ERR_",);
    await store.clear();
    await store.set("1", { valid: true, },);

    // AssertRejects captura os throw Exceptions disparados lá no switch(command) do worker
    await assertRejects(
      async () =>
        await store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "A função injetada em GET_SOME deve retornar um Array.",
    );

    await assertRejects(
      async () =>
        await store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "A função injetada em DEL_SOME deve retornar um Array.",
    );

    await assertRejects(
      async () =>
        await store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "A função de seleção em SET_SOME deve retornar um Array.",
    );
  },
},);

Deno.test({
  name:
    "DB Advanced - Transformações de Tipo, UPPERCASE e Exclusão Segura no Worker",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("EMPRESA", "funcionarios", "EMP_",);
    await store.clear();

    await store.importDB({
      EMP_e10: {
        name: "joão silva",
        department: "tecnologia",
        level: 2,
        active: true,
      },
      EMP_e20: {
        name: "maria souza",
        department: "rh",
        level: 3,
        active: true,
      },
      EMP_e30: {
        name: "pedro alves",
        department: "vendas",
        level: 1,
        active: false,
      },
    },);

    // Atualiza nome para UPPERCASE e converte 'level' (number) para string
    await store.setSome(
      (items: Funcionario[],) =>
        items.filter((item: Funcionario,) =>
          item.active === true
        ) as Funcionario[],
      (item: Funcionario,) => ({
        ...item,
        name: item.name.toUpperCase(),
        department: item.department.toUpperCase(),
        level: String(item.level,), // Mutação de tipo!
      }),
    );

    const e10 = await store.get<Funcionario>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECNOLOGIA",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = await store.get<Funcionario>("e30",);
    assertEquals(e30?.department, "vendas",); // Permanece em lowercase
    assertEquals(typeof e30?.level, "number",); // Permanece tipo número

    // Exclui funcionários inativos via delSome
    await store.delSome((items: Funcionario[],) =>
      items.filter((i: Funcionario,) => i.active === false)
    );

    // Checa deleção correta
    assertEquals(await store.get("e30",), undefined,);
    const remainingKeys = await store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Assegura integridade dos que ficaram
    const remaining = await store.values<Funcionario>();
    assertNotEquals(remaining[0]?.name, "pedro alves",);
  },
},);
