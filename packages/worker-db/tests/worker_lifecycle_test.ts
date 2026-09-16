import { assertEquals, } from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";

const isFake = true;

Deno.test({
  name:
    "LIFECYCLE - Inicialização, Terminação, Restart e Persistência do Worker",
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

    // O restart vai recriar o Worker utilizando o último caminho válido
    // (que é o fake-db.ts garantido pelo nosso fake-mod.ts)
    db.restart();

    if (!isFake) {
      // Lógica isolada para cenários não-falsos, caso necessário
    }

    await store.patch<Record<string, unknown>>("status", {
      phase: "restarted",
    },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(
      result?.phase,
      "restarted",
      "Worker recriado pelo restart() falhou",
    );

    db.terminate();
  },
},);

Deno.test({
  name:
    "LIFECYCLE - Comportamento com requisições disparadas imediatamente após restart",
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
