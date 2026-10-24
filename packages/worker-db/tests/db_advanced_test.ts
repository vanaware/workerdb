import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

interface Invoice {
  tag: string;
  amount: number;
  status: string;
  code: string;
}

interface Employee {
  _id: string;
  name: string;
  department: string;
  level: number | string;
  active: boolean;
}

Deno.test({
  name:
    "DB Advanced - Array method execution inside the Worker (query, getSome)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("FINANCES", "invoices", "INV_",);
    await store.clear();

    await store.importDB({
      INV_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      INV_f2: { tag: "personal", amount: 300, status: "pending", code: "y", },
      INV_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      INV_f4: { tag: "home", amount: 80, status: "pending", code: "w", },
      INV_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Validate advanced function execution inside the Database Worker
    const result = await store.query((items: Invoice[],) => {
      return {
        count: items.length, // length
        total: items.reduce((acc: number, i: Invoice,) => acc + i.amount, 0,), // reduce
        firstWork: items.find((i: Invoice,) => i.tag === "work"), // find
        lastWork: items.findLast((i: Invoice,) => i.tag === "work"), // findLast
        lastItem: items.at(-1,), // at
        hasPending: items.some((i: Invoice,) => i.status === "pending"), // some
        allPositive: items.every((i: Invoice,) => i.amount > 0), // every
        tagsHaveHome: items.map((i: Invoice,) => i.tag).includes("home",), // map and includes
        idxPersonal: items.findIndex((i: Invoice,) => i.tag === "personal"), // findIndex
        lastIdxWork: items.findLastIndex((i: Invoice,) => i.tag === "work"), // findLastIndex
        indexOfZ: items.map((i: Invoice,) => i.code).indexOf("z",), // indexOf
        paidItems: items.filter((i: Invoice,) => i.status === "paid"), // filter
        sliced: items.slice(1, 4,), // slice
        sortedByAmount: items.toSorted((a: Invoice, b: Invoice,) =>
          a.amount - b.amount
        ), // toSorted
        reversed: items.toReversed(), // toReversed
        spliced: items.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Invoice).amount, 150,);
    assertEquals((result.lastWork as Invoice).amount, 200,);
    assertEquals((result.lastItem as Invoice).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals((result.sortedByAmount[0] as Invoice).amount, 80,);
    assertEquals((result.reversed[0] as Invoice).code, "k",);
    assertEquals(result.spliced.length, 3,);
  },
},);

Deno.test({
  name:
    "DB Advanced - Runtime errors inside the Worker (invalid return values)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_ERRORS", "tests", "ERR_",);
    await store.clear();
    await store.set("1", { valid: true, },);

    // AssertRejects captures throw Exceptions dispatched in worker switch(command)
    await assertRejects(
      async () =>
        await store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "The injected function in GET_SOME must return an Array.",
    );

    await assertRejects(
      async () =>
        await store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "The injected function in DEL_SOME must return an Array.",
    );

    await assertRejects(
      async () =>
        await store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "The selector function in SET_SOME must return an Array.",
    );
  },
},);

Deno.test({
  name:
    "DB Advanced - Type transformations, UPPERCASE and safe deletion in the Worker",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("COMPANY", "employees", "EMP_",);
    await store.clear();

    await store.importDB({
      EMP_e10: {
        name: "joão silva",
        department: "technology",
        level: 2,
        active: true,
      },
      EMP_e20: {
        name: "maria souza",
        department: "hr",
        level: 3,
        active: true,
      },
      EMP_e30: {
        name: "pedro alves",
        department: "sales",
        level: 1,
        active: false,
      },
    },);

    // Uppercase the name and convert `level` from number to string
    await store.setSome(
      (items: Employee[],) =>
        items.filter((item: Employee,) => item.active === true) as Employee[],
      (item: Employee,) => ({
        ...item,
        name: item.name.toUpperCase(),
        department: item.department.toUpperCase(),
        level: String(item.level,), // type mutation!
      }),
    );

    const e10 = await store.get<Employee>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECHNOLOGY",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = await store.get<Employee>("e30",);
    assertEquals(e30?.department, "sales",); // stays lowercase
    assertEquals(typeof e30?.level, "number",); // stays a number

    // Delete inactive employees via delSome
    await store.delSome((items: Employee[],) =>
      items.filter((i: Employee,) => i.active === false)
    );

    // Verify correct deletion
    assertEquals(await store.get("e30",), undefined,);
    const remainingKeys = await store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Ensure integrity of remaining records
    const remaining = await store.values<Employee>();
    assertNotEquals(remaining[0]?.name, "pedro alves",);
  },
},);
