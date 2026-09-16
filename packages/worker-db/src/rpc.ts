// ## Arquivo: monorepo/worker-db/src/rpc.ts
import { gerarId, gerarIdComPrefixo, type WithId, } from './utils/id.ts';
import type { DbStoreOptions, OpfsFileInfo, OpfsStoreOptions, } from './db.ts';

let workerInstance: Worker | null = null;
let currentWorkerPath: string | URL = './worker-db.js';
const pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();

function getWorker(workerPath?: string | URL,): Worker {
  if (workerPath) {
    currentWorkerPath = workerPath;
  }

  if (!workerInstance) {
    const workerUrl = typeof currentWorkerPath === 'string'
      ? new URL(currentWorkerPath, import.meta.url,)
      : currentWorkerPath;
    workerInstance = new Worker(workerUrl, { type: 'module', },);

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
      console.error('⚠️ Falha crítica no Web Worker:', event.message,);
      pendingRequests.forEach(({ reject, },) => reject(new Error('Worker crashed',),));
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
  pendingRequests.forEach(({ reject, },) => reject(new Error('Worker foi reiniciado',),));
  pendingRequests.clear();
  getWorker();
}

function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

function exec<T,>(command: string, args: Record<string, unknown> = {},): Promise<T> {
  return new Promise<T>((resolve, reject,) => {
    const requestId = gerarId();
    pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject, },);
    try {
      getWorker().postMessage({ requestId, command, args, },);
    } catch (err) {
      pendingRequests.delete(requestId,);
      reject(err,);
    }
  },);
}

const globalDbAPI = {
  get: <T,>(key: string, opts?: DbStoreOptions,) => exec<WithId<T>>('GET', { key, ...opts, },),
  set: <T,>(keyOrVal: string | T, val?: T | DbStoreOptions, opts?: DbStoreOptions,) => {
    if (typeof keyOrVal !== 'string') {
      const options = opts || (val as DbStoreOptions) || {};
      return exec<string>('SET', { key: undefined, val: keyOrVal, ...options, },);
    }
    return exec<string>('SET', { key: keyOrVal, val, ...opts, },);
  },
  update: async <T,>(
    key: string,
    updater: (val: WithId<T> | undefined,) => T,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const currentVal = await exec<WithId<T> | undefined>('GET', { key, ...opts, },);
    const newVal = updater(currentVal,);
    await exec<void>('SET', { key, val: newVal, ...opts, },);
  },
  patch: <T extends Record<string, unknown>, C = unknown,>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx: C,) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>> => {
    const isFn = typeof patchOrFn === 'function';
    return exec<WithId<T>>('PATCH', {
      key,
      patch: isFn ? undefined : patchOrFn,
      fnStr: isFn ? patchOrFn.toString() : undefined,
      context,
      ...opts,
    },);
  },
  delete: (key: string, opts?: DbStoreOptions,) => exec<void>('DELETE', { key, ...opts, },),
  getMany: <T,>(keys: string[], opts?: DbStoreOptions,) =>
    exec<(WithId<T> | undefined)[]>('GET_MANY', { keys, ...opts, },),
  setMany: (entries: [string, unknown,][], opts?: DbStoreOptions,) =>
    exec<void>('SET_MANY', { entries, ...opts, },),
  deleteMany: (keys: string[], opts?: DbStoreOptions,) =>
    exec<void>('DEL_MANY', { keys, ...opts, },),
  keys: (opts?: DbStoreOptions,) => exec<string[]>('KEYS', { ...opts, },),
  values: <T,>(opts?: DbStoreOptions,) => exec<T[]>('VALUES', { ...opts, },),
  entries: <T,>(opts?: DbStoreOptions,) => exec<[string, T,][]>('ENTRIES', { ...opts, },),
  clear: (opts?: DbStoreOptions,) => exec<void>('CLEAR', { ...opts, },),
  query: <T, R, C = unknown,>(
    fn: (items: WithId<T>[], ctx: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> => exec<R>('QUERY', { fnStr: fn.toString(), context, ...opts, },),
  getSome: <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>('GET_SOME', { fnStr: fn.toString(), context, ...opts, },),
  delSome: <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => exec<void>('DEL_SOME', { fnStr: fn.toString(), context, ...opts, },),
  setSome: <T, C = unknown,>(
    selectFn: (items: WithId<T>[], ctx: C,) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx: C,) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>('SET_SOME', {
      selectFnStr: selectFn.toString(),
      updateFnStr: updateFn.toString(),
      context,
      ...opts,
    },),
  exportDB: (opts?: DbStoreOptions,) => exec<Record<string, unknown>>('EXPORT', { ...opts, },),
  importDB: (data: Record<string, unknown>, clearFirst = false, opts?: DbStoreOptions,) =>
    exec<void>('IMPORT', { data, clearFirst, ...opts, },),
  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions,) =>
    exec<string>('BACKUP_OPFS', { key, fileName, ...opts, },),
  restoreFromOpfs: (key: string, fileName: string, clearFirst = false, opts?: DbStoreOptions,) =>
    exec<void>('RESTORE_OPFS', { key, fileName, clearFirst, ...opts, },),

  init: (workerPath?: string | URL,) => {
    getWorker(workerPath,);
  },
  restart: () => restartWorker(),
  terminate: () => terminateWorker(),
};

function createScopedDb(dbName?: string, storeName = 'keyval', prefix = '',) {
  const opts: DbStoreOptions = { dbName, storeName, prefix, };
  return {
    get: <T,>(key: string,) => globalDbAPI.get<T>(key, opts,),
    set: <T,>(keyOrVal: string | T, val?: T,) =>
      globalDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T,>(key: string, updater: (val: WithId<T> | undefined,) => T,) =>
      globalDbAPI.update<T>(key, updater, opts,),
    patch: <T extends Record<string, unknown>, C = unknown,>(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx: C,) => T | Partial<T>),
      context?: C,
    ) => globalDbAPI.patch<T, C>(key, patchOrFn, context, opts,),
    delete: (key: string,) => globalDbAPI.delete(key, opts,),
    getMany: <T,>(keys: string[],) => globalDbAPI.getMany<T>(keys, opts,),
    setMany: (entries: [string, unknown,][],) => globalDbAPI.setMany(entries, opts,),
    deleteMany: (keys: string[],) => globalDbAPI.deleteMany(keys, opts,),
    keys: () => globalDbAPI.keys(opts,),
    values: <T,>() => globalDbAPI.values<T>(opts,),
    entries: <T,>() => globalDbAPI.entries<T>(opts,),
    clear: () => globalDbAPI.clear(opts,),
    query: <T, R, C = unknown,>(fn: (items: WithId<T>[], ctx: C,) => R, context?: C,) =>
      globalDbAPI.query<T, R, C>(fn, context, opts,),
    getSome: <T, C = unknown,>(fn: (items: WithId<T>[], ctx: C,) => WithId<T>[], context?: C,) =>
      globalDbAPI.getSome<T, C>(fn, context, opts,),
    delSome: <T, C = unknown,>(fn: (items: WithId<T>[], ctx: C,) => WithId<T>[], context?: C,) =>
      globalDbAPI.delSome<T, C>(fn, context, opts,),
    setSome: <T, C = unknown,>(
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
    gerarIdComPrefixo: () => prefix ? gerarIdComPrefixo(prefix,) : gerarId(),
  };
}

const globalOpfsAPI = {
  ...globalDbAPI,
  listFiles: (key: string, opts?: OpfsStoreOptions,) =>
    exec<OpfsFileInfo[]>('OPFS_LIST', { key, ...opts, },),
  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<File>('OPFS_GET', { key, fileName, ...opts, },),
  addFile: (key: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<void>('OPFS_ADD', { key, file, fileName, ...opts, },),
  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<void>('OPFS_DEL', { key, fileName, ...opts, },),
  renFile: (key: string, oldName: string, newName: string, opts?: OpfsStoreOptions,) =>
    exec<void>('OPFS_REN', { key, oldName, newName, ...opts, },),
  mvFile: (key: string, fileName: string, newKey: string, opts?: OpfsStoreOptions,) =>
    exec<void>('OPFS_MV', { key, fileName, newKey, ...opts, },),
  zip: (
    key: string,
    zipName: string,
    filesToZip?: string[],
    deleteOriginals = false,
    opts?: OpfsStoreOptions,
  ) => exec<void>('OPFS_ZIP', { key, zipName, filesToZip, deleteOriginals, ...opts, },),
  unzip: (key: string, zipName: string, deleteZip = false, opts?: OpfsStoreOptions,) =>
    exec<void>('OPFS_UNZIP', { key, zipName, deleteZip, ...opts, },),
  addZip: (
    key: string,
    zipName: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) => exec<void>('OPFS_ADDZIP', { key, zipName, file, fileName, ...opts, },),
  delZip: (key: string, zipName: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<void>('OPFS_DELZIP', { key, zipName, fileName, ...opts, },),
};

function createScopedOpfs(dbName?: string, storeName = 'keyval', prefix = '', basePath = '',) {
  const opts: OpfsStoreOptions = { dbName, storeName, prefix, basePath, };
  return {
    ...createScopedDb(dbName, storeName, prefix,),
    listFiles: (key: string,) => globalOpfsAPI.listFiles(key, opts,),
    getFile: (key: string, fileName: string,) => globalOpfsAPI.getFile(key, fileName, opts,),
    addFile: (key: string, file: File | Blob, fileName: string,) =>
      globalOpfsAPI.addFile(key, file, fileName, opts,),
    delFile: (key: string, fileName: string,) => globalOpfsAPI.delFile(key, fileName, opts,),
    renFile: (key: string, oldName: string, newName: string,) =>
      globalOpfsAPI.renFile(key, oldName, newName, opts,),
    mvFile: (key: string, fileName: string, newKey: string,) =>
      globalOpfsAPI.mvFile(key, fileName, newKey, opts,),
    zip: (key: string, zipName: string, filesToZip?: string[], deleteOriginals = false,) =>
      globalOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),
    unzip: (key: string, zipName: string, deleteZip = false,) =>
      globalOpfsAPI.unzip(key, zipName, deleteZip, opts,),
    addZip: (key: string, zipName: string, file: File | Blob, fileName: string,) =>
      globalOpfsAPI.addZip(key, zipName, file, fileName, opts,),
    delZip: (key: string, zipName: string, fileName: string,) =>
      globalOpfsAPI.delZip(key, zipName, fileName, opts,),
  };
}

export const db = Object.assign(
  (dbName?: string, storeName?: string, prefix?: string,) =>
    createScopedDb(dbName, storeName, prefix,),
  globalDbAPI,
);

export const opfs = Object.assign(
  (dbName?: string, storeName?: string, prefix?: string, basePath = '',) =>
    createScopedOpfs(dbName, storeName, prefix, basePath,),
  globalOpfsAPI,
);
