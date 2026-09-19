// ## Arquivo: monorepo/worker-db/src/rpc.ts
import { gerarId, gerarIdComPrefixo, type WithId, } from "./utils/id.ts";
import type {
  DbStoreOptions,
  IndexQuery,
  OpfsFileInfo,
  OpfsStoreOptions,
} from "./db.ts";

let workerInstance: Worker | null = null;
let currentWorkerPath: string | URL = "./worker.js";
const pendingRequests = new Map<
  string,
  { resolve: (value: unknown,) => void; reject: (reason?: unknown,) => void }
>();

function getWorker(workerPath?: string | URL,): Worker {
  if (workerPath) {
    currentWorkerPath = workerPath;
  }

  if (!workerInstance) {
    const workerUrl = typeof currentWorkerPath === "string"
      ? new URL(currentWorkerPath, import.meta.url,)
      : currentWorkerPath;
    workerInstance = new Worker(workerUrl, { type: "module", },);

    workerInstance.onmessage = (e: MessageEvent,) => {
      const { requestId, success, result, error, } = e.data;
      const promise = pendingRequests.get(requestId,);
      if (promise) {
        if (success) promise.resolve(result,);
        else promise.reject(new Error(error,),);
        pendingRequests.delete(requestId,);
      }
    };

    workerInstance.onerror = (event,) => {
      console.error("⚠️ Falha crítica no Web Worker:", event.message,);
      pendingRequests.forEach(({ reject, },) =>
        reject(new Error("Worker crashed",),)
      );
      pendingRequests.clear();
      restartWorker();
    };
  }
  return workerInstance;
}

function restartWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  pendingRequests.forEach(({ reject, },) =>
    reject(new Error("Worker foi reiniciado",),)
  );
  pendingRequests.clear();
  getWorker();
}

function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

function exec<T,>(
  command: string,
  args: Record<string, unknown> = {},
  transfer: Transferable[] = [],
): Promise<T> {
  return new Promise<T>((resolve, reject,) => {
    const requestId = gerarId();
    pendingRequests.set(requestId, {
      resolve: resolve as (value: unknown,) => void,
      reject,
    },);
    try {
      if (transfer && transfer.length > 0) {
        getWorker().postMessage({ requestId, command, args, }, transfer,);
      } else {
        getWorker().postMessage({ requestId, command, args, },);
      }
    } catch (err) {
      pendingRequests.delete(requestId,);
      reject(err,);
    }
  },);
}

function serializeDbOpts<T extends DbStoreOptions>(
  opts?: T,
): (Omit<T, "validator"> & { validatorStr?: string }) | undefined {
  if (!opts) return undefined;
  const { validator, ...rest } = opts;
  const result: Omit<T, "validator"> & { validatorStr?: string } = { ...rest, };
  if (validator && !opts.validatorStr) {
    result.validatorStr = validator.toString();
  }
  return result;
}

const globalDbAPI = {
  get: <T,>(key: string, opts?: DbStoreOptions,) =>
    exec<WithId<T>>("GET", { key, ...serializeDbOpts(opts), },),
  set: <T,>(
    keyOrVal: string | T,
    val?: T | DbStoreOptions,
    opts?: DbStoreOptions,
  ) => {
    if (typeof keyOrVal !== "string") {
      const options = opts || (val as DbStoreOptions) || {};
      return exec<string>("SET", {
        key: undefined,
        val: keyOrVal,
        ...serializeDbOpts(options),
      },);
    }
    return exec<string>("SET", {
      key: keyOrVal,
      val,
      ...serializeDbOpts(opts),
    },);
  },
  update: async <T,>(
    key: string,
    updater: (val: WithId<T> | undefined,) => T,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const currentVal = await exec<WithId<T> | undefined>("GET", {
      key,
      ...serializeDbOpts(opts),
    },);
    const newVal = updater(currentVal,);
    await exec<void>("SET", { key, val: newVal, ...serializeDbOpts(opts), },);
  },
  patch: <T extends Record<string, unknown>, C = unknown,>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx: C,) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>> => {
    const isFn = typeof patchOrFn === "function";
    return exec<WithId<T>>("PATCH", {
      key,
      patch: isFn ? undefined : patchOrFn,
      fnStr: isFn ? patchOrFn.toString() : undefined,
      context,
      ...serializeDbOpts(opts),
    },);
  },
  delete: (key: string, opts?: DbStoreOptions,) =>
    exec<void>("DELETE", { key, ...serializeDbOpts(opts), },),
  getMany: <T,>(keys: string[], opts?: DbStoreOptions,) =>
    exec<(WithId<T> | undefined)[]>("GET_MANY", {
      keys,
      ...serializeDbOpts(opts),
    },),
  setMany: (entries: [string, unknown,][], opts?: DbStoreOptions,) =>
    exec<void>("SET_MANY", { entries, ...serializeDbOpts(opts), },),
  deleteMany: (keys: string[], opts?: DbStoreOptions,) =>
    exec<void>("DEL_MANY", { keys, ...serializeDbOpts(opts), },),
  keys: (opts?: DbStoreOptions,) =>
    exec<string[]>("KEYS", { ...serializeDbOpts(opts), },),
  values: <T,>(opts?: DbStoreOptions,) =>
    exec<T[]>("VALUES", { ...serializeDbOpts(opts), },),
  entries: <T,>(opts?: DbStoreOptions,) =>
    exec<[string, T,][]>("ENTRIES", { ...serializeDbOpts(opts), },),
  clear: (opts?: DbStoreOptions,) =>
    exec<void>("CLEAR", { ...serializeDbOpts(opts), },),
  getByIndex: <T,>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<WithId<T>[]>("GET_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  countByIndex: (
    indexName: string,
    query?: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<number>("COUNT_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  getOneByIndex: <T,>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<WithId<T> | undefined>("GET_ONE_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  keysByIndex: (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<string[]>("KEYS_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  patchByIndex: <T,>(
    indexName: string,
    query: IndexQuery,
    patch: Partial<T>,
    opts?: DbStoreOptions,
  ) =>
    exec<void>("PATCH_BY_INDEX", {
      indexName,
      query,
      patch,
      ...serializeDbOpts(opts),
    },),
  getByIndexPaginated: <T,>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions,
  ) =>
    exec<{ items: WithId<T>[]; nextCursor?: string }>("GET_BY_INDEX_PAGINATED", {
      indexName,
      query,
      paginationOpts,
      ...serializeDbOpts(opts),
    },),
  getManyByIndex: <T,>(
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ) =>
    exec<WithId<T>[]>("GET_MANY_BY_INDEX", {
      indexName,
      queries,
      ...serializeDbOpts(opts),
    },),
  getSomeByIndex: <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>("GET_SOME_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  queryByIndex: <T, R, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> =>
    exec<R>("QUERY_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  deleteByIndex: (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DELETE_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  deleteManyByIndex: (
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DELETE_MANY_BY_INDEX", {
      indexName,
      queries,
      ...serializeDbOpts(opts),
    },),
  delSomeByIndex: <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DEL_SOME_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  setSomeByIndex: <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    selectFn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx: C,) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("SET_SOME_BY_INDEX", {
      indexName,
      query,
      selectFnStr: selectFn.toString(),
      updateFnStr: updateFn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  query: <T, R, C = unknown,>(
    fn: (items: WithId<T>[], ctx: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> =>
    exec<R>("QUERY", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  getSome: <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>("GET_SOME", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  delSome: <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DEL_SOME", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  setSome: <T, C = unknown,>(
    selectFn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx: C,) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("SET_SOME", {
      selectFnStr: selectFn.toString(),
      updateFnStr: updateFn.toString(),
      context,
      ...serializeDbOpts(opts),
    },),
  exportDB: (opts?: DbStoreOptions,) =>
    exec<Record<string, unknown>>("EXPORT", { ...serializeDbOpts(opts), },),
  importDB: (
    data: Record<string, unknown>,
    clearFirst = false,
    opts?: DbStoreOptions,
  ) =>
    exec<void>("IMPORT", {
      data,
      clearFirst,
      ...serializeDbOpts(opts),
    },),
  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions,) =>
    exec<string>("BACKUP_OPFS", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  restoreFromOpfs: (
    key: string,
    fileName: string,
    clearFirst = false,
    opts?: DbStoreOptions,
  ) =>
    exec<void>("RESTORE_OPFS", {
      key,
      fileName,
      clearFirst,
      ...serializeDbOpts(opts),
    },),

  init: (workerPath?: string | URL,) => {
    getWorker(workerPath,);
  },
  restart: () => restartWorker(),
  terminate: () => terminateWorker(),
};

function createScopedDb<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName = "keyval",
  prefix = "",
  extraOpts?: Partial<DbStoreOptions>,
) {
  let opts: DbStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, ...extraOpts, };
  }
  return {
    get: <T = TDefault,>(key: string,) => globalDbAPI.get<T>(key, opts,),
    set: <T = TDefault,>(keyOrVal: string | T, val?: T,) =>
      globalDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T = TDefault,>(
      key: string,
      updater: (val: WithId<T> | undefined,) => T,
    ) => globalDbAPI.update<T>(key, updater, opts,),
    patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown,>(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx: C,) => T | Partial<T>),
      context?: C,
    ) => globalDbAPI.patch<T, C>(key, patchOrFn, context, opts,),
    delete: (key: string,) => globalDbAPI.delete(key, opts,),
    getMany: <T = TDefault,>(keys: string[],) =>
      globalDbAPI.getMany<T>(keys, opts,),
    setMany: (entries: [string, unknown,][],) =>
      globalDbAPI.setMany(entries, opts,),
    deleteMany: (keys: string[],) => globalDbAPI.deleteMany(keys, opts,),
    keys: () => globalDbAPI.keys(opts,),
    values: <T = TDefault,>() => globalDbAPI.values<T>(opts,),
    entries: <T = TDefault,>() => globalDbAPI.entries<T>(opts,),
    clear: () => globalDbAPI.clear(opts,),
    getByIndex: <T = TDefault,>(indexName: string, query: IndexQuery,) =>
      globalDbAPI.getByIndex<T>(indexName, query, opts,),
    countByIndex: (indexName: string, query?: IndexQuery,) =>
      globalDbAPI.countByIndex(indexName, query, opts,),
    getOneByIndex: <T = TDefault,>(indexName: string, query: IndexQuery,) =>
      globalDbAPI.getOneByIndex<T>(indexName, query, opts,),
    keysByIndex: (indexName: string, query: IndexQuery,) =>
      globalDbAPI.keysByIndex(indexName, query, opts,),
    patchByIndex: <T = TDefault,>(indexName: string, query: IndexQuery, patch: Partial<T>) =>
      globalDbAPI.patchByIndex<T>(indexName, query, patch, opts,),
    getByIndexPaginated: <T = TDefault,>(
      indexName: string,
      query: IndexQuery,
      paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    ) => globalDbAPI.getByIndexPaginated<T>(indexName, query, paginationOpts, opts,),
    getManyByIndex: <T = TDefault,>(
      indexName: string,
      queries: IndexQuery[],
    ) => globalDbAPI.getManyByIndex<T>(indexName, queries, opts,),
    getSomeByIndex: <T = TDefault, C = unknown,>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.getSomeByIndex<T, C>(
      indexName,
      query,
      fn,
      context,
      opts,
    ),
    queryByIndex: <T = TDefault, R = unknown, C = unknown,>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx: C,) => R,
      context?: C,
    ) => globalDbAPI.queryByIndex<T, R, C>(
      indexName,
      query,
      fn,
      context,
      opts,
    ),
    deleteByIndex: (indexName: string, query: IndexQuery,) =>
      globalDbAPI.deleteByIndex(indexName, query, opts,),
    deleteManyByIndex: (indexName: string, queries: IndexQuery[],) =>
      globalDbAPI.deleteManyByIndex(indexName, queries, opts,),
    delSomeByIndex: <T = TDefault, C = unknown,>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.delSomeByIndex<T, C>(
      indexName,
      query,
      fn,
      context,
      opts,
    ),
    setSomeByIndex: <T = TDefault, C = unknown,>(
      indexName: string,
      query: IndexQuery,
      selectFn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx: C,) => WithId<T>,
      context?: C,
    ) => globalDbAPI.setSomeByIndex<T, C>(
      indexName,
      query,
      selectFn,
      updateFn,
      context,
      opts,
    ),
    query: <T = TDefault, R = unknown, C = unknown,>(
      fn: (items: WithId<T>[], ctx: C,) => R,
      context?: C,
    ) => globalDbAPI.query<T, R, C>(fn, context, opts,),
    getSome: <T = TDefault, C = unknown,>(
      fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.getSome<T, C>(fn, context, opts,),
    delSome: <T = TDefault, C = unknown,>(
      fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.delSome<T, C>(fn, context, opts,),
    setSome: <T = TDefault, C = unknown,>(
      selectFn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx: C,) => WithId<T>,
      context?: C,
    ) => globalDbAPI.setSome<T, C>(selectFn, updateFn, context, opts,),
    exportDB: () => globalDbAPI.exportDB(opts,),
    importDB: (data: Record<string, unknown>, clearFirst = false,) =>
      globalDbAPI.importDB(data, clearFirst, opts,),
    backupToOpfs: (key: string, fileName?: string,) =>
      globalDbAPI.backupToOpfs(key, fileName, opts,),
    restoreFromOpfs: (key: string, fileName: string, clearFirst = false,) =>
      globalDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts,),
    gerarId,
    gerarIdComPrefixo: () =>
      opts.prefix ? gerarIdComPrefixo(opts.prefix,) : gerarId(),
  };
}

const globalOpfsAPI = {
  ...globalDbAPI,
  listFiles: (key: string, opts?: OpfsStoreOptions,) =>
    exec<OpfsFileInfo[]>("OPFS_LIST", {
      key,
      ...serializeDbOpts(opts),
    },),
  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<File>("OPFS_GET", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  getFileStream: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<ReadableStream<Uint8Array>>("OPFS_GET_STREAM", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  addFile: (
    key: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_ADD", {
      key,
      file,
      fileName,
      ...serializeDbOpts(opts),
    },),
  addFileStream: (
    key: string,
    streamOrFileName: ReadableStream<Uint8Array> | string,
    fileNameOrStream: string | ReadableStream<Uint8Array>,
    opts?: OpfsStoreOptions,
  ) => {
    let stream: ReadableStream<Uint8Array>;
    let fileName: string;
    if (typeof streamOrFileName === "string") {
      fileName = streamOrFileName;
      stream = fileNameOrStream as ReadableStream<Uint8Array>;
    } else {
      stream = streamOrFileName;
      fileName = fileNameOrStream as string;
    }
    return exec<void>(
      "OPFS_ADD_STREAM",
      {
        key,
        stream,
        fileName,
        ...serializeDbOpts(opts),
      },
      [stream as unknown as Transferable,],
    );
  },
  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<void>("OPFS_DEL", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  renFile: (
    key: string,
    oldName: string,
    newName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_REN", {
      key,
      oldName,
      newName,
      ...serializeDbOpts(opts),
    },),
  mvFile: (
    key: string,
    fileName: string,
    newKey: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_MV", {
      key,
      fileName,
      newKey,
      ...serializeDbOpts(opts),
    },),
  zip: (
    key: string,
    zipName: string,
    filesToZip?: string[],
    deleteOriginals = false,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_ZIP", {
      key,
      zipName,
      filesToZip,
      deleteOriginals,
      ...serializeDbOpts(opts),
    },),
  unzip: (
    key: string,
    zipName: string,
    deleteZip = false,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_UNZIP", {
      key,
      zipName,
      deleteZip,
      ...serializeDbOpts(opts),
    },),
  addZip: (
    key: string,
    zipName: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_ADDZIP", {
      key,
      zipName,
      file,
      fileName,
      ...serializeDbOpts(opts),
    },),
  delZip: (
    key: string,
    zipName: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_DELZIP", {
      key,
      zipName,
      fileName,
      ...serializeDbOpts(opts),
    },),
};

function createScopedOpfs<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName = "keyval",
  prefix = "",
  basePath = "",
  extraOpts?: Partial<OpfsStoreOptions>,
) {
  let opts: OpfsStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, basePath, ...extraOpts, };
  }
  return {
    ...createScopedDb<TDefault>(opts,),
    listFiles: (key: string,) => globalOpfsAPI.listFiles(key, opts,),
    getFile: (key: string, fileName: string,) =>
      globalOpfsAPI.getFile(key, fileName, opts,),
    getFileStream: (key: string, fileName: string,) =>
      globalOpfsAPI.getFileStream(key, fileName, opts,),
    addFile: (key: string, file: File | Blob, fileName: string,) =>
      globalOpfsAPI.addFile(key, file, fileName, opts,),
    addFileStream: (
      key: string,
      streamOrFileName: ReadableStream<Uint8Array> | string,
      fileNameOrStream: string | ReadableStream<Uint8Array>,
    ) =>
      globalOpfsAPI.addFileStream(
        key,
        streamOrFileName as unknown as string,
        fileNameOrStream as unknown as ReadableStream<Uint8Array>,
        opts,
      ),
    delFile: (key: string, fileName: string,) =>
      globalOpfsAPI.delFile(key, fileName, opts,),
    renFile: (key: string, oldName: string, newName: string,) =>
      globalOpfsAPI.renFile(key, oldName, newName, opts,),
    mvFile: (key: string, fileName: string, newKey: string,) =>
      globalOpfsAPI.mvFile(key, fileName, newKey, opts,),
    zip: (
      key: string,
      zipName: string,
      filesToZip?: string[],
      deleteOriginals = false,
    ) => globalOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),
    unzip: (key: string, zipName: string, deleteZip = false,) =>
      globalOpfsAPI.unzip(key, zipName, deleteZip, opts,),
    addZip: (
      key: string,
      zipName: string,
      file: File | Blob,
      fileName: string,
    ) => globalOpfsAPI.addZip(key, zipName, file, fileName, opts,),
    delZip: (key: string, zipName: string, fileName: string,) =>
      globalOpfsAPI.delZip(key, zipName, fileName, opts,),
  };
}

export const db = Object.assign(
  <TDefault = unknown,>(
    dbName?: string | DbStoreOptions,
    storeName?: string,
    prefix?: string,
    extraOpts?: Partial<DbStoreOptions>,
  ) => createScopedDb<TDefault>(dbName, storeName, prefix, extraOpts,),
  globalDbAPI,
);

export const opfs = Object.assign(
  <TDefault = unknown,>(
    dbName?: string | OpfsStoreOptions,
    storeName?: string,
    prefix?: string,
    basePath = "",
    extraOpts?: Partial<OpfsStoreOptions>,
  ) => createScopedOpfs<TDefault>(dbName, storeName, prefix, basePath, extraOpts,),
  globalOpfsAPI,
);
