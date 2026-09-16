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
} from 'idb-keyval';
import { unzipSync, zipSync, } from 'fflate';

import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from './utils/id.ts';

// ============================================================================
// DEFINIÇÕES DE TIPOS (Single Source of Truth)
// ============================================================================
export interface DbStoreOptions {
  dbName?: string;
  storeName?: string;
  prefix?: string;
}

export interface OpfsStoreOptions extends DbStoreOptions {
  basePath?: string;
}

export interface OpfsFileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}
// ============================================================================

const storeCache = new Map<string, UseStore>();

function getCustomStore(dbName?: string, storeName = 'keyval',): UseStore | undefined {
  if (!dbName) return undefined;
  const cacheKey = `${dbName}:${storeName}`;
  if (!storeCache.has(cacheKey,)) storeCache.set(cacheKey, createStore(dbName, storeName,),);
  return storeCache.get(cacheKey,);
}

function formatDbEntries(rawEntries: [IDBValidKey, unknown,][], prefix?: string,) {
  let items = rawEntries;
  if (prefix) items = items.filter(([k,],) => typeof k === 'string' && k.startsWith(prefix,));
  return items.map(([k, v,],) => formatDbItem(k, v, prefix,));
}

async function getRecordDir(
  basePath = '',
  rawKey: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const fullPath = basePath ? `${basePath}/${rawKey}` : rawKey;
  const parts = fullPath.split('/',).filter(Boolean,);
  let curr = root;
  for (const p of parts) curr = await curr.getDirectoryHandle(p, { create, },);
  return curr;
}

export const globalSwDbAPI = {
  get: async <T,>(key: string, opts?: DbStoreOptions,): Promise<WithId<T> | undefined> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const val = await get(rawKey, store,);
    return val !== undefined ? formatDbItem(rawKey, val, opts?.prefix,) as WithId<T> : undefined;
  },

  set: async <T,>(
    keyOrVal: string | T,
    val?: T | DbStoreOptions,
    opts?: DbStoreOptions,
  ): Promise<string> => {
    let keyToSave: string | undefined;
    let valToSave: unknown;
    let options: DbStoreOptions = opts || {};
    if (typeof keyOrVal !== 'string') {
      keyToSave = undefined;
      valToSave = keyOrVal;
      if (val) options = val as DbStoreOptions;
    } else {
      keyToSave = keyOrVal;
      valToSave = val;
    }
    const store = getCustomStore(options.dbName, options.storeName,);
    const { key, cleanVal, } = prepareForSave(keyToSave, valToSave, options.prefix,);
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
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const current = (await get(rawKey, store,)) || {};

    let updated: unknown;
    if (typeof patchOrFn === 'function') {
      updated = patchOrFn(formatDbItem(rawKey, current, opts?.prefix,) as WithId<T>, context,);
    } else {
      updated = Object.assign({}, current, patchOrFn,);
    }
    const { key: finalKey, cleanVal, } = prepareForSave(rawKey, updated, opts?.prefix,);
    await set(finalKey, cleanVal, store,);
    return formatDbItem(finalKey, cleanVal, opts?.prefix,) as WithId<T>;
  },

  delete: async (key: string, opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    await del(rawKey, store,);
  },

  getMany: async <T,>(
    keysList: string[],
    opts?: DbStoreOptions,
  ): Promise<(WithId<T> | undefined)[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const fullKeys = keysList.map((k,) =>
      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k
    );
    const rawValues = await getMany(fullKeys, store,);
    return rawValues.map((val, idx,) =>
      val !== undefined ? formatDbItem(fullKeys[idx]!, val, opts?.prefix,) as WithId<T> : undefined
    );
  },

  setMany: async (entriesList: [string, unknown,][], opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const entriesToSet: [string, unknown,][] = entriesList.map(([k, v,],) => {
      const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
      return [key, cleanVal,];
    },);
    await setMany(entriesToSet, store,);
  },

  deleteMany: async (keysList: string[], opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const fullKeys = keysList.map((k,) =>
      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k
    );
    await delMany(fullKeys, store,);
  },

  keys: async (opts?: DbStoreOptions,): Promise<string[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const allKeys = await keys(store,);
    return opts?.prefix
      ? allKeys.filter((k,) => typeof k === 'string' && k.startsWith(opts.prefix!,)) as string[]
      : allKeys as string[];
  },

  values: async <T,>(opts?: DbStoreOptions,): Promise<T[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const allEntries = await entries(store,);
    return formatDbEntries(allEntries, opts?.prefix,) as unknown as T[];
  },

  entries: async <T,>(opts?: DbStoreOptions,): Promise<[string, T,][]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const allEntries = await entries(store,);
    return opts?.prefix
      ? allEntries.filter(([k,],) => typeof k === 'string' && k.startsWith(opts.prefix!,)) as [
        string,
        T,
      ][]
      : allEntries as [string, T,][];
  },

  clear: async (opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    if (opts?.prefix) {
      const allKeys = await keys(store,);
      const keysToDelete = allKeys.filter((k,) =>
        typeof k === 'string' && k.startsWith(opts.prefix!,)
      );
      await delMany(keysToDelete, store,);
    } else {
      await clear(store,);
    }
  },

  query: async <T, R, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    return fn(formattedItems as WithId<T>[], context,);
  },

  getSome: async <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    const selectedItems = fn(formattedItems as WithId<T>[], context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error('A função injetada em GET_SOME deve retornar um Array.',);
    }
    return selectedItems;
  },

  delSome: async <T, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    const selectedItems = fn(formattedItems as WithId<T>[], context,);

    if (!Array.isArray(selectedItems,)) {
      throw new Error('A função injetada em DEL_SOME deve retornar um Array.',);
    }

    const keysToDelete: string[] = selectedItems.map((item: WithId<T>,) => {
      if (!item || item._id === undefined) {
        throw new Error("Os itens retornados em DEL_SOME precisam conter a propriedade '_id'.",);
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
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);

    const selectedItems = selectFn(formattedItems as WithId<T>[], context,);
    if (!Array.isArray(selectedItems,)) {
      throw new Error('A função de seleção em SET_SOME deve retornar um Array.',);
    }

    const entriesToSet: [string, unknown,][] = selectedItems.map((item: WithId<T>,) => {
      if (!item || item._id === undefined) {
        throw new Error("Os itens selecionados no SET_SOME precisam conter a propriedade '_id'.",);
      }
      const updatedItem = updateFn(item, context,);
      const { key, cleanVal, } = prepareForSave(undefined, updatedItem, opts?.prefix,);
      return [key, cleanVal,];
    },);
    await setMany(entriesToSet, store,);
  },

  exportDB: async (opts?: DbStoreOptions,): Promise<Record<string, unknown>> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const allEntries = await entries(store,);
    const filtered = opts?.prefix
      ? allEntries.filter(([k,],) => typeof k === 'string' && k.startsWith(opts.prefix!,))
      : allEntries;
    return Object.fromEntries(filtered,);
  },

  importDB: async (
    data: Record<string, unknown>,
    clearFirst = false,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    if (clearFirst) await globalSwDbAPI.clear(opts,);

    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(([k, v,],) => {
      const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
      return [key, cleanVal,];
    },);
    await setMany(entriesToImport, store,);
  },

  backupToOpfs: async (key: string, fileName?: string, opts?: DbStoreOptions,): Promise<string> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    const allEntries = await entries(store,);
    const filtered = opts?.prefix
      ? allEntries.filter(([k,],) => typeof k === 'string' && k.startsWith(opts.prefix!,))
      : allEntries;
    const data = Object.fromEntries(filtered,);

    const finalName = fileName || 'backup.json';
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;

    const dir = await getRecordDir('backup', rawKey, true,);
    const fileHandle = await dir.getFileHandle(finalName, { create: true, },);
    const w = await fileHandle.createWritable();
    await w.write(new Blob([JSON.stringify(data,),], { type: 'application/json', },),);
    await w.close();

    return `${rawKey}/${finalName}`;
  },

  restoreFromOpfs: async (
    key: string,
    fileName: string,
    clearFirst = false,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir('backup', rawKey, false,);

    const finalName = fileName.includes('/',) ? fileName.split('/',).pop()! : fileName;

    const fileHandle = await dir.getFileHandle(finalName,);
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text(),);

    const store = getCustomStore(opts?.dbName, opts?.storeName,);
    if (clearFirst) await globalSwDbAPI.clear(opts,);

    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(([k, v,],) => {
      const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
      return [key, cleanVal,];
    },);
    await setMany(entriesToImport, store,);
  },
};

export const globalSwOpfsAPI = {
  ...globalSwDbAPI,

  listFiles: async (key: string, opts?: OpfsStoreOptions,): Promise<OpfsFileInfo[]> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const filesList = [];
    // @ts-ignore: Deno API for directory entries
    for await (const [name, handle,] of dir.entries()) {
      if (handle.kind === 'file') {
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

  getFile: async (key: string, fileName: string, opts?: OpfsStoreOptions,): Promise<File> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    return await fileHandle.getFile();
  },

  addFile: async (
    key: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const fh = await dir.getFileHandle(fileName, { create: true, },);
    const w = await fh.createWritable();
    await w.write(new Blob([await file.arrayBuffer(),],),);
    await w.close();
  },

  delFile: async (key: string, fileName: string, opts?: OpfsStoreOptions,): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    await dir.removeEntry(fileName,);
  },

  renFile: async (
    key: string,
    oldName: string,
    newName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
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
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
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
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const filesRecord: Record<string, Uint8Array> = {};

    // @ts-ignore: Deno API for directory entries
    for await (const [name, handle,] of dir.entries()) {
      if (handle.kind === 'file' && (!filesToZip || filesToZip.includes(name,))) {
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
      for (const name of Object.keys(filesRecord,)) await dir.removeEntry(name,);
    }
  },

  unzip: async (
    key: string,
    zipName: string,
    deleteZip = false,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(await (await zipFileHandle.getFile()).arrayBuffer(),);

    const unzipped = unzipSync(zipBuffer,);
    for (const [name, data,] of Object.entries(unzipped,)) {
      if (!name.includes('/',)) {
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
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(await (await zipFileHandle.getFile()).arrayBuffer(),);
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
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,) ? `${opts.prefix}${key}` : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(await (await zipFileHandle.getFile()).arrayBuffer(),);
    const currentZipData = unzipSync(zipBuffer,);

    delete currentZipData[fileName];

    const newZippedData = zipSync(currentZipData,);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([newZippedData as BlobPart,],),);
    await w.close();
  },
};

// 💎 EXPORTA A API INTERNA PARA SER CONSUMIDA PELO PROXY (db.ts)
export const internalAPI = globalSwOpfsAPI;

export function createScopedDb(dbName?: string, storeName = 'keyval', prefix = '',) {
  const opts: DbStoreOptions = { dbName, storeName, prefix, };
  return {
    get: <T,>(key: string,) => globalSwDbAPI.get<T>(key, opts,),
    set: <T,>(keyOrVal: string | T, val?: T,) =>
      globalSwDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T,>(key: string, updater: (val: WithId<T> | undefined,) => T,) =>
      globalSwDbAPI.update<T>(key, updater, opts,),
    patch: <T extends Record<string, unknown>, C = unknown,>(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),
      context?: C,
    ) => globalSwDbAPI.patch<T, C>(key, patchOrFn, context, opts,),
    delete: (key: string,) => globalSwDbAPI.delete(key, opts,),
    getMany: <T,>(keys: string[],) => globalSwDbAPI.getMany<T>(keys, opts,),
    setMany: (entries: [string, unknown,][],) => globalSwDbAPI.setMany(entries, opts,),
    deleteMany: (keys: string[],) => globalSwDbAPI.deleteMany(keys, opts,),
    keys: () => globalSwDbAPI.keys(opts,),
    values: <T,>() => globalSwDbAPI.values<T>(opts,),
    entries: <T,>() => globalSwDbAPI.entries<T>(opts,),
    clear: () => globalSwDbAPI.clear(opts,),
    query: <T, R, C = unknown,>(fn: (items: WithId<T>[], ctx?: C,) => R, context?: C,) =>
      globalSwDbAPI.query<T, R, C>(fn, context, opts,),
    getSome: <T, C = unknown,>(fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[], context?: C,) =>
      globalSwDbAPI.getSome<T, C>(fn, context, opts,),
    delSome: <T, C = unknown,>(fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[], context?: C,) =>
      globalSwDbAPI.delSome<T, C>(fn, context, opts,),
    setSome: <T, C = unknown,>(
      selectFn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C,) => WithId<T>,
      context?: C,
    ) => globalSwDbAPI.setSome<T, C>(selectFn, updateFn, context, opts,),
    exportDB: () => globalSwDbAPI.exportDB(opts,),
    importDB: (data: Record<string, unknown>, clearFirst = false,) =>
      globalSwDbAPI.importDB(data, clearFirst, opts,),
    backupToOpfs: (key: string, fileName?: string,) =>
      globalSwDbAPI.backupToOpfs(key, fileName, opts,),
    restoreFromOpfs: (key: string, fileName: string, clearFirst = false,) =>
      globalSwDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts,),
    gerarId,
    gerarIdComPrefixo: () => prefix ? gerarIdComPrefixo(prefix,) : gerarId(),
  };
}

export function createScopedOpfs(
  dbName?: string,
  storeName = 'keyval',
  prefix = '',
  basePath = '',
) {
  const opts: OpfsStoreOptions = { dbName, storeName, prefix, basePath, };
  return {
    ...createScopedDb(dbName, storeName, prefix,),
    listFiles: (key: string,) => globalSwOpfsAPI.listFiles(key, opts,),
    getFile: (key: string, fileName: string,) => globalSwOpfsAPI.getFile(key, fileName, opts,),
    addFile: (key: string, file: File | Blob, fileName: string,) =>
      globalSwOpfsAPI.addFile(key, file, fileName, opts,),
    delFile: (key: string, fileName: string,) => globalSwOpfsAPI.delFile(key, fileName, opts,),
    renFile: (key: string, oldName: string, newName: string,) =>
      globalSwOpfsAPI.renFile(key, oldName, newName, opts,),
    mvFile: (key: string, fileName: string, newKey: string,) =>
      globalSwOpfsAPI.mvFile(key, fileName, newKey, opts,),
    zip: (key: string, zipName: string, filesToZip?: string[], deleteOriginals = false,) =>
      globalSwOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),
    unzip: (key: string, zipName: string, deleteZip = false,) =>
      globalSwOpfsAPI.unzip(key, zipName, deleteZip, opts,),
    addZip: (key: string, zipName: string, file: File | Blob, fileName: string,) =>
      globalSwOpfsAPI.addZip(key, zipName, file, fileName, opts,),
    delZip: (key: string, zipName: string, fileName: string,) =>
      globalSwOpfsAPI.delZip(key, zipName, fileName, opts,),
  };
}

export const db = Object.assign(
  (dbName?: string, storeName?: string, prefix?: string,) =>
    createScopedDb(dbName, storeName, prefix,),
  globalSwDbAPI,
);
export const opfs = Object.assign(
  (dbName?: string, storeName?: string, prefix?: string, basePath = '',) =>
    createScopedOpfs(dbName, storeName, prefix, basePath,),
  globalSwOpfsAPI,
);
