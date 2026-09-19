// ## Arquivo: monorepo/worker-db/src/db-sw.ts
// ⚠️ MÓDULO CENTRAL DO BANCO DE DADOS: Ponto único de verdade para manipulação do IDB e OPFS.
import {
  clear,
  createStore,
  del,
  delMany,
  entries,
  get,
  getMany,
  keys,
  set,
  setMany,
  type UseStore,
  values,
} from "idb-keyval";
import { unzipSync, zipSync, } from "fflate";

import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from "./utils/id.ts";

// ============================================================================
// DEFINIÇÕES DE TIPOS (Single Source of Truth)
// ============================================================================
/**
 * Opções de configuração para o Object Store do IndexedDB.
 */
export interface DbStoreOptions {
  /** Nome do banco de dados IndexedDB. */
  dbName?: string;
  /** Nome do object store dentro do banco. */
  storeName?: string;
  /** Prefixo opcional para isolamento de chaves nesta instância. */
  prefix?: string;
  /** Lista de nomes de campos a serem indexados. */
  indexes?: string[];
  /** Versão do banco de dados (incremental). */
  dbVersion?: number;
  /** Representação em string da função de validação (usada em RPC). */
  validatorStr?: string;
  /** Função de validação opcional para os dados gravados. */
  validator?: (val: unknown) => boolean;
}

/**
 * Opções estendidas para armazenamento em OPFS.
 */
export interface OpfsStoreOptions extends DbStoreOptions {
  /** Caminho base (diretório raiz) no OPFS. */
  basePath?: string;
}

/**
 * Metadados de um arquivo no OPFS.
 */
export interface OpfsFileInfo {
  /** Nome do arquivo. */
  name: string;
  /** Tamanho em bytes. */
  size: number;
  /** MIME type do arquivo. */
  type: string;
  /** Timestamp da última modificação. */
  lastModified: number;
}

/**
 * Range de consulta para índices.
 */
export interface IndexRange {
  /** Valor exato. */
  eq?: IDBValidKey;
  /** Maior que. */
  gt?: IDBValidKey;
  /** Maior ou igual a. */
  gte?: IDBValidKey;
  /** Menor que. */
  lt?: IDBValidKey;
  /** Menor ou igual a. */
  lte?: IDBValidKey;
}

export type IndexQuery = IDBValidKey | IDBKeyRange | IndexRange;

/**
 * Interface principal para operações de banco de dados (IndexedDB).
 * @template TDefault Tipo padrão para os registros.
 */
export interface WorkerDbAPI<TDefault = unknown> {
  get: <T = TDefault>(key: string, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;
  set: <T = TDefault>(keyOrVal: string | T, val?: T | DbStoreOptions, opts?: DbStoreOptions) => Promise<string>;
  update: <T = TDefault>(key: string, updater: (val: WithId<T> | undefined) => T, opts?: DbStoreOptions) => Promise<void>;
  patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions
  ) => Promise<WithId<T>>;
  delete: (key: string, opts?: DbStoreOptions) => Promise<void>;
  getMany: <T = TDefault>(keysList: string[], opts?: DbStoreOptions) => Promise<(WithId<T> | undefined)[]>;
  setMany: (entriesList: [string, unknown][], opts?: DbStoreOptions) => Promise<void>;
  deleteMany: (keysList: string[], opts?: DbStoreOptions) => Promise<void>;
  keys: (opts?: DbStoreOptions) => Promise<string[]>;
  values: <T = TDefault>(opts?: DbStoreOptions) => Promise<T[]>;
  entries: <T = TDefault>(opts?: DbStoreOptions) => Promise<[string, T][]>;
  clear: (opts?: DbStoreOptions) => Promise<void>;
  countByIndex: (indexName: string, query?: IndexQuery, opts?: DbStoreOptions) => Promise<number>;
  getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;
  keysByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<string[]>;
  patchByIndex: <T = TDefault>(indexName: string, query: IndexQuery, patch: Partial<T>, opts?: DbStoreOptions) => Promise<void>;
  getByIndexPaginated: <T = TDefault>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions
  ) => Promise<{ items: WithId<T>[]; nextCursor?: string }>;
  getByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  getManyByIndex: <T = TDefault>(indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  getSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  queryByIndex: <T = TDefault, R = unknown, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;
  deleteByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<void>;
  deleteManyByIndex: (indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<void>;
  delSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;
  setSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;
  query: <T = TDefault, R = unknown, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;
  getSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  delSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;
  setSome: <T = TDefault, C = unknown>(selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;
  exportDB: (opts?: DbStoreOptions) => Promise<Record<string, unknown>>;
  importDB: (data: Record<string, unknown>, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;
  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions) => Promise<string>;
  restoreFromOpfs: (key: string, fileName: string, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;
  init: (workerPath?: string | URL) => void;
  restart: () => void;
  terminate: () => void;
  gerarId: () => string;
  gerarIdComPrefixo: (prefix?: string) => string;
}

/**
 * Interface estendida para operações de sistema de arquivos (OPFS).
 * @template TDefault Tipo padrão para os registros.
 */
export interface WorkerOpfsAPI<TDefault = unknown> extends WorkerDbAPI<TDefault> {
  listFiles: (key: string, opts?: OpfsStoreOptions) => Promise<OpfsFileInfo[]>;
  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<File>;
  getFileStream: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<ReadableStream<Uint8Array>>;
  addFile: (key: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  addFileStream: (key: string, streamOrFileName: ReadableStream<Uint8Array> | string, fileNameOrStream: string | ReadableStream<Uint8Array>, opts?: OpfsStoreOptions) => Promise<void>;
  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  renFile: (key: string, oldName: string, newName: string, opts?: OpfsStoreOptions) => Promise<void>;
  mvFile: (key: string, fileName: string, newKey: string, opts?: OpfsStoreOptions) => Promise<void>;
  zip: (key: string, zipName: string, filesToZip?: string[], deleteOriginals?: boolean, opts?: OpfsStoreOptions) => Promise<void>;
  unzip: (key: string, zipName: string, deleteZip?: boolean, opts?: OpfsStoreOptions) => Promise<void>;
  addZip: (key: string, zipName: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  delZip: (key: string, zipName: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
}

export function buildIDBQuery(query: IndexQuery): IDBValidKey | IDBKeyRange {
  if (query == null) throw new Error("Query cannot be null");
  if (
    typeof query !== "object" || query instanceof Date ||
    Array.isArray(query) || query instanceof ArrayBuffer
  ) {
    return query as IDBValidKey;
  }
  if ("lower" in query || "upper" in query) {
    return query as IDBKeyRange;
  }

  const q = query as IndexRange;
  if (q.eq !== undefined) return IDBKeyRange.only(q.eq);
  if (
    (q.gt !== undefined || q.gte !== undefined) &&
    (q.lt !== undefined || q.lte !== undefined)
  ) {
    const lower = q.gt !== undefined ? q.gt : q.gte!;
    const upper = q.lt !== undefined ? q.lt : q.lte!;
    return IDBKeyRange.bound(
      lower,
      upper,
      q.gt !== undefined,
      q.lt !== undefined,
    );
  }
  if (q.gt !== undefined || q.gte !== undefined) {
    return IDBKeyRange.lowerBound(
      q.gt !== undefined ? q.gt : q.gte!,
      q.gt !== undefined,
    );
  }
  if (q.lt !== undefined || q.lte !== undefined) {
    return IDBKeyRange.upperBound(
      q.lt !== undefined ? q.lt : q.lte!,
      q.lt !== undefined,
    );
  }
  return query as unknown as IDBValidKey;
}

// ============================================================================

const storeCache = new Map<string, UseStore>();

function createStoreWithIndexes(dbName: string, storeName: string, indexes?: string[], dbVersion?: number): UseStore {
  const request = indexedDB.open(dbName, dbVersion);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName);
      if (indexes) {
        for (const index of indexes) {
          store.createIndex(index, index);
        }
      }
    } else if (indexes) {
      // If store exists but we requested indexes, try to add them
      const store = request.transaction!.objectStore(storeName);
      for (const index of indexes) {
        if (!store.indexNames.contains(index)) {
          store.createIndex(index, index);
        }
      }
    }
  };
  const dbp = new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return (txMode, callback) =>
    dbp.then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName))
    );
}

function getCustomStore(
  dbName?: string,
  storeName = "keyval",
  indexes?: string[],
  dbVersion?: number
): UseStore | undefined {
  if (!dbName) return undefined;
  // Incorporate version into cache key if provided so it recreates if version changes
  const cacheKey = `${dbName}:${storeName}:${dbVersion || 1}`;
  if (!storeCache.has(cacheKey)) {
    storeCache.set(cacheKey, createStoreWithIndexes(dbName, storeName, indexes, dbVersion));
  }
  return storeCache.get(cacheKey);
}

function formatDbEntries(
  rawEntries: [IDBValidKey, unknown,][],
  prefix?: string,
) {
  let items = rawEntries;
  if (prefix) {
    items = items.filter(([k,],) =>
      typeof k === "string" && k.startsWith(prefix,)
    );
  }
  return items.map(([k, v,],) => formatDbItem(k, v, prefix,));
}

async function getRecordDir(
  basePath = "",
  rawKey: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const fullPath = basePath ? `${basePath}/${rawKey}` : rawKey;
  const parts = fullPath.split("/",).filter(Boolean,);
  let curr = root;
  for (const p of parts) curr = await curr.getDirectoryHandle(p, { create, },);
  return curr;
}

function validateDbItem(
  val: unknown,
  validatorStr?: string,
  validator?: (val: unknown,) => boolean,
) {
  if (val === undefined) return;
  if (validator) {
    if (!validator(val,)) {
      throw new Error(`Validation failed for item: ${JSON.stringify(val,)}`,);
    }
    return;
  }
  if (!validatorStr) return;
  const validatorFn = new Function("val", `return (${validatorStr})(val);`,);
  if (!validatorFn(val,)) {
    throw new Error(`Validation failed for item: ${JSON.stringify(val,)}`,);
  }
}

/**
 * API global para acesso direto ao IndexedDB no Worker.
 */
export const globalSwDbAPI: WorkerDbAPI<unknown> = {
  get: async <T,>(
    key: string,
    opts?: DbStoreOptions,
  ): Promise<WithId<T> | undefined> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const val = await get(rawKey, store,);
    return val !== undefined
      ? formatDbItem(rawKey, val, opts?.prefix,) as WithId<T>
      : undefined;
  },

  set: async <T,>(
    keyOrVal: string | T,
    val?: T | DbStoreOptions,
    opts?: DbStoreOptions,
  ): Promise<string> => {
    let keyToSave: string | undefined;
    let valToSave: unknown;
    let options: DbStoreOptions = opts || {};
    if (typeof keyOrVal !== "string") {
      keyToSave = undefined;
      valToSave = keyOrVal;
      if (val) options = val as DbStoreOptions;
    } else {
      keyToSave = keyOrVal;
      valToSave = val;
    }
    const store = getCustomStore(options.dbName, options.storeName, options.indexes, options.dbVersion);
    const { key, cleanVal, } = prepareForSave(
      keyToSave,
      valToSave,
      options.prefix,
    );
    validateDbItem(cleanVal, options.validatorStr, options.validator,);
    await set(key, cleanVal, store,);
    return key;
  },

  update: async <T,>(
    key: string,
    updater: (val: WithId<T> | undefined,) => T,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const currentVal = await globalSwDbAPI.get<T>(key, opts,);
    const newVal = updater(currentVal,);
    await globalSwDbAPI.set(key, newVal, opts,);
  },

  patch: async <T extends Record<string, unknown>, C = unknown,>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const current = (await get(rawKey, store,)) || {};

    let updated: unknown;
    if (typeof patchOrFn === "function") {
      updated = patchOrFn(
        formatDbItem(rawKey, current, opts?.prefix,) as WithId<T>,
        context,
      );
    } else {
      updated = Object.assign({}, current, patchOrFn,);
    }
    const { key: finalKey, cleanVal, } = prepareForSave(
      rawKey,
      updated,
      opts?.prefix,
    );
    validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
    await set(finalKey, cleanVal, store,);
    return formatDbItem(finalKey, cleanVal, opts?.prefix,) as WithId<T>;
  },

  delete: async (key: string, opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    await del(rawKey, store,);
  },

  getMany: async <T,>(
    keysList: string[],
    opts?: DbStoreOptions,
  ): Promise<(WithId<T> | undefined)[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const fullKeys = keysList.map((k,) =>
      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k
    );
    const rawValues = await getMany(fullKeys, store,);
    return rawValues.map((val, idx,) =>
      val !== undefined
        ? formatDbItem(fullKeys[idx]!, val, opts?.prefix,) as WithId<T>
        : undefined
    );
  },

  setMany: async (
    entriesList: [string, unknown,][],
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const entriesToSet: [string, unknown,][] = entriesList.map(([k, v,],) => {
      const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
      validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
      return [key, cleanVal,];
    },);
    await setMany(entriesToSet, store,);
  },

  deleteMany: async (
    keysList: string[],
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const fullKeys = keysList.map((k,) =>
      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k
    );
    await delMany(fullKeys, store,);
  },

  keys: async (opts?: DbStoreOptions,): Promise<string[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allKeys = await keys(store,);
    return opts?.prefix
      ? allKeys.filter((k,) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      ) as string[]
      : allKeys as string[];
  },

  values: async <T,>(opts?: DbStoreOptions,): Promise<T[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    return formatDbEntries(allEntries, opts?.prefix,) as unknown as T[];
  },

  entries: async <T,>(opts?: DbStoreOptions,): Promise<[string, T,][]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    return opts?.prefix
      ? allEntries.filter(([k,],) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      ) as [
        string,
        T,
      ][]
      : allEntries as [string, T,][];
  },

  clear: async (opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    if (opts?.prefix) {
      const allKeys = await keys(store,);
      const keysToDelete = allKeys.filter((k,) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      );
      await delMany(keysToDelete, store,);
    } else {
      await clear(store,);
    }
  },

  countByIndex: async (
    indexName: string,
    query?: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<number> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
      return new Promise<number>((resolve, reject) => {
        try {
          const index = idbStore.index(indexName);
          const req = query !== undefined ? index.count(buildIDBQuery(query)) : index.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  getOneByIndex: async <T>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<WithId<T> | undefined> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
      return new Promise<WithId<T> | undefined>((resolve, reject) => {
        try {
          const index = idbStore.index(indexName);
          const idbQuery = buildIDBQuery(query);
          const req = index.get(idbQuery);
          const keyReq = index.getKey(idbQuery);
          
          let val: unknown | undefined = undefined;
          let key: IDBValidKey | undefined = undefined;
          let valDone = false;
          let keyDone = false;

          const checkDone = () => {
             if (valDone && keyDone) {
                if (val !== undefined && key !== undefined) {
                   resolve(formatDbItem(String(key), val, opts?.prefix) as WithId<T>);
                } else {
                   resolve(undefined);
                }
             }
          };

          req.onsuccess = () => {
            val = req.result;
            valDone = true;
            checkDone();
          };
          req.onerror = () => reject(req.error);

          keyReq.onsuccess = () => {
            key = keyReq.result;
            keyDone = true;
            checkDone();
          };
          keyReq.onerror = () => reject(keyReq.error);
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  keysByIndex: async (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<string[]> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
       return new Promise<string[]>((resolve, reject) => {
          try {
             const index = idbStore.index(indexName);
             const req = index.getAllKeys(buildIDBQuery(query));
             req.onsuccess = () => {
                const keys = req.result.map(k => String(k));
                resolve(keys);
             };
             req.onerror = () => reject(req.error);
          } catch(err) {
             reject(err);
          }
       });
    });
  },

  patchByIndex: async <T>(
    indexName: string,
    query: IndexQuery,
    patch: Partial<T>,
    opts?: DbStoreOptions,
  ): Promise<void> => {
     await globalSwDbAPI.setSomeByIndex<T, Partial<T>>(
        indexName,
        query,
        (items) => items, // select all matched
        (item, patchObj) => Object.assign({}, item, patchObj) as WithId<T>,
        patch,
        opts
     );
  },

  getByIndexPaginated: async <T>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions,
  ): Promise<{ items: WithId<T>[]; nextCursor?: string }> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
      return new Promise<{ items: WithId<T>[]; nextCursor?: string }>((resolve, reject) => {
        try {
          const index = idbStore.index(indexName);
          const idbQuery = buildIDBQuery(query);
          const direction = paginationOpts.direction || "next";
          const limit = paginationOpts.limit || 50;
          
          const items: WithId<T>[] = [];
          const req = index.openCursor(idbQuery, direction);
          let advanced = false;
          let targetIndexKey: unknown;
          let targetPrimaryKey: unknown;

          if (paginationOpts.cursor) {
             try {
                const parsed = JSON.parse(paginationOpts.cursor);
                targetIndexKey = parsed[0];
                targetPrimaryKey = parsed[1];
             } catch (e) {
                // invalid cursor, ignore
             }
          }

          let lastIndexKey: IDBValidKey | undefined;
          let lastPrimaryKey: IDBValidKey | undefined;

          req.onsuccess = (event) => {
             const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
             
             if (!cursor) {
                resolve({ 
                  items, 
                  nextCursor: items.length > 0 && lastIndexKey !== undefined && lastPrimaryKey !== undefined 
                    ? JSON.stringify([lastIndexKey, lastPrimaryKey]) 
                    : undefined 
                });
                return;
             }

             if (!advanced && targetIndexKey !== undefined && targetPrimaryKey !== undefined) {
                advanced = true;
                if (cursor.continuePrimaryKey) {
                   cursor.continuePrimaryKey(targetIndexKey as IDBValidKey, targetPrimaryKey as IDBValidKey);
                   return;
                }
             }

             if (advanced && targetPrimaryKey !== undefined && cursor.primaryKey === targetPrimaryKey && cursor.key === targetIndexKey) {
                 targetPrimaryKey = undefined; 
                 cursor.continue();
                 return;
             }
             
             if (!advanced && targetPrimaryKey !== undefined) {
                if (cursor.primaryKey === targetPrimaryKey && cursor.key === targetIndexKey) {
                   advanced = true;
                   targetPrimaryKey = undefined;
                }
                cursor.continue();
                return;
             }

             items.push(formatDbItem(String(cursor.primaryKey), cursor.value, opts?.prefix) as WithId<T>);
             lastIndexKey = cursor.key;
             lastPrimaryKey = cursor.primaryKey;

             if (items.length >= limit) {
                resolve({ 
                   items, 
                   nextCursor: JSON.stringify([lastIndexKey, lastPrimaryKey]) 
                });
             } else {
                cursor.continue();
             }
          };
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  getByIndex: async <T,>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    return await store("readonly", (idbStore,) => {
      return new Promise<WithId<T>[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const idbQuery = buildIDBQuery(query,);
          const req = index.getAll(idbQuery,);
          const keysReq = index.getAllKeys(idbQuery,);
          let values: unknown[] | null = null;
          let keys: IDBValidKey[] | null = null;

          const checkDone = () => {
            if (values !== null && keys !== null) {
              const formatted = values.map((val, i,) =>
                formatDbItem(String(keys![i],), val, opts?.prefix,) as WithId<T>
              );
              resolve(formatted,);
            }
          };

          req.onsuccess = () => {
            values = req.result;
            checkDone();
          };
          req.onerror = () => reject(req.error,);

          keysReq.onsuccess = () => {
            keys = keysReq.result;
            checkDone();
          };
          keysReq.onerror = () => reject(keysReq.error,);
        } catch (err) {
          reject(err,);
        }
      },);
    },);
  },

  getManyByIndex: async <T,>(
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    return await store("readonly", (idbStore,) => {
      return new Promise<WithId<T>[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const resultsMap = new Map<string, WithId<T>>();
          if (queries.length === 0) {
            return resolve([],);
          }
          let completed = 0;
          for (const q of queries) {
            const idbQuery = buildIDBQuery(q,);
            const req = index.getAll(idbQuery,);
            const keysReq = index.getAllKeys(idbQuery,);
            let vals: unknown[] | null = null;
            let keys: IDBValidKey[] | null = null;

            const check = () => {
              if (vals !== null && keys !== null) {
                vals.forEach((val, i,) => {
                  const keyStr = String(keys![i],);
                  if (!resultsMap.has(keyStr,)) {
                    resultsMap.set(
                      keyStr,
                      formatDbItem(keyStr, val, opts?.prefix,) as WithId<T>,
                    );
                  }
                },);
                completed++;
                if (completed === queries.length) {
                  resolve(Array.from(resultsMap.values(),),);
                }
              }
            };

            req.onsuccess = () => {
              vals = req.result;
              check();
            };
            req.onerror = () => reject(req.error,);

            keysReq.onsuccess = () => {
              keys = keysReq.result;
              check();
            };
            keysReq.onerror = () => reject(keysReq.error,);
          }
        } catch (err) {
          reject(err,);
        }
      },);
    },);
  },

  getSomeByIndex: async <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts,);
    const selectedItems = fn(matched, context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error(
        "A função injetada em GET_SOME_BY_INDEX deve retornar um Array.",
      );
    }
    return selectedItems;
  },

  queryByIndex: async <T, R, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> => {
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts,);
    return fn(matched, context,);
  },

  deleteByIndex: async (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    const keysToDelete = await store("readonly", (idbStore,) => {
      return new Promise<string[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const keysReq = index.getAllKeys(buildIDBQuery(query,),);
          keysReq.onsuccess = () => {
            resolve(keysReq.result.map((k,) => String(k,)),);
          };
          keysReq.onerror = () => reject(keysReq.error,);
        } catch (err) {
          reject(err,);
        }
      },);
    },);
    if (keysToDelete.length > 0) {
      await delMany(keysToDelete, store,);
    }
  },

  deleteManyByIndex: async (
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ): Promise<void> => {
    if (queries.length === 0) return;
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    const allKeysToDelete = await store("readonly", (idbStore,) => {
      return new Promise<string[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const keySet = new Set<string>();
          let completed = 0;
          for (const q of queries) {
            const req = index.getAllKeys(buildIDBQuery(q,),);
            req.onsuccess = () => {
              for (const k of req.result) {
                keySet.add(String(k,));
              }
              completed++;
              if (completed === queries.length) {
                resolve(Array.from(keySet,),);
              }
            };
            req.onerror = () => reject(req.error,);
          }
        } catch (err) {
          reject(err,);
        }
      },);
    },);
    if (allKeysToDelete.length > 0) {
      await delMany(allKeysToDelete, store,);
    }
  },

  delSomeByIndex: async <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts,);
    const selectedItems = fn(matched, context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error(
        "A função injetada em DEL_SOME_BY_INDEX deve retornar um Array.",
      );
    }
    const keysToDelete: string[] = selectedItems.map((item: WithId<T>,) => {
      if (!item || item._id === undefined) {
        throw new Error(
          "Os itens retornados em DEL_SOME_BY_INDEX precisam conter a propriedade '_id'.",
        );
      }
      return opts?.prefix && !item._id.startsWith(opts.prefix,)
        ? `${opts.prefix}${item._id}`
        : item._id;
    },);
    if (keysToDelete.length > 0) {
      await delMany(keysToDelete, store,);
    }
  },

  setSomeByIndex: async <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    selectFn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C,) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts,);
    const selectedItems = selectFn(matched, context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error(
        "A função de seleção em SET_SOME_BY_INDEX deve retornar um Array.",
      );
    }
    const entriesToSet: [string, unknown,][] = selectedItems.map(
      (item: WithId<T>,) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Os itens selecionados no SET_SOME_BY_INDEX precisam conter a propriedade '_id'.",
          );
        }
        const updatedItem = updateFn(item, context,);
        const { key, cleanVal, } = prepareForSave(
          undefined,
          updatedItem,
          opts?.prefix,
        );
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
        return [key, cleanVal,];
      },
    );
    if (entriesToSet.length > 0) {
      await setMany(entriesToSet, store,);
    }
  },

  query: async <T, R, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    return fn(formattedItems as WithId<T>[], context,);
  },

  getSome: async <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    const selectedItems = fn(formattedItems as WithId<T>[], context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error("A função injetada em GET_SOME deve retornar um Array.",);
    }
    return selectedItems;
  },

  delSome: async <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    const selectedItems = fn(formattedItems as WithId<T>[], context,);

    if (!Array.isArray(selectedItems,)) {
      throw new Error("A função injetada em DEL_SOME deve retornar um Array.",);
    }

    const keysToDelete: string[] = selectedItems.map((item: WithId<T>,) => {
      if (!item || item._id === undefined) {
        throw new Error(
          "Os itens retornados em DEL_SOME precisam conter a propriedade '_id'.",
        );
      }
      return opts?.prefix && !item._id.startsWith(opts.prefix,)
        ? `${opts.prefix}${item._id}`
        : item._id;
    },);
    await delMany(keysToDelete, store,);
  },

  setSome: async <T, C = unknown,>(
    selectFn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C,) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);

    const selectedItems = selectFn(formattedItems as WithId<T>[], context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error(
        "A função de seleção em SET_SOME deve retornar um Array.",
      );
    }

    const entriesToSet: [string, unknown,][] = selectedItems.map(
      (item: WithId<T>,) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Os itens selecionados no SET_SOME precisam conter a propriedade '_id'.",
          );
        }
        const updatedItem = updateFn(item, context,);
        const { key, cleanVal, } = prepareForSave(
          undefined,
          updatedItem,
          opts?.prefix,
        );
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
        return [key, cleanVal,];
      },
    );
    await setMany(entriesToSet, store,);
  },

  exportDB: async (
    opts?: DbStoreOptions,
  ): Promise<Record<string, unknown>> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    const filtered = opts?.prefix
      ? allEntries.filter(([k,],) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      )
      : allEntries;
    return Object.fromEntries(filtered,);
  },

  importDB: async (
    data: Record<string, unknown>,
    clearFirst = false,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    if (clearFirst) await globalSwDbAPI.clear(opts,);

    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(
      ([k, v,],) => {
        const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
        return [key, cleanVal,];
      },
    );
    await setMany(entriesToImport, store,);
  },

  backupToOpfs: async (
    key: string,
    fileName?: string,
    opts?: DbStoreOptions,
  ): Promise<string> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    const filtered = opts?.prefix
      ? allEntries.filter(([k,],) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      )
      : allEntries;
    const data = Object.fromEntries(filtered,);

    const finalName = fileName || "backup.json";
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;

    const dir = await getRecordDir("backup", rawKey, true,);
    const fileHandle = await dir.getFileHandle(finalName, { create: true, },);
    const w = await fileHandle.createWritable();
    await w.write(
      new Blob([JSON.stringify(data,),], { type: "application/json", },),
    );
    await w.close();

    return `${rawKey}/${finalName}`;
  },

  restoreFromOpfs: async (
    key: string,
    fileName: string,
    clearFirst = false,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir("backup", rawKey, false,);

    const finalName = fileName.includes("/",)
      ? fileName.split("/",).pop()!
      : fileName;

    const fileHandle = await dir.getFileHandle(finalName,);
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text(),);

    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    if (clearFirst) await globalSwDbAPI.clear(opts,);

    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(
      ([k, v,],) => {
        const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
        return [key, cleanVal,];
      },
    );
    await setMany(entriesToImport, store,);
  },

  init: (_workerPath?: string | URL): void => {
    // No-op no Worker
  },
  restart: (): void => {
    // No-op no Worker
  },
  terminate: (): void => {
    // No-op no Worker
  },
  gerarId,
  gerarIdComPrefixo: (prefix?: string): string =>
    gerarIdComPrefixo(prefix || ""),
};

/**
 * API global para acesso ao File System (OPFS) no Worker.
 */
export const globalSwOpfsAPI: WorkerOpfsAPI<unknown> = {
  ...globalSwDbAPI,

  listFiles: async (
    key: string,
    opts?: OpfsStoreOptions,
  ): Promise<OpfsFileInfo[]> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const filesList = [];
    // @ts-ignore: Deno API for directory entries
    for await (const [name, handle,] of dir.entries()) {
      if (handle.kind === "file") {
        const file = await handle.getFile();
        filesList.push({
          name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },);
      }
    }
    return filesList;
  },

  getFile: async (
    key: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<File> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    return await fileHandle.getFile();
  },

  getFileStream: async (
    key: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<ReadableStream<Uint8Array>> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    const file = await fileHandle.getFile();
    return file.stream();
  },

  addFile: async (
    key: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const fh = await dir.getFileHandle(fileName, { create: true, },);
    const w = await fh.createWritable();
    await w.write(new Blob([await file.arrayBuffer(),],),);
    await w.close();
  },

  addFileStream: async (
    key: string,
    streamOrFileName: ReadableStream<Uint8Array> | string,
    fileNameOrStream: string | ReadableStream<Uint8Array>,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    let stream: ReadableStream<Uint8Array>;
    let fileName: string;
    if (typeof streamOrFileName === "string") {
      fileName = streamOrFileName;
      stream = fileNameOrStream as ReadableStream<Uint8Array>;
    } else {
      stream = streamOrFileName;
      fileName = fileNameOrStream as string;
    }
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const fh = await dir.getFileHandle(fileName, { create: true, },);
    const w = await fh.createWritable();
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value, } = await reader.read();
        if (done) break;
        if (value) {
          await w.write(value as unknown as BufferSource,);
        }
      }
    } finally {
      reader.releaseLock();
    }
    await w.close();
  },

  delFile: async (
    key: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    await dir.removeEntry(fileName,);
  },

  renFile: async (
    key: string,
    oldName: string,
    newName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const oldFile = await dir.getFileHandle(oldName,);
    const fileData = await oldFile.getFile();
    const newFile = await dir.getFileHandle(newName, { create: true, },);
    const w = await newFile.createWritable();
    await w.write(new Blob([await fileData.arrayBuffer(),],),);
    await w.close();
    await dir.removeEntry(oldName,);
  },

  mvFile: async (
    key: string,
    fileName: string,
    newKey: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    const fileData = await fileHandle.getFile();

    const rawNewKey = opts?.prefix && !newKey.startsWith(opts.prefix,)
      ? `${opts.prefix}${newKey}`
      : newKey;
    const targetDir = await getRecordDir(opts?.basePath, rawNewKey, true,);

    const newFile = await targetDir.getFileHandle(fileName, { create: true, },);
    const w = await newFile.createWritable();
    await w.write(new Blob([await fileData.arrayBuffer(),],),);
    await w.close();
    await dir.removeEntry(fileName,);
  },

  zip: async (
    key: string,
    zipName: string,
    filesToZip?: string[],
    deleteOriginals = false,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const filesRecord: Record<string, Uint8Array> = {};

    // @ts-ignore: Deno API for directory entries
    for await (const [name, handle,] of dir.entries()) {
      if (
        handle.kind === "file" && (!filesToZip || filesToZip.includes(name,))
      ) {
        const f = await handle.getFile();
        filesRecord[name] = new Uint8Array(await f.arrayBuffer(),);
      }
    }

    const zippedData = zipSync(filesRecord,);
    const zipFileHandle = await dir.getFileHandle(zipName, { create: true, },);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([zippedData as BlobPart,],),);
    await w.close();

    if (deleteOriginals) {
      for (const name of Object.keys(filesRecord,)) {
        await dir.removeEntry(name,);
      }
    }
  },

  unzip: async (
    key: string,
    zipName: string,
    deleteZip = false,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(
      await (await zipFileHandle.getFile()).arrayBuffer(),
    );

    const unzipped = unzipSync(zipBuffer,);
    for (const [name, data,] of Object.entries(unzipped,)) {
      if (!name.includes("/",)) {
        const fh = await dir.getFileHandle(name, { create: true, },);
        const w = await fh.createWritable();
        await w.write(new Blob([data as BlobPart,],),);
        await w.close();
      }
    }

    if (deleteZip) await dir.removeEntry(zipName,);
  },

  addZip: async (
    key: string,
    zipName: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(
      await (await zipFileHandle.getFile()).arrayBuffer(),
    );
    const currentZipData = unzipSync(zipBuffer,);

    currentZipData[fileName] = new Uint8Array(await file.arrayBuffer(),);

    const newZippedData = zipSync(currentZipData,);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([newZippedData as BlobPart,],),);
    await w.close();
  },

  delZip: async (
    key: string,
    zipName: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(
      await (await zipFileHandle.getFile()).arrayBuffer(),
    );
    const currentZipData = unzipSync(zipBuffer,);

    delete currentZipData[fileName];

    const newZippedData = zipSync(currentZipData,);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([newZippedData as BlobPart,],),);
    await w.close();
  },
};

// 💎 EXPORTA A API INTERNA PARA SER CONSUMIDA PELO PROXY (db.ts)
export const internalAPI: WorkerOpfsAPI<unknown> = globalSwOpfsAPI;

export function createScopedDb<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName = "keyval",
  prefix = "",
  extraOpts?: Partial<DbStoreOptions>,
): WorkerDbAPI<TDefault> {
  let opts: DbStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, ...extraOpts, };
  }
  return {
    get: <T = TDefault,>(key: string,) => globalSwDbAPI.get<T>(key, opts,),
    set: <T = TDefault,>(keyOrVal: string | T, val?: T,) =>
      globalSwDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T = TDefault,>(
      key: string,
      updater: (val: WithId<T> | undefined,) => T,
    ) => globalSwDbAPI.update<T>(key, updater, opts,),
    patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown,>(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),
      context?: C,
    ) => globalSwDbAPI.patch<T, C>(key, patchOrFn, context, opts,),
    delete: (key: string,) => globalSwDbAPI.delete(key, opts,),
    getMany: <T = TDefault,>(keys: string[],) =>
      globalSwDbAPI.getMany<T>(keys, opts,),
    setMany: (entries: [string, unknown,][],) =>
      globalSwDbAPI.setMany(entries, opts,),
    deleteMany: (keys: string[],) => globalSwDbAPI.deleteMany(keys, opts,),
    keys: () => globalSwDbAPI.keys(opts,),
    values: <T = TDefault,>() => globalSwDbAPI.values<T>(opts,),
    entries: <T = TDefault,>() => globalSwDbAPI.entries<T>(opts,),
    clear: () => globalSwDbAPI.clear(opts,),
    countByIndex: (indexName: string, query?: IndexQuery) =>
      globalSwDbAPI.countByIndex(indexName, query, opts),
    getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery) =>
      globalSwDbAPI.getOneByIndex<T>(indexName, query, opts),
    keysByIndex: (indexName: string, query: IndexQuery) =>
      globalSwDbAPI.keysByIndex(indexName, query, opts),
    patchByIndex: <T = TDefault>(
      indexName: string,
      query: IndexQuery,
      patch: Partial<T>,
    ) => globalSwDbAPI.patchByIndex<T>(indexName, query, patch, opts),
    getByIndexPaginated: <T = TDefault>(
      indexName: string,
      query: IndexQuery,
      paginationOpts: {
        limit?: number;
        cursor?: string;
        direction?: "next" | "prev" | "nextunique" | "prevunique";
      },
    ) =>
      globalSwDbAPI.getByIndexPaginated<T>(
        indexName,
        query,
        paginationOpts,
        opts,
      ),
    getByIndex: <T = TDefault>(indexName: string, query: IndexQuery) =>
      globalSwDbAPI.getByIndex<T>(indexName, query, opts),
    getManyByIndex: <T = TDefault>(
      indexName: string,
      queries: IndexQuery[],
    ) => globalSwDbAPI.getManyByIndex<T>(indexName, queries, opts),
    getSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) =>
      globalSwDbAPI.getSomeByIndex<T, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    queryByIndex: <T = TDefault, R = unknown, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ) =>
      globalSwDbAPI.queryByIndex<T, R, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    deleteByIndex: (indexName: string, query: IndexQuery) =>
      globalSwDbAPI.deleteByIndex(indexName, query, opts),
    deleteManyByIndex: (indexName: string, queries: IndexQuery[]) =>
      globalSwDbAPI.deleteManyByIndex(indexName, queries, opts),
    delSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalSwDbAPI.delSomeByIndex<T, C>(
      indexName,
      query,
      fn,
      context,
      opts,
    ),
    setSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) => globalSwDbAPI.setSomeByIndex<T, C>(
      indexName,
      query,
      selectFn,
      updateFn,
      context,
      opts,
    ),
    query: <T = TDefault, R = unknown, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ) => globalSwDbAPI.query<T, R, C>(fn, context, opts),
    getSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalSwDbAPI.getSome<T, C>(fn, context, opts),
    delSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalSwDbAPI.delSome<T, C>(fn, context, opts),
    setSome: <T = TDefault, C = unknown>(
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) => globalSwDbAPI.setSome<T, C>(selectFn, updateFn, context, opts),
    exportDB: () => globalSwDbAPI.exportDB(opts),
    importDB: (data: Record<string, unknown>, clearFirst = false) =>
      globalSwDbAPI.importDB(data, clearFirst, opts),
    backupToOpfs: (key: string, fileName?: string) =>
      globalSwDbAPI.backupToOpfs(key, fileName, opts),
    restoreFromOpfs: (key: string, fileName: string, clearFirst = false) =>
      globalSwDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),
    init: (workerPath?: string | URL) => globalSwDbAPI.init(workerPath),
    restart: () => globalSwDbAPI.restart(),
    terminate: () => globalSwDbAPI.terminate(),
    gerarId,
    gerarIdComPrefixo: () =>
      opts.prefix ? gerarIdComPrefixo(opts.prefix) : gerarId(),
  };
}

export function createScopedOpfs<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName = "keyval",
  prefix = "",
  basePath = "",
  extraOpts?: Partial<OpfsStoreOptions>,
): WorkerOpfsAPI<TDefault> {
  let opts: OpfsStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, basePath, ...extraOpts, };
  }
  return {
    ...createScopedDb<TDefault>(opts,),
    listFiles: (key: string,) => globalSwOpfsAPI.listFiles(key, opts,),
    getFile: (key: string, fileName: string,) =>
      globalSwOpfsAPI.getFile(key, fileName, opts,),
    getFileStream: (key: string, fileName: string,) =>
      globalSwOpfsAPI.getFileStream(key, fileName, opts,),
    addFile: (key: string, file: File | Blob, fileName: string,) =>
      globalSwOpfsAPI.addFile(key, file, fileName, opts,),
    addFileStream: (
      key: string,
      streamOrFileName: ReadableStream<Uint8Array> | string,
      fileNameOrStream: string | ReadableStream<Uint8Array>,
    ) =>
      globalSwOpfsAPI.addFileStream(
        key,
        streamOrFileName as unknown as string,
        fileNameOrStream as unknown as ReadableStream<Uint8Array>,
        opts,
      ),
    delFile: (key: string, fileName: string,) =>
      globalSwOpfsAPI.delFile(key, fileName, opts,),
    renFile: (key: string, oldName: string, newName: string,) =>
      globalSwOpfsAPI.renFile(key, oldName, newName, opts,),
    mvFile: (key: string, fileName: string, newKey: string,) =>
      globalSwOpfsAPI.mvFile(key, fileName, newKey, opts,),
    zip: (
      key: string,
      zipName: string,
      filesToZip?: string[],
      deleteOriginals = false,
    ) => globalSwOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),
    unzip: (key: string, zipName: string, deleteZip = false,) =>
      globalSwOpfsAPI.unzip(key, zipName, deleteZip, opts,),
    addZip: (
      key: string,
      zipName: string,
      file: File | Blob,
      fileName: string,
    ) => globalSwOpfsAPI.addZip(key, zipName, file, fileName, opts,),
    delZip: (key: string, zipName: string, fileName: string) =>
      globalSwOpfsAPI.delZip(key, zipName, fileName, opts),
    init: (workerPath?: string | URL) => globalSwOpfsAPI.init(workerPath),
    restart: () => globalSwOpfsAPI.restart(),
    terminate: () => globalSwOpfsAPI.terminate(),
    gerarId,
    gerarIdComPrefixo: () =>
      opts.prefix ? gerarIdComPrefixo(opts.prefix) : gerarId(),
  };
}

/**
 * Ponto de acesso para o Banco de Dados (IndexedDB).
 * Pode ser invocado como função para criar uma instância prefixada ou usado diretamente.
 *
 * @example
 * ```ts
 * const myDb = db("my-app", "users", "user_");
 * await myDb.set("123", { name: "John" });
 * ```
 */
export const db: (<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName?: string,
  prefix?: string,
  extraOpts?: Partial<DbStoreOptions>,
) => WorkerDbAPI<TDefault>) & WorkerDbAPI<unknown> = Object.assign(
  <TDefault = unknown>(
    dbName?: string | DbStoreOptions,
    storeName?: string,
    prefix?: string,
    extraOpts?: Partial<DbStoreOptions>,
  ): WorkerDbAPI<TDefault> =>
    createScopedDb<TDefault>(dbName, storeName, prefix, extraOpts),
  globalSwDbAPI,
);

/**
 * Ponto de acesso para o Sistema de Arquivos (OPFS).
 * Pode ser invocado como função para criar uma instância prefixada ou usado diretamente.
 *
 * @example
 * ```ts
 * const drive = opfs("my-app", "files", "docs_");
 * await drive.addFile("doc1", blob, "manual.pdf");
 * ```
 */
export const opfs: (<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName?: string,
  prefix?: string,
  basePath?: string,
  extraOpts?: Partial<OpfsStoreOptions>,
) => WorkerOpfsAPI<TDefault>) & WorkerOpfsAPI<unknown> = Object.assign(
  <TDefault = unknown>(
    dbName?: string | OpfsStoreOptions,
    storeName?: string,
    prefix?: string,
    basePath = "",
    extraOpts?: Partial<OpfsStoreOptions>,
  ): WorkerOpfsAPI<TDefault> =>
    createScopedOpfs<TDefault>(dbName, storeName, prefix, basePath, extraOpts),
  globalSwOpfsAPI,
);
