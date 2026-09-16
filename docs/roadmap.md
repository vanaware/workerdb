# WorkerDB Roadmap

## Phase 2: Reactivity & UI Integration

1. **Live Queries / Subscriptions (Observe API):**
   Implement a `db.subscribe(key, callback)` or `db.watchQuery(queryFn, callback)` system. When another part of the app updates a record, the worker pushes a message to the main thread, automatically triggering the callback. 

2. **Official `@preact/signals` Bindings:**
   Since your UI uses Preact and Signals, create a companion package (`@workerdb/signals`). 
   Imagine: `const user = useWorkerDbSignal("USERS", "usr_123");`. When the DB changes, the signal updates automatically, and the UI re-renders without any manual `useEffect` wiring.

## Phase 3: Sync & Cloud

1. **File System Access API Bridge:**
   Allow users to link a real directory on their local hard drive (using `window.showDirectoryPicker()`) and seamlessly sync it back and forth with the OPFS sandbox.
