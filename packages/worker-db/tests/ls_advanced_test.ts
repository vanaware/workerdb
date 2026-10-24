import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { ls, } from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

Deno.test({
  name: "LS Advanced - Modern JS Array method execution (query, getSome)",
  fn() {
    const store = ls("LS_FINANCES_",);
    store.clear();

    store.importLS({
      LS_FINANCES_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      LS_FINANCES_f2: {
        tag: "personal",
        amount: 300,
        status: "pending",
        code: "y",
      },
      LS_FINANCES_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      LS_FINANCES_f4: {
        tag: "home",
        amount: 80,
        status: "pending",
        code: "w",
      },
      LS_FINANCES_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Validate synchronous advanced Array function execution
    const result = store.query((items,) => {
      const data = items as Record<string, unknown>[];
      return {
        count: data.length, // length
        total: data.reduce((acc, i,) => acc + (i.amount as number), 0,), // reduce
        firstWork: data.find((i,) => i.tag === "work"), // find
        lastWork: data.findLast((i,) => i.tag === "work"), // findLast
        lastItem: data.at(-1,), // at
        hasPending: data.some((i,) => i.status === "pending"), // some
        allPositive: data.every((i,) => (i.amount as number) > 0), // every
        tagsHaveHome: data.map((i,) => i.tag as string).includes("home",), // map and includes
        idxPersonal: data.findIndex((i,) => i.tag === "personal"), // findIndex
        lastIdxWork: data.findLastIndex((i,) => i.tag === "work"), // findLastIndex
        indexOfZ: data.map((i,) => i.code as string).indexOf("z",), // indexOf
        paidItems: data.filter((i,) => i.status === "paid"), // filter
        sliced: data.slice(1, 4,), // slice
        sortedByAmount: data.toSorted((a, b,) =>
          (a.amount as number) - (b.amount as number)
        ), // toSorted
        reversed: data.toReversed(), // toReversed
        spliced: data.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Record<string, unknown>).amount, 150,);
    assertEquals((result.lastWork as Record<string, unknown>).amount, 200,);
    assertEquals((result.lastItem as Record<string, unknown>).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals(
      (result.sortedByAmount[0] as Record<string, unknown>).amount,
      80,
    );
    assertEquals((result.reversed[0] as Record<string, unknown>).code, "k",);
    assertEquals(result.spliced.length, 3,);

    store.clear();
  },
},);

Deno.test({
  name: "LS Advanced - Synchronous type errors (invalid return values)",
  fn() {
    const store = ls("LS_ERRORS_",);
    store.clear();
    store.set("1", { valid: true, },);

    // AssertThrows captures synchronous exceptions dispatched by ls() wrapper
    assertThrows(
      () =>
        store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "The function in getSome must return an Array.",
    );

    assertThrows(
      () => store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "The function in delSome must return an Array.",
    );

    assertThrows(
      () =>
        store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "The selector function in setSome must return an Array.",
    );

    store.clear();
  },
},);

Deno.test({
  name: "LS Advanced - Type transformations, bulk mutation and safe deletion",
  fn() {
    const store = ls("LS_COMPANY_",);
    store.clear();

    store.importLS({
      LS_COMPANY_e10: {
        name: "joão silva",
        department: "technology",
        level: 2,
        active: true,
      },
      LS_COMPANY_e20: {
        name: "maria souza",
        department: "hr",
        level: 3,
        active: true,
      },
      LS_COMPANY_e30: {
        name: "pedro alves",
        department: "sales",
        level: 1,
        active: false,
      },
    },);

    // Uppercase the name and convert `level` from number to string
    store.setSome(
      (items,) => {
        const data = items as Record<string, unknown>[];
        return data.filter((item,) =>
          (item.active as boolean) === true
        ) as WithId<Record<string, unknown>>[];
      },
      (item,) => {
        const data = item as Record<string, unknown>;
        return {
          ...data,
          name: (data.name as string).toUpperCase(),
          department: (data.department as string).toUpperCase(),
          level: String(data.level as number,), // explicit type mutation!
          _id: data._id as string,
        };
      },
    );

    const e10 = store.get<Record<string, unknown>>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECHNOLOGY",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = store.get<Record<string, unknown>>("e30",);
    assertEquals(e30?.department, "sales",); // stays lowercase because active=false
    assertEquals(typeof e30?.level, "number",); // stays a number

    // Delete inactive employees via delSome
    store.delSome((items,) => {
      const data = items as Record<string, unknown>[];
      return data.filter((i,) => (i.active as boolean) === false) as WithId<
        Record<string, unknown>
      >[];
    },);

    // Verify correct deletion
    assertEquals(store.get("e30",), undefined,);
    const remainingKeys = store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Ensure integrity of remaining records
    const remaining = store.values<Record<string, unknown>>();
    assertNotEquals(remaining[0]?.name as string, "pedro alves",);

    store.clear();
  },
},);
