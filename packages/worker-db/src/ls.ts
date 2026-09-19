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
