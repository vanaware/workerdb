// ## Arquivo: monorepo/worker-db/src/mod.ts

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
