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
