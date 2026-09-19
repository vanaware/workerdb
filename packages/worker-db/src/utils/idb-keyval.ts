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
