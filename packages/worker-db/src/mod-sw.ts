// ## Arquivo: monorepo/worker-db/src/mod.ts

export { db, opfs, } from "./db.ts";
export { gerarId, gerarIdComPrefixo, validarId, } from "./utils/id.ts";
export type { DbStoreOptions, OpfsFileInfo, OpfsStoreOptions, } from "./db.ts";
export type { WithId, } from "./utils/id.ts";
