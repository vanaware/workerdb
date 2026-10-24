# `CURRENT.md`

## Current Status: Phase 1 Complete & Publishable OPFS Explorer Package

All capabilities of **Phase 1: Performance & Advanced Data Capabilities** and the JSR package infrastructure have been successfully implemented, tested, and integrated:

1. **Native IndexedDB Indexes & Index Operations**:
   - Declarative index creation via `indexes: string[]` in `db()` and `db.ts`.
   - `getByIndex(indexName, query)`: indexed $O(\log N)$ lookup.
   - `getManyByIndex(indexName, queries)`: batch lookup for multiple index values.
   - `getSomeByIndex(indexName, query, filterFn, context)`: filters only the indexed subset without loading the entire collection into memory.
   - `queryByIndex(indexName, query, fn, context)`: aggregates/transforms the indexed subset inside the Web Worker.
   - `deleteByIndex(indexName, query)`: removes all records matching the index in $O(\log N)$ without reading payloads into memory.
   - `deleteManyByIndex(indexName, queries)`: removes multiple indexed groups in batch.
   - `delSomeByIndex(indexName, query, filterFn, context)`: filters and removes records from the indexed subset.
   - `setSomeByIndex(indexName, query, selectFn, updateFn, context)`: filters and updates records in the indexed subset with schema validation.

2. **Streaming OPFS API**:
   - `addFileStream(key, fileName, stream)`: large file writes via `ReadableStream<Uint8Array>`.
   - `getFileStream(key, fileName)`: readable via transferable streaming over RPC.

3. **In-Worker Schema Validation**:
   - Synchronous validator inside the Web Worker (`validator: (item) => boolean`) protecting `set`, `setMany`, and `patch`.

4. **Standalone `@vanaware/opfs-explorer` Package & Service Worker**:
   - Dedicated package under `packages/service-worker/` configured for JSR publication as `@vanaware/opfs-explorer`.
   - **Configurable Subfolder**: The handler no longer has a hardcoded route. Developers can pass custom names as a string (`"files"`, `"arquivos"`, `"opfs"`) or via an `OpfsExplorerOptions` configuration object.
   - **Dynamic Routing and Scope**: `resolveRoutePrefix` combines the active Service Worker scope (`/`, `/my-repo/`) with the chosen subfolder without any fixed paths.
   - `createOpfsFetchHandler`: 1-line helper for `self.addEventListener("fetch", createOpfsFetchHandler("files"))`.
   - `handleOpfsRequest`: manual handler with support for canonical 301 redirects.
   - Exported utilities: `listOpfsFiles`, `getFileFromOpfs`, `getEffectiveRootDir`, `getScopePath`, `normalizeOptions`.

5. **Dynamic UI Path Resolution (GitHub Pages Ready)**:
   - `packages/ui/src/main.tsx` uses `new URL("./", globalThis.location.href).pathname` to dynamically resolve the base path, SW scope, and UI links — eliminating any fixed references to `/workerdb/`.
   - `packages/server/src/main.ts` cleaned of hardcoded fallbacks.

6. **Automated JSR Publication**:
   - `.github/workflows/jsr-publish.yml` configured with a publish matrix for both packages: `@vanaware/workerdb` and `@vanaware/opfs-explorer`.
   - Strict JSR compliance: 100% JSDoc coverage (`deno doc --lint` clean), complete `README.md` with TypeScript examples and API reference tables.

7. **PWA & CI/CD Deployment**:
   - `manifest.json` uses relative paths (`./index.html`) to enable PWA installation under any subfolder.
   - GitHub Actions workflow (`.github/workflows/gh-pages.yml`) for automated build and deploy to GitHub Pages.
   - Anti-cache headers on the dev server and graceful handling of redirects during Service Worker initialization.

8. **Quality, Linter & BDD Test Suite**:
   - 64 BDD tests passing (269 steps) with a 100% success rate (`deno task test`).
   - Linter (`deno lint`) 100% clean across all 38 workspace files.

## Next Steps (Phase 2 — Planning)

- **Live Queries / Subscriptions (Observe API)**: Implement reactive listeners (`db.subscribe(key, cb)` or `db.watchQuery()`).
- **Preact Signals Bindings**: Reactive utilities that sync WorkerDB collections directly with UI signals.
- **Sync & Cloud**: State replication and a bridge to the File System Access API (`showDirectoryPicker`).
