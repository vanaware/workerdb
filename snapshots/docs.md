> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém a DOCUMENTAÇÃO e diretrizes arquiteturais do projeto.
> O projeto é o **WorkerDB ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: DOCS

Gerado automaticamente em: 9/20/2026, 5:30:37 PM

---

## Arquivo: `docs/api.md`

````md
# WorkerDB API Reference

WorkerDB is an offline-first storage and file management library running strictly within a Web Worker. It exposes three primary namespaces:

- `db`: Asynchronous IndexedDB operations via RPC to the Worker.
- `opfs`: Asynchronous Origin Private File System operations via RPC to the Worker.
- `ls`: Synchronous LocalStorage wrapper.

All exports can be imported from `jsr:@vanaware/workerdb`.

---

## 🚀 Initialization & Lifecycle

### `db.init(workerPath?: string | URL)`
Initializes the Web Worker connection. By default, it expects the worker to be served at `./worker.js`.
```typescript
import { db } from "jsr:@vanaware/workerdb";
db.init("./worker.js");
```

### `db.restart()`
Terminates the current Worker instance and spins up a fresh one, immediately processing queued RPC requests.

### `db.terminate()`
Safely shuts down and cleans up the active Web Worker instance.

---

## 🗄️ Database API (`db`)

The `db` object provides a complete set of asynchronous database operations for IndexedDB (via `idb-keyval`). 

### Scoping & Options
You can create isolated namespaces for different tables or stores by invoking `db` as a function with options or positional arguments. Supports TypeScript generics to type documents:

```typescript
interface UserProfile {
  username: string;
  age: number;
}

// Option A: With configuration object
const myStore = db<UserProfile>({
  dbName: "MyDatabase",
  storeName: "users",
  prefix: "usr_",
  indexes: ["age"], // IndexedDB index
  validator: (item) => typeof item === "object" && item !== null && (item as any).age >= 18,
});

// Option B: With positional parameters
const simpleStore = db<UserProfile>("MyDatabase", "users", "usr_");
```

### Schema Validation & Indexed Operations

- **`validator: (item: unknown) => boolean`**
  Validate items before writing to the database on `set`, `setMany`, and `patch`.
- **`getByIndex<T>(indexName: string, query: IDBValidKey): Promise<WithId<T>[]>`**
  Queries records directly using IndexedDB secondary indexes (O(log N) indexed lookup).
- **`getManyByIndex<T>(indexName: string, queries: IDBValidKey[]): Promise<WithId<T>[]>`**
  Queries records matching any of the specified index keys in batch, deduplicating matching results.
- **`getSomeByIndex<T, C = unknown>(indexName: string, query: IDBValidKey, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C): Promise<WithId<T>[]>`**
  Uses the index to retrieve ONLY the subset matching `query` and then executes a filtering function on that small subset, avoiding loading the full database into memory.
- **`queryByIndex<T, R, C = unknown>(indexName: string, query: IDBValidKey, fn: (items: WithId<T>[], ctx?: C) => R, context?: C): Promise<R>`**
  Executes an aggregation or transformation function over the index-matched records directly in the worker.
- **`deleteByIndex(indexName: string, query: IDBValidKey): Promise<void>`**
  Deletes all records matching an index key in O(log N) without retrieving or loading document contents into memory.
- **`deleteManyByIndex(indexName: string, queries: IDBValidKey[]): Promise<void>`**
  Deletes all records matching any of the specified index keys in batch.
- **`delSomeByIndex<T, C = unknown>(indexName: string, query: IDBValidKey, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C): Promise<void>`**
  Uses the index to retrieve only the matching subset, selects items to remove using `fn`, and deletes them by key.
- **`setSomeByIndex<T, C = unknown>(indexName: string, query: IDBValidKey, selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C): Promise<void>`**
  Uses the index to retrieve only the matching subset, selects targets with `selectFn`, computes updates with `updateFn`, validates schema, and writes updates back.

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
- **`getFileStream(key: string, fileName: string): Promise<ReadableStream<Uint8Array>>`**
  Retrieves a file as a chunked `ReadableStream<Uint8Array>` (memory-efficient for large files).
- **`addFile(key: string, file: File | Blob, fileName: string): Promise<void>`**
  Saves a file to OPFS.
- **`addFileStream(key: string, fileName: string, stream: ReadableStream<Uint8Array>): Promise<void>`**
  Pipes a `ReadableStream<Uint8Array>` directly into an OPFS file.
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

---

## 🆔 ID Utilities

WorkerDB exports cryptographic identifier utilities for client-side key generation and validation:

```typescript
import { gerarId, gerarIdComPrefixo, validarId, type WithId } from "jsr:@vanaware/workerdb";

// Generate a 12-character cryptographically random ID
const id = gerarId(); // e.g. "4f8a91b2c3d4"

// Generate an ID with a domain prefix
const userId = gerarIdComPrefixo("usr_"); // e.g. "usr_4f8a91b2c3d4"

// Validate ID string format and length (1-24 chars)
const isValid = validarId(id); // true

// Generic helper type for documents with an _id field
type UserDocument = WithId<{ name: string; email: string }>;
```

---

## 📂 OPFS Explorer API (`@vanaware/opfs-explorer`)

The companion library `jsr:@vanaware/opfs-explorer` provides a zero-dependency, pluggable Service Worker handler and visual UI for browsing and downloading files in the Origin Private File System.

### Quick Import
```typescript
import {
  createOpfsFetchHandler,
  handleOpfsRequest,
  listOpfsFiles,
  getFileFromOpfs,
  getMimeType,
  resolveRoutePrefix,
  type OpfsExplorerOptions,
  type OpfsExplorerResponse,
} from "jsr:@vanaware/opfs-explorer";
```

### 1. `createOpfsFetchHandler(options?: string | OpfsExplorerOptions)`
Creates a standard `(event: FetchEvent) => void` listener to plug directly into `self.addEventListener("fetch", ...)`.
- Accepts either a custom subfolder name string (`"files"`, `"arquivos"`, `"opfs"`) or a configuration object.
- Automatically handles canonical redirects (e.g. `/files` -> `/files/`), directory index generation, and binary file streaming.

```typescript
// 1-liner with custom subfolder (auto-resolves scope on GitHub Pages or localhost):
self.addEventListener("fetch", createOpfsFetchHandler("files"));

// With options object:
self.addEventListener("fetch", createOpfsFetchHandler({
  subfolder: "arquivos",
  title: "Meus Arquivos Locais",
  opfsDir: "backups", // Restrict explorer to a specific subfolder inside OPFS
}));
```

### 2. `handleOpfsRequest(request: Request, options?: string | OpfsExplorerOptions): Promise<OpfsExplorerResponse>`
Low-level request handler for custom Service Worker routing pipelines:

```typescript
self.addEventListener("fetch", async (event) => {
  const { matched, response } = await handleOpfsRequest(event.request, "files");
  if (matched && response) {
    event.respondWith(response);
  }
});
```

### 3. `OpfsExplorerOptions`

```typescript
interface OpfsExplorerOptions {
  /** Subfolder name to mount the explorer under (e.g. "files", "arquivos", "opfs"). */
  subfolder?: string;
  /** Explicit route prefix override (e.g. "/files" or "/my-repo/files"). */
  routePrefix?: string;
  /** Base scope path override (defaults to self.registration.scope pathname). */
  scopePath?: string;
  /** Custom title for HTML header and page <title>. */
  title?: string;
  /** Custom CSS styles to inject into the explorer interface. */
  customStyles?: string;
  /** Custom root directory handle (defaults to OPFS root). */
  rootDir?: FileSystemDirectoryHandle;
  /** Name of a specific OPFS subdirectory to restrict exploration to. */
  opfsDir?: string;
}
```

### 4. Direct File & Path Utilities
These functions can be imported and executed standalone in any modern browser context (UI, Web Worker, or Service Worker):

- **`listOpfsFiles(dirHandle?: FileSystemDirectoryHandle, path?: string): Promise<string[]>`**
  Recursively traverses the OPFS directory tree and returns an array of relative file paths (e.g. `["backups/db.json", "photos/cover.png"]`).
- **`getFileFromOpfs(filePath: string, rootDir?: FileSystemDirectoryHandle): Promise<File>`**
  Resolves a relative path and returns the native `File` object from OPFS.
- **`getMimeType(path: string): string`**
  Resolves the Content-Type MIME header for a file extension (e.g. `"image/png"`, `"application/json"`).
- **`resolveRoutePrefix(options?: string | OpfsExplorerOptions): string`**
  Computes the canonical path prefix combining the active Service Worker scope and configured subfolder (e.g. `"/my-repo/files"`).



````

---

## Arquivo: `docs/getting-started.md`

````md
# Getting Started: How to Use WorkerDB

WorkerDB is designed to be highly modular and environment-agnostic (running purely on standard Web APIs like Web Workers, IndexedDB, and OPFS). 

Because the library relies on Web Workers, setting it up requires **two steps**: configuring the background worker and importing the main thread client.

This guide explains how to import and use the library via **JSR** or directly from the **GitHub** repository.

---

## 📦 1. Installation & Importing

WorkerDB is available via **JSR** (recommended for Deno) and as a raw **GitHub** import.

### Option A: JSR (Best for Deno & modern toolchains)
JSR provides automatic type definitions and optimized loading.

```typescript
// Main Thread (UI/App)
import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// Service Worker / Web Worker (Direct Access)
import { dbsw, opfssw } from "jsr:@vanaware/workerdb/sw";
```

### Option B: Importing Directly from GitHub (No registry)
You can import WorkerDB directly via URL. Depending on your environment, you can use raw GitHub URLs (best for Deno) or a CDN like `esm.sh` or `jsdelivr` (best for browsers).

#### Standard GitHub URLs
- **Main Thread (UI/App):** 
  `https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/mod-main.ts`
- **Web Worker Engine:** 
  `https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/worker.ts`
- **Service Worker:** 
  `https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/mod-sw.ts`

*(Note: If using standard Node.js or a web bundler like Vite, you can use `https://esm.sh/gh/vanaware/workerdb/packages/worker-db/src/mod-main.ts` to ensure proper transpilation and MIME types).*

---

## ⚙️ 2. Setting up the Web Worker (Crucial Step)

Because browsers enforce strict **Same-Origin Policies** on Web Workers, you generally *cannot* instantiate a worker directly from an external URL like GitHub. 

To solve this, you need to create a small, local worker file in your project that imports the remote WorkerDB engine.

**Create a file named `worker.ts` (or `worker.js`) in your public/static folder:**

```typescript
// File: my-local-worker.ts (Served at /my-local-worker.js)

// Import the background worker engine from JSR
import "jsr:@vanaware/workerdb/sw"; 

// OR from GitHub
// import "https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/worker.ts";

// The imported script automatically sets up the `onmessage` listeners!
```

---

## 🚀 3. Initializing in your Main App

Now, in your main application logic (React, Preact, Vanilla JS, etc.), import the main-thread RPC client and point it to your local worker file.

```typescript
// File: main.ts (Your UI / Application logic)

import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// 1. Initialize the Database Engine by pointing to your local worker file
db.init("./my-local-worker.js"); // Ensure this path correctly resolves in your browser!

// 2. Create a scoped database instance
const usersStore = db("MyApp", "Users", "USR_");

// 3. Start using the database non-blockingly!
async function saveUser() {
  await usersStore.set("123", { name: "Alice", role: "admin" });
  
  const user = await usersStore.get("123");
  console.log("Saved User:", user);
}

saveUser();
```

---

## 🌐 4. Using within a Service Worker

Service Workers already operate in a background thread and have native access to IndexedDB. They **do not** need the Web Worker RPC bridge.

If you want to use WorkerDB inside your Service Worker (for caching, offline sync, etc.), import from the **`mod-sw.ts`** endpoint.

```typescript
// File: sw.ts (Your Service Worker script)

// Import the direct-access SW module
import { db, opfs } from "jsr:@vanaware/workerdb/sw";

self.addEventListener("sync", async (event) => {
  if (event.tag === "sync-data") {
    const store = db("MyApp", "OfflineQueue");
    const pendingItems = await store.values();
    
    // Process background sync...
  }
});
```

---

## 📂 5. Adding the Visual OPFS Explorer to your Service Worker

You can expose a visual web interface to browse, inspect, and download files directly from OPFS by installing the companion package `jsr:@vanaware/opfs-explorer`:

```typescript
// File: sw.ts (Your Service Worker)
import { createOpfsFetchHandler } from "jsr:@vanaware/opfs-explorer";

// Route explorer to /files/ (or custom name like "arquivos" or "opfs"):
self.addEventListener("fetch", createOpfsFetchHandler("files"));
```

- **Zero configuration:** Automatically detects your Service Worker scope (whether running at `http://localhost:3000/` or on GitHub Pages `https://vanaware.github.io/my-repo/`).
- Navigate in your browser to `http://localhost:3000/files/` to see your OPFS files in real time.

---

## 🧪 6. Quick Summary of API Exports

WorkerDB provides three main namespaces in `@vanaware/workerdb`:

1. `db`: The **IndexedDB** wrapper. Async. Persists complex JSON objects and handles heavy array queries using the Web Worker engine.
2. `opfs`: The **Origin Private File System** wrapper. Async. Manages heavy binary data (Files, Blobs) and handles zip compression securely in the background.
3. `ls`: The **LocalStorage** wrapper. Sync. Use only for tiny configurations like theme preferences, as it runs synchronously on the main thread.

And the companion package `@vanaware/opfs-explorer`:
- `createOpfsFetchHandler`: 1-line fetch event listener for visual directory browsing.
- `handleOpfsRequest`: Custom request routing and file inspection.
- `listOpfsFiles` & `getFileFromOpfs`: Standalone file utilities.

For deep documentation on what functions these namespaces provide, see the [API Reference](./api.md).


````

---

## Arquivo: `docs/publish-jsr-rules.md`

`````md
# Diretrizes de Documentação e Publicação no JSR

> **Nota para Agentes de IA:** Este documento define os padrões obrigatórios para documentação (README.md e JSDoc) e as regras de configuração do `deno.json` para publicação no JSR. Siga estas diretrizes rigorosamente ao gerar ou refatorar código neste repositório.

---

## 📌 Sumário

1. [Visão Geral](#-visão-geral)
2. [Padrões para o README.md](#-padrões-para-o-readmemd)
3. [Padrões para Comentários JSDoc](#-padrões-para-comentários-jsdoc)
4. [Recomendações de Uso e Qualidade](#-recomendações-de-uso-e-qualidade)
5. [Configuração de `publish: false` em Workspaces](#-configuração-de-publish-false-em-workspaces)
6. [Configuração de `publish.include` e `publish.exclude`](#-configuração-de-publishinclude-e-publishexclude)
7. [Checklist Antes de Publicar](#-checklist-antes-de-publicar)

---

## 🎯 Visão Geral

Todo pacote publicado no JSR deve ter **duas camadas de documentação**:

| Camada | Arquivo/Local | Propósito | Público-Alvo |
| :--- | :--- | :--- | :--- |
| **Guia Rápido** | `README.md` na raiz | Explicar *por que* usar o pacote e como começar. | Desenvolvedores avaliando adotar o pacote. |
| **Referência da API** | Comentários JSDoc no código | Documentar *como* usar cada símbolo exportado. | Desenvolvedores que já usam o pacote. |

Ambas as camadas impactam diretamente a **pontuação de qualidade do JSR** e a experiência do usuário final (incluindo autocompletar no editor).

---

## 📝 Padrões para o README.md

### Localização e Formato
- **Arquivo:** `README.md` 
- **Localização:** Obrigatório, na raiz do pacote, não é o mesmo README da raiz do worspace, cada pacote a ser publicado precisa de seu próprio README.
- **Sintaxe:** Markdown padrão (GFM - GitHub Flavored Markdown).
- **Idioma:** Inglês (mantenha consistência e use o mesmo idioma em toda a documentação a ser publicada).

### Estrutura Obrigatória

O README **deve** conter, no mínimo, as seguintes seções nesta ordem:

1. **Título** (`# Nome do Pacote`) — usar o nome real do pacote, sem o escopo.
2. **Descrição curta** — uma ou duas frases explicando o que o pacote faz.
3. **Instalação** — bloco de código com o comando `deno add`.
4. **Uso Básico** — **obrigatório** um bloco de código funcional mostrando import + uso real.
5. **Documentação** — link para a página do pacote no JSR (referência da API).

### Estrutura Recomendada (Adicional)

- **Features** — lista de bullets com os principais recursos.
- **API Overview** — tabela ou lista dos principais exports.
- **Exemplos Avançados** — casos de uso além do "hello world".

### Exemplo de Template

````markdown
# nome-do-pacote

Uma breve descrição de uma ou duas frases sobre o que este pacote faz.

## Instalação

```bash
deno add jsr:@seu-escopo/nome-do-pacote
```

## Uso

```ts
import { funcaoPrincipal } from "jsr:@seu-escopo/nome-do-pacote";

const resultado = funcaoPrincipal({ opcao: "valor" });
console.log(resultado);
```

## Features

- ✅ Recurso A
- ✅ Recurso B
- ✅ Recurso C

## Documentação

Para a referência completa da API, visite a
[página do pacote no JSR](https://jsr.io/@vanaware/nome-do-pacote).

````

### ⚠️ Regras Críticas
- **NUNCA** deixe o README vazio ou com apenas o título.
- **SEMPRE** inclua um bloco de código no README — o JSR usa isso para pontuar o pacote.
- **NÃO** duplique toda a documentação JSDoc aqui; o README é visão geral, não referência.

---

## 📚 Padrões para Comentários JSDoc

### Regras Gerais
- **Local:** Imediatamente acima de **cada símbolo exportado** (função, classe, interface, tipo, constante).
- **Sintaxe:** Bloco `/** ... */` com cada linha interna iniciando por `*`.
- **Idioma:** Manter o mesmo do README.
- **Obrigatoriedade:** Todo `export` **deve** ter JSDoc. Sem exceção.

### Estrutura do Bloco

1. **Resumo** (primeira linha) — frase curta e imperativa. Aparece em tooltips do editor.
2. **Descrição detalhada** (opcional) — parágrafo(s) adicional(is) com contexto.
3. **Tags** — na ordem: `@param`, `@returns`, `@throws`, `@example`, `@see`.
4. **Exemplo** — sempre que a função não for trivial.

### Exemplo Completo — Função

````ts
/**
 * Busca registros no banco de dados usando a consulta fornecida.
 *
 * Realiza normalização de entrada e aplica limite padrão quando não
 * especificado, evitando sobrecarga em consultas muito amplas.
 *
 * @param query - Consulta textual. Deve ter entre 1 e 50 caracteres.
 * @param limit - Número máximo de itens a retornar. Padrão: `20`.
 * @returns Array com os registros encontrados. Vazio se nada corresponder.
 * @throws {Error} Se `query` estiver vazia ou exceder 50 caracteres.
 *
 * @example
 * ```ts
 * const resultados = search("Deno");
 * console.log(resultados); // ["Deno", "Deno Deploy"]
 * ```
 *
 * @see {@link normalizeQuery} para detalhes da normalização.
 */
export function search(query: string, limit: number = 20): string[] {
  // ...
}
````

### Exemplo Completo — Interface / Tipo

````ts
/**
 * Opções aceitas pelo cliente HTTP.
 */
export interface ClientOptions {
  /** URL base para todas as requisições. */
  baseUrl: string;

  /** Tempo limite em milissegundos. Padrão: `5000`. */
  timeout?: number;

  /** Cabeçalhos adicionais enviados em cada requisição. */
  headers?: Record<string, string>;
}
````

### Exemplo Completo — Classe

````ts
/**
 * Cliente HTTP leve com suporte a retry automático.
 *
 * @example
 * ```ts
 * const client = new Client({ baseUrl: "https://api.example.com" });
 * const data = await client.get("/users");
 * ```
 */
export class Client {
  /**
   * Cria uma nova instância do cliente.
   *
   * @param options - Configurações do cliente.
   */
  constructor(options: ClientOptions) {
    // ...
  }

  /**
   * Executa uma requisição GET.
   *
   * @param path - Caminho relativo à `baseUrl`.
   * @returns Resposta parseada como JSON.
   */
  async get<T>(path: string): Promise<T> {
    // ...
  }
}
````

### Tags Suportadas e Quando Usar

| Tag | Uso |
| :--- | :--- |
| `@param` | Descrever **cada** parâmetro. Use `-` após o nome. |
| `@returns` | Descrever o valor de retorno (omita apenas se `void`). |
| `@throws` | Tipos e condições de erro lançados. |
| `@example` | Bloco de código executável. Sempre em cercas ` ```ts `. |
| `@see` | Referência cruzada. Combine com `{@link Symbol}`. |
| `@deprecated` | Marcar símbolos obsoletos e indicar substituto. |
| `@since` | Versão em que o símbolo foi introduzido. |

### Links Internos
Use `{@link <Símbolo>}` para criar links clicáveis entre símbolos na documentação gerada:

```ts
/**
 * Atalho para {@link Client.get} com timeout customizado.
 */
export function quickGet(path: string) { /* ... */ }
```

### ⚠️ Regras Críticas
- **NÃO** use JSDoc para comentários internos de linha — use `//`.
- **NÃO** documente símbolos não exportados (a menos que sejam úteis para contexto).
- **SEMPRE** coloque o `@example` **após** `@returns`/`@throws`.
- **NUNCA** escreva "TODO" dentro de JSDoc; use comentários normais.

---

## ✅ Recomendações de Uso e Qualidade

1. **README e JSDoc são complementares** — nunca um substitui o outro.
2. **Escreva exemplos reais** — evite `foo`/`bar`; use nomes que reflitam o domínio.
3. **Mantenha o README curto** — se passar de ~150 linhas, crie uma pasta `docs/` dentro do diretório do pacote.
4. **Valide antes de commitar:**
   ```bash
   deno doc --lint mod.ts
   ```
   Isso aponta exports sem JSDoc e tags malformadas.
5. **Valide antes de publicar:**
   ```bash
   deno publish --dry-run
   ```
   Inspecione o output para confirmar que apenas os arquivos desejados serão enviados.
6. **Atualize o JSDoc ao refatorar** — nunca deixe documentação divergente do código.
7. **Use `@deprecated`** ao invés de remover símbolos abruptamente — quebre consumidores com aviso.

---

## 🏢 Configuração de `publish: false` em Workspaces

Em um **workspace Deno** (definido por `workspace` no `deno.json` raiz), o comando `deno publish` tenta publicar **todos os membros** que possuem `name` e `exports`.

Para **excluir um membro interno** (pacotes utilitários compartilhados, ferramentas de build, etc.), defina `"publish": false` no `deno.json` desse membro.

### Estrutura Real no WorkerDB

No monorepo do WorkerDB, temos múltiplos pacotes publicados e pacotes de aplicação/infraestrutura interna:

```
/
├── deno.jsonc                 # workspace raiz
├── packages/
│   ├── worker-db/             # publicado no JSR como @vanaware/workerdb
│   │   └── deno.jsonc
│   ├── service-worker/        # publicado no JSR como @vanaware/opfs-explorer
│   │   └── deno.jsonc
│   ├── ui/                    # app frontend (publish: false)
│   │   └── deno.jsonc
│   ├── server/                # dev/prod server Deno (publish: false)
│   │   └── deno.jsonc
│   └── utils/                 # scripts de bundling/build (publish: false)
│       └── deno.jsonc
```

O workflow de CI/CD em `.github/workflows/jsr-publish.yml` executa a matriz de publicação automatizada para `packages/worker-db` e `packages/service-worker`.

### Estrutura de Exemplo Genérica

```
/
├── deno.json              # workspace raiz
├── packages/
│   ├── core/
│   │   └── deno.json      # publicado no JSR
│   ├── utils-internal/
│   │   └── deno.json      # NÃO publicado
│   └── cli/
│       └── deno.json      # publicado no JSR
```

### `deno.json` raiz (workspace)

```json
{
  "workspace": [
    "./packages/core",
    "./packages/utils-internal",
    "./packages/cli"
  ]
}
```

### `packages/core/deno.json` (publicado)

```json
{
  "name": "@seu-escopo/core",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT"
}
```
> **Importante:** Caso os campos license e version não estejam configurados no deno.jsonc (ou deno.json) do pacote, configure com o mesmo valor encontrado no deno.jsonc raiz do workspace.

### `packages/utils-internal/deno.json` (NÃO publicado)

```json
{
  "name": "@seu-escopo/utils-internal",
  "version": "0.0.0",
  "exports": "./mod.ts",
  "publish": false
}
```

> **Importante:** Mesmo com `publish: false`, o pacote ainda pode ser importado por outros membros do workspace via `jsr:@seu-escopo/utils-internal` durante o desenvolvimento. Ele apenas não será enviado ao registro.

> **Regra fundamental:** Caso alguma função do pacote que não será publicado esteja em uso por um pacote que será publicado, o desenvolvedor deverá ser alertado e uma documentação de BUG deve ser criada com todas as referidas funções que deverão ser analisadas e devidamente tratadas antes da publicação do pacote.

---

## 🗂️ Configuração de `publish.include` e `publish.exclude`

### Regras Básicas
- Os padrões são avaliados **relativos à raiz do pacote** (onde está o `deno.json` do pacote a ser publicado).
- Use **globs POSIX** com `/` como separador (funciona em Windows também).
- **`publish.include`** — lista branca. Se definido, **somente** o que casar será publicado.
- **`publish.exclude`** — lista negra. Aplicada **após** o `include`.
- Se apenas `exclude` for definido, tudo é incluído por padrão e depois filtrado.
- **NUNCA** inclua `deno.json` no `exclude` — ele é sempre publicado automaticamente.

### Globs Recomendados

#### Incluir apenas o código-fonte publicável

```json
{
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ]
  }
}
```

#### Excluir arquivos de desenvolvimento

```json
{
  "publish": {
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "tests/",
      "test/",
      "bench/",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "TODO.md",
      "CHANGELOG.md",
      ".github/",
      "*.config.ts",
      "build.ts",
      "bundle.ts",
      "deploy.ts",
      "deno.lock",
      ".gitignore"
    ]
  }
}
```

### Combinação Recomendada (Include + Exclude)

A abordagem mais segura é **combinar ambos**: um `include` restritivo que define o que é código, e um `exclude` para varrer resíduos.

```json
{
  "name": "@seu-escopo/seu-pacote",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT",
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ],
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "src/**/__mocks__/**",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "CHANGELOG.md",
      ".github/"
    ]
  }
}
```

### Mapa de Decisão: Incluir ou Excluir?

| Arquivo/Pasta | Ação | Justificativa |
| :--- | :--- | :--- |
| `src/**/*.ts` | ✅ Incluir | Código-fonte principal. |
| `mod.ts` | ✅ Incluir | Ponto de entrada principal. |
| `README.md` | ✅ Incluir | Exibido no JSR. |
| `**/*_test.ts` | ❌ Excluir | Testes não vão para o registro. |
| `tests/`, `test/` | ❌ Excluir | Idem. |
| `examples/` | ❌ Excluir | Exemplos grandes ou não-API. |
| `scripts/` | ❌ Excluir | Scripts de build/deploy. |
| `build.ts`, `bundle.ts`, `deploy.ts` | ❌ Excluir | Ferramentas de dev. |
| `docs/` | ❌ Excluir o docs da raiz pode incluir o subset do pacote | Documentação estendida da raiz do workspace fica no repo, documentação essencial reduzida do pacote pode incluir. |
| `planning/` | ❌ Excluir | Planejamento interno. |
| `AGENTS.md`, `CURRENT.md` | ❌ Excluir | Metadados para agentes de IA. |
| `CHANGELOG.md` | ⚠️ Excluir | Útil para consumidores, mas aumenta o pacote. |
| `deno.lock` | ❌ Excluir | Reconstruído pelo consumidor. |
| `.github/` | ❌ Excluir | CI/CD. |
| `deno.json` | 🚫 Nunca listar | Sempre publicado automaticamente. |

### Padrões Glob de Referência

| Padrão | Casa com |
| :--- | :--- |
| `src/**/*.ts` | Todos os `.ts` em `src/` recursivamente. |
| `**/*_test.ts` | Qualquer arquivo terminando em `_test.ts`. |
| `**/*.test.ts` | Qualquer arquivo terminando em `.test.ts`. |
| `test/` | Todo o diretório `test/`. |
| `**/__mocks__/**` | Qualquer diretório `__mocks__` em qualquer nível. |
| `scripts/**` | Tudo dentro de `scripts/`. |
| `*.config.ts` | Arquivos `.config.ts` na raiz. |

### ⚠️ Erros Comuns a Evitar
- **Não** use `./` no início dos padrões (`"./src/**"` ❌ → `"src/**"` ✅).
- **Não** use `\` como separador — sempre `/`.
- **Não** inclua `deno.json` no `exclude` — quebra a publicação.
- **Não** use `include` e `exclude` contraditórios (ex: incluir `src/**` e excluir `src/`).
- **Sempre** valide com `deno publish --dry-run` antes de publicar de verdade.

---

## ✅ Checklist Antes de Publicar

Execute na ordem:

- [ ] `deno fmt --check` — formatação consistente.
- [ ] `deno lint` — sem avisos.
- [ ] `deno check mod.ts` — sem erros de tipo.
- [ ] `deno test` — todos os testes passando.
- [ ] `deno doc --lint mod.ts` — sem exports sem JSDoc.
- [ ] `README.md` revisado e com bloco de código de exemplo.
- [ ] `deno.jsonc` com `name`, `version`, `exports`, `license` corretos.
- [ ] `publish.include` e `publish.exclude` revisados.
- [ ] `deno publish --dry-run` — inspecionar arquivos listados.
- [ ] Versão incrementada conforme SemVer, temos um script de sanitização a ser executado antes da publicação.
- [ ] `deno publish` — publicar de fato.

---

## 📎 Referências

- [Documentação oficial do JSR](https://jsr.io/docs)
- [Escrevendo documentação para JSR](https://jsr.io/docs/writing-docs)
- [Configuração `deno.jsonc`](https://docs.deno.com/runtime/fundamentals/configuration/)
- [Globs no Deno](https://docs.deno.com/runtime/fundamentals/configuration/#glob-patterns)
`````

---

## Arquivo: `docs/roadmap.md`

```md
# WorkerDB Roadmap

## ✅ Phase 1: Core Performance & OPFS Ecosystem (Completed)

1. **Native IndexedDB Indexes & Batch Operations**:
   Declarative secondary indexes with $O(\log N)$ indexed lookups, batch queries, and worker-side mutations (`getByIndex`, `getSomeByIndex`, `queryByIndex`, `deleteByIndex`, `setSomeByIndex`).
2. **Streaming OPFS API**:
   Non-blocking large binary file transfers with `ReadableStream<Uint8Array>` (`addFileStream`, `getFileStream`).
3. **In-Worker Schema Validation**:
   Synchronous schema enforcement in Web Worker background thread (`validator`).
4. **Standalone `@vanaware/opfs-explorer` Package**:
   Published to JSR, zero-config Service Worker fetch handler with dynamic route subfolders (`"files"`, `"arquivos"`, `"opfs"`) and auto-detection of Service Worker scopes (local & GitHub Pages).
5. **Deno Monorepo & JSR Publishing CI/CD**:
   Automated GitHub Actions matrix publishing both `@vanaware/workerdb` and `@vanaware/opfs-explorer`.

---

## 🚀 Phase 2: Reactivity & UI Integration

1. **Live Queries / Subscriptions (Observe API):**
   Implement a `db.subscribe(key, callback)` or `db.watchQuery(queryFn, callback)` system. When another part of the app updates a record, the worker pushes a message to the main thread, automatically triggering the callback. 

2. **Official `@preact/signals` Bindings:**
   Since your UI uses Preact and Signals, create a companion package (`@workerdb/signals`). 
   Imagine: `const user = useWorkerDbSignal("USERS", "usr_123");`. When the DB changes, the signal updates automatically, and the UI re-renders without any manual `useEffect` wiring.

---

## ☁️ Phase 3: Sync & Cloud

1. **File System Access API Bridge:**
   Allow users to link a real directory on their local hard drive (using `window.showDirectoryPicker()`) and seamlessly sync it back and forth with the OPFS sandbox.
2. **Multi-Tab Broadcast Sync Engine:**
   Synchronize state across multiple browser tabs in real time using `BroadcastChannel`.


```

---

## Arquivo: `docs/testing.md`

````md
# 🧪 Testing with WorkerDB

Testing background workers, IndexedDB, and the Origin Private File System (OPFS) in modern web applications can be challenging since these APIs often aren't available in standard Node.js or Deno CLI test runners.

To solve this, **WorkerDB** ships with fully simulated (Fake) implementations of IndexedDB, OPFS, and LocalStorage. These fakes run entirely in-memory and allow you to write and execute robust integration tests using standard testing frameworks (like Deno's `@std/testing` or Jest/Vitest) without needing a real browser environment!

---

## 📦 Available Fake Environments

WorkerDB exposes two dedicated subpaths for testing, depending on the environment you want to simulate:

### 1. Main Thread Testing (`jsr:@vanaware/workerdb/fake`)
Use this export when testing your React/Preact components or main application logic. 
It injects the global fakes (`localStorage`, `indexedDB`, OPFS `navigator.storage`) and automatically initializes a Web Worker interceptor that executes the worker logic synchronously in the test thread.

```typescript
// Import the fake initialization AT THE TOP of your test file
import { db, opfs, ls } from "jsr:@vanaware/workerdb/fake";

// Now you can use db, opfs, and ls exactly as they behave in the browser!
```

### 2. Service Worker Testing (`jsr:@vanaware/workerdb/swfake`)
Use this export when you are writing unit tests for your Service Worker logic (e.g. testing interceptors or background syncs). 
It injects fakes into the `self` context, bypasses the Web Worker RPC (since Service Workers can execute IndexedDB natively), and exports direct instances.

```typescript
// Import the SW fake initialization AT THE TOP of your SW test file
import { db, opfs } from "jsr:@vanaware/workerdb/swfake";

// Proceed to test your Service Worker caching or DB routines
```

---

## 🛠️ Usage Example (Main Thread - BDD Standard)

All tests in WorkerDB are written using Deno's native BDD standard (`@std/testing/bdd`) and assertions (`@std/assert`).

```typescript
import { describe, it, beforeEach } from "jsr:@std/testing/bdd";
import { assertEquals, assert } from "jsr:@std/assert";

// 1. Import from the /fake endpoint FIRST to bootstrap the environment
import { db, opfs, ls } from "jsr:@vanaware/workerdb/fake";

describe("WorkerDB BDD Test Suite", () => {
  const store = db("APP_DB", "users", "USR_");

  beforeEach(async () => {
    // Clean state before each test
    await store.clear();
  });

  it("should execute queries and heavy array transformations in worker", async () => {
    await store.set("1", { name: "Alice", active: true });
    await store.set("2", { name: "Bob", active: false });

    const activeUsers = await store.getSome((items) =>
      items.filter((i) => i.active === true)
    );

    assertEquals(activeUsers.length, 1);
    assertEquals(activeUsers[0].name, "Alice");
  });

  it("should simulate OPFS filesystem interactions in memory", async () => {
    const fileStore = opfs("APP_DB", "files", "USR_");
    const blob = new Blob(["Hello OPFS!"], { type: "text/plain" });

    await fileStore.addFile("documents", blob, "hello.txt");
    const retrieved = await fileStore.getFile("documents", "hello.txt");
    const text = await retrieved.text();

    assertEquals(text, "Hello OPFS!");
  });
});
```

---

## 📂 Testing OPFS Explorer (`@vanaware/opfs-explorer`)

Unit tests for `@vanaware/opfs-explorer` are located in `packages/service-worker/tests/` and test routing, options normalization, MIME detection, and HTML rendering without requiring a live Service Worker:

```typescript
import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import {
  resolveRoutePrefix,
  normalizeOptions,
  getMimeType,
} from "jsr:@vanaware/opfs-explorer";

describe("OPFS Explorer Utilities", () => {
  it("resolves route prefix with custom subfolder and scope", () => {
    const prefix = resolveRoutePrefix({
      scopePath: "/my-app/",
      subfolder: "arquivos",
    });
    assertEquals(prefix, "/my-app/arquivos");
  });

  it("correctly identifies MIME types", () => {
    assertEquals(getMimeType("data.json"), "application/json; charset=utf-8");
    assertEquals(getMimeType("photo.png"), "image/png");
  });
});
```

## 🧠 Under the Hood

When you import from the `fake` subpaths, WorkerDB performs the following bootstrapping:

1. **IndexedDB:** Injects `fake-indexeddb` globally.
2. **OPFS:** Overrides `navigator.storage.getDirectory()` with a custom in-memory implementation (`FakeOPFSDirectory` & `FakeOPFSFileHandle`).
3. **LocalStorage:** Overrides the global `localStorage` with a custom `FakeLocalStorage` engine.
4. **Worker Router:** Transparently redirects the main thread RPC pipeline to point to `fake-worker.ts`, bridging the simulated environments without requiring any code changes to your app logic.

---

## ⚠️ Notes for Test Runners

Because the in-memory fakes share the same global objects across tests, it is highly recommended to **always call `.clear()`** on your scoped database instances at the beginning of each test block to ensure a clean state, or use isolated database names for each test block.

````

---

## Arquivo: `.tool-versions`

```tool-versions
deno 2.9.7
```

---

## Arquivo: `LICENSE`

```license
MIT License

Copyright (c) 2026 Vanaware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

---

## Arquivo: `README.md`

````md
# 🌌 WorkerDB

**Asynchronous database layer for Web Workers, IndexedDB, and OPFS.**

WorkerDB is a high-performance, non-blocking persistence engine designed for modern Deno and Web applications. It offloads all database and filesystem operations to background threads, ensuring a smooth 60fps user interface even during massive data processing.

## ✨ Core Features

- **Non-Blocking Architecture:** Offloads all heavy IndexedDB and OPFS operations to a background Web Worker via a transparent RPC proxy.
- **Advanced Query Engine:** Leverages native IDB indexes for fast aggregations, range filters, and cursor-based pagination.
- **OPFS File System:** High-performance, private, persistent file system integration for large binary blobs and encrypted media.
- **ZIP Compression:** Native in-worker zipping and unzipping of files stored in the OPFS.
- **Offline-First PWA:** Robust Service Worker caching and PWA manifest for a native-app experience.
- **Deno-Native Toolchain:** Zero `node_modules`. Pure TypeScript ecosystem with built-in build orchestration.
- **Reactive UI:** Built with Preact, granular state via `@preact/signals`, and Material Design 3 (BeerCSS).

## 📦 Monorepo Structure

This project is organized as a Deno monorepo publishing multiple packages to JSR:

- `packages/worker-db/`: The core persistence engine (JSR: [`@vanaware/workerdb`](https://jsr.io/@vanaware/workerdb)).
- `packages/service-worker/`: Standalone OPFS file explorer & Service Worker router (JSR: [`@vanaware/opfs-explorer`](https://jsr.io/@vanaware/opfs-explorer)).
- `packages/ui/`: The Preact-based reactive frontend application.
- `packages/server/`: A lightweight Deno file server for production delivery.
- `packages/utils/`: Shared build tools and esbuild orchestration scripts.

## 📚 Library Usage

If you are a developer looking to use **WorkerDB** or **OPFS Explorer** in your own projects, see:
- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api.md)
- [OPFS Explorer Documentation](./packages/service-worker/README.md)

### Quick Imports (JSR)

```ts
// WorkerDB (Core Persistence)
import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// OPFS Explorer (Service Worker Handler)
import { createOpfsFetchHandler } from "jsr:@vanaware/opfs-explorer";
```

## 🚀 Getting Started (Development)

### Prerequisites

You only need **Deno** installed to run this project. 
*(Note: A `package.json` and `install-script.sh` are included exclusively for compatibility with specific containerized environments like AI Studio).*

### Development

To start the development server, you can use standard Deno tasks:

```bash
# Installs dependencies, builds the project into /packages/server/build/dist, and starts the server on port 3000
deno task dev
```

Alternatively, if you are in an NPM-bridged environment:

```bash
npm run dev
```

### Building for Production

Our custom `esbuild.ts` pipeline bundles the UI, Worker, and Service Worker into the `packages/server/build/dist/` directory.

```bash
deno task build
```

### Testing

All tests are written using Deno's native BDD testing standard (`@std/testing/bdd`).

```bash
deno task test
# OR to run checks, linting, formatting, and tests:
deno task check-all
```

## 🛠️ Tech Stack

- **Runtime:** [Deno](https://deno.com/)
- **UI Framework:** [Preact](https://preactjs.com/) (no React)
- **State Management:** [@preact/signals](https://preactjs.com/guide/v10/signals/)
- **CSS Framework:** [BeerCSS](https://www.beercss.com/) (Material Design 3)
- **Database:** [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via `idb-keyval`)
- **File System:** [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- **Bundler:** [esbuild](https://esbuild.github.io/)

## 📂 OPFS Explorer (`@vanaware/opfs-explorer`)

Once the application is running and the Service Worker is registered, you can navigate to the configured explorer endpoint:

```text
# Default route in demo app:
http://localhost:3000/opfs/

# Or on GitHub Pages (auto-detected scope):
https://vanaware.github.io/workerdb/opfs/
```

The Service Worker intercepts the request and dynamically renders a visual, dark-mode HTML file explorer directly from the browser's Origin Private File System!

### Pluggable into any Service Worker:

```ts
import { createOpfsFetchHandler } from "jsr:@vanaware/opfs-explorer";

// Configure with any subfolder name ("files", "arquivos", "opfs"):
self.addEventListener("fetch", createOpfsFetchHandler("files"));
// Now accessible at /files/ or /{repo-name}/files/
```

## 📜 License

MIT License

````

---

