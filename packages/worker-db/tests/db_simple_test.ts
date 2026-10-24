import { assert, assertEquals, assertNotEquals, } from "@std/assert";

import { db, } from "../src/fake/fake-mod.ts";

Deno.test({
  name: "DB Simple - Handling of _id ('auto', '0990', with prefix)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Use an isolated database name for this test to avoid instance collisions in the fake IndexedDB
    const store = db("STORE_TEST_1", "customers", "CUST_",);
    await store.clear();

    // 1. _id: "auto"
    const keyAuto = await store.set({ _id: "auto", name: "Alice", level: 1, },);
    assert(keyAuto.startsWith("CUST_",),);
    const itemAuto = await store.get<unknown>(keyAuto,) as Record<
      string,
      unknown
    >;
    assert(itemAuto !== undefined,);
    assertNotEquals(itemAuto?._id, "auto",);
    assertEquals(itemAuto?.name, "Alice",);

    // 2. _id: "0990"
    const key0990 = await store.set({ _id: "0990", name: "Bob", level: 2, },);
    assertEquals(key0990, "CUST_0990",);
    const item0990 = await store.get<unknown>("0990",) as Record<
      string,
      unknown
    >;
    assertEquals(item0990?._id, "0990",);
    assertEquals(item0990?.name, "Bob",);

    // 3. _id: "CUST_0990" (already carrying the prefix)
    const keyPref = await store.set({
      _id: "CUST_0990",
      name: "Bob Updated",
      level: 3,
    },);
    assertEquals(keyPref, "CUST_0990",);
    const itemPref = await store.get<unknown>("0990",) as Record<
      string,
      unknown
    >;
    assertEquals(itemPref?.name, "Bob Updated",);
  },
},);

Deno.test({
  name: "DB Simple - CRUD, patch and collection methods",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Isolate the database so it does not collide with the previous test
    const store = db("STORE_TEST_2", "products", "PROD_",);
    await store.clear();

    await store.set("p1", { name: "Notebook", price: 3000, },);
    const p1 = await store.get<unknown>("p1",) as Record<string, unknown>;
    assertEquals(p1?.name, "Notebook",);

    const patched = await store.patch<Record<string, unknown>>("p1", {
      price: 3200,
    },);
    assertEquals((patched as Record<string, unknown>).price, 3200,);

    await store.setMany([
      ["p2", { name: "Mouse", price: 80, },],
      ["p3", { name: "Keyboard", price: 200, },],
    ],);

    const items = await store.getMany<unknown>(["p1", "p2", "p3",],);
    assertEquals(items.length, 3,);

    const keys = await store.keys();
    assert(keys.includes("PROD_p1",),);

    await store.delete("p1",);
    assertEquals(await store.get("p1",), undefined,);

    await store.deleteMany(["p2", "p3",],);
    assertEquals((await store.keys()).length, 0,);
  },
},);

Deno.test({
  name: "DB Simple - importDB and exportDB respecting scope/prefix",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Isolate the database
    const store = db("STORE_TEST_3", "inventory", "INV_",);
    await store.clear();

    const mockData = {
      INV_e1: { item: "Screw", qty: 100, },
      INV_e2: { item: "Nut", qty: 200, },
    };

    await store.importDB(mockData, true,);

    const exported = await store.exportDB();
    assertEquals(exported, mockData,);

    const values = await store.values<unknown>();
    assertEquals(values.length, 2,);
  },
},);
