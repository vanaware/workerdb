// ## Arquivo: monorepo/worker-db/src/ls.ts
import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from "./utils/id.ts";
import { opfs, } from "./mod-main.ts"; // 💎 Proxy Worker-DB: Ponto de acesso unificado e assíncrono

export interface LsStoreOptions {
  prefix?: string;
}

function getAllPrefixedEntries(prefix = "",): [string, unknown,][] {
  const entries: [string, unknown,][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i,);
    if (key && (!prefix || key.startsWith(prefix,))) {
      const rawVal = localStorage.getItem(key,);
      if (rawVal !== null) {
        try {
          entries.push([key, JSON.parse(rawVal,),],);
        } catch {
          // Ignora itens que não sejam JSON válido
        }
      }
    }
  }
  return entries;
}

function getFormattedItems<T,>(prefix = "",): WithId<T>[] {
  const rawEntries = getAllPrefixedEntries(prefix,);
  return rawEntries.map(([k, v,],) => formatDbItem(k, v, prefix,) as WithId<T>);
}

function resolveKey(key: string, prefix = "",): string {
  return prefix && !key.startsWith(prefix,) ? `${prefix}${key}` : key;
}

function createScopedLs(prefix = "",) {
  return {
    get: <T,>(key: string,): WithId<T> | undefined => {
      const fullKey = resolveKey(key, prefix,);
      const raw = localStorage.getItem(fullKey,);
      if (raw === null) return undefined;
      try {
        return formatDbItem(fullKey, JSON.parse(raw,), prefix,) as WithId<T>;
      } catch {
        return undefined;
      }
    },

    set: <T,>(keyOrVal: string | T, val?: T,): string => {
      let key: string | undefined;
      let targetVal: unknown;

      if (typeof keyOrVal === "string") {
        key = keyOrVal;
        targetVal = val;
      } else {
        key = undefined;
        targetVal = keyOrVal;
      }

      const { key: finalKey, cleanVal, } = prepareForSave(
        key,
        targetVal,
        prefix,
      );
      localStorage.setItem(finalKey, JSON.stringify(cleanVal,),);
      return finalKey;
    },

    patch: <T extends Record<string, unknown>, C = unknown,>(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),
      context?: C,
    ): WithId<T> => {
      const current = createScopedLs(prefix,).get<T>(key,) || ({} as WithId<T>);
      let updated: unknown;

      if (typeof patchOrFn === "function") {
        updated = patchOrFn(current, context,);
      } else {
        updated = Object.assign({}, current, patchOrFn,);
      }

      const { key: finalKey, cleanVal, } = prepareForSave(
        key,
        updated,
        prefix,
      );
      localStorage.setItem(finalKey, JSON.stringify(cleanVal,),);
      return formatDbItem(finalKey, cleanVal, prefix,) as WithId<T>;
    },

    delete: (key: string,): void => {
      localStorage.removeItem(resolveKey(key, prefix,),);
    },

    getMany: <T,>(keys: string[],): (WithId<T> | undefined)[] => {
      const api = createScopedLs(prefix,);
      return keys.map((k,) => api.get<T>(k,));
    },

    setMany: (entries: [string, unknown,][],): void => {
      const api = createScopedLs(prefix,);
      entries.forEach(([k, v,],) => api.set(k, v,));
    },

    deleteMany: (keys: string[],): void => {
      const api = createScopedLs(prefix,);
      keys.forEach((k,) => api.delete(k,));
    },

    keys: (): string[] => {
      const keysList: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i,);
        if (k && (!prefix || k.startsWith(prefix,))) {
          keysList.push(k,);
        }
      }
      return keysList;
    },

    values: <T,>(): T[] => {
      return getFormattedItems<T>(prefix,) as unknown as T[];
    },

    entries: <T,>(): [string, T,][] => {
      return getAllPrefixedEntries(prefix,) as [string, T,][];
    },

    clear: (): void => {
      if (!prefix) {
        localStorage.clear();
        return;
      }
      const keysToRemove = createScopedLs(prefix,).keys();
      keysToRemove.forEach((k,) => localStorage.removeItem(k,));
    },

    query: <T, R, C = unknown,>(
      fn: (items: WithId<T>[], ctx?: C,) => R,
      context?: C,
    ): R => {
      const items = getFormattedItems<T>(prefix,);
      return fn(items, context,);
    },

    getSome: <T, C = unknown,>(
      fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
      context?: C,
    ): WithId<T>[] => {
      const items = getFormattedItems<T>(prefix,);
      const selected = fn(items, context,);
      if (!Array.isArray(selected,)) {
        throw new Error("A função em getSome deve retornar um Array.",);
      }
      return selected;
    },

    delSome: <T, C = unknown,>(
      fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
      context?: C,
    ): void => {
      const items = getFormattedItems<T>(prefix,);
      const selected = fn(items, context,);
      if (!Array.isArray(selected,)) {
        throw new Error("A função em delSome deve retornar um Array.",);
      }
      selected.forEach((item,) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Os itens retornados em delSome precisam conter a propriedade '_id'.",
          );
        }
        const rawKey = prefix && !item._id.startsWith(prefix,)
          ? `${prefix}${item._id}`
          : item._id;
        localStorage.removeItem(rawKey,);
      },);
    },

    setSome: <T, C = unknown,>(
      selectFn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C,) => WithId<T>,
      context?: C,
    ): void => {
      const items = getFormattedItems<T>(prefix,);
      const selected = selectFn(items, context,);
      if (!Array.isArray(selected,)) {
        throw new Error(
          "A função de seleção em setSome deve retornar um Array.",
        );
      }
      selected.forEach((item,) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Os itens selecionados em setSome precisam conter a propriedade '_id'.",
          );
        }
        const updatedItem = updateFn(item, context,);
        const { key: finalKey, cleanVal, } = prepareForSave(
          undefined,
          updatedItem,
          prefix,
        );
        localStorage.setItem(finalKey, JSON.stringify(cleanVal,),);
      },);
    },

    // --- MÉTODOS DE EXPORTAÇÃO / IMPORTAÇÃO ---

    exportLS: (): Record<string, unknown> => {
      const allEntries = getAllPrefixedEntries(prefix,);
      return Object.fromEntries(allEntries,);
    },

    importLS: (data: Record<string, unknown>, clearFirst = false,): void => {
      const api = createScopedLs(prefix,);
      if (clearFirst) api.clear();
      Object.entries(data,).forEach(([k, v,],) => api.set(k, v,));
    },

    backupToOpfs: async (
      recordKey: string,
      fileName = "backup.json",
    ): Promise<string> => {
      const data = Object.fromEntries(getAllPrefixedEntries(prefix,),);
      const blob = new Blob([JSON.stringify(data,),], {
        type: "application/json",
      },);

      // Instancia o drive OPFS via worker apontando para a pasta física /backup
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup",);
      await drive.addFile(recordKey, blob, fileName,);

      return `${recordKey}/${fileName}`;
    },

    restoreFromOpfs: async (
      recordKey: string,
      fileName: string,
      clearFirst = false,
    ): Promise<void> => {
      // Instancia o drive OPFS via worker para leitura da pasta /backup
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup",);

      const fileBlob = await drive.getFile(recordKey, fileName,);
      const data = JSON.parse(await fileBlob.text(),);

      const api = createScopedLs(prefix,);
      if (clearFirst) api.clear();
      Object.entries(data,).forEach(([k, v,],) => api.set(k, v,));
    },

    gerarId,
    gerarIdComPrefixo: () => (prefix ? gerarIdComPrefixo(prefix,) : gerarId()),
  };
}

export const ls = Object.assign(
  (prefix = "",) => createScopedLs(prefix,),
  createScopedLs(),
);
