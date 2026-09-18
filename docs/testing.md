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

## 🛠️ Usage Example (Main Thread)

Here is a complete example of how you can write unit tests for your database schemas and OPFS logic using Deno's native test runner.

```typescript
import { assertEquals, assert } from "jsr:@std/assert";

// 1. Import from the /fake endpoint FIRST to bootstrap the environment
import { db, opfs, ls } from "jsr:@vanaware/workerdb/fake";

Deno.test("Should correctly execute heavy array methods natively", async () => {
  // Create a scoped database collection
  const store = db("APP_DB", "users", "USR_");
  
  // Clear the in-memory fake database
  await store.clear();

  // Populate data
  await store.set("1", { name: "Alice", active: true });
  await store.set("2", { name: "Bob", active: false });

  // Test the Worker Engine!
  // This will successfully execute the closure using the fake engine.
  const activeUsers = await store.getSome((items) => 
    items.filter(i => i.active === true)
  );

  assertEquals(activeUsers.length, 1);
  assertEquals(activeUsers[0].name, "Alice");
});

Deno.test("Should correctly simulate OPFS filesystem interactions", async () => {
  const fileStore = opfs("APP_DB", "files", "USR_");

  const blob = new Blob(["Hello OPFS!"], { type: "text/plain" });
  
  // The fake OPFS engine handles paths, streams, and File instances in memory!
  await fileStore.addFile("documents", blob, "hello.txt");

  const retrieved = await fileStore.getFile("documents", "hello.txt");
  const text = await retrieved.text();
  
  assertEquals(text, "Hello OPFS!");
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
