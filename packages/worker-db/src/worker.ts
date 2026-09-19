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

