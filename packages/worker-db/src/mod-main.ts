/**
 * @module @vanaware/workerdb
 * @description Main Thread entry point for WorkerDB.
 * Provides asynchronous IndexedDB and OPFS file system APIs with non-blocking Web Worker execution,
 * along with synchronous LocalStorage support and unique ID generation utilities.
 *
 * @example
 * ```ts
 * import { db, opfs, ls } from "@vanaware/workerdb";
 *
 * // Scoped IndexedDB store running in Web Worker
 * const users = db("my-app", "users", "usr_");
 * await users.set("1", { name: "Alice", email: "alice@example.com" });
 * const user = await users.get("1");
 * ```
 */

export { ls } from "./ls.ts";
export type { WorkerLsAPI } from "./ls.ts";
export { db as dbsw, opfs as opfssw } from "./db.ts";
export { db, opfs } from "./rpc.ts";
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
