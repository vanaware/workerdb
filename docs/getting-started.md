# Getting Started: How to Use WorkerDB

WorkerDB is designed to be highly modular and environment-agnostic (running purely on standard Web APIs like Web Workers, IndexedDB, and OPFS). 

Because the library relies on Web Workers, setting it up requires **two steps**: configuring the background worker and importing the main thread client.

This guide explains how to import and use the library directly from the GitHub repository (`https://github.com/vanaware/workerdb`).

---

## 📦 1. Importing Directly from GitHub (Deno / Browser)

You can import WorkerDB directly via URL. Depending on your environment, you can use raw GitHub URLs (best for Deno) or a CDN like `esm.sh` or `jsdelivr` (best for browsers).

### Standard Import URLs
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

// Import the background worker engine directly from GitHub
import "https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/worker.ts";

// The imported script automatically sets up the `onmessage` listeners!
```

---

## 🚀 3. Initializing in your Main App

Now, in your main application logic (React, Preact, Vanilla JS, etc.), import the main-thread RPC client and point it to your local worker file.

```typescript
// File: main.ts (Your UI / Application logic)

import { db, opfs, ls } from "https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/mod-main.ts";

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
import { db, opfs } from "https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/mod-sw.ts";

self.addEventListener("sync", async (event) => {
  if (event.tag === "sync-data") {
    const store = db("MyApp", "OfflineQueue");
    const pendingItems = await store.values();
    
    // Process background sync...
  }
});
```

---

## 🧪 5. Quick Summary of API Exports

WorkerDB provides three main namespaces:

1. `db`: The **IndexedDB** wrapper. Async. Persists complex JSON objects and handles heavy array queries using the Web Worker engine.
2. `opfs`: The **Origin Private File System** wrapper. Async. Manages heavy binary data (Files, Blobs) and handles zip compression securely in the background.
3. `ls`: The **LocalStorage** wrapper. Sync. Use only for tiny configurations like theme preferences, as it runs synchronously on the main thread.

For deep documentation on what functions these namespaces provide, see the [API Reference](./api.md).
