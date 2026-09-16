# WorkerDB API Reference

WorkerDB is an offline-first storage and file management library running strictly within a Web Worker. It exposes three primary namespaces:

- `db`: Asynchronous IndexedDB operations via RPC to the Worker.
- `opfs`: Asynchronous Origin Private File System operations via RPC to the Worker.
- `ls`: Synchronous LocalStorage wrapper.

All exports can be imported from `@workerdb/workerdb`.

---

## 🚀 Initialization & Lifecycle

### `db.init(workerPath?: string | URL)`
Initializes the Web Worker connection. By default, it expects the worker to be served at `./worker.js`.
```typescript
import { db } from "@workerdb/workerdb";
db.init("./worker.js");
```

### `db.restart()`
Terminates the current Worker instance and spins up a fresh one, immediately processing queued RPC requests.

### `db.terminate()`
Safely shuts down and cleans up the active Web Worker instance.

---

## 🗄️ Database API (`db`)

The `db` object provides a complete set of asynchronous database operations for IndexedDB (via `idb-keyval`). 

### Scoping
You can create isolated namespaces for different tables or stores by invoking `db` as a function.

```typescript
// Creates an isolated instance
const myStore = db("MyDatabase", "MyStore", "user_123_");
// Now myStore.set("config", {...}) saves to key: "user_123_config"
```

### Basic CRUD Operations

- **`get<T>(key: string): Promise<WithId<T> | undefined>`**
  Retrieves a record by its key. Automatically injects the `_id` into the returned object.
- **`set<T>(key: string, val: T): Promise<string>`**
  Sets a specific key.
- **`set<T>(val: T): Promise<string>`**
  Automatically generates a highly collision-resistant ID and saves the document. Returns the generated key.
- **`update<T>(key: string, updater: (val: WithId<T> | undefined) => T): Promise<void>`**
  Atomically updates a record by passing its current value to an updater function.
- **`patch<T, C>(key: string, patchOrFn: Partial<T> | Function, context?: C): Promise<WithId<T>>`**
  Partially updates a record. Accepts a partial object, or a function that executes *inside the worker* to calculate the patch.
- **`delete(key: string): Promise<void>`**
  Removes a record by its key.

### Bulk Operations

- **`getMany<T>(keys: string[]): Promise<(WithId<T> | undefined)[]>`**
  Retrieves multiple records.
- **`setMany(entries: [string, unknown][]): Promise<void>`**
  Inserts or updates multiple records concurrently.
- **`deleteMany(keys: string[]): Promise<void>`**
  Deletes multiple records concurrently.

### Collection Operations

- **`keys(): Promise<string[]>`**
  Returns all keys in the store (respecting prefix/scope).
- **`values<T>(): Promise<T[]>`**
  Returns all values in the store.
- **`entries<T>(): Promise<[string, T][]>`**
  Returns all entries `[key, value]` pairs.
- **`clear(): Promise<void>`**
  Removes all entries within the active scope.

### 🧠 Worker Execution Engine

Run heavy array methods directly inside the Web Worker (no data serialization back and forth just to filter items!).

- **`query<T, R, C>(fn: (items: WithId<T>[], ctx: C) => R, context?: C): Promise<R>`**
  Executes an arbitrary function across all stored items in the Worker and returns the computed result. Useful for aggregations, counting, or deep searches.
  
  ```typescript
  // Example: Calculate total invoice amount natively in the worker
  const result = await db("FINANCES", "invoices").query((items) => {
    return {
      count: items.length,
      total: items.reduce((acc, i) => acc + i.amount, 0),
      firstWorkItem: items.find(i => i.tag === "work"),
      sorted: items.toSorted((a, b) => a.amount - b.amount)
    };
  });
  ```

- **`getSome<T, C>(fn: (items: WithId<T>[], ctx: C) => WithId<T>[], context?: C): Promise<WithId<T>[]>`**
  Like `query`, but specifically expects a filtered array of items returned. Great for complex native filters.

  ```typescript
  // Example: Filter high value items by passing external context
  const targetThreshold = 500;
  const expensiveItems = await db("SHOP", "items").getSome(
    (items, ctx) => items.filter(i => i.price >= ctx.threshold),
    { threshold: targetThreshold } // Context is injected!
  );
  ```

- **`delSome<T, C>(fn: (items: WithId<T>[], ctx: C) => WithId<T>[], context?: C): Promise<void>`**
  Filters items within the worker and automatically deletes the resulting matches.

  ```typescript
  // Example: Delete all inactive employees
  await db("COMPANY", "employees").delSome((items) => 
    items.filter(i => i.active === false)
  );
  ```

- **`setSome<T, C>(selectFn: Function, updateFn: Function, context?: C): Promise<void>`**
  Selects records and updates them en-masse natively in the background thread. Applies type transformations or bulk updates without main-thread locking.

  ```typescript
  // Example: Mass update department names to uppercase for active employees
  await db("COMPANY", "employees").setSome(
    // 1. Selector Function
    (items) => items.filter(item => item.active === true),
    // 2. Updater Function
    (item) => ({
      ...item,
      name: item.name.toUpperCase(),
      department: item.department.toUpperCase(),
      level: String(item.level) // Mutating type from number to string!
    })
  );
  ```

### OPFS Backup / Export

- **`exportDB(): Promise<Record<string, unknown>>`**
  Dumps the database to a JSON object.
- **`importDB(data: Record<string, unknown>, clearFirst = false): Promise<void>`**
  Hydrates the database from a JSON dump.
- **`backupToOpfs(key: string, fileName?: string): Promise<string>`**
  Writes a full JSON database snapshot to OPFS natively within the worker.
- **`restoreFromOpfs(key: string, fileName: string, clearFirst = false): Promise<void>`**
  Restores the database from an OPFS JSON snapshot.

---

## 📁 OPFS API (`opfs`)

Provides native access to the Origin Private File System for robust offline blob/binary storage. Executed inside the Web Worker.

### Scoping
```typescript
const userFiles = opfs("MyDb", "MyStore", "user_prefix_", "base/folder/path");
```

### File Operations

- **`listFiles(key: string): Promise<string[]>`**
  Lists all files associated with a specific logical key (folder representation).
- **`getFile(key: string, fileName: string): Promise<File>`**
  Retrieves a file as a binary `File` object.
- **`addFile(key: string, file: File | Blob, fileName: string): Promise<void>`**
  Saves a file to OPFS.
- **`delFile(key: string, fileName: string): Promise<void>`**
  Deletes a specific file.
- **`renFile(key: string, oldName: string, newName: string): Promise<void>`**
  Renames a file in-place.
- **`mvFile(key: string, fileName: string, newKey: string): Promise<void>`**
  Moves a file to a new logical key folder.

### Zip/Archive Operations
All Zip actions execute natively in the Worker using `fflate` compression!

- **`zip(key: string, zipName: string, filesToZip?: string[], deleteOriginals = false): Promise<void>`**
  Compresses specific files (or the entire folder) into a `.zip` archive.
- **`unzip(key: string, zipName: string, deleteZip = false): Promise<void>`**
  Extracts an OPFS `.zip` archive.
- **`addZip(key: string, zipName: string, file: File | Blob, fileName: string): Promise<void>`**
  Writes a file directly into an existing `.zip` archive without extracting it.
- **`delZip(key: string, zipName: string, fileName: string): Promise<void>`**
  Deletes a specific file from inside a `.zip` archive.

---

## 💾 LocalStorage API (`ls`)

A synchronous fallback matching the structure of `db`, operating directly on `window.localStorage`.

### Scoping
```typescript
const preferences = ls("prefs_");
preferences.set("theme", "dark");
```

### Supported Methods
`ls` exposes synchronous variants of the fundamental CRUD and Map operations:
- `get(key)`, `set(key, val)`, `set(val)`, `update(key, fn)`, `patch(key, patch)`
- `delete(key)`
- `getMany(keys)`, `setMany(entries)`, `deleteMany(keys)`
- `keys()`, `values()`, `entries()`, `clear()`
- `getSome(fn)`, `delSome(fn)`, `setSome(fn)`
- `importDB(data)`, `exportDB()`
