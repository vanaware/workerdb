// ## Arquivo: monorepo/worker-db/src/db.ts
import { internalAPI, } from "./db.ts";
import type { DbStoreOptions, OpfsStoreOptions, } from "./db.ts";

import { APP_VERSION, } from "@workerdb/utils/config";

console.log(`[DB] 🌌 Worker-db carregado (v${APP_VERSION}).`,);

self.onmessage = async (e: MessageEvent,) => {
  const { requestId, command, args, } = e.data;

  try {
    const dbOpts: DbStoreOptions = {
      dbName: args.dbName,
      storeName: args.storeName,
      prefix: args.prefix,
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

      default:
        throw new Error(`Comando desconhecido: ${command}`,);
    }

    self.postMessage({ requestId, success: true, result, },);
  } catch (error) {
    self.postMessage({
      requestId,
      success: false,
      error: (error as Error).message,
    },);
  }
};
