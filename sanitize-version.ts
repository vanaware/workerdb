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
