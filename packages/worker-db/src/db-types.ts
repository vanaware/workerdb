// packages/worker-db/src/db-types.ts
// Pure type definitions and the stateless buildIDBQuery helper.
// Extracted from db.ts to keep the implementation module focused on storage logic.

import type { WithId } from "./utils/id.ts";

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
  generateId: () => string;
  /** Generates a random unique ID with prefix. */
  generateIdWithPrefix: (prefix?: string) => string;
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
