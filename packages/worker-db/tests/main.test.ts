import { assert, assertEquals, } from "@std/assert";
import { generateId, validateId, } from "../src/utils/id.ts";
import { db, ls, } from "../src/fake/fake-mod.ts";

Deno.test("MAIN - ID utility validation and global integration", () => {
  const id = generateId();
  assert(id.length > 0,);

  const isValid = validateId(id,);
  assertEquals(isValid, true,);

  const dbInstance = db("MAIN_DB", "main",);
  assert(dbInstance !== undefined,);

  const lsInstance = ls("MAIN_LS_",);
  assert(lsInstance !== undefined,);
});
