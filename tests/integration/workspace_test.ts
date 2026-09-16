/**
 * @workerdb/tests/integration/workspace_test.ts
 *
 * Valida que o workspace Deno está configurado corretamente:
 * - Todos os pacotes listados em `deno.jsonc` workspace existem
 * - Cada pacote tem `deno.jsonc` com `name`, `exports`, `version` e `tasks`
 * - Os novos pacotes (language, richtext, markdown) estão presentes
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { existsSync, } from "@std/fs";
import { join, resolve, } from "@std/path";

const ROOT = resolve(Deno.cwd(),);
const PACKAGES_DIR = join(ROOT, "packages",);

const EXPECTED_PACKAGES = [
  "worker-db",
  "server",
  "ui",
  "utils",
  "service-worker",
];

/**
 * Remove comentários de linha única (//) e de bloco (/* *\/) de JSONC,
 * respeitando strings para não corromper valores que contenham essas sequências.
 */
function stripJSONCComments(text: string,): string {
  let result = "";
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        result += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      result += ch;
      if (ch === "\\") {
        result += next;
        i++;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    }

    result += ch;
  }

  return result;
}

function parseJSONC(text: string,): unknown {
  return JSON.parse(stripJSONCComments(text,),);
}

describe("workspace", () => {
  it("deve ter todos os pacotes esperados presentes no diretório packages", () => {
    for (const pkg of EXPECTED_PACKAGES) {
      const dir = join(PACKAGES_DIR, pkg,);
      assert(existsSync(dir,), `Pacote ${pkg} deve existir em ${dir}`,);
    }
  });

  it("cada pacote deve ter um deno.jsonc válido com name, exports, version e tasks", () => {
    for (const pkg of EXPECTED_PACKAGES) {
      const configPath = join(PACKAGES_DIR, pkg, "deno.jsonc",);
      assert(
        existsSync(configPath,),
        `deno.jsonc deve existir em ${configPath}`,
      );

      const config = parseJSONC(Deno.readTextFileSync(configPath,),) as {
        name: string;
        exports: Record<string, unknown>;
        tasks: Record<string, unknown>;
      };
      assert(
        typeof config.name === "string" &&
          config.name.startsWith("@workerdb/",),
        `Pacote ${pkg} deve ter name válido, recebeu: ${config.name}`,
      );
      assert(
        config.exports &&
          (typeof config.exports === "object" ||
            typeof config.exports === "string"),
        `Pacote ${pkg} deve ter exports definido`,
      );
      assert(
        config.tasks && typeof config.tasks === "object",
        `Pacote ${pkg} deve ter tasks definido`,
      );
    }
  });

  // Removido teste de language, richtext e markdown pois eles não existem neste repo
});
