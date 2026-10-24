import { assertEquals, } from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";

const isFake = true;

Deno.test({
  name:
    "LIFECYCLE - Worker initialization, termination, restart and persistence",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_LIFECYCLE_DB", "state", "LC_",);
    await store.clear();

    await store.set("status", { alive: true, phase: "init", },);
    let result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(result?.alive, true,);

    db.terminate();

    await store.set("status", { alive: true, phase: "healed", },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(result?.phase, "healed",);

    // restart() will recreate the Worker using the last valid path
    // (which is fake-db.ts guaranteed by our fake-mod.ts)
    db.restart();

    if (!isFake) {
      // Isolated logic for non-fake scenarios, if needed
    }

    await store.patch<Record<string, unknown>>("status", {
      phase: "restarted",
    },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(
      result?.phase,
      "restarted",
      "Worker recreated by restart() failed",
    );

    db.terminate();
  },
},);

Deno.test({
  name:
    "LIFECYCLE - Behavior when requests are fired immediately after restart",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_LIFECYCLE_DB", "stress", "STRESS_",);

    db.restart();

    await store.set("k1", { val: 1, },);
    await store.set("k2", { val: 2, },);

    const keys = await store.keys();
    assertEquals(keys.length, 2,);

    await store.clear();
    db.terminate();
  },
},);
