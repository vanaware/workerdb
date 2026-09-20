> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém experimentos e código da área de @vanaware/workerdb
> O projeto é o **WorkerDB ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: WORKERDB

Gerado automaticamente em: 9/20/2026, 5:30:37 PM

---

## Arquivo: `packages/worker-db/src/fake/fake-local-storage.ts`

```ts
export class FakeLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string,): string | null {
    return this.store.get(key,) ?? null;
  }

  setItem(key: string, value: string,): void {
    this.store.set(key, String(value,),);
  }

  removeItem(key: string,): void {
    this.store.delete(key,);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number,): string | null {
    return Array.from(this.store.keys(),)[index] ?? null;
  }
}

```

---

## Arquivo: `packages/worker-db/src/fake/fake-worker.ts`

```ts
// src/fake/fake-worker.ts

// 1. Inject Fake IndexedDB into the global scope (self) of the Worker
import "fake-indexeddb/auto";

import { FakeOPFSDirectory } from "./fake-opfs.ts";

const _self = globalThis as unknown as Record<string, unknown>;

// 2. Inject Fake OPFS into the Worker scope
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Import real worker logic with simulated environment
import "../worker.ts";

```

---

## Arquivo: `packages/worker-db/src/fake/fake-db.ts`

```ts
/**
 * @module @vanaware/workerdb/swfake
 * @description Testing and simulation environment for Service Worker and Web Worker environments.
 * Injects in-memory IndexedDB and simulated OPFS into the ServiceWorkerGlobalScope (`self`)
 * for isolated testing of background sync, worker caches, and offline logic.
 */

// 1. Inject Fake IndexedDB into global scope of the Service Worker (self)
import "fake-indexeddb/auto";
import { FakeOPFSDirectory } from "./fake-opfs.ts";

const _self = self as unknown as Record<string, unknown>;

// 2. Inject Fake OPFS into the Service Worker scope
// navigator.storage.getDirectory() exists in modern Service Workers,
// so we replace it with our in-memory fake version.
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Export direct database APIs with simulated environment.
// Imports directly from db.ts since the Service Worker is already a background worker.
export { db, opfs } from "../db.ts";

```

---

## Arquivo: `packages/worker-db/src/fake/fake-mod.ts`

```ts
/**
 * @module @vanaware/workerdb/fake
 * @description Testing and simulation environment for Main Thread applications.
 * Automatically injects in-memory IndexedDB (via fake-indexeddb), simulated OPFS,
 * and a Mock Web Worker for end-to-end testing in Node.js or Deno without headless browsers.
 */

// 1. Inject Fake IndexedDB globally (Main Thread)
import "fake-indexeddb/auto";
import { FakeOPFSDirectory } from "./fake-opfs.ts";
import { FakeLocalStorage } from "./fake-local-storage.ts";

const _global = globalThis as Record<string, unknown>;

// 2. Inject Fake OPFS (Main Thread)
if (!_global.navigator) _global.navigator = {};
const navigator = _global.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Inject Fake LocalStorage (Main Thread)
if (
  !_global.localStorage ||
  _global.localStorage.constructor.name !== "FakeLocalStorage"
) {
  try {
    Object.defineProperty(_global, "localStorage", {
      value: new FakeLocalStorage(),
      writable: true,
      configurable: true,
    });
  } catch {
    _global.localStorage = new FakeLocalStorage();
  }
}

// 4. Export everything from main module
export * from "../mod-main.ts";

// 5. Initialize the module to use the Fake Worker.
// Deno resolves .ts files natively in Workers using import.meta.url
import { db } from "../mod-main.ts";
const fakeWorkerUrl = new URL("./fake-worker.ts", import.meta.url);
db.init(fakeWorkerUrl);

```

---

## Arquivo: `packages/worker-db/src/fake/fake-opfs.ts`

```ts
export class FakeOPFSFileHandle {
  public kind: "file" | "directory" = "file";

  constructor(
    private fullPath: string,
    private storage: Map<string, Uint8Array>,
  ) {}

  createWritable() {
    const chunks: Uint8Array[] = [];
    const storage = this.storage;
    const fullPath = this.fullPath;
    return {
      async write(data: Uint8Array | string | Blob | ArrayBuffer,) {
        let chunk: Uint8Array;
        if (data instanceof Uint8Array) {
          chunk = data;
        } else if (data instanceof ArrayBuffer) {
          chunk = new Uint8Array(data,);
        } else if (data instanceof Blob) {
          chunk = new Uint8Array(await data.arrayBuffer(),);
        } else {
          chunk = new TextEncoder().encode(String(data,),);
        }
        chunks.push(chunk,);
      },
      close() {
        const totalLen = chunks.reduce((acc, c,) => acc + c.length, 0,);
        const merged = new Uint8Array(totalLen,);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset,);
          offset += c.length;
        }
        storage.set(fullPath, merged,);
      },
    };
  }

  getFile(): Promise<File> {
    const content = this.storage.get(this.fullPath,);
    if (content === undefined) {
      throw new Error(`File ${this.fullPath} not found in Fake OPFS`,);
    }
    const fileName = this.fullPath.split("/",).pop() || "file";
    return Promise.resolve(
      new File([content as BlobPart,], fileName, {
        type: "application/octet-stream",
        lastModified: Date.now(),
      },),
    );
  }
}

export class FakeOPFSDirectory {
  public kind: "file" | "directory" = "directory";
  private static sharedStorage = new Map<string, Uint8Array>();

  constructor(private path: string = "",) {}

  getDirectoryHandle(name: string, options?: { create?: boolean },) {
    return new FakeOPFSDirectory(this.path ? `${this.path}/${name}` : name,);
  }

  getFileHandle(name: string, options?: { create?: boolean },) {
    const fullPath = this.path ? `${this.path}/${name}` : name;
    if (!options?.create && !FakeOPFSDirectory.sharedStorage.has(fullPath,)) {
      throw new Error(`File ${fullPath} not found in Fake OPFS`,);
    }
    return new FakeOPFSFileHandle(fullPath, FakeOPFSDirectory.sharedStorage,);
  }

  removeEntry(name: string,) {
    const fullPath = this.path ? `${this.path}/${name}` : name;
    FakeOPFSDirectory.sharedStorage.delete(fullPath,);
    for (const key of Array.from(FakeOPFSDirectory.sharedStorage.keys())) {
      if (key === fullPath || key.startsWith(`${fullPath}/`,)) {
        FakeOPFSDirectory.sharedStorage.delete(key,);
      }
    }
  }

  async *keys() {
    const yieldedDirs = new Set<string>();
    for (const key of FakeOPFSDirectory.sharedStorage.keys()) {
      if (this.path && key.startsWith(`${this.path}/`,)) {
        const localPath = key.slice(this.path.length + 1,);
        const slashIdx = localPath.indexOf("/",);
        if (slashIdx === -1) {
          yield localPath;
        } else {
          const dirName = localPath.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield dirName;
          }
        }
      } else if (!this.path) {
        const slashIdx = key.indexOf("/",);
        if (slashIdx === -1) {
          yield key;
        } else {
          const dirName = key.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield dirName;
          }
        }
      }
    }
  }

  async *entries() {
    const yieldedDirs = new Set<string>();
    for (const key of FakeOPFSDirectory.sharedStorage.keys()) {
      if (this.path && key.startsWith(`${this.path}/`,)) {
        const localPath = key.slice(this.path.length + 1,);
        const slashIdx = localPath.indexOf("/",);
        if (slashIdx === -1) {
          yield [
            localPath,
            new FakeOPFSFileHandle(key, FakeOPFSDirectory.sharedStorage,),
          ] as const;
        } else {
          const dirName = localPath.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield [
              dirName,
              new FakeOPFSDirectory(
                this.path ? `${this.path}/${dirName}` : dirName,
              ),
            ] as const;
          }
        }
      } else if (!this.path) {
        const slashIdx = key.indexOf("/",);
        if (slashIdx === -1) {
          yield [
            key,
            new FakeOPFSFileHandle(key, FakeOPFSDirectory.sharedStorage,),
          ] as const;
        } else {
          const dirName = key.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield [
              dirName,
              new FakeOPFSDirectory(dirName,),
            ] as const;
          }
        }
      }
    }
  }

  async *values() {
    for await (const [, handle,] of this.entries()) {
      yield handle;
    }
  }

  static clear() {
    FakeOPFSDirectory.sharedStorage.clear();
  }
}

```

---

## Arquivo: `packages/worker-db/src/utils/id.ts`

````ts
// src/utils/id-utils.ts

/**
 * Type extending an object with an `_id` property.
 * @template T The base object type.
 */
export type WithId<T> = T & { _id: string };

/**
 * Generates a short, secure unique identifier.
 * Uses Web Crypto API if available, otherwise falls back to a mathematical generator.
 *
 * @returns {string} Generated 12-character ID (hexadecimal or base36).
 *
 * @example
 * ```ts
 * const id = gerarId();
 * console.log(id); // "a1b2c3d4e5f6"
 * ```
 */
export function gerarId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0"))
      .join("").substring(
        0,
        12,
      );
  }
  return gerarIdFallback();
}

/**
 * Fallback for ID generation if crypto.getRandomValues is unavailable.
 * Combines a base36 timestamp with a random string.
 *
 * @returns {string} Temporary ID.
 */
export function gerarIdFallback(): string {
  return Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8);
}

/**
 * Validates whether a string has an acceptable WorkerDB ID format.
 *
 * @param {string} id The ID to validate.
 * @returns {boolean} True if the ID is valid (non-empty string up to 24 characters).
 */
export function validarId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 24;
}

/**
 * Generates a prefixed unique ID.
 *
 * @param {string} prefix The prefix to prepend to the ID.
 * @returns {string} The prefixed ID.
 */
export function gerarIdComPrefixo(prefix: string): string {
  return `${prefix}${gerarId()}`;
}

/**
 * Dynamically injects the `_id` field into an object when reading from storage,
 * stripping the prefix if present.
 *
 * @param {IDBValidKey} key The raw IndexedDB/LocalStorage key.
 * @param {unknown} val The raw stored value.
 * @param {string} [prefix=""] The prefix to remove from the key.
 * @returns {unknown} The object with the injected `_id` field.
 * @internal
 */
export function formatDbItem(
  key: IDBValidKey,
  val: unknown,
  prefix = "",
): unknown {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const keyStr = String(key);
  const _id = prefix && keyStr.startsWith(prefix)
    ? keyStr.slice(prefix.length)
    : keyStr;
  return { _id, ...val };
}

/**
 * Prepares a record for storage, generating automatic keys and stripping the internal `_id`.
 *
 * @param {string | undefined | null} key Suggested key or "auto".
 * @param {unknown} val Object to be saved.
 * @param {string} [prefix=""] Prefix to apply to the final key.
 * @returns {{ key: string; cleanVal: unknown }} Object containing the final key and sanitized value.
 * @throws {Error} If no key can be determined.
 * @internal
 */
export function prepareForSave(
  key: string | undefined | null,
  val: unknown,
  prefix = "",
): { key: string; cleanVal: unknown } {
  let rawId = val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)._id as string | undefined
    : undefined;

  if (rawId === "auto") {
    rawId = gerarId();
  }

  // Intercept key provided as "auto" via direct parameter or setMany tuple
  const processKey = key === "auto" ? gerarId() : key;

  let finalKey = processKey || "";

  if (rawId) {
    if (prefix && rawId.startsWith(prefix)) {
      finalKey = rawId;
    } else {
      finalKey = prefix ? `${prefix}${rawId}` : rawId;
    }
  } else if (processKey) {
    if (prefix && processKey.startsWith(prefix)) {
      finalKey = processKey;
    } else {
      finalKey = prefix ? `${prefix}${processKey}` : processKey;
    }
  }

  if (!finalKey) {
    throw new Error(
      "A key or an '_id' attribute on the object must be provided.",
    );
  }

  if (
    val && typeof val === "object" && !Array.isArray(val) &&
    "_id" in (val as Record<string, unknown>)
  ) {
    const { _id: _, ...cleanVal } = val as Record<string, unknown>;
    return { key: finalKey, cleanVal };
  }

  return { key: finalKey, cleanVal: val };
}

````

---

## Arquivo: `packages/worker-db/src/utils/idb-keyval.ts`

```ts
/**
 * @module @workerdb/utils/idb-keyval
 * @description Lightweight IndexedDB key-value helper based on idb-keyval patterns.
 */

/**
 * Wraps an IDBRequest or IDBTransaction in a standard Promise.
 *
 * @param request The IDBRequest or IDBTransaction to convert to a Promise.
 * @returns A Promise that resolves with the request result or transaction completion.
 */
export function promisifyRequest<T = undefined>(
  request: IDBRequest<T> | IDBTransaction,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // IDBTransaction uses oncomplete, IDBRequest uses onsuccess
    // deno-lint-ignore no-explicit-any
    (request as any).oncomplete = (request as any).onsuccess = () =>
      resolve((request as IDBRequest<T>).result);
    // deno-lint-ignore no-explicit-any
    (request as any).onabort = (request as any).onerror = () =>
      reject(request.error);
  });
}

/**
 * Function type representing a store execution callback.
 */
export type UseStore = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>,
) => Promise<T>;

/**
 * Creates a custom store invoker for a given database and store name.
 *
 * @param dbName Name of the IndexedDB database.
 * @param storeName Name of the object store.
 * @returns A UseStore callback function.
 */
export function createStore(dbName: string, storeName: string): UseStore {
  let dbp: Promise<IDBDatabase> | undefined;
  const getDB = (): Promise<IDBDatabase> => {
    if (dbp) return dbp;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    dbp = promisifyRequest(request);
    dbp.then(
      (db) => {
        db.onclose = () => {
          dbp = undefined;
        };
      },
      () => {
        dbp = undefined;
      },
    );
    return dbp;
  };
  return (txMode, callback) =>
    getDB().then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName))
    );
}

let defaultGetStoreFunc: UseStore | undefined;

/**
 * Returns the default store instance ('keyval-store', 'keyval').
 *
 * @returns The default UseStore function.
 */
export function defaultGetStore(): UseStore {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("keyval-store", "keyval");
  }
  return defaultGetStoreFunc;
}

/**
 * Retrieves a value by its key.
 *
 * @param key Key to query.
 * @param customStore Optional custom store callback.
 * @returns Value or undefined if not found.
 */
export function get<T = unknown>(
  key: IDBValidKey,
  customStore: UseStore = defaultGetStore(),
): Promise<T | undefined> {
  return customStore("readonly", (store) =>
    promisifyRequest<T>(store.get(key) as IDBRequest<T>)
  );
}

/**
 * Sets a value for a specific key.
 *
 * @param key Key to store against.
 * @param value Value to store.
 * @param customStore Optional custom store callback.
 */
export function set(
  key: IDBValidKey,
  value: unknown,
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Sets multiple key-value pairs at once atomically.
 *
 * @param entries Array of [key, value] pairs.
 * @param customStore Optional custom store callback.
 */
export function setMany(
  entries: [IDBValidKey, unknown][],
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    entries.forEach((entry) => store.put(entry[1], entry[0]));
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Retrieves multiple values by their keys in order.
 *
 * @param keys Array of keys to retrieve.
 * @param customStore Optional custom store callback.
 * @returns Array of retrieved values or undefined for missing keys.
 */
export function getMany<T = unknown>(
  keys: IDBValidKey[],
  customStore: UseStore = defaultGetStore(),
): Promise<(T | undefined)[]> {
  return customStore("readonly", (store) =>
    Promise.all(
      keys.map((key) => promisifyRequest<T>(store.get(key) as IDBRequest<T>)),
    )
  );
}

/**
 * Updates a value atomically using an updater callback.
 *
 * @param key Key to update.
 * @param updater Function to compute the new value from the previous value.
 * @param customStore Optional custom store callback.
 */
export function update<T = unknown>(
  key: IDBValidKey,
  updater: (oldValue: T | undefined) => T,
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore(
    "readwrite",
    (store) =>
      new Promise<void>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => {
          try {
            store.put(updater(req.result), key);
            resolve(promisifyRequest(store.transaction!));
          } catch (err) {
            reject(err);
          }
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Deletes a particular key from the store.
 *
 * @param key Key to delete.
 * @param customStore Optional custom store callback.
 */
export function del(
  key: IDBValidKey,
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Deletes multiple keys at once.
 *
 * @param keys Keys to delete.
 * @param customStore Optional custom store callback.
 */
export function delMany(
  keys: IDBValidKey[],
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    keys.forEach((key) => store.delete(key));
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Clears all entries from the store.
 *
 * @param customStore Optional custom store callback.
 */
export function clear(
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.clear();
    return promisifyRequest(store.transaction!);
  });
}

function eachCursor(
  store: IDBObjectStore,
  callback: (cursor: IDBCursorWithValue) => void,
): Promise<void> {
  store.openCursor().onsuccess = function () {
    if (!this.result) return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction!);
}

/**
 * Retrieves all keys stored in the object store.
 *
 * @param customStore Optional custom store callback.
 * @returns Array of keys.
 */
export function keys<KeyType extends IDBValidKey = IDBValidKey>(
  customStore: UseStore = defaultGetStore(),
): Promise<KeyType[]> {
  return customStore("readonly", (store) => {
    if (store.getAllKeys) {
      return promisifyRequest(
        store.getAllKeys() as unknown as IDBRequest<KeyType[]>,
      );
    }
    const items: KeyType[] = [];
    return eachCursor(store, (cursor) => items.push(cursor.key as KeyType)).then(
      () => items,
    );
  });
}

/**
 * Retrieves all values stored in the object store.
 *
 * @param customStore Optional custom store callback.
 * @returns Array of values.
 */
export function values<T = unknown>(
  customStore: UseStore = defaultGetStore(),
): Promise<T[]> {
  return customStore("readonly", (store) => {
    if (store.getAll) {
      return promisifyRequest(store.getAll() as IDBRequest<T[]>);
    }
    const items: T[] = [];
    return eachCursor(store, (cursor) => items.push(cursor.value as T)).then(
      () => items,
    );
  });
}

/**
 * Retrieves all [key, value] pairs stored in the object store.
 *
 * @param customStore Optional custom store callback.
 * @returns Array of [key, value] entries.
 */
export function entries<
  KeyType extends IDBValidKey = IDBValidKey,
  ValueType = unknown,
>(
  customStore: UseStore = defaultGetStore(),
): Promise<[KeyType, ValueType][]> {
  return customStore("readonly", (store) => {
    if (store.getAll && store.getAllKeys) {
      return Promise.all([
        promisifyRequest(
          store.getAllKeys() as unknown as IDBRequest<KeyType[]>,
        ),
        promisifyRequest(store.getAll() as IDBRequest<ValueType[]>),
      ]).then(([keysList, valuesList]) =>
        keysList.map((key, i) => [key, valuesList[i]] as [KeyType, ValueType])
      );
    }
    const items: [KeyType, ValueType][] = [];
    return eachCursor(store, (cursor) =>
      items.push([cursor.key as KeyType, cursor.value as ValueType])
    ).then(() => items);
  });
}

```

---

## Arquivo: `packages/worker-db/src/utils/opfs.ts`

```ts
// src/utils/opfs.ts

/**
 * Options for resolving OPFS file names.
 */
export interface OpfsResolveOptions {
  dbName?: string;
  storeName?: string;
  prefix?: string;
}

/**
 * Resolves a normalized OPFS file name based on storage type, names, and prefix.
 */
export function resolveOpfsFileName(
  type: "db" | "ls",
  fileName: string,
  opts?: OpfsResolveOptions,
): string {
  const parts: string[] = [type];
  if (type === "db") {
    if (opts?.dbName) parts.push(opts.dbName);
    if (opts?.storeName) parts.push(opts.storeName);
  }
  if (opts?.prefix) parts.push(opts.prefix);

  parts.push(fileName);
  return parts.join("_");
}

async function getOpfsRootDir(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}

// Navigates and creates (if needed) the full path based on slash-delimited strings from OPFS root
async function resolvePath(filePath: string, create = false) {
  const rootDir = await getOpfsRootDir();
  const parts = filePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  let curr = rootDir;
  for (const p of parts) {
    curr = await curr.getDirectoryHandle(p, { create });
  }
  return { dir: curr, fileName };
}

/**
 * Writes JSON data to an OPFS file path.
 *
 * @param filePath Relative path from OPFS root.
 * @param data JSON-serializable data.
 * @returns The resolved file path.
 */
export async function writeJsonToOpfs(
  filePath: string,
  data: unknown,
): Promise<string> {
  const { dir, fileName } = await resolvePath(filePath, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
  return filePath;
}

/**
 * Writes a ReadableStream of bytes to an OPFS file path.
 *
 * @param filePath Relative path from OPFS root.
 * @param stream Readable byte stream.
 * @returns The resolved file path.
 */
export async function writeStreamToOpfs(
  filePath: string,
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const { dir, fileName } = await resolvePath(filePath, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await writable.write(value as unknown as BufferSource);
      }
    }
  } finally {
    reader.releaseLock();
  }
  await writable.close();
  return filePath;
}

/**
 * Reads and parses JSON data from an OPFS file.
 *
 * @param filePath Relative path from OPFS root.
 * @returns Parsed JSON content.
 */
export async function readJsonFromOpfs(filePath: string): Promise<unknown> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Deletes a file from OPFS.
 *
 * @param filePath Relative path from OPFS root.
 */
export async function deleteFromOpfs(filePath: string): Promise<void> {
  const { dir, fileName } = await resolvePath(filePath, false);
  await dir.removeEntry(fileName);
}

/**
 * Gets a File handle from an OPFS file path.
 *
 * @param filePath Relative path from OPFS root.
 * @returns The File object.
 */
export async function getFileFromOpfs(filePath: string): Promise<File> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  return await fileHandle.getFile();
}

/**
 * Gets a byte ReadableStream from an OPFS file.
 *
 * @param filePath Relative path from OPFS root.
 * @returns A byte ReadableStream.
 */
export async function getFileStreamFromOpfs(
  filePath: string,
): Promise<ReadableStream<Uint8Array>> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.stream();
}

/**
 * Recursively lists files preserving relative paths (e.g., "backup/MY_KEY/backup.json" or "demo/FS_test-file/hello.txt").
 *
 * @param dirHandle Optional directory handle to start listing from (defaults to OPFS root).
 * @param path Current relative path prefix.
 * @returns Array of relative file paths.
 */
export async function listOpfsFiles(
  dirHandle?: FileSystemDirectoryHandle,
  path = "",
): Promise<string[]> {
  const dir = dirHandle || await getOpfsRootDir();
  let files: string[] = [];
  // @ts-ignore: async iterator support
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file") {
      files.push(path ? `${path}/${name}` : name);
    } else if (handle.kind === "directory") {
      const subFiles = await listOpfsFiles(
        handle,
        path ? `${path}/${name}` : name,
      );
      files = files.concat(subFiles);
    }
  }
  return files;
}

/**
 * Triggers a browser download for an OPFS file.
 */
export async function downloadOpfsFile(fileName: string): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error(
      "downloadOpfsFile can only be executed on the Main Thread (where 'document' is defined).",
    );
  }
  const file = await getFileFromOpfs(fileName);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.split("/").pop()!; // Download always uses only the final file name
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

```

---

## Arquivo: `packages/worker-db/src/utils/version.ts`

```ts
// Automatically generated file during build
declare const __APP_VERSION__: string;

/** Current library/application version. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined"
  ? __APP_VERSION__
  : "0.3.0#mua9rvo8";

```

---

## Arquivo: `packages/worker-db/src/ls.ts`

````ts
// src/ls.ts
import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from "./utils/id.ts";
import { opfs } from "./mod-main.ts";

/** Configuration options for the LocalStorage Store. */
export interface LsStoreOptions {
  /** Optional prefix for LocalStorage keys. */
  prefix?: string;
}

/**
 * Interface for synchronous operations on LocalStorage.
 * @template TDefault Default type for stored records.
 */
export interface WorkerLsAPI<TDefault = unknown> {
  /** Synchronously retrieves a record by key. */
  get: <T = TDefault>(key: string) => WithId<T> | undefined;
  /** Synchronously sets a record (key/value or value with auto-generated ID). */
  set: <T = TDefault>(keyOrVal: string | T, val?: T) => string;
  /** Synchronously applies a partial patch to a record. */
  patch: <
    T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>,
    C = unknown
  >(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
    context?: C
  ) => WithId<T>;
  /** Synchronously removes a record by key. */
  delete: (key: string) => void;
  /** Synchronously retrieves multiple records by keys. */
  getMany: <T = TDefault>(keys: string[]) => (WithId<T> | undefined)[];
  /** Synchronously sets multiple key-value pairs. */
  setMany: (entries: [string, unknown][]) => void;
  /** Synchronously removes multiple records by keys. */
  deleteMany: (keys: string[]) => void;
  /** Retrieves all keys filtered by prefix. */
  keys: () => string[];
  /** Retrieves all values filtered by prefix. */
  values: <T = TDefault>() => T[];
  /** Retrieves all [key, value] pairs filtered by prefix. */
  entries: <T = TDefault>() => [string, T][];
  /** Clears all records belonging to this prefix. */
  clear: () => void;
  /** Executes a synchronous query function over stored items. */
  query: <T = TDefault, R = unknown, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => R, context?: C) => R;
  /** Synchronously filters records using a predicate/selector function. */
  getSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C) => WithId<T>[];
  /** Synchronously deletes records selected by a function. */
  delSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C) => void;
  /** Synchronously updates records selected by a function. */
  setSome: <T = TDefault, C = unknown>(selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C) => void;
  /** Exports LocalStorage records to a JSON object. */
  exportLS: () => Record<string, unknown>;
  /** Imports records from a JSON object into LocalStorage. */
  importLS: (data: Record<string, unknown>, clearFirst?: boolean) => void;
  /** Asynchronously backs up LocalStorage records to OPFS. */
  backupToOpfs: (recordKey: string, fileName?: string) => Promise<string>;
  /** Asynchronously restores LocalStorage records from OPFS. */
  restoreFromOpfs: (recordKey: string, fileName: string, clearFirst?: boolean) => Promise<void>;
  /** Generates a random unique ID. */
  gerarId: () => string;
  /** Generates a random unique ID with the store prefix. */
  gerarIdComPrefixo: () => string;
}

function getAllPrefixedEntries(prefix = ""): [string, unknown][] {
  const entries: [string, unknown][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (!prefix || key.startsWith(prefix))) {
      const rawVal = localStorage.getItem(key);
      if (rawVal !== null) {
        try {
          entries.push([key, JSON.parse(rawVal)]);
        } catch {
          // Ignore items that are not valid JSON
        }
      }
    }
  }
  return entries;
}

function getFormattedItems<T>(prefix = ""): WithId<T>[] {
  const rawEntries = getAllPrefixedEntries(prefix);
  return rawEntries.map(([k, v]) => formatDbItem(k, v, prefix) as WithId<T>);
}

function resolveKey(key: string, prefix = ""): string {
  return prefix && !key.startsWith(prefix) ? `${prefix}${key}` : key;
}

function createScopedLs<TDefault = unknown>(prefix = ""): WorkerLsAPI<TDefault> {
  return {
    get: <T = TDefault>(key: string): WithId<T> | undefined => {
      const fullKey = resolveKey(key, prefix);
      const raw = localStorage.getItem(fullKey);
      if (raw === null) return undefined;
      try {
        return formatDbItem(fullKey, JSON.parse(raw), prefix) as WithId<T>;
      } catch {
        return undefined;
      }
    },

    set: <T = TDefault>(keyOrVal: string | T, val?: T): string => {
      let key: string | undefined;
      let targetVal: unknown;

      if (typeof keyOrVal === "string") {
        key = keyOrVal;
        targetVal = val;
      } else {
        key = undefined;
        targetVal = keyOrVal;
      }

      const { key: finalKey, cleanVal } = prepareForSave(
        key,
        targetVal,
        prefix,
      );
      localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      return finalKey;
    },

    patch: <
      T extends Record<string, unknown> = TDefault extends Record<
        string,
        unknown
      > ? TDefault
        : Record<string, unknown>,
      C = unknown,
    >(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
      context?: C,
    ): WithId<T> => {
      const current = createScopedLs<T>(prefix).get(key) || ({} as WithId<T>);
      let updated: unknown;

      if (typeof patchOrFn === "function") {
        updated = patchOrFn(current, context);
      } else {
        updated = Object.assign({}, current, patchOrFn);
      }

      const { key: finalKey, cleanVal } = prepareForSave(
        key,
        updated,
        prefix,
      );
      localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      return formatDbItem(finalKey, cleanVal, prefix) as WithId<T>;
    },

    delete: (key: string): void => {
      localStorage.removeItem(resolveKey(key, prefix));
    },

    getMany: <T = TDefault>(keys: string[]): (WithId<T> | undefined)[] => {
      const api = createScopedLs<T>(prefix);
      return keys.map((k) => api.get(k));
    },

    setMany: (entries: [string, unknown][]): void => {
      const api = createScopedLs(prefix);
      entries.forEach(([k, v]) => api.set(k, v));
    },

    deleteMany: (keys: string[]): void => {
      const api = createScopedLs(prefix);
      keys.forEach((k) => api.delete(k));
    },

    keys: (): string[] => {
      const keysList: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) {
          keysList.push(k);
        }
      }
      return keysList;
    },

    values: <T = TDefault>(): T[] => {
      return getFormattedItems<T>(prefix) as unknown as T[];
    },

    entries: <T = TDefault>(): [string, T][] => {
      return getAllPrefixedEntries(prefix) as [string, T][];
    },

    clear: (): void => {
      if (!prefix) {
        localStorage.clear();
        return;
      }
      const keysToRemove = createScopedLs(prefix).keys();
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    },

    query: <T = TDefault, R = unknown, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ): R => {
      const items = getFormattedItems<T>(prefix);
      return fn(items, context);
    },

    getSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ): WithId<T>[] => {
      const items = getFormattedItems<T>(prefix);
      const selected = fn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("The function in getSome must return an Array.");
      }
      return selected;
    },

    delSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ): void => {
      const items = getFormattedItems<T>(prefix);
      const selected = fn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("The function in delSome must return an Array.");
      }
      selected.forEach((item) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items returned by delSome must contain an '_id' property.",
          );
        }
        const rawKey = prefix && !item._id.startsWith(prefix)
          ? `${prefix}${item._id}`
          : item._id;
        localStorage.removeItem(rawKey);
      });
    },

    setSome: <T = TDefault, C = unknown>(
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ): void => {
      const items = getFormattedItems<T>(prefix);
      const selected = selectFn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error(
          "The selector function in setSome must return an Array.",
        );
      }
      selected.forEach((item) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items selected by setSome must contain an '_id' property.",
          );
        }
        const updatedItem = updateFn(item, context);
        const { key: finalKey, cleanVal } = prepareForSave(
          undefined,
          updatedItem,
          prefix,
        );
        localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      });
    },

    // --- EXPORT / IMPORT METHODS ---

    exportLS: (): Record<string, unknown> => {
      const allEntries = getAllPrefixedEntries(prefix);
      return Object.fromEntries(allEntries);
    },

    importLS: (data: Record<string, unknown>, clearFirst = false): void => {
      const api = createScopedLs(prefix);
      if (clearFirst) api.clear();
      Object.entries(data).forEach(([k, v]) => api.set(k, v));
    },

    backupToOpfs: async (
      recordKey: string,
      fileName = "backup.json",
    ): Promise<string> => {
      const data = Object.fromEntries(getAllPrefixedEntries(prefix));
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });

      // Instantiate OPFS drive via worker targeting the physical /backup directory
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup");
      await drive.addFile(recordKey, blob, fileName);

      return `${recordKey}/${fileName}`;
    },

    restoreFromOpfs: async (
      recordKey: string,
      fileName: string,
      clearFirst = false,
    ): Promise<void> => {
      // Instantiate OPFS drive via worker for reading from /backup directory
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup");

      const fileBlob = await drive.getFile(recordKey, fileName);
      const data = JSON.parse(await fileBlob.text());

      const api = createScopedLs(prefix);
      if (clearFirst) api.clear();
      Object.entries(data).forEach(([k, v]) => api.set(k, v));
    },

    gerarId,
    gerarIdComPrefixo: () => (prefix ? gerarIdComPrefixo(prefix) : gerarId()),
  };
}

/**
 * Access point for LocalStorage persistence.
 * Provides synchronous storage with complex object (JSON) support and automatic IDs.
 *
 * @example
 * ```ts
 * ls.set("settings", { theme: "dark" });
 * const settings = ls.get("settings");
 * ```
 */
export const ls: ((prefix?: string) => WorkerLsAPI<unknown>) &
  WorkerLsAPI<unknown> = Object.assign(
    (prefix = ""): WorkerLsAPI<unknown> => createScopedLs(prefix),
    createScopedLs(),
  );

````

---

## Arquivo: `packages/worker-db/src/rpc.ts`

```ts
// ## Arquivo: monorepo/worker-db/src/rpc.ts
import { gerarId, gerarIdComPrefixo, type WithId, } from "./utils/id.ts";
import type {
  DbStoreOptions,
  IndexQuery,
  OpfsFileInfo,
  OpfsStoreOptions,
  WorkerDbAPI,
  WorkerOpfsAPI,
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

    workerInstance.onerror = (event) => {
      console.error("⚠️ Critical failure in Web Worker:", event.message);
      pendingRequests.forEach(({ reject }) =>
        reject(new Error("Worker crashed"))
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
  pendingRequests.forEach(({ reject }) =>
    reject(new Error("Worker was restarted"))
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

function exec<T>(
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

const globalDbAPI: WorkerDbAPI<unknown> = {
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
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
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
  getSomeByIndex: <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>("GET_SOME_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  queryByIndex: <T, R, C = unknown>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> =>
    exec<R>("QUERY_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
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
  delSomeByIndex: <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DEL_SOME_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  setSomeByIndex: <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
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
    }),
  query: <T, R, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> =>
    exec<R>("QUERY", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  getSome: <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>("GET_SOME", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  delSome: <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DEL_SOME", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  setSome: <T, C = unknown>(
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("SET_SOME", {
      selectFnStr: selectFn.toString(),
      updateFnStr: updateFn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
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
  gerarId: (): string => gerarId(),
  gerarIdComPrefixo: (prefix?: string): string =>
    gerarIdComPrefixo(prefix || ""),
};

function createScopedDb<TDefault = unknown>(
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
    get: <T = TDefault,>(key: string,) => globalDbAPI.get<T>(key, opts,),
    set: <T = TDefault,>(keyOrVal: string | T, val?: T,) =>
      globalDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T = TDefault,>(
      key: string,
      updater: (val: WithId<T> | undefined,) => T,
    ) => globalDbAPI.update<T>(key, updater, opts,),
    patch: <
      T extends Record<string, unknown> = TDefault extends Record<
        string,
        unknown
      > ? TDefault
        : Record<string, unknown>,
      C = unknown,
    >(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
      context?: C,
    ) => globalDbAPI.patch<T, C>(key, patchOrFn, context, opts),
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
    getSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) =>
      globalDbAPI.getSomeByIndex<T, C>(
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
      globalDbAPI.queryByIndex<T, R, C>(
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
    delSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) =>
      globalDbAPI.delSomeByIndex<T, C>(
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
    ) =>
      globalDbAPI.setSomeByIndex<T, C>(
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
    ) => globalDbAPI.query<T, R, C>(fn, context, opts),
    getSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.getSome<T, C>(fn, context, opts),
    delSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.delSome<T, C>(fn, context, opts),
    setSome: <T = TDefault, C = unknown>(
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) => globalDbAPI.setSome<T, C>(selectFn, updateFn, context, opts),
    exportDB: () => globalDbAPI.exportDB(opts,),
    importDB: (data: Record<string, unknown>, clearFirst = false,) =>
      globalDbAPI.importDB(data, clearFirst, opts,),
    backupToOpfs: (key: string, fileName?: string,) =>
      globalDbAPI.backupToOpfs(key, fileName, opts,),
    restoreFromOpfs: (key: string, fileName: string, clearFirst = false) =>
      globalDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),
    init: (workerPath?: string | URL) => globalDbAPI.init(workerPath),
    restart: () => globalDbAPI.restart(),
    terminate: () => globalDbAPI.terminate(),
    gerarId: () => globalDbAPI.gerarId(),
    gerarIdComPrefixo: () =>
      opts.prefix ? globalDbAPI.gerarIdComPrefixo(opts.prefix) : globalDbAPI.gerarId(),
  };
}

const globalOpfsAPI: WorkerOpfsAPI<unknown> = {
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
    }),
  init: (workerPath?: string | URL) => globalDbAPI.init(workerPath),
  restart: () => globalDbAPI.restart(),
  terminate: () => globalDbAPI.terminate(),
  gerarId: (): string => gerarId(),
  gerarIdComPrefixo: (prefix?: string): string =>
    gerarIdComPrefixo(prefix || ""),
};

function createScopedOpfs<TDefault = unknown>(
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

/**
 * Access point for Database (IndexedDB) via Web Worker Proxy.
 * Ideal for use on the browser Main Thread to prevent UI blocking.
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
  globalDbAPI,
);

/**
 * Access point for File System (OPFS) via Web Worker Proxy.
 * Ideal for use on the browser Main Thread.
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
  globalOpfsAPI,
);

```

---

## Arquivo: `packages/worker-db/src/db.ts`

````ts
// src/db.ts
// Central database module: Single source of truth for IDB and OPFS manipulation.
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
} from "./utils/idb-keyval.ts";
import { unzipSync, zipSync } from "fflate";

import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from "./utils/id.ts";

// ============================================================================
// TYPE DEFINITIONS (Single Source of Truth)
// ============================================================================
/**
 * Configuration options for IndexedDB Object Stores.
 */
export interface DbStoreOptions {
  /** Name of the IndexedDB database. */
  dbName?: string;
  /** Name of the object store within the database. */
  storeName?: string;
  /** Optional prefix for key isolation in this instance. */
  prefix?: string;
  /** List of field names to index. */
  indexes?: string[];
  /** Database version (incremental). */
  dbVersion?: number;
  /** String representation of validation function (used across RPC). */
  validatorStr?: string;
  /** Optional validation function for saved records. */
  validator?: (val: unknown) => boolean;
}

/**
 * Extended options for OPFS storage.
 */
export interface OpfsStoreOptions extends DbStoreOptions {
  /** Base path (root directory) in OPFS. */
  basePath?: string;
}

/**
 * File metadata in OPFS.
 */
export interface OpfsFileInfo {
  /** Name of the file. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type of the file. */
  type: string;
  /** Timestamp of last modification. */
  lastModified: number;
}

/**
 * Query range for index operations.
 */
export interface IndexRange {
  /** Exact match value. */
  eq?: IDBValidKey;
  /** Greater than. */
  gt?: IDBValidKey;
  /** Greater than or equal to. */
  gte?: IDBValidKey;
  /** Less than. */
  lt?: IDBValidKey;
  /** Less than or equal to. */
  lte?: IDBValidKey;
}

/** Query type for index operations (IDBValidKey, IDBKeyRange, or IndexRange). */
export type IndexQuery = IDBValidKey | IDBKeyRange | IndexRange;

/**
 * Main interface for database operations (IndexedDB).
 * @template TDefault Default record type.
 */
export interface WorkerDbAPI<TDefault = unknown> {
  /** Retrieves a record by key. */
  get: <T = TDefault>(key: string, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;
  /** Sets a record (key/value or value with auto-generated ID). */
  set: <T = TDefault>(keyOrVal: string | T, val?: T | DbStoreOptions, opts?: DbStoreOptions) => Promise<string>;
  /** Updates a record via an updater callback function. */
  update: <T = TDefault>(key: string, updater: (val: WithId<T> | undefined) => T, opts?: DbStoreOptions) => Promise<void>;
  /** Applies a partial patch to a record. */
  patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions
  ) => Promise<WithId<T>>;
  /** Deletes a record by key. */
  delete: (key: string, opts?: DbStoreOptions) => Promise<void>;
  /** Retrieves multiple records by keys. */
  getMany: <T = TDefault>(keysList: string[], opts?: DbStoreOptions) => Promise<(WithId<T> | undefined)[]>;
  /** Sets multiple key-value pairs in batch. */
  setMany: (entriesList: [string, unknown][], opts?: DbStoreOptions) => Promise<void>;
  /** Deletes multiple records by keys in batch. */
  deleteMany: (keysList: string[], opts?: DbStoreOptions) => Promise<void>;
  /** Retrieves all keys in the store. */
  keys: (opts?: DbStoreOptions) => Promise<string[]>;
  /** Retrieves all values in the store. */
  values: <T = TDefault>(opts?: DbStoreOptions) => Promise<T[]>;
  /** Retrieves all [key, value] pairs in the store. */
  entries: <T = TDefault>(opts?: DbStoreOptions) => Promise<[string, T][]>;
  /** Clears all records in the store. */
  clear: (opts?: DbStoreOptions) => Promise<void>;
  /** Counts records matching an index query. */
  countByIndex: (indexName: string, query?: IndexQuery, opts?: DbStoreOptions) => Promise<number>;
  /** Retrieves a single record by index query. */
  getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;
  /** Retrieves all keys matching an index query. */
  keysByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<string[]>;
  /** Applies a partial patch to records matching an index query. */
  patchByIndex: <T = TDefault>(indexName: string, query: IndexQuery, patch: Partial<T>, opts?: DbStoreOptions) => Promise<void>;
  /** Retrieves indexed records with cursor-based pagination. */
  getByIndexPaginated: <T = TDefault>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions
  ) => Promise<{ items: WithId<T>[]; nextCursor?: string }>;
  /** Retrieves records matching an index query. */
  getByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Retrieves records matching multiple index queries. */
  getManyByIndex: <T = TDefault>(indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Filters indexed records in the Worker using a selector function. */
  getSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Executes an aggregation query over indexed records in the Worker. */
  queryByIndex: <T = TDefault, R = unknown, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;
  /** Deletes records matching an index query. */
  deleteByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<void>;
  /** Deletes records matching multiple index queries. */
  deleteManyByIndex: (indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<void>;
  /** Deletes a subset of indexed records selected by a function in the Worker. */
  delSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Updates a subset of indexed records selected by a function in the Worker. */
  setSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Executes a query function over stored items in the Worker. */
  query: <T = TDefault, R = unknown, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;
  /** Filters records in the Worker using a selector function. */
  getSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Deletes filtered records in the Worker using a selector function. */
  delSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Updates filtered records in the Worker using a selector and updater function. */
  setSome: <T = TDefault, C = unknown>(selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Exports database records to a JSON object. */
  exportDB: (opts?: DbStoreOptions) => Promise<Record<string, unknown>>;
  /** Imports records from a JSON object into the database. */
  importDB: (data: Record<string, unknown>, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;
  /** Backs up database records to OPFS. */
  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions) => Promise<string>;
  /** Restores database records from an OPFS backup file. */
  restoreFromOpfs: (key: string, fileName: string, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;
  /** Initializes the Worker. */
  init: (workerPath?: string | URL) => void;
  /** Restarts the Worker. */
  restart: () => void;
  /** Terminates the Worker. */
  terminate: () => void;
  /** Generates a random unique ID. */
  gerarId: () => string;
  /** Generates a random unique ID with prefix. */
  gerarIdComPrefixo: (prefix?: string) => string;
}

/**
 * Extended interface for file system operations (OPFS).
 * @template TDefault Default record type.
 */
export interface WorkerOpfsAPI<TDefault = unknown> extends WorkerDbAPI<TDefault> {
  /** Lists files with lightweight metadata. */
  listFiles: (key: string, opts?: OpfsStoreOptions) => Promise<OpfsFileInfo[]>;
  /** Retrieves a file. */
  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<File>;
  /** Retrieves a byte stream of a file. */
  getFileStream: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<ReadableStream<Uint8Array>>;
  /** Adds a file. */
  addFile: (key: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Adds a file via a byte stream. */
  addFileStream: (key: string, streamOrFileName: ReadableStream<Uint8Array> | string, fileNameOrStream: string | ReadableStream<Uint8Array>, opts?: OpfsStoreOptions) => Promise<void>;
  /** Deletes a file. */
  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Renames a file. */
  renFile: (key: string, oldName: string, newName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Moves a file to another record key. */
  mvFile: (key: string, fileName: string, newKey: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Compresses files into a ZIP archive. */
  zip: (key: string, zipName: string, filesToZip?: string[], deleteOriginals?: boolean, opts?: OpfsStoreOptions) => Promise<void>;
  /** Extracts files from a ZIP archive. */
  unzip: (key: string, zipName: string, deleteZip?: boolean, opts?: OpfsStoreOptions) => Promise<void>;
  /** Adds a file into an existing ZIP archive. */
  addZip: (key: string, zipName: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Removes a file from an existing ZIP archive. */
  delZip: (key: string, zipName: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
}

/**
 * Converts an IndexQuery (value, key range, or boundary object) into an IDBValidKey or IDBKeyRange.
 *
 * @param query The index query specification.
 * @returns The converted IDBValidKey or native IDBKeyRange.
 * @throws {Error} If query is null or undefined.
 */
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
 * Global API for direct IndexedDB access in the Worker.
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
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);
    const selectedItems = fn(matched, context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The injected function in GET_SOME_BY_INDEX must return an Array.",
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
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);
    const selectedItems = fn(matched, context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The injected function in DEL_SOME_BY_INDEX must return an Array.",
      );
    }
    const keysToDelete: string[] = selectedItems.map((item: WithId<T>) => {
      if (!item || item._id === undefined) {
        throw new Error(
          "Items returned in DEL_SOME_BY_INDEX must contain an '_id' property.",
        );
      }
      return opts?.prefix && !item._id.startsWith(opts.prefix)
        ? `${opts.prefix}${item._id}`
        : item._id;
    });
    if (keysToDelete.length > 0) {
      await delMany(keysToDelete, store);
    }
  },

  setSomeByIndex: async <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);
    const selectedItems = selectFn(matched, context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The selector function in SET_SOME_BY_INDEX must return an Array.",
      );
    }
    const entriesToSet: [string, unknown][] = selectedItems.map(
      (item: WithId<T>) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items selected in SET_SOME_BY_INDEX must contain an '_id' property.",
          );
        }
        const updatedItem = updateFn(item, context);
        const { key, cleanVal } = prepareForSave(
          undefined,
          updatedItem,
          opts?.prefix,
        );
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator);
        return [key, cleanVal];
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

  getSome: async <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = fn(formattedItems as WithId<T>[], context);
    if (!Array.isArray(selectedItems)) {
      throw new Error("The injected function in GET_SOME must return an Array.");
    }
    return selectedItems;
  },

  delSome: async <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = fn(formattedItems as WithId<T>[], context);

    if (!Array.isArray(selectedItems)) {
      throw new Error("The injected function in DEL_SOME must return an Array.");
    }

    const keysToDelete: string[] = selectedItems.map((item: WithId<T>) => {
      if (!item || item._id === undefined) {
        throw new Error(
          "Items returned in DEL_SOME must contain an '_id' property.",
        );
      }
      return opts?.prefix && !item._id.startsWith(opts.prefix)
        ? `${opts.prefix}${item._id}`
        : item._id;
    });
    await delMany(keysToDelete, store);
  },

  setSome: async <T, C = unknown>(
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);

    const selectedItems = selectFn(formattedItems as WithId<T>[], context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The selector function in SET_SOME must return an Array.",
      );
    }

    const entriesToSet: [string, unknown][] = selectedItems.map(
      (item: WithId<T>) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items selected in SET_SOME must contain an '_id' property.",
          );
        }
        const updatedItem = updateFn(item, context);
        const { key, cleanVal } = prepareForSave(
          undefined,
          updatedItem,
          opts?.prefix,
        );
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator);
        return [key, cleanVal];
      },
    );
    await setMany(entriesToSet, store);
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
 * Global API for direct File System (OPFS) access in the Worker.
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

// Internal API export consumed by RPC proxy (rpc.ts)
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
 * Access point for Database (IndexedDB).
 * Can be invoked as a function to create a scoped instance or used directly.
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
 * Access point for File System (OPFS).
 * Can be invoked as a function to create a scoped instance or used directly.
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

````

---

## Arquivo: `packages/worker-db/src/mod-main.ts`

````ts
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

````

---

## Arquivo: `packages/worker-db/src/mod-sw.ts`

````ts
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

````

---

## Arquivo: `packages/worker-db/src/worker.ts`

```ts
/**
 * @module @vanaware/workerdb/worker
 * @description Dedicated Web Worker script and RPC request router for WorkerDB.
 * Handles background IndexedDB queries, validations, OPFS file storage, and data streaming.
 */

import { internalAPI } from "./db.ts";
import type { DbStoreOptions, OpfsStoreOptions } from "./db.ts";

import { APP_VERSION } from "./utils/version.ts";

console.log(`[DB] 🌌 Worker-db loaded (v${APP_VERSION}).`);

/**
 * Main RPC message handler for WorkerDB.
 * Can be integrated into an existing Web Worker or executed directly.
 */
export async function handleWorkerMessage(e: MessageEvent): Promise<void> {
  if (
    !e.data ||
    typeof e.data !== "object" ||
    !("requestId" in e.data) ||
    !("command" in e.data)
  ) {
    return;
  }

  const { requestId, command, args = {}, } = e.data;

  try {
    const dbOpts: DbStoreOptions = {
      dbName: args.dbName,
      storeName: args.storeName,
      prefix: args.prefix,
      indexes: args.indexes,
      dbVersion: args.dbVersion,
      validatorStr: args.validatorStr,
    };

    const opfsOpts: OpfsStoreOptions = {
      ...dbOpts,
      basePath: args.basePath,
    };

    let result;

    switch (command) {
      case "VERSION":
        result = { version: APP_VERSION, };
        break;
      case "GET":
        result = await internalAPI.get(args.key, dbOpts,);
        break;
      case "SET":
        if (args.key !== undefined) {
          result = await internalAPI.set(args.key, args.val, dbOpts,);
        } else {
          result = await internalAPI.set(args.val, dbOpts,);
        }
        break;
      case "DELETE":
        result = await internalAPI.delete(args.key, dbOpts,);
        break;
      case "GET_MANY":
        result = await internalAPI.getMany(args.keys, dbOpts,);
        break;
      case "SET_MANY":
        result = await internalAPI.setMany(args.entries, dbOpts,);
        break;
      case "DEL_MANY":
        result = await internalAPI.deleteMany(args.keys, dbOpts,);
        break;
      case "KEYS":
        result = await internalAPI.keys(dbOpts,);
        break;
      case "VALUES":
        result = await internalAPI.values(dbOpts,);
        break;
      case "ENTRIES":
        result = await internalAPI.entries(dbOpts,);
        break;
      case "CLEAR":
        result = await internalAPI.clear(dbOpts,);
        break;
      case "PATCH": {
        let patchOrFn;
        if (args.fnStr) {
          patchOrFn = new Function(
            "prev",
            "ctx",
            `return (${args.fnStr})(prev, ctx);`,
          ) as unknown;
        } else {
          patchOrFn = args.patch;
        }
        result = await internalAPI.patch(
          args.key,
          patchOrFn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "QUERY": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.query(fn, args.context, dbOpts,);
        break;
      }
      case "GET_SOME": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.getSome(fn, args.context, dbOpts,);
        break;
      }
      case "DEL_SOME": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.delSome(fn, args.context, dbOpts,);
        break;
      }
      case "SET_SOME": {
        const selectFn = new Function(
          "items",
          "ctx",
          `return (${args.selectFnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        const updateFn = new Function(
          "item",
          "ctx",
          `return (${args.updateFnStr})(item, ctx);`,
        ) as (item: { _id: string }, ctx?: unknown,) => { _id: string };
        result = await internalAPI.setSome(
          selectFn,
          updateFn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "EXPORT":
        result = await internalAPI.exportDB(dbOpts,);
        break;
      case "IMPORT":
        result = await internalAPI.importDB(
          args.data,
          args.clearFirst,
          dbOpts,
        );
        break;
      case "BACKUP_OPFS":
        result = await internalAPI.backupToOpfs(
          args.key,
          args.fileName,
          dbOpts,
        );
        break;
      case "RESTORE_OPFS":
        result = await internalAPI.restoreFromOpfs(
          args.key,
          args.fileName,
          args.clearFirst,
          dbOpts,
        );
        break;

      // ==== OPFS EXTENSION ====
      case "OPFS_LIST":
        result = await internalAPI.listFiles(args.key, opfsOpts,);
        break;
      case "OPFS_GET":
        result = await internalAPI.getFile(args.key, args.fileName, opfsOpts,);
        break;
      case "OPFS_ADD":
        result = await internalAPI.addFile(
          args.key,
          args.file,
          args.fileName,
          opfsOpts,
        );
        break;
      case "OPFS_DEL":
        result = await internalAPI.delFile(args.key, args.fileName, opfsOpts,);
        break;
      case "OPFS_REN":
        result = await internalAPI.renFile(
          args.key,
          args.oldName,
          args.newName,
          opfsOpts,
        );
        break;
      case "OPFS_MV":
        result = await internalAPI.mvFile(
          args.key,
          args.fileName,
          args.newKey,
          opfsOpts,
        );
        break;
      case "OPFS_ZIP":
        result = await internalAPI.zip(
          args.key,
          args.zipName,
          args.filesToZip,
          args.deleteOriginals,
          opfsOpts,
        );
        break;
      case "OPFS_UNZIP":
        result = await internalAPI.unzip(
          args.key,
          args.zipName,
          args.deleteZip,
          opfsOpts,
        );
        break;
      case "OPFS_ADDZIP":
        result = await internalAPI.addZip(
          args.key,
          args.zipName,
          args.file,
          args.fileName,
          opfsOpts,
        );
        break;
      case "OPFS_DELZIP":
        result = await internalAPI.delZip(
          args.key,
          args.zipName,
          args.fileName,
          opfsOpts,
        );
        break;
      case "GET_BY_INDEX":
        result = await internalAPI.getByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "COUNT_BY_INDEX":
        result = await internalAPI.countByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "GET_ONE_BY_INDEX":
        result = await internalAPI.getOneByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "KEYS_BY_INDEX":
        result = await internalAPI.keysByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "PATCH_BY_INDEX":
        result = await internalAPI.patchByIndex(
          args.indexName,
          args.query,
          args.patch,
          dbOpts,
        );
        break;
      case "GET_BY_INDEX_PAGINATED":
        result = await internalAPI.getByIndexPaginated(
          args.indexName,
          args.query,
          args.paginationOpts,
          dbOpts,
        );
        break;
      case "GET_MANY_BY_INDEX":
        result = await internalAPI.getManyByIndex(
          args.indexName,
          args.queries,
          dbOpts,
        );
        break;
      case "GET_SOME_BY_INDEX": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.getSomeByIndex(
          args.indexName,
          args.query,
          fn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "QUERY_BY_INDEX": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => unknown;
        result = await internalAPI.queryByIndex(
          args.indexName,
          args.query,
          fn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "DELETE_BY_INDEX":
        result = await internalAPI.deleteByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "DELETE_MANY_BY_INDEX":
        result = await internalAPI.deleteManyByIndex(
          args.indexName,
          args.queries,
          dbOpts,
        );
        break;
      case "DEL_SOME_BY_INDEX": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.delSomeByIndex(
          args.indexName,
          args.query,
          fn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "SET_SOME_BY_INDEX": {
        const selectFn = new Function(
          "items",
          "ctx",
          `return (${args.selectFnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        const updateFn = new Function(
          "item",
          "ctx",
          `return (${args.updateFnStr})(item, ctx);`,
        ) as (item: { _id: string }, ctx?: unknown,) => { _id: string };
        result = await internalAPI.setSomeByIndex(
          args.indexName,
          args.query,
          selectFn,
          updateFn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "OPFS_ADD_STREAM":
        result = await internalAPI.addFileStream(
          args.key,
          args.stream,
          args.fileName,
          opfsOpts,
        );
        break;
      case "OPFS_GET_STREAM": {
        const stream = await internalAPI.getFileStream(
          args.key,
          args.fileName,
          opfsOpts,
        );
        (self as unknown as {
          postMessage: (message: unknown, transfer?: Transferable[],) => void;
        }).postMessage(
          { requestId, success: true, result: stream, },
          [stream as unknown as Transferable,],
        );
        return;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    self.postMessage({ requestId, success: true, result });
  } catch (error) {
    self.postMessage({
      requestId,
      success: false,
      error: (error as Error).message,
    });
  }
}

// Auto-register listener if running directly in a Web Worker context
if (
  typeof self !== "undefined" &&
  typeof (self as unknown as { postMessage?: unknown }).postMessage === "function" &&
  typeof (self as unknown as { document?: unknown }).document === "undefined"
) {
  self.addEventListener("message", (e: Event) => {
    handleWorkerMessage(e as MessageEvent);
  });
}


```

---

## Arquivo: `packages/worker-db/tests/db_opfs_extension_test.ts`

```ts
import { assert, assertEquals, } from "@std/assert";
import { opfs, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

const drive = opfs("P2P_DRIVE", "files", "FL_", "meus_compartilhamentos",);

Deno.test({
  name: "OPFS Ext - Manipulação Básica de Arquivos e Metadados",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderKey = await drive.set("auto", {
      owner: "Satoshi",
      permissions: "read-only",
      seeders: 5,
    },);

    const encoder = new TextEncoder();
    const file1 = new Blob([encoder.encode("WorkerDB PWA Rocks!",),], {
      type: "text/plain",
    },);
    const file2 = new Blob([encoder.encode("Offline First",),], {
      type: "text/plain",
    },);

    await drive.addFile(folderKey, file1, "doc1.txt",);
    await drive.addFile(folderKey, file2, "doc2.txt",);

    let files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 2,);
    assert(files.some((f,) => f.name === "doc1.txt"),);

    await drive.renFile(folderKey, "doc1.txt", "doc_renomeado.txt",);
    await drive.delFile(folderKey, "doc2.txt",);

    files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "doc_renomeado.txt",);
  },
},);

Deno.test({
  name: "OPFS Ext - Compressão e Descompressão ZIP (fflate)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderKey = await drive.set("auto", {
      description: "Album de Fotos",
    },);

    const img1 = new Blob([new Uint8Array([255, 0, 150,],),],);
    const img2 = new Blob([new Uint8Array([10, 20, 30,],),],);

    await drive.addFile(folderKey, img1, "foto1.png",);
    await drive.addFile(folderKey, img2, "foto2.png",);

    await drive.zip(folderKey, "album.zip", undefined, true,);

    let files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "album.zip",);

    const img3 = new Blob([new Uint8Array([99, 99,],),],);
    await drive.addZip(folderKey, "album.zip", img3, "foto3.png",);

    await drive.delZip(folderKey, "album.zip", "foto1.png",);

    await drive.unzip(folderKey, "album.zip", true,);

    files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 2,);
    assert(files.some((f,) => f.name === "foto2.png"),);
    assert(files.some((f,) => f.name === "foto3.png"),);
  },
},);

Deno.test({
  name: "OPFS Ext - Movendo arquivos entre registros (Pastas)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderA = await drive.set("auto", { type: "inbox", },);
    const folderB = await drive.set("auto", { type: "archive", },);

    await drive.addFile(folderA, new Blob(["Move me",],), "target.txt",);
    await drive.mvFile(folderA, "target.txt", folderB,);

    const filesA = await drive.listFiles(folderA,);
    const filesB = await drive.listFiles(folderB,);

    assertEquals(filesA.length, 0,);
    assertEquals(filesB.length, 1,);
    assertEquals(filesB[0]?.name, "target.txt",);
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/opfs_and_isolation_test.ts`

```ts
// ## Arquivo: monorepo/worker-db/tests/opfs_and_isolation_test.ts
import { assert, assertEquals, } from "@std/assert";

import { db, ls, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

Deno.test({
  name:
    "ISOLATION - LS: Garantir que instâncias com prefixos diferentes não colidam",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const storeA = ls("APP_A_",);
    const storeB = ls("APP_B_",);

    storeA.clear();
    storeB.clear();

    storeA.set("1", { data: "from A", },);
    storeB.set("1", { data: "from B", },);

    assertEquals(storeA.get<Record<string, unknown>>("1",)?.data, "from A",);
    assertEquals(storeB.get<Record<string, unknown>>("1",)?.data, "from B",);

    storeA.clear();
    assertEquals(storeA.keys().length, 0,);
    assertEquals(storeB.keys().length, 1,);
    assertEquals(storeB.get<Record<string, unknown>>("1",)?.data, "from B",);
  },
},);

db.init(new URL("../build/worker-db.js", import.meta.url,),);

Deno.test({
  name:
    "ISOLATION - DB: Garantir que instâncias no mesmo Store, com prefixos diferentes, são isoladas",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const dbApp1 = db("SHARED_DB", "keyval", "APP_1_",);
    const dbApp2 = db("SHARED_DB", "keyval", "APP_2_",);

    await dbApp1.clear();
    await dbApp2.clear();

    await dbApp1.set("config", { theme: "dark", },);
    await dbApp2.set("config", { theme: "light", },);

    const app1Vals = await dbApp1.values<unknown>();
    assertEquals(app1Vals.length, 1,);
    assertEquals((app1Vals[0] as Record<string, unknown>).theme, "dark",);

    const exportApp2 = await dbApp2.exportDB();
    assert(Object.keys(exportApp2,).includes("APP_2_config",),);
    assert(!Object.keys(exportApp2,).includes("APP_1_config",),);

    await dbApp1.clear();
    assertEquals((await dbApp1.keys()).length, 0,);

    const app2Keys = await dbApp2.keys();
    assertEquals(app2Keys.length, 1,);
    assertEquals(app2Keys[0], "APP_2_config",);
  },
},);

Deno.test({
  name:
    "OPFS - Fluxo completo de Backup e Restore (INDEXED-DB) usando record-keys",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    const store = db("OPFS_DB", "test", "BACKUP_",);
    await store.clear();

    await store.set("k1", { text: "Hello OPFS DB", },);
    await store.set("k2", { text: "WorkerDB PWA", },);

    const recordKey = "meus_snapshots_db";
    const fileNamePath = await store.backupToOpfs(
      recordKey,
      "meu_backup_db.json",
    );

    assert(fileNamePath.includes("BACKUP_",),);
    assert(fileNamePath.includes(recordKey,),);
    assert(fileNamePath.includes("meu_backup_db.json",),);

    await store.clear();
    assertEquals((await store.keys()).length, 0,);

    // Restore indicando a recordKey isolada
    await store.restoreFromOpfs(recordKey, "meu_backup_db.json",);
    const restored = await store.values<unknown>();
    assertEquals(restored.length, 2,);

    const k1 = await store.get<unknown>("k1",) as Record<string, unknown>;
    assertEquals(k1?.text, "Hello OPFS DB",);

    FakeOPFSDirectory.clear();
  },
},);

Deno.test({
  name:
    "OPFS - Fluxo completo de Backup e Restore (LOCAL-STORAGE) usando record-keys e proxy opfs()",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    const store = ls("LS_BKP_SYS_",);
    store.clear();

    // 1. Popula o LocalStorage de forma síncrona
    store.set("config", { theme: "dark", notifications: true, },);
    store.set("perfil", { alias: "Satoshi", status: "online", },);
    assertEquals(store.keys().length, 2,);

    // 2. Realiza o backup assíncrono delegando para o Worker-DB via opfs()
    const recordKey = "ls_snapshots";
    const fileNamePath = await store.backupToOpfs(recordKey, "ls_backup.json",);

    // Verifica se a rota de retorno seguiu a padronização das keys
    assert(fileNamePath.includes(recordKey,),);
    assert(fileNamePath.includes("ls_backup.json",),);

    // 3. Limpa o LocalStorage simulando uma perda de dados local ou troca de dispositivo
    store.clear();
    assertEquals(store.keys().length, 0,);

    // 4. Executa o Restore assíncrono puxando o binário via Worker e regravando no LS
    await store.restoreFromOpfs(recordKey, "ls_backup.json", true,);

    // 5. Valida a integridade dos dados resgatados
    const restoredKeys = store.keys();
    assertEquals(restoredKeys.length, 2,);

    const config = store.get<unknown>("config",) as Record<string, unknown>;
    assertEquals(config?.theme, "dark",);
    assertEquals(config?.notifications, true,);

    const perfil = store.get<unknown>("perfil",) as Record<string, unknown>;
    assertEquals(perfil?.alias, "Satoshi",);

    FakeOPFSDirectory.clear();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/db_simple_test.ts`

```ts
import { assert, assertEquals, assertNotEquals, } from "@std/assert";

import { db, } from "../src/fake/fake-mod.ts";

Deno.test({
  name: "DB Simple - Tratamento de _id ('auto', '0990', com prefixo)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Utilizando um nome de banco isolado para o teste para evitar choque de instâncias no IndexedDB fake
    const store = db("LOJA_TEST_1", "clientes", "CLI_",);
    await store.clear();

    // 1. _id: "auto"
    const keyAuto = await store.set({ _id: "auto", name: "Alice", level: 1, },);
    assert(keyAuto.startsWith("CLI_",),);
    const itemAuto = await store.get<unknown>(keyAuto,) as Record<
      string,
      unknown
    >;
    assert(itemAuto !== undefined,);
    assertNotEquals(itemAuto?._id, "auto",);
    assertEquals(itemAuto?.name, "Alice",);

    // 2. _id: "0990"
    const key0990 = await store.set({ _id: "0990", name: "Bob", level: 2, },);
    assertEquals(key0990, "CLI_0990",);
    const item0990 = await store.get<unknown>("0990",) as Record<
      string,
      unknown
    >;
    assertEquals(item0990?._id, "0990",);
    assertEquals(item0990?.name, "Bob",);

    // 3. _id: "CLI_0990" (com prefixo pré-existente)
    const keyPref = await store.set({
      _id: "CLI_0990",
      name: "Bob Atualizado",
      level: 3,
    },);
    assertEquals(keyPref, "CLI_0990",);
    const itemPref = await store.get<unknown>("0990",) as Record<
      string,
      unknown
    >;
    assertEquals(itemPref?.name, "Bob Atualizado",);
  },
},);

Deno.test({
  name: "DB Simple - CRUD, Patch e Métodos de Coleção",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Isolando o banco para não colidir com o teste anterior
    const store = db("LOJA_TEST_2", "produtos", "PROD_",);
    await store.clear();

    await store.set("p1", { name: "Notebook", price: 3000, },);
    const p1 = await store.get<unknown>("p1",) as Record<string, unknown>;
    assertEquals(p1?.name, "Notebook",);

    const patched = await store.patch<Record<string, unknown>>("p1", {
      price: 3200,
    },);
    assertEquals((patched as Record<string, unknown>).price, 3200,);

    await store.setMany([
      ["p2", { name: "Mouse", price: 80, },],
      ["p3", { name: "Teclado", price: 200, },],
    ],);

    const items = await store.getMany<unknown>(["p1", "p2", "p3",],);
    assertEquals(items.length, 3,);

    const keys = await store.keys();
    assert(keys.includes("PROD_p1",),);

    await store.delete("p1",);
    assertEquals(await store.get("p1",), undefined,);

    await store.deleteMany(["p2", "p3",],);
    assertEquals((await store.keys()).length, 0,);
  },
},);

Deno.test({
  name: "DB Simple - ImportDB e ExportDB com Respeito ao Escopo/Prefixo",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Isolando o banco de dados
    const store = db("LOJA_TEST_3", "estoque", "EST_",);
    await store.clear();

    const mockData = {
      EST_e1: { item: "Parafuso", qty: 100, },
      EST_e2: { item: "Porca", qty: 200, },
    };

    await store.importDB(mockData, true,);

    const exported = await store.exportDB();
    assertEquals(exported, mockData,);

    const values = await store.values<unknown>();
    assertEquals(values.length, 2,);
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/ls_simple_test.ts`

```ts
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import { ls, } from "../src/fake/fake-mod.ts";

type DbItem = {
  _id: string;
  name?: string;
  type?: string;
  age?: number;
  v?: number;
};

Deno.test({
  name: "LS Simple - Gestão de _id ('auto', '0990', com prefixo)",
  fn() {
    const store = ls("LS_PRE_",);
    store.clear();

    // 1. Geração automática com _id: "auto"
    const autoKey = store.set({
      _id: "auto",
      name: "Item Auto",
      type: "system",
    },);
    assert(
      autoKey.startsWith("LS_PRE_",),
      "A chave gerada automaticamente deve conter o prefixo do banco",
    );

    // O _id retornado no objeto deve ter o prefixo removido pelo formatDbItem
    const fetchedAuto = store.get(autoKey,) as DbItem;
    assert(fetchedAuto !== undefined,);
    assertNotEquals(
      fetchedAuto._id,
      "auto",
      "O _id 'auto' deve ter sido substituído por um UUID ou Hash",
    );
    assertEquals(autoKey, `LS_PRE_${fetchedAuto._id}`,);
    assertEquals(fetchedAuto.name, "Item Auto",);

    // 2. Definindo chave customizada via parâmetro direto
    const customKey = store.set("0990", { name: "Item Fixo", type: "user", },);
    assertEquals(customKey, "LS_PRE_0990",);

    // A busca aceita tanto a chave simples quanto a formatada (resolveKey cuida disso)
    const fetchedCustom = store.get("0990",) as DbItem;
    assertEquals(fetchedCustom._id, "0990",);
    assertEquals(fetchedCustom.name, "Item Fixo",);

    // 3. Salvando passando um objeto que já possui o prefixo no _id
    const keyPref = store.set({
      _id: "LS_PRE_0991",
      name: "Item Fixo 2",
      type: "user",
    },);
    assertEquals(keyPref, "LS_PRE_0991",);
    const fetchedPref = store.get("0991",) as DbItem;
    assertEquals(fetchedPref.name, "Item Fixo 2",);

    store.clear();
  },
},);

Deno.test({
  name: "LS Simple - CRUD Básico, Patch e Iteradores (keys, values, entries)",
  fn() {
    const store = ls("LS_CRUD_",);
    store.clear();

    // Create / Read
    store.set("user1", { name: "Carlos", age: 30, },);
    let user = store.get("user1",) as DbItem;
    assertEquals(user.name, "Carlos",);

    // Update Parcial (Patch)
    const patchedUser = store.patch("user1", { age: 31, },);
    assertEquals(patchedUser.age, 31,);

    user = store.get("user1",) as DbItem;
    assertEquals(user.age, 31,);

    // Operações em Lote (setMany, getMany)
    store.setMany([
      ["user2", { name: "Ana", },],
      ["user3", { name: "Beatriz", },],
    ],);

    const users = store.getMany(["user1", "user2", "user3",],) as DbItem[];
    assertEquals(users.length, 3,);
    assertEquals(users[1]?.name, "Ana",);

    // Testando Iteradores (keys, values, entries)
    const allKeys = store.keys();
    assertEquals(allKeys.length, 3,);
    assert(allKeys.includes("LS_CRUD_user1",),);

    const allValues = store.values() as DbItem[];
    assertEquals(allValues.length, 3,);
    assert(allValues.some((v,) => v._id === "user2" && v.name === "Ana"),); // Valida se formatDbItem agiu nos values

    const allEntries = store.entries() as [string, DbItem,][];
    assertEquals(allEntries.length, 3,);
    const firstEntry = allEntries.find(([k,],) => k === "LS_CRUD_user3");
    assert(firstEntry !== undefined,);
    assertEquals(firstEntry[1].name, "Beatriz",);

    // Delete
    store.delete("user1",);
    assertEquals(store.get("user1",), undefined,);
    assertEquals(store.keys().length, 2,);

    store.deleteMany(["user2", "user3",],);
    assertEquals(store.keys().length, 0,);

    store.clear();
  },
},);

Deno.test({
  name: "LS Simple - Import e Export com Respeito ao Escopo/Prefixo",
  fn() {
    const store = ls("LS_EXP_",);
    store.clear();

    const mockData = {
      LS_EXP_k1: { v: 1, label: "A", },
      LS_EXP_k2: { v: 2, label: "B", },
    };

    store.importLS(mockData, true,);

    const exported = store.exportLS();
    assertEquals(exported, mockData,);

    const values = store.values() as DbItem[];
    assertEquals(values.length, 2,);
    assertEquals(values.find((i,) => i._id === "k1")?.v, 1,);

    store.clear();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/main.test.ts`

```ts
import { assert, assertEquals, } from "@std/assert";
import { gerarId, validarId, } from "../src/utils/id.ts";
import { db, ls, } from "../src/fake/fake-mod.ts";

Deno.test("MAIN - Validação de Utilitários de ID e Integração Global", () => {
  const id = gerarId();
  assert(id.length > 0,);

  const isValid = validarId(id,);
  assertEquals(isValid, true,);

  const dbInstance = db("MAIN_DB", "main",);
  assert(dbInstance !== undefined,);

  const lsInstance = ls("MAIN_LS_",);
  assert(lsInstance !== undefined,);
});

```

---

## Arquivo: `packages/worker-db/tests/worker_lifecycle_test.ts`

```ts
import { assertEquals, } from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";

const isFake = true;

Deno.test({
  name:
    "LIFECYCLE - Inicialização, Terminação, Restart e Persistência do Worker",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_LIFECYCLE_DB", "state", "LC_",);
    await store.clear();

    await store.set("status", { alive: true, phase: "init", },);
    let result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(result?.alive, true,);

    db.terminate();

    await store.set("status", { alive: true, phase: "healed", },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(result?.phase, "healed",);

    // O restart vai recriar o Worker utilizando o último caminho válido
    // (que é o fake-db.ts garantido pelo nosso fake-mod.ts)
    db.restart();

    if (!isFake) {
      // Lógica isolada para cenários não-falsos, caso necessário
    }

    await store.patch<Record<string, unknown>>("status", {
      phase: "restarted",
    },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(
      result?.phase,
      "restarted",
      "Worker recriado pelo restart() falhou",
    );

    db.terminate();
  },
},);

Deno.test({
  name:
    "LIFECYCLE - Comportamento com requisições disparadas imediatamente após restart",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_LIFECYCLE_DB", "stress", "STRESS_",);

    db.restart();

    await store.set("k1", { val: 1, },);
    await store.set("k2", { val: 2, },);

    const keys = await store.keys();
    assertEquals(keys.length, 2,);

    await store.clear();
    db.terminate();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/db_phase1_features_test.ts`

```ts
import { assert, assertEquals, assertRejects, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { db, opfs, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

describe("WorkerDB Phase 1 - Schema Validation", () => {
  interface UserProfile {
    _id?: string;
    username: string;
    age: number;
  }

  const validatedDb = db<UserProfile>({
    dbName: "VALIDATION_DB",
    storeName: "users",
    prefix: "USR_",
    validator: (item: unknown,) => {
      if (!item || typeof item !== "object") return false;
      const u = item as Record<string, unknown>;
      return typeof u.username === "string" && typeof u.age === "number" &&
        u.age >= 18;
    },
  },);

  it("permite inserir registro que passa na validação", async () => {
    await validatedDb.clear();
    const id = await validatedDb.set("u1", {
      username: "Alice",
      age: 25,
    },);
    assertEquals(id, "USR_u1",);
    const item = await validatedDb.get("u1",);
    assertEquals(item?.username, "Alice",);
    assertEquals(item?.age, 25,);
  });

  it("rejeita inserção de registro inválido pelo validador", async () => {
    await assertRejects(
      async () => {
        await validatedDb.set("u2", {
          username: "Bob",
          age: 16, // inválido (< 18)
        },);
      },
      Error,
      "Validation failed",
    );
  });

  it("rejeita patch que torna o registro inválido", async () => {
    await assertRejects(
      async () => {
        await validatedDb.patch("u1", { age: 10, },);
      },
      Error,
      "Validation failed",
    );
  });
});

describe("WorkerDB Phase 1 - Indexed Queries (getByIndex)", () => {
  interface Product {
    _id?: string;
    title: string;
    category: string;
    price: number;
  }

  const productStore = db<Product>({
    dbName: "CATALOG_DB",
    storeName: "products",
    indexes: ["category",],
  },);

  it("recupera registros filtrando pelo índice", async () => {
    await productStore.clear();
    await productStore.set("p1", {
      title: "Laptop",
      category: "electronics",
      price: 1200,
    },);
    await productStore.set("p2", {
      title: "Teclado",
      category: "electronics",
      price: 100,
    },);
    await productStore.set("p3", {
      title: "Cadeira",
      category: "furniture",
      price: 300,
    },);

    const electronics = await productStore.getByIndex<Product>(
      "category",
      "electronics",
    );
    assertEquals(electronics.length, 2,);
    assert(electronics.some((p,) => p.title === "Laptop"),);
    assert(electronics.some((p,) => p.title === "Teclado"),);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 1,);
    assertEquals(furniture[0]?.title, "Cadeira",);
  });

  it("recupera múltiplos valores de índice em lote com getManyByIndex", async () => {
    await productStore.set("p4", {
      title: "Livro",
      category: "books",
      price: 50,
    },);

    const multi = await productStore.getManyByIndex<Product>(
      "category",
      ["electronics", "books",],
    );
    assertEquals(multi.length, 3,);
    assert(multi.some((p,) => p.title === "Laptop"),);
    assert(multi.some((p,) => p.title === "Teclado"),);
    assert(multi.some((p,) => p.title === "Livro"),);
  });

  it("filtra subconjunto indexado com getSomeByIndex sem escanear o banco inteiro", async () => {
    // Filtra eletrônicos com preço > 500
    const expensiveElectronics = await productStore.getSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price > 500),
    );
    assertEquals(expensiveElectronics.length, 1,);
    assertEquals(expensiveElectronics[0]?.title, "Laptop",);
  });

  it("calcula agregações sobre o subconjunto indexado com queryByIndex", async () => {
    // Calcula o total gasto em eletrônicos
    const totalElectronicsPrice = await productStore.queryByIndex<
      Product,
      number
    >(
      "category",
      "electronics",
      (items,) => items.reduce((acc, p,) => acc + p.price, 0,),
    );
    assertEquals(totalElectronicsPrice, 1300,);
  });

  it("atualiza apenas registros do índice selecionados com setSomeByIndex", async () => {
    // Aplica desconto de 10% apenas em eletrônicos com preço >= 1000
    await productStore.setSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price >= 1000),
      (item,) => ({ ...item, price: item.price * 0.9, }),
    );

    const laptop = await productStore.get<Product>("p1",);
    assertEquals(laptop?.price, 1080,);

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard?.price, 100,); // Não foi alterado
  });

  it("remove itens selecionados do subconjunto indexado com delSomeByIndex", async () => {
    // Deleta eletrônicos com preço <= 150
    await productStore.delSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price <= 150),
    );

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard, undefined,);

    const laptop = await productStore.get<Product>("p1",);
    assert(laptop !== undefined,);
  });

  it("remove todos os registros de um valor de índice com deleteByIndex", async () => {
    await productStore.deleteByIndex("category", "furniture",);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);

    const cadeira = await productStore.get<Product>("p3",);
    assertEquals(cadeira, undefined,);
  });

  it("remove múltiplos grupos de índice com deleteManyByIndex", async () => {
    await productStore.set("p5", {
      title: "Mesa",
      category: "furniture",
      price: 400,
    },);
    await productStore.set("p6", {
      title: "Revista",
      category: "books",
      price: 15,
    },);

    await productStore.deleteManyByIndex("category", ["furniture", "books",],);

    const books = await productStore.getByIndex<Product>("category", "books",);
    assertEquals(books.length, 0,);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);
  });
});

describe("WorkerDB Phase 1 - OPFS Streams (addFileStream & getFileStream)", () => {
  const streamDrive = opfs({
    dbName: "STREAM_DRIVE",
    storeName: "media",
    prefix: "MED_",
  },);

  it("grava e lê arquivo via ReadableStream", async () => {
    FakeOPFSDirectory.clear();
    await streamDrive.clear();

    const recordKey = await streamDrive.set("auto", {
      title: "Video Stream",
    },);

    const chunk1 = new Uint8Array([1, 2, 3, 4, 5,],);
    const chunk2 = new Uint8Array([6, 7, 8, 9, 10,],);

    const inputStream = new ReadableStream<Uint8Array>({
      start(controller,) {
        controller.enqueue(chunk1,);
        controller.enqueue(chunk2,);
        controller.close();
      },
    },);

    await streamDrive.addFileStream(recordKey, "data.bin", inputStream,);

    const files = await streamDrive.listFiles(recordKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "data.bin",);

    const outputStream = await streamDrive.getFileStream(
      recordKey,
      "data.bin",
    );
    assert(outputStream instanceof ReadableStream,);

    const reader = outputStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value, } = await reader.read();
      if (done) break;
      if (value) chunks.push(value,);
    }

    const totalLength = chunks.reduce((acc, c,) => acc + c.length, 0,);
    const combined = new Uint8Array(totalLength,);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset,);
      offset += c.length;
    }

    assertEquals(combined, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10,],),);
  });
});

```

---

## Arquivo: `packages/worker-db/tests/id-utils.test.ts`

```ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import { gerarId, gerarIdFallback, validarId, } from "../src/utils/id.ts";

Deno.test("gerarId - Deve gerar um ID no formato string e com tamanho adequado", () => {
  const id = gerarId();
  assert(typeof id === "string", "O ID gerado deve ser uma string",);
  assert(
    id.length > 0 && id.length <= 24,
    "O tamanho do ID deve estar entre 1 e 24 caracteres",
  );
});

Deno.test("gerarId - Não deve gerar IDs duplicados em chamadas sequenciais", () => {
  const id1 = gerarId();
  const id2 = gerarId();
  assertNotEquals(
    id1,
    id2,
    "IDs gerados sequencialmente não podem ser idênticos",
  );
});

Deno.test("gerarIdFallback - Deve funcionar como alternativa segura", () => {
  const idFallback = gerarIdFallback();
  assert(
    typeof idFallback === "string",
    "O ID de fallback deve ser uma string",
  );
  assert(idFallback.length > 0, "O ID de fallback não pode ser vazio",);
});

Deno.test("validarId - Deve validar corretamente limites de tamanho", () => {
  const idValido = gerarId();
  const idInvalidoLongo = "a".repeat(25,);
  const idInvalidoVazio = "";
  assertEquals(
    validarId(idValido,),
    true,
    "Deve aceitar um ID gerado pela própria função",
  );
  assertEquals(
    validarId(idInvalidoLongo,),
    false,
    "Não deve aceitar IDs maiores que 24 caracteres",
  );
  assertEquals(
    validarId(idInvalidoVazio,),
    false,
    "Não deve aceitar IDs vazios",
  );
});

```

---

## Arquivo: `packages/worker-db/tests/db_advanced_test.ts`

```ts
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

interface Fatura {
  tag: string;
  amount: number;
  status: string;
  code: string;
}

interface Funcionario {
  _id: string;
  name: string;
  department: string;
  level: number | string;
  active: boolean;
}

Deno.test({
  name: "DB Advanced - Execução de Métodos de Array no Worker (query, getSome)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("FINANCAS", "faturas", "FAT_",);
    await store.clear();

    await store.importDB({
      FAT_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      FAT_f2: { tag: "personal", amount: 300, status: "pending", code: "y", },
      FAT_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      FAT_f4: { tag: "home", amount: 80, status: "pending", code: "w", },
      FAT_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Valida execução de funções avançadas dentro do Worker de Banco de Dados
    const result = await store.query((items: Fatura[],) => {
      return {
        count: items.length, // length
        total: items.reduce((acc: number, i: Fatura,) => acc + i.amount, 0,), // reduce
        firstWork: items.find((i: Fatura,) => i.tag === "work"), // find
        lastWork: items.findLast((i: Fatura,) => i.tag === "work"), // findLast
        lastItem: items.at(-1,), // at
        hasPending: items.some((i: Fatura,) => i.status === "pending"), // some
        allPositive: items.every((i: Fatura,) => i.amount > 0), // every
        tagsHaveHome: items.map((i: Fatura,) => i.tag).includes("home",), // map e includes
        idxPersonal: items.findIndex((i: Fatura,) => i.tag === "personal"), // findIndex
        lastIdxWork: items.findLastIndex((i: Fatura,) => i.tag === "work"), // findLastIndex
        indexOfZ: items.map((i: Fatura,) => i.code).indexOf("z",), // indexOf
        paidItems: items.filter((i: Fatura,) => i.status === "paid"), // filter
        sliced: items.slice(1, 4,), // slice
        sortedByAmount: items.toSorted((a: Fatura, b: Fatura,) =>
          a.amount - b.amount
        ), // toSorted
        reversed: items.toReversed(), // toReversed
        spliced: items.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Fatura).amount, 150,);
    assertEquals((result.lastWork as Fatura).amount, 200,);
    assertEquals((result.lastItem as Fatura).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals((result.sortedByAmount[0] as Fatura).amount, 80,);
    assertEquals((result.reversed[0] as Fatura).code, "k",);
    assertEquals(result.spliced.length, 3,);
  },
},);

Deno.test({
  name:
    "DB Advanced - Erros em tempo de execução no Worker (Retornos Inválidos)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("ERROS_WORKER", "testes", "ERR_",);
    await store.clear();
    await store.set("1", { valid: true, },);

    // AssertRejects captures throw Exceptions dispatched in worker switch(command)
    await assertRejects(
      async () =>
        await store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "The injected function in GET_SOME must return an Array.",
    );

    await assertRejects(
      async () =>
        await store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "The injected function in DEL_SOME must return an Array.",
    );

    await assertRejects(
      async () =>
        await store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "The selector function in SET_SOME must return an Array.",
    );
  },
},);

Deno.test({
  name:
    "DB Advanced - Transformações de Tipo, UPPERCASE e Exclusão Segura no Worker",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("EMPRESA", "funcionarios", "EMP_",);
    await store.clear();

    await store.importDB({
      EMP_e10: {
        name: "joão silva",
        department: "tecnologia",
        level: 2,
        active: true,
      },
      EMP_e20: {
        name: "maria souza",
        department: "rh",
        level: 3,
        active: true,
      },
      EMP_e30: {
        name: "pedro alves",
        department: "vendas",
        level: 1,
        active: false,
      },
    },);

    // Atualiza nome para UPPERCASE e converte 'level' (number) para string
    await store.setSome(
      (items: Funcionario[],) =>
        items.filter((item: Funcionario,) =>
          item.active === true
        ) as Funcionario[],
      (item: Funcionario,) => ({
        ...item,
        name: item.name.toUpperCase(),
        department: item.department.toUpperCase(),
        level: String(item.level,), // Mutação de tipo!
      }),
    );

    const e10 = await store.get<Funcionario>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECNOLOGIA",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = await store.get<Funcionario>("e30",);
    assertEquals(e30?.department, "vendas",); // Permanece em lowercase
    assertEquals(typeof e30?.level, "number",); // Permanece tipo número

    // Exclui funcionários inativos via delSome
    await store.delSome((items: Funcionario[],) =>
      items.filter((i: Funcionario,) => i.active === false)
    );

    // Checa deleção correta
    assertEquals(await store.get("e30",), undefined,);
    const remainingKeys = await store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Assegura integridade dos que ficaram
    const remaining = await store.values<Funcionario>();
    assertNotEquals(remaining[0]?.name, "pedro alves",);
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/ls_advanced_test.ts`

```ts
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { ls, } from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

Deno.test({
  name:
    "LS Advanced - Execução de Métodos Modernos de Array JS (query, getSome)",
  fn() {
    const store = ls("LS_FINANCAS_",);
    store.clear();

    store.importLS({
      LS_FINANCAS_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      LS_FINANCAS_f2: {
        tag: "personal",
        amount: 300,
        status: "pending",
        code: "y",
      },
      LS_FINANCAS_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      LS_FINANCAS_f4: {
        tag: "home",
        amount: 80,
        status: "pending",
        code: "w",
      },
      LS_FINANCAS_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Valida execução de funções avançadas síncronas de Array
    const result = store.query((items,) => {
      const data = items as Record<string, unknown>[];
      return {
        count: data.length, // length
        total: data.reduce((acc, i,) => acc + (i.amount as number), 0,), // reduce
        firstWork: data.find((i,) => i.tag === "work"), // find
        lastWork: data.findLast((i,) => i.tag === "work"), // findLast
        lastItem: data.at(-1,), // at
        hasPending: data.some((i,) => i.status === "pending"), // some
        allPositive: data.every((i,) => (i.amount as number) > 0), // every
        tagsHaveHome: data.map((i,) => i.tag as string).includes("home",), // map e includes
        idxPersonal: data.findIndex((i,) => i.tag === "personal"), // findIndex
        lastIdxWork: data.findLastIndex((i,) => i.tag === "work"), // findLastIndex
        indexOfZ: data.map((i,) => i.code as string).indexOf("z",), // indexOf
        paidItems: data.filter((i,) => i.status === "paid"), // filter
        sliced: data.slice(1, 4,), // slice
        sortedByAmount: data.toSorted((a, b,) =>
          (a.amount as number) - (b.amount as number)
        ), // toSorted
        reversed: data.toReversed(), // toReversed
        spliced: data.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Record<string, unknown>).amount, 150,);
    assertEquals((result.lastWork as Record<string, unknown>).amount, 200,);
    assertEquals((result.lastItem as Record<string, unknown>).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals(
      (result.sortedByAmount[0] as Record<string, unknown>).amount,
      80,
    );
    assertEquals((result.reversed[0] as Record<string, unknown>).code, "k",);
    assertEquals(result.spliced.length, 3,);

    store.clear();
  },
},);

Deno.test({
  name: "LS Advanced - Erros de Tipagem Síncronos (Retornos Inválidos)",
  fn() {
    const store = ls("LS_ERROS_",);
    store.clear();
    store.set("1", { valid: true, },);

    // AssertThrows captures synchronous exceptions dispatched by ls() wrapper
    assertThrows(
      () =>
        store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "The function in getSome must return an Array.",
    );

    assertThrows(
      () => store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "The function in delSome must return an Array.",
    );

    assertThrows(
      () =>
        store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "The selector function in setSome must return an Array.",
    );

    store.clear();
  },
},);

Deno.test({
  name:
    "LS Advanced - Transformações de Tipo, Mutação em Massa e Exclusão Segura",
  fn() {
    const store = ls("LS_EMPRESA_",);
    store.clear();

    store.importLS({
      LS_EMPRESA_e10: {
        name: "joão silva",
        department: "tecnologia",
        level: 2,
        active: true,
      },
      LS_EMPRESA_e20: {
        name: "maria souza",
        department: "rh",
        level: 3,
        active: true,
      },
      LS_EMPRESA_e30: {
        name: "pedro alves",
        department: "vendas",
        level: 1,
        active: false,
      },
    },);

    // Atualiza nome para UPPERCASE e converte 'level' (number) para string
    store.setSome(
      (items,) => {
        const data = items as Record<string, unknown>[];
        return data.filter((item,) =>
          (item.active as boolean) === true
        ) as WithId<Record<string, unknown>>[];
      },
      (item,) => {
        const data = item as Record<string, unknown>;
        return {
          ...data,
          name: (data.name as string).toUpperCase(),
          department: (data.department as string).toUpperCase(),
          level: String(data.level as number,), // Mutação de tipo explícita!
          _id: data._id as string,
        };
      },
    );

    const e10 = store.get<Record<string, unknown>>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECNOLOGIA",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = store.get<Record<string, unknown>>("e30",);
    assertEquals(e30?.department, "vendas",); // Permanece em lowercase pois active=false
    assertEquals(typeof e30?.level, "number",); // Permanece tipo número

    // Exclui funcionários inativos via delSome
    store.delSome((items,) => {
      const data = items as Record<string, unknown>[];
      return data.filter((i,) => (i.active as boolean) === false) as WithId<
        Record<string, unknown>
      >[];
    },);

    // Checa deleção correta
    assertEquals(store.get("e30",), undefined,);
    const remainingKeys = store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Assegura integridade dos que ficaram
    const remaining = store.values<Record<string, unknown>>();
    assertNotEquals(remaining[0]?.name as string, "pedro alves",);

    store.clear();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/idb-keyval.test.ts`

```ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  clear,
  createStore,
  del,
  delMany,
  entries,
  get,
  getMany,
  keys,
  promisifyRequest,
  set,
  setMany,
  update,
  values,
} from "../src/utils/idb-keyval.ts";

describe("Internal idb-keyval module", () => {
  it("should set and get values with a custom store", async () => {
    const store = createStore("test-db-1", "test-store-1",);
    await set("hello", "world", store,);
    const result = await get<string>("hello", store,);
    assertEquals(result, "world",);
  });

  it("should return undefined for non-existent key", async () => {
    const store = createStore("test-db-nonexistent", "test-store",);
    const result = await get("missing", store,);
    assertEquals(result, undefined,);
  });

  it("should handle setMany and getMany", async () => {
    const store = createStore("test-db-many", "test-store-many",);
    await setMany([["a", 1,], ["b", 2,], ["c", 3,],], store,);

    const res = await getMany(["a", "b", "c", "d",], store,);
    assertEquals(res, [1, 2, 3, undefined,],);
  });

  it("should atomically update a value", async () => {
    const store = createStore("test-db-update", "test-store-update",);
    await set("count", 10, store,);
    await update<number>("count", (old,) => (old ?? 0) + 5, store,);

    const val = await get<number>("count", store,);
    assertEquals(val, 15,);
  });

  it("should update a missing value gracefully", async () => {
    const store = createStore("test-db-update-missing", "test-store-update",);
    await update<number>("counter", (old,) => (old ?? 0) + 1, store,);

    const val = await get<number>("counter", store,);
    assertEquals(val, 1,);
  });

  it("should delete a key using del", async () => {
    const store = createStore("test-db-del", "test-store-del",);
    await set("temp", "value", store,);
    assertEquals(await get("temp", store,), "value",);

    await del("temp", store,);
    assertEquals(await get("temp", store,), undefined,);
  });

  it("should delete multiple keys with delMany", async () => {
    const store = createStore("test-db-delmany", "test-store-delmany",);
    await setMany([["k1", 1,], ["k2", 2,], ["k3", 3,],], store,);

    await delMany(["k1", "k2",], store,);
    assertEquals(await get("k1", store,), undefined,);
    assertEquals(await get("k2", store,), undefined,);
    assertEquals(await get<number>("k3", store,), 3,);
  });

  it("should list keys, values, and entries", async () => {
    const store = createStore("test-db-iter", "test-store-iter",);
    await set("x", 100, store,);
    await set("y", 200, store,);

    const k = await keys(store,);
    assertEquals(k.sort(), ["x", "y",],);

    const v = await values<number>(store,);
    assertEquals(v.sort(), [100, 200,],);

    const e = await entries(store,);
    assertEquals(
      e.sort((a, b,) => String(a[0],).localeCompare(String(b[0],),)),
      [["x", 100,], ["y", 200,],],
    );
  });

  it("should clear the store", async () => {
    const store = createStore("test-db-clear", "test-store-clear",);
    await setMany([["x", 1,], ["y", 2,],], store,);
    await clear(store,);

    const allKeys = await keys(store,);
    assertEquals(allKeys.length, 0,);
  });

  it("promisifyRequest resolves correctly for standard request", async () => {
    const openReq = indexedDB.open("test-promisify", 1,);
    const db = await promisifyRequest<IDBDatabase>(openReq,);
    assertEquals(typeof db.name, "string",);
    db.close();
  });
});

```

---

## Arquivo: `packages/worker-db/tests/opfs_explorer_root_test.ts`

```ts
// packages/worker-db/tests/opfs_explorer_root_test.ts
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";
import {
  deleteFromOpfs,
  getFileFromOpfs,
  listOpfsFiles,
  readJsonFromOpfs,
  writeJsonToOpfs,
} from "../src/utils/opfs.ts";

describe("OPFS Root & Explorer", () => {
  it("lists all files and directories starting from the OPFS root", async () => {
    FakeOPFSDirectory.clear();

    // Simula arquivos criados em múltiplos subdiretórios (ex: demo/ e backup/)
    await writeJsonToOpfs("demo/FS_test-file/hello.txt", {
      message: "Hello OPFS",
    },);
    await writeJsonToOpfs("backup/MSG_auto_backups/sw_auto_backup.json", {
      backup: true,
      timestamp: 123456789,
    },);
    await writeJsonToOpfs("media/images/avatar.png", "fake-png-content",);

    const files = await listOpfsFiles();

    // Deve listar todos os arquivos preservando caminhos relativos a partir da raiz
    assertEquals(files.length, 3,);
    assert(files.includes("demo/FS_test-file/hello.txt",),);
    assert(files.includes("backup/MSG_auto_backups/sw_auto_backup.json",),);
    assert(files.includes("media/images/avatar.png",),);

    // Lê os arquivos a partir dos caminhos relativos da raiz
    const backupContent = await readJsonFromOpfs(
      "backup/MSG_auto_backups/sw_auto_backup.json",
    ) as { backup: boolean };
    assertEquals(backupContent.backup, true,);

    const file = await getFileFromOpfs("demo/FS_test-file/hello.txt",);
    assertEquals(file.name, "hello.txt",);

    // Deleta arquivo da raiz e revalida
    await deleteFromOpfs("media/images/avatar.png",);
    const updatedFiles = await listOpfsFiles();
    assertEquals(updatedFiles.length, 2,);
    assert(!updatedFiles.includes("media/images/avatar.png",),);

    FakeOPFSDirectory.clear();
  });
});

```

---

## Arquivo: `packages/worker-db/example/demo.ts`

```ts
import { db, ls, } from "../src/fake/fake-mod.ts";

interface WorkerDBMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: "pending" | "sent" | "delivered";
  timestamp: number;
}

interface UserPreferences {
  _id?: string; // Corrigindo a tipagem aqui também
  theme: "dark" | "light";
  notificationsEnabled: boolean;
  activeChatId: string | null;
}

async function runWorkerDBDbDemo() {
  console.log("🚀 [WorkerDB PWA] Iniciando demonstração do WORKER-DB...\n",);
  ls().clear();

  console.log("📦 1. LocalStorage - Criando itens com _id 'auto'...",);
  const prefStore = ls("WORKERDB_PREF_",);

  const autoKey1 = prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "dark",
    notificationsEnabled: true,
    activeChatId: "chat_1",
  },);
  const autoKey2 = prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "light",
    notificationsEnabled: false,
    activeChatId: null,
  },);

  console.log(`   --> Item 1 gerado: Chave = ${autoKey1}`,);
  console.log(
    `   --> Recuperando Item 1 (notem que '_id' volta limpo):`,
    prefStore.get(autoKey1,),
  );
  console.log(`   --> Recuperando Item 2:`, prefStore.get(autoKey2,),);

  console.log("\n🔒 2. LocalStorage - Testando Isolamento de Prefixos...",);
  const authStore = ls("WORKERDB_AUTH_",);
  authStore.set("session_token", { token: "abc-123", active: true, },);
  console.log(
    `   --> Total de itens em WORKERDB_PREF_ (Preferências): ${prefStore.keys().length}`,
  );
  console.log(
    `   --> Total de itens em WORKERDB_AUTH_ (Autenticação): ${authStore.keys().length}`,
  );

  console.log("\n🌍 3. LocalStorage - Visão Global (Sem prefixo)...",);
  const globalStore = ls();
  const allKeys = globalStore.keys();
  console.log(
    `   --> Total de itens armazenados em TODA a aplicação: ${allKeys.length}`,
  );
  console.log(
    `   --> Realizando leitura global do token:`,
    globalStore.get("WORKERDB_AUTH_session_token",),
  );

  console.log("\n💬 4. IndexedDB Worker - Enfileirando Mensagens Offline...",);
  const msgStore = db("WORKERDB_DATA", "messages", "MSG_",);
  await msgStore.clear();

  const msgId1 = await msgStore.set<WorkerDBMessage>({
    _id: "auto",
    senderId: "user_alice",
    recipientId: "user_bob",
    content: "Olá! Esta mensagem foi enfileirada offline.",
    status: "pending",
    timestamp: Date.now(),
  },);

  console.log(
    `   --> Mensagens injetadas no IndexedDB. Keys geradas: ${msgId1}`,
  );

  console.log("\n⚙️ 5. IndexedDB Worker - Mutações Assíncronas...",);
  const pendingCount = await msgStore.query<WorkerDBMessage, number>(
    (items,) => {
      return items.filter((m,) => m.status === "pending").length;
    },
  );
  console.log(
    `   --> Total pendente (calculado remotamente): ${pendingCount}`,
  );

  await msgStore.setSome<WorkerDBMessage>(
    (items,) => items.filter((m,) => m.status === "pending"),
    (item,) => ({ ...item, status: "sent", }),
  );

  const updatedMessages = await msgStore.values<WorkerDBMessage>();
  console.log(
    "   --> Estado das mensagens após envio simulado:",
    updatedMessages,
  );

  db.terminate();
  console.log("\n✅ Demonstração finalizada. Worker encerrado.",);
}

runWorkerDBDbDemo();

```

---

## Arquivo: `packages/worker-db/README.md`

````md
# 🗄️ WorkerDB Core

**Asynchronous database layer for Web Workers, IndexedDB, and OPFS.**

WorkerDB provides a unified, typed, and high-performance interface to interact with native browser persistence APIs (`IndexedDB`, `LocalStorage`, and `Origin Private File System`). 

To ensure the UI never freezes, even during heavy E2EE cryptography or massive file I/O, **all database and file processing occurs in a background Web Worker.**

## ✨ Core Features

- 🧵 **Non-Blocking UI:** Transparent RPC proxy via `postMessage`.
- 🛡️ **Scope Isolation:** Database stores and record-level isolation with dynamic prefixes.
- 🔑 **Automatic ID Management:** Native support for UUID generation and short IDs.
- 🚀 **High Performance OPFS:** Direct file system manipulation with metadata-only discovery.
- 🗜️ **Native ZIP Engine:** Background compression and extraction using `fflate`.
- 🔄 **Backup & Recovery:** Integrated snapshot engine for OPFS and IndexedDB.

---

## 🚀 1. Installation and Import

**WorkerDB** is ready for use in Deno projects or modern browsers. You can import via JSR (recommended) or directly from your package manager.

### Via JSR (Recommended for Deno)
```ts
// Main Thread (UI/App via non-blocking RPC Proxy)
import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// Standalone or Composed Web Worker
import "jsr:@vanaware/workerdb/worker";
import { handleWorkerMessage } from "jsr:@vanaware/workerdb/worker";

// Service Worker / Web Worker (Direct access without RPC)
import { dbsw, opfssw } from "jsr:@vanaware/workerdb/sw";
```

---

## ⚙️ 2. Configuring the Web Worker in the UI

To ensure the UI never hangs during heavy database operations or OPFS/ZIP file processing, `db()` and `opfs()` on the Main Thread operate as a **transparent RPC Proxy** that delegates work to a background Web Worker.

For this reason, **your web application must serve the compiled Worker `.js` file** so the browser can load it.

### 📦 2.1 Bundling the Worker

You can bundle the worker provided by the `jsr:@vanaware/workerdb/worker` subpath directly:

#### Option A: Script with esbuild + Deno 2 (Recommended)
Create a build script (e.g. `build-worker.ts`):

```ts
import * as esbuild from "npm:esbuild@0.28.2";
import { denoPlugins } from "jsr:@deno/esbuild-plugin@1.2.1";

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["jsr:@vanaware/workerdb/worker"],
  outfile: "./public/worker.js",
  bundle: true,
  format: "esm",
  minify: true,
});

esbuild.stop();
console.log("✅ Worker compiled to ./public/worker.js");
```

Run with:
```bash
deno run -A build-worker.ts
```

#### Option B: Using Deno 2 Bundle API (`--unstable-bundle`)
Create a local file `src/worker.ts`:
```ts
// src/worker.ts
import "jsr:@vanaware/workerdb/worker";
```

And compile it to your public directory:
```bash
deno run --unstable-bundle -A ./src/worker.ts --output ./public/worker.js
```

---

### 📂 2.2 Where to Save the Output File

Save the generated bundle in your project's public static assets directory (for example, `./public/worker.js`, `./static/worker.js`, or `./dist/worker.js`). It must be served as an HTTP-accessible static asset by the browser.

---

### 🚀 2.3 Initializing in the UI

By default, `db()` and `opfs()` look for the worker at the relative path `./worker.js`:

```ts
import { db, opfs } from "jsr:@vanaware/workerdb";

// Initialization with the default path ("./worker.js"):
db.init(); 
```

#### Using a custom name or path (e.g. `workerdb.min.js`):
If you saved the bundle under another name (such as `workerdb.min.js`) or in a subdirectory (such as `/assets/worker.js`), pass the path or `URL` to `init()`:

```ts
import { db, opfs } from "jsr:@vanaware/workerdb";

// Custom relative path:
db.init("./workerdb.min.js");

// Or absolute path / resolved URL:
db.init(new URL("./assets/worker.js", import.meta.url));

// The same worker path is shared by opfs:
opfs.init("./workerdb.min.js");
```

---

### 🧩 2.4 Composing inside an Existing Web Worker

If your application already has its own Web Worker for other background tasks and you want to unify everything into a single worker without spawning multiple threads, use the exported `handleWorkerMessage` function:

```ts
// src/my-app-worker.ts
import { handleWorkerMessage } from "jsr:@vanaware/workerdb/worker";

self.addEventListener("message", async (event: MessageEvent) => {
  // WorkerDB commands contain `command` and `requestId`
  if (event.data?.command && event.data?.requestId) {
    await handleWorkerMessage(event);
    return;
  }

  // Your application's custom messages:
  if (event.data?.type === "PROCESS_AUDIO") {
    // your custom background logic...
  }
});
```

---

## 📦 3. Module: `db()` (IndexedDB)

`db()` is the primary factory for persisting objects and structured metadata asynchronously. Ideal for message queues, contact lists, and E2EE session logs.

```ts
import { db } from "jsr:@vanaware/workerdb";

// Initialize the Global Worker (Main Thread only)
db.init();

// Create a scoped instance (Database, Store, Prefix)
const msgStore = db("WORKERDB_DATA", "messages", "MSG_");

// Basic CRUD
const id = await msgStore.set("auto", { text: "Hello", status: "pending" }); // Returns MSG_xxx
const msg = await msgStore.get(id);
await msgStore.patch(id, { status: "sent" });
await msgStore.delete(id);

// Batch operations and remote queries executed in the Worker
await msgStore.setSome(
  (items) => items.filter((i) => i.status === "pending"),
  (item) => ({ ...item, status: "sent" })
);

const pendingCount = await msgStore.query((items) =>
  items.filter((i) => i.status === "pending").length
);
```

---

## 📦 4. Module: `ls()` (LocalStorage)

`ls()` follows the exact same patterns and signatures as `db()`, but operates **synchronously** directly against `localStorage`. Ideal for theme preferences, authentication state, or rapid boot configurations.

```ts
import { ls } from "jsr:@vanaware/workerdb";

const prefStore = ls("WORKERDB_PREF_");

// Immediate synchronous usage
prefStore.set("config", { theme: "dark" });
const prefs = prefStore.get("config");

// Asynchronous backups delegated to Worker-DB (OPFS)
await prefStore.backupToOpfs("backups_prefs", "ui_config.json");
```

---

## 📦 5. Module: `opfs()` (Origin Private File System)

The crown jewel. `opfs()` **inherits all capabilities from `db()`**, but extends the API to manage physical files on disk. It adopts the **Record-Key Isolation** pattern: each database record key is paired with its own isolated directory in the FileSystem.

### Initialization

```ts
import { opfs } from "jsr:@vanaware/workerdb";

// Parameters: DB, Store, ID Prefix, Base OPFS subfolder
const drive = opfs("WORKERDB_FILES", "attachments", "ATT_", "chats");
```

### Upload and Lightweight Listing

To avoid overloading RAM (e.g. if a directory contains dozens of large files), `listFiles` returns only **lightweight metadata**.

```ts
const msgRecordId = "msg_12345";

// Saving file in the background Worker
await drive.addFile(msgRecordId, fileInput.files[0], "photo.png");

// Ultra-fast listing (only name, size, type, lastModified)
const files = await drive.listFiles(msgRecordId);
files.forEach((f) => console.log(`${f.name} - ${f.size} bytes`));
```

### On-Demand Download / Read

The raw file content (`Blob` / `File`) only crosses the bridge from the Worker to the Main Thread when explicitly requested for display or download.

```ts
const rawFile = await drive.getFile(msgRecordId, "photo.png");
const objectUrl = URL.createObjectURL(rawFile);
```

### File Management and Manipulation

```ts
await drive.renFile(msgRecordId, "photo.png", "avatar.png");
await drive.delFile(msgRecordId, "avatar.png");
await drive.mvFile(msgRecordId, "file.txt", "other_destination_folder");
```

---

## 🗜️ 6. Integrated ZIP Compression API

Built-in native tools in `opfs()` for heavy compression running completely outside the UI thread—essential for bulk exports or archiving encrypted E2EE media.

```ts
// 1. Zip all (or selected) files in a record folder (optionally deleting originals)
await drive.zip(msgRecordId, "album.zip", ["photo1.png", "photo2.png"], true);

// 2. Unzip an existing archive in the record folder
await drive.unzip(msgRecordId, "album.zip");

// 3. Add or delete files within an existing ZIP archive
await drive.addZip(msgRecordId, "album.zip", newBlob, "photo3.png");
await drive.delZip(msgRecordId, "album.zip", "photo1.png");
```

---

## 🔄 7. Automated Backups and Recovery

The system provides a unified engine to create snapshots of entire stores (both IndexedDB and LocalStorage) and archive them securely in OPFS under a global `/backup` directory.

```ts
// Generate a snapshot and save to disk (OPFS) under /backup/my_account
await msgStore.backupToOpfs("my_account", "bkp_v1.json");

// Read from disk, truncate the current store, and restore snapshot data
await msgStore.restoreFromOpfs("my_account", "bkp_v1.json", true);
```

---

## 🚧 8. Roadmap

- [x] IndexedDB abstraction in Web Worker
- [x] ID synchronization (Dynamic prefix, "auto" interception)
- [x] Query, SetSome, DelSome (Isolated array calculations in Worker)
- [x] OPFS Integration (Blob operations directly in native FileSystem)
- [x] OPFS ZIP Compression (Powered by `fflate`)
- [x] OPFS Performance Optimization (`listFiles` metadata-only vs on-demand `getFile`)

````

---

## Arquivo: `packages/worker-db/deno.jsonc`

```json
{
  "name": "@vanaware/workerdb",
  "version": "0.3.0#mua9rvo8",
  "description": "Indexeddb wrapper on Web Worker, with a simple API and a powerful query engine.",
  "author": "Vanaware",
  "license": "MIT",
  // ----------------------------------------------------------------------
  // 🔧 Compiler Options específicos do pacote
  // ----------------------------------------------------------------------
  "compilerOptions": {
    "lib": [
      "dom", 
      "dom.iterable", 
      "dom.asynciterable", 
      "esnext"
    ]
  },
  "imports": {
    "fake-indexeddb": "npm:fake-indexeddb@^6.2.5",
    "fake-indexeddb/auto": "npm:fake-indexeddb@^6.2.5/auto",
    "fflate": "npm:fflate@^0.8.3"
  },
  "tasks": {
    "test": "deno test -P",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "check": "deno check src/**/*.{ts,tsx} example/**/*.{ts,tsx} tests/**/*.ts",
    "fmt:check": "deno fmt --check",
    "lint:fix": "deno lint --fix",
    "lint:doc": "deno doc --lint src/mod-main.ts src/mod-sw.ts src/fake/fake-mod.ts src/fake/fake-db.ts",
    "tests": "deno task check && deno task lint && deno task fmt:check && deno task test",
    "demo": "deno run --allow-env --allow-read --allow-net ./example/demo.ts"
  },
  // ----------------------------------------------------------------------
  // 🎯 Exports via subpaths (Deno não suporta conditional exports)
  //
  // Uso no código fonte:
  //   - Main Thread:  import { db, opfs, ls } from "@vanaware/workerdb";
  //   - Service Worker: import { dbsw, opfssw } from "@vanaware/workerdb/sw";
  //   - Web Worker:   import { dbsw, opfssw } from "@vanaware/workerdb/sw";
  // ----------------------------------------------------------------------
  "exports": {
    // Entry point padrão — Main Thread (browser)
    // Retorna db(), opfs(), ls() com Web Worker interno para otimização
    ".": "./src/mod-main.ts",
    // Subpath para Service Worker e Web Worker
    // Retorna db(), opfs() com acesso direto (sem Web Worker interno)
    "./sw": "./src/mod-sw.ts",
    "./fake": "./src/fake/fake-mod.ts",
    "./swfake": "./src/fake/fake-db.ts",
    "./worker": "./src/worker.ts"
  },
  "publish": {
    "include": [
      "src/**/*.ts",
      "README.md",
      "docs/**/*.md",
      "dist/workerdb.min.js",
      "dist/workerdb.min.js.map",
      "deno.jsonc"
    ],
    "exclude": [
      "tests",
      "example"
    ]
  },
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["ban-untagged-todo"],
      "exclude": ["no-unused-vars"]
    },
    "include": [
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "test": {
    "permissions": {
      "read": true,
      "write": true,
      "net": true,
      "env": true,
      "sys": true,
      "run": true,
      "ffi": true,
      "import": true
    },
    "include": [
      "tests/**/*test.ts"
    ],
    "exclude": [
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}"
    ]
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 80,
    "indentWidth": 2,
    "semiColons": true,
    "singleQuote": false,
    "proseWrap": "preserve",
    "trailingCommas": "always",
    "json.trailingCommas": "never",
    "operatorPosition": "maintain",
    "jsx.bracketPosition": "sameLine",
    "jsx.forceNewLinesSurroundingContent": true,
    "jsx.multiLineParens": "always",
    "newLineKind": "lf",
    "include": [
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "exclude": [
    "docs"
  ]
}

```

---

