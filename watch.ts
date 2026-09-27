/**
 * BuildIt Watch CLI Entry Point.
 * Delegado para o utilitário @vanaware/buildit.
 */
import { watchCli } from "@vanaware/buildit/cli/watch";

if (import.meta.main) {
  await watchCli().parse(Deno.args);
}
