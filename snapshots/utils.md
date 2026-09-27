> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém o código e testes da biblioteca @workerdb/utils
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: UTILS

Gerado automaticamente em: 2026-09-27T14:57:48.262Z

---

## Arquivo: `packages/utils/README.md`

```md

```

---

## Arquivo: `packages/utils/deno.jsonc`

```json
{
  "name": "@workerdb/utils",
  "publish": false,
  "compilerOptions": {
    "lib": [
      "deno.window"
    ]
  },
  "imports": {},
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read --allow-write tests/",
    "check": "deno check src/**/*.{ts,tsx} tests/**/*.ts",
    "tests": "deno task check && deno task test"
  },
  "exports": {
    ".": "./src/mod.ts"
  }
}

```

---

## Arquivo: `packages/utils/src/config/mod.ts`

```ts
export { APP_VERSION, } from "../../../worker-db/src/utils/version.ts";

```

---

## Arquivo: `packages/utils/src/mod.ts`

```ts
/**
 * @workerdb/utils
 * Entry point for shared utilities.
 */

export * from "./config/mod.ts";

```

---

## Arquivo: `packages/utils/tests/bdd_example_test.ts`

```ts
/**
 * @workerdb/packages/utils/tests/bdd_example_test.ts
 *
 * Exemplo de uso do estilo BDD (describe/it) com @std/testing/bdd,
 * conforme definido na ADR 008.
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";

describe("bdd_example", () => {
  it("deve passar com uma afirmação simples", () => {
    assertEquals(1 + 1, 2,);
  });

  it("deve falhar corretamente quando a condição não é atendida", () => {
    // Este teste demonstra que o framework BDD funciona conforme esperado.
    const value = "workerdb";
    assert(value.length > 0,);
  });
});

```

---

## Arquivo: `sanitize-version.ts`

```ts
/// <reference lib="deno.ns" />

/**
 * @file sanitize-version.ts
 * @description CLI de sanitização de versão semântica do deno.json[c].
 * Normaliza o campo "version" para o formato estrito semver (MAJOR.MINOR.PATCH).
 */

import { sanitizeVersionCli, } from "@vanaware/buildit/cli/sanitize-version";

if (import.meta.main) {
  const cli = sanitizeVersionCli();
  await cli.parse(Deno.args,);
}

```

---

## Arquivo: `tag-version.ts`

```ts
/// <reference lib="deno.ns" />

/**
 * @file tag-version.ts
 * @description CLI para criação e publicação de tag git baseada na versão do deno.json[c].
 * Gera tags no formato vMAJOR.MINOR e publica no repositório remoto.
 */

import { tagVersionCli, }  from "@vanaware/buildit/cli/tag-version";

if (import.meta.main) {
  const cli = tagVersionCli();
  await cli.parse(Deno.args,);
}

```

---

