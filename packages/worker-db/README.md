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
