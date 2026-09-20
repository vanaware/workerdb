/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  clear,
  createStore,
  del,
  delMany,
  entries,
  get,
  getMany,
  keys,
  promisifyRequest,
  set,
  setMany,
  update,
  values,
} from "../src/utils/idb-keyval.ts";

describe("Internal idb-keyval module", () => {
  it("should set and get values with a custom store", async () => {
    const store = createStore("test-db-1", "test-store-1",);
    await set("hello", "world", store,);
    const result = await get<string>("hello", store,);
    assertEquals(result, "world",);
  });

  it("should return undefined for non-existent key", async () => {
    const store = createStore("test-db-nonexistent", "test-store",);
    const result = await get("missing", store,);
    assertEquals(result, undefined,);
  });

  it("should handle setMany and getMany", async () => {
    const store = createStore("test-db-many", "test-store-many",);
    await setMany([["a", 1,], ["b", 2,], ["c", 3,],], store,);

    const res = await getMany(["a", "b", "c", "d",], store,);
    assertEquals(res, [1, 2, 3, undefined,],);
  });

  it("should atomically update a value", async () => {
    const store = createStore("test-db-update", "test-store-update",);
    await set("count", 10, store,);
    await update<number>("count", (old,) => (old ?? 0) + 5, store,);

    const val = await get<number>("count", store,);
    assertEquals(val, 15,);
  });

  it("should update a missing value gracefully", async () => {
    const store = createStore("test-db-update-missing", "test-store-update",);
    await update<number>("counter", (old,) => (old ?? 0) + 1, store,);

    const val = await get<number>("counter", store,);
    assertEquals(val, 1,);
  });

  it("should delete a key using del", async () => {
    const store = createStore("test-db-del", "test-store-del",);
    await set("temp", "value", store,);
    assertEquals(await get("temp", store,), "value",);

    await del("temp", store,);
    assertEquals(await get("temp", store,), undefined,);
  });

  it("should delete multiple keys with delMany", async () => {
    const store = createStore("test-db-delmany", "test-store-delmany",);
    await setMany([["k1", 1,], ["k2", 2,], ["k3", 3,],], store,);

    await delMany(["k1", "k2",], store,);
    assertEquals(await get("k1", store,), undefined,);
    assertEquals(await get("k2", store,), undefined,);
    assertEquals(await get<number>("k3", store,), 3,);
  });

  it("should list keys, values, and entries", async () => {
    const store = createStore("test-db-iter", "test-store-iter",);
    await set("x", 100, store,);
    await set("y", 200, store,);

    const k = await keys(store,);
    assertEquals(k.sort(), ["x", "y",],);

    const v = await values<number>(store,);
    assertEquals(v.sort(), [100, 200,],);

    const e = await entries(store,);
    assertEquals(
      e.sort((a, b,) => String(a[0],).localeCompare(String(b[0],),)),
      [["x", 100,], ["y", 200,],],
    );
  });

  it("should clear the store", async () => {
    const store = createStore("test-db-clear", "test-store-clear",);
    await setMany([["x", 1,], ["y", 2,],], store,);
    await clear(store,);

    const allKeys = await keys(store,);
    assertEquals(allKeys.length, 0,);
  });

  it("promisifyRequest resolves correctly for standard request", async () => {
    const openReq = indexedDB.open("test-promisify", 1,);
    const db = await promisifyRequest<IDBDatabase>(openReq,);
    assertEquals(typeof db.name, "string",);
    db.close();
  });
});
