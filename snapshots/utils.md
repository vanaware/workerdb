> **AI INSTRUCTION:** 
> O texto abaixo contém o código e testes da biblioteca @workerdb/utils
> Each file starts with a title indicating its exact relative path (e.g., `## File: src/main.ts`).
> Whenever suggesting changes, clearly indicate which file should be modified based on these paths and provide the complete new code for the file.

---

# Exported Context from Project WorkerDB - Mode: UTILS

Automatically generated at: 2026-10-24T20:59:04.242Z

---

## File: `packages/utils/README.md`

```md

```

---

## File: `packages/utils/deno.jsonc`

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

## File: `packages/utils/src/config/mod.ts`

```ts
export { APP_VERSION, } from "../../../worker-db/src/utils/version.ts";

```

---

## File: `packages/utils/src/mod.ts`

```ts
/**
 * @workerdb/utils
 * Entry point for shared utilities.
 */

export * from "./config/mod.ts";

```

---

## File: `packages/utils/tests/bdd_example_test.ts`

```ts
/**
 * @workerdb/packages/utils/tests/bdd_example_test.ts
 *
 * Example of the BDD style (describe/it) using @std/testing/bdd,
 * as defined in ADR 008.
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";

describe("bdd_example", () => {
  it("should pass with a simple assertion", () => {
    assertEquals(1 + 1, 2,);
  });

  it("should fail correctly when the condition is not met", () => {
    // This test demonstrates that the BDD framework works as expected.
    const value = "workerdb";
    assert(value.length > 0,);
  });
});

```

---

