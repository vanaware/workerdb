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

