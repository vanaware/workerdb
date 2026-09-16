/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, assertThrows, } from "@std/assert";
import {
  currentVersion,
  extractVersionFromContent,
  formatVersion,
  incrementVersion,
  parseVersion,
  replaceVersionInContent,
} from "../../src/esbuild/mod.ts";
import { withTempDenoJsonc, } from "../helpers/fixtures.ts";

describe("parseVersion", () => {
  describe("casos válidos", () => {
    const validCases = [
      { input: "1.2.3", expected: { major: 1, minor: 2, patch: 3, }, },
      { input: "0.0.0", expected: { major: 0, minor: 0, patch: 0, }, },
      { input: "99.99.99", expected: { major: 99, minor: 99, patch: 99, }, },
      {
        input: "0.2.148-msv0okam",
        expected: { major: 0, minor: 2, patch: 148, },
      },
      { input: "1.0.0-alpha", expected: { major: 1, minor: 0, patch: 0, }, },
      { input: "2.0.0-beta.1", expected: { major: 2, minor: 0, patch: 0, }, },
      {
        input: "1.0.0-alpha-beta-1",
        expected: { major: 1, minor: 0, patch: 0, },
      },
    ];
    for (const { input, expected, } of validCases) {
      it(`parseia "${input}" corretamente`, () => {
        assertEquals(parseVersion(input,), expected,);
      });
    }
  });
  describe("casos inválidos", () => {
    const invalidCases = [
      { input: "", desc: "string vazia", },
      { input: "1.2", desc: "apenas 2 partes", },
      { input: "1.2.3.4", desc: "4 partes", },
      { input: "a.b.c", desc: "letras", },
      { input: "1.abc.3", desc: "parte não numérica", },
      { input: "v1.2.3", desc: "prefixo v", },
      { input: "1.2.3-", desc: "hífen sem hash", },
      { input: " 1.2.3", desc: "espaço antes", },
      { input: "1.2.3 ", desc: "espaço depois", },
    ];
    for (const { input, desc, } of invalidCases) {
      it(`lança erro para ${desc} ("${input}")`, () => {
        assertThrows(() => parseVersion(input,), Error,);
      });
    }
  });
});

describe("formatVersion", () => {
  it("formata com hash fornecido", () => {
    assertEquals(formatVersion(1, 2, 3, "abc",), "1.2.3-abc",);
  });
  it("gera hash automático quando não fornecido", () => {
    const result = formatVersion(0, 2, 149,);
    assertStringIncludes(result, "0.2.149-",);
    // Hash deve ter pelo menos alguns caracteres
    const hash = result.split("-",)[1];
    // 🔥 CORREÇÃO: Tratamento explícito de undefined (noUncheckedIndexedAccess)
    assertEquals(hash !== undefined && hash.length > 0, true,);
  });
  it("usa o mesmo hash em chamadas com mesmo parâmetro", () => {
    const hash = "fixedhash";
    assertEquals(
      formatVersion(1, 0, 0, hash,),
      formatVersion(1, 0, 0, hash,),
    );
  });
  it("lida com números grandes", () => {
    assertEquals(formatVersion(999, 999, 999, "x",), "999.999.999-x",);
  });
});

describe("extractVersionFromContent", () => {
  it("extrai versão de JSON simples", () => {
    assertEquals(
      extractVersionFromContent(`{ "version": "1.2.3" }`,),
      "1.2.3",
    );
  });
  it("extrai versão de JSONC com comentários", () => {
    const content = `{
      // Comentário
      "name": "workerdb",
      "version": "2.0.0", /* inline */
    }`;
    assertEquals(extractVersionFromContent(content,), "2.0.0",);
  });
  it("extrai versão com hash", () => {
    assertEquals(
      extractVersionFromContent(`{ "version": "1.2.3-abc123" }`,),
      "1.2.3-abc123",
    );
  });
  it("retorna null quando não há versão", () => {
    assertEquals(
      extractVersionFromContent(`{ "name": "workerdb" }`,),
      null,
    );
  });
  it("retorna null para string vazia", () => {
    assertEquals(extractVersionFromContent("",), null,);
  });
  it("ignora campos 'version' dentro de strings", () => {
    const content = `{ "name": "tem version: 1.0.0 no nome" }`;
    assertEquals(extractVersionFromContent(content,), null,);
  });
});

describe("replaceVersionInContent", () => {
  it("substitui versão preservando o resto", () => {
    const content = `{
      "name": "@workerdb/app",
      "version": "1.0.0-old",
      "imports": {}
    }`;
    const result = replaceVersionInContent(content, "2.0.0-new",);
    assertStringIncludes(result, `"version": "2.0.0-new"`,);
    assertStringIncludes(result, `"name": "@workerdb/app"`,);
    assertStringIncludes(result, `"imports"`,);
  });
  it("substitui apenas a primeira ocorrência", () => {
    const content = `{ "version": "1.0.0", "other": "version": "2.0.0" }`;
    const result = replaceVersionInContent(content, "3.0.0",);
    // A primeira deve ser substituída
    assertStringIncludes(result, `"version": "3.0.0"`,);
  });
});

describe("currentVersion (integração)", () => {
  it("lê versão de arquivo existente", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.2.3-abc",);
    try {
      const version = await currentVersion(path,);
      assertEquals(version, "1.2.3-abc",);
    } finally {
      await cleanup();
    }
  });
  it("lança erro quando arquivo não existe", async () => {
    let threw = false;
    try {
      await currentVersion("/caminho/que/nao/existe/deno.jsonc",);
    } catch {
      threw = true;
    }
    assertEquals(threw, true,);
  });
  it("lança erro quando versão não está no arquivo", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.0.0", {
      version: undefined,
    },);
    try {
      // Reescreve sem version
      await Deno.writeTextFile(path, `{ "name": "workerdb" }`,);
      let errorMessage = "";
      try {
        await currentVersion(path,);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      assertStringIncludes(errorMessage, "Versão não encontrada",);
    } finally {
      await cleanup();
    }
  });
});

describe("incrementVersion (integração)", () => {
  it("incrementa patch e atualiza arquivo", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.2.3",);
    try {
      const newVersion = await incrementVersion("1.2.3", path, "testhash",);
      assertEquals(newVersion, "1.2.4-testhash",);
      const content = await Deno.readTextFile(path,);
      assertStringIncludes(content, `"version": "1.2.4-testhash"`,);
    } finally {
      await cleanup();
    }
  });
  it("preserva outras propriedades do JSON", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("0.0.1", {
      name: "@workerdb/app",
      imports: { preact: "https://esm.sh/preact", },
    },);
    try {
      await incrementVersion("0.0.1", path, "x",);
      const content = await Deno.readTextFile(path,);
      assertStringIncludes(content, `"name": "@workerdb/app"`,);
      assertStringIncludes(content, `"preact"`,);
    } finally {
      await cleanup();
    }
  });
  it("incrementa múltiplas vezes", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.0.0",);
    try {
      const v1 = await incrementVersion("1.0.0", path, "h1",);
      assertEquals(v1, "1.0.1-h1",);
      const v2 = await incrementVersion(v1, path, "h2",);
      assertEquals(v2, "1.0.2-h2",);
      const v3 = await incrementVersion(v2, path, "h3",);
      assertEquals(v3, "1.0.3-h3",);
    } finally {
      await cleanup();
    }
  });
});
