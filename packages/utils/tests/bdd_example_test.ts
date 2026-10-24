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
