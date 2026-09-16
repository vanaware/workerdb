/**
 * @workerdb/tests/integration/core_isolation_test.ts
 *
 * Valida a regra de isolamento do Core (ADR 001):
 * O Core não pode importar DOM, Preact, BeerCSS, IndexedDB, OPFS,
 * window, document, navigator, localStorage.
 *
 * Esta é uma verificação estática: analisa o código-fonte do Core
 * em busca de importações e referências proibidas.
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { join, resolve, } from "@std/path";
import { walkSync, } from "@std/fs";

const ROOT = resolve(Deno.cwd(),);
const CORE_DIR = join(ROOT, "packages", "core", "src",);

const FORBIDDEN_IMPORTS = [
  "preact",
  "beercss",
  "idb-keyval",
  "@workerdb/storage",
  "@workerdb/ui",
];

const FORBIDDEN_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "indexedDB",
  "self",
];

function getCoreSourceFiles(): string[] {
  const files: string[] = [];
  for (const entry of walkSync(CORE_DIR, { exts: [".ts", ".tsx",], },)) {
    files.push(entry.path,);
  }
  return files;
}

function checkForbiddenPatterns(
  content: string,
  patterns: string[],
): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    // Procura por `import ... from "pattern"` ou `require("pattern")` ou `import "pattern"`
    const importRegex = new RegExp(
      `import\\b[^'";]*['"]${
        pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&",)
      }['"]`,
      "i",
    );
    const requireRegex = new RegExp(
      `require\\s*\\(\\s*['"]${
        pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&",)
      }['"]\\s*\\)`,
      "i",
    );
    if (importRegex.test(content,) || requireRegex.test(content,)) {
      found.push(pattern,);
    }
  }
  return found;
}

function checkForbiddenGlobals(content: string, globals: string[],): string[] {
  const found: string[] = [];
  for (const global of globals) {
    // Procura por uso como `window.x`, `document.x`, etc.
    const globalRegex = new RegExp(
      `\\b${global.replace(/[.*+?^${}()|[\]\\]/g, "\\$&",)}\\b`,
    );
    if (globalRegex.test(content,)) {
      found.push(global,);
    }
  }
  return found;
}

describe("core_isolation", () => {
  const files = getCoreSourceFiles();

  it("deve ter pelo menos um arquivo de fonte no Core", () => {
    assert(
      files.length > 0,
      `Core deve ter ao menos um arquivo .ts/.tsx em src/`,
    );
  });

  it("Core não deve importar dependências proibidas", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = Deno.readTextFileSync(file,);
      const found = checkForbiddenPatterns(content, FORBIDDEN_IMPORTS,);
      for (const f of found) {
        violations.push(`${file}: importação proibida de "${f}"`,);
      }
    }
    assertEquals(
      violations.length,
      0,
      `Core violou regra de isolamento:\n${violations.join("\n",)}`,
    );
  });

  it("Core não deve usar globals do navegador", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = Deno.readTextFileSync(file,);
      const found = checkForbiddenGlobals(content, FORBIDDEN_GLOBALS,);
      for (const f of found) {
        violations.push(`${file}: uso proibido de global "${f}"`,);
      }
    }
    assertEquals(
      violations.length,
      0,
      `Core violou regra de isolamento de globals:\n${violations.join("\n",)}`,
    );
  });
});
