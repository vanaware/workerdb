/**
 * @workerdb/tests/integration/smoke_test.ts
 *
 * Smoke test: verifica que os pacotes principais são importáveis
 * e que a estrutura básica do workspace está saudável.
 */

import { assert, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { join, resolve, } from "@std/path";

const ROOT = resolve(Deno.cwd(),);

describe("smoke", () => {
  it("deve ser possível carregar o módulo workerdb principal", async () => {
    const dbMod = await import(join(ROOT, "packages/worker-db/src/db.ts",));
    assert(
      typeof dbMod === "object",
      "worker-db/db.ts deve ser carregável",
    );
  });

  it("deve ser possível carregar o utils", async () => {
    const utilsMod = await import(join(ROOT, "packages/utils/src/mod.ts",));
    assert(
      typeof utilsMod === "object",
      "utils/mod.ts deve ser carregável",
    );
  });
});
