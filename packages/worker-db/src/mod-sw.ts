/**
 * @module @vanaware/workerdb/sw
 * @description Service Worker and Web Worker direct entry point for WorkerDB.
 * Provides direct, in-process asynchronous IndexedDB and OPFS APIs without secondary worker spawning.
 *
 * @example
 * ```ts
 * import { db, opfs } from "@vanaware/workerdb/sw";
 *
 * const cacheDb = db("sw-cache", "offline-data");
 * await cacheDb.set("page-1", { html: "<h1>Cached</h1>" });
 * ```
 */

export { db, opfs } from "./db.ts";
export { gerarId, gerarIdComPrefixo, validarId } from "./utils/id.ts";
export { APP_VERSION as version } from "./utils/version.ts";
export type {
  DbStoreOptions,
  IndexQuery,
  IndexRange,
  OpfsFileInfo,
  OpfsStoreOptions,
  WorkerDbAPI,
  WorkerOpfsAPI,
} from "./db.ts";
export type { WithId } from "./utils/id.ts";
