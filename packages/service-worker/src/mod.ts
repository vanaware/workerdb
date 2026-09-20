// packages/service-worker/src/mod.ts
/**
 * @module @vanaware/opfs-explorer
 * @description Lightweight Service Worker middleware and UI Explorer for the Origin Private File System (OPFS).
 *
 * Provides instant browser-based directory navigation, file inspections, and stream downloading for OPFS files directly inside your Service Worker.
 *
 * Fully configurable with custom subfolder routes (e.g. `"files"`, `"arquivos"`, `"opfs"`), auto-adapting to any Service Worker scope (including GitHub Pages repositories and subfolder deployments).
 *
 * @example Quick Start — 1-line fetch handler with custom subfolder
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * // Automatically intercepts requests under /files/ or /{repo}/files/
 * self.addEventListener("fetch", createOpfsFetchHandler("files"));
 *
 * // Or in Portuguese:
 * // self.addEventListener("fetch", createOpfsFetchHandler("arquivos"));
 * ```
 *
 * @example Advanced Configuration with Options Object
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", createOpfsFetchHandler({
 *   subfolder: "arquivos",
 *   title: "Meus Arquivos no OPFS",
 *   opfsDir: "backups", // Restrict exploration to a specific OPFS directory
 * }));
 * ```
 *
 * @example Manual Request Handling with `handleOpfsRequest`
 * ```ts
 * import { handleOpfsRequest } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", async (event) => {
 *   const { matched, response } = await handleOpfsRequest(event.request, "files");
 *   if (matched && response) {
 *     event.respondWith(response);
 *   }
 * });
 * ```
 *
 * @example Standalone Programmatic Usage (no Service Worker router needed)
 * ```ts
 * import { listOpfsFiles, getFileFromOpfs } from "@vanaware/opfs-explorer";
 *
 * const files = await listOpfsFiles();
 * console.log("OPFS Files:", files);
 *
 * const file = await getFileFromOpfs("backup/data.json");
 * const data = JSON.parse(await file.text());
 * ```
 */

export {
  createOpfsFetchHandler,
  getEffectiveRootDir,
  getFileFromOpfs,
  getMimeType,
  getScopePath,
  handleOpfsRequest,
  listOpfsFiles,
  normalizeOptions,
  renderDirectoryHtml,
  resolveRoutePrefix,
} from "./explorer.ts";

export type { OpfsExplorerOptions, OpfsExplorerResponse, } from "./explorer.ts";
