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
  it("deve ser possível carregar o módulo core", async () => {
    const coreMod = await import(join(ROOT, "packages/core/src/mod.ts",));
    assert(
      typeof coreMod.CORE_VERSION === "string",
      "core deve exportar CORE_VERSION",
    );
  });

  it("deve ser possível carregar o módulo parser", async () => {
    const parserMod = await import(join(ROOT, "packages/parser/src/mod.ts",));
    assert(
      typeof parserMod.PARSER_VERSION === "string",
      "parser deve exportar PARSER_VERSION",
    );
  });

  it("deve ser possível carregar o módulo report", async () => {
    const reportMod = await import(join(ROOT, "packages/report/src/mod.ts",));
    assert(
      typeof reportMod.REPORT_VERSION === "string",
      "report deve exportar REPORT_VERSION",
    );
  });

  it("deve ser possível carregar o módulo storage", async () => {
    const storageMod = await import(join(ROOT, "packages/storage/src/mod.ts",));
    assert(
      typeof storageMod.STORAGE_VERSION === "string",
      "storage deve exportar STORAGE_VERSION",
    );
  });

  it("deve ser possível carregar os novos pacotes language, richtext, markdown", async () => {
    const languageMod = await import(join(ROOT, "packages/language/mod.ts",));
    const richtextMod = await import(join(ROOT, "packages/richtext/mod.ts",));
    const markdownMod = await import(join(ROOT, "packages/markdown/mod.ts",));
    assert(typeof languageMod === "object",);
    assert(typeof richtextMod === "object",);
    assert(typeof markdownMod === "object",);
  });
});
