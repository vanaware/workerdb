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
