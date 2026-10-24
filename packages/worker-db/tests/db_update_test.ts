import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { db, } from "../src/fake/fake-mod.ts";
import type { WithId, } from "../src/utils/id.ts";

interface Task {
  [key: string]: unknown;
  _id?: string;
  title: string;
  done: boolean;
  priority: number;
}

describe("DB – update method", () => {
  const store = db<Task>({
    dbName: "UPDATE_TEST_DB",
    storeName: "tasks",
    prefix: "TSK_",
  },);

  it("calls the updater with undefined when the key does not exist", async () => {
    await store.clear();

    // Use an object wrapper so TypeScript does not narrow the inner value
    // to its initial assignment (callbacks side-effects are not tracked).
    const captured: { arg: WithId<Task> | undefined; called: boolean } = {
      arg: undefined,
      called: false,
    };

    await store.update("missing-key", (val,) => {
      captured.arg = val;
      captured.called = true;
      return { title: "Created fresh", done: false, priority: 1, };
    },);

    assert(captured.called, "updater should have been called",);
    assert(
      captured.arg === undefined,
      "updater should receive undefined for a missing key",
    );

    const saved = await store.get("missing-key",);
    assertEquals(saved?.title, "Created fresh",);
  });

  it("calls the updater with the current record when the key exists", async () => {
    await store.clear();

    await store.set("t1", { title: "Write tests", done: false, priority: 2, },);

    const captured: { arg: WithId<Task> | undefined } = { arg: undefined, };

    await store.update("t1", (val,) => {
      captured.arg = val;
      return { ...val!, done: true, };
    },);

    // The callback ran synchronously; arg must hold the existing record.
    const arg = captured.arg!;
    assert(arg !== undefined, "updater should receive the existing record",);
    assertEquals(arg.title, "Write tests",);
    assertEquals(arg.done, false,);
    assert(
      arg._id !== undefined,
      "_id should be present in the callback argument",
    );

    const updated = await store.get("t1",);
    assertEquals(updated?.done, true,);
    assertEquals(updated?.title, "Write tests",);
  });

  it("persists the new value returned by the updater", async () => {
    await store.clear();

    await store.set("t2", { title: "Draft", done: false, priority: 1, },);

    await store.update("t2", (val,) => ({
      ...val!,
      priority: (val?.priority ?? 0) + 10,
    }),);

    const result = await store.get("t2",);
    assertEquals(result?.priority, 11,);
  });
});

describe("DB – patch with a function argument", () => {
  const store = db<Task>({
    dbName: "PATCH_FN_TEST_DB",
    storeName: "tasks",
    prefix: "PTCH_",
  },);

  it("applies a function patcher to an existing record", async () => {
    await store.clear();

    await store.set("p1", { title: "Review PR", done: false, priority: 3, },);

    const patched = await store.patch<Task>("p1", (prev,) => ({
      ...prev,
      done: !prev.done,
      priority: prev.priority + 1,
    }),);

    assertEquals(patched.done, true,);
    assertEquals(patched.priority, 4,);
    assertEquals(patched.title, "Review PR",);
  });

  it("passes the context argument through to the patcher function", async () => {
    await store.clear();

    await store.set("p2", { title: "Assign", done: false, priority: 0, },);

    const assignee = "Charlie";

    const patched = await store.patch<Task, string>(
      "p2",
      (prev, ctx,) => ({
        ...prev,
        assignee: ctx!,
      }),
      assignee,
    );

    // deno-lint-ignore no-explicit-any
    assertEquals((patched as any).assignee, "Charlie",);
    assertEquals(patched.title, "Assign",);
  });
});
