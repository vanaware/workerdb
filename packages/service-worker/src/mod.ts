// packages/service-worker/src/mod.ts
/**
 * @module @vanaware/opfs-explorer
 * @description Lightweight Service Worker middleware and UI Explorer for the Origin Private File System (OPFS).
 *
 * Provides instant browser-based directory navigation, file inspections, and stream downloading for OPFS files directly inside your Service Worker.
 *
 * @example Simple usage in Service Worker
 * ```ts
 * import { handleOpfsRequest } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", async (event) => {
 *   const { matched, response } = await handleOpfsRequest(event.request, {
 *     routePrefix: "/opfs",
 *   });
 *   if (matched && response) {
 *     event.respondWith(response);
 *   }
 * });
 * ```
 */

export {
  createOpfsFetchHandler,
  getFileFromOpfs,
  getMimeType,
  handleOpfsRequest,
  listOpfsFiles,
  renderDirectoryHtml,
} from "./explorer.ts";

export type { OpfsExplorerOptions, OpfsExplorerResponse, } from "./explorer.ts";
