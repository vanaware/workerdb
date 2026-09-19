// src/mod-sw.ts

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
