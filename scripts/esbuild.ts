/// <reference lib="deno.ns" />

/**
 * @file esbuild.ts
 * @description CLI do orquestrador de build baseado em esbuild nativo.
 * Delega a execução para a biblioteca @vanaware/buildit
 * e carrega as configurações declarativas de esbuild.jsonc.
 */

import { esBuildCli, } from "@vanaware/buildit/cli/esbuild";

if (import.meta.main) {
  const cli = esBuildCli();
  await cli.parse(Deno.args,);
}
