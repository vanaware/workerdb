# 🌌 WorkerDB

**WorkerDB** is a lightweight, high-performance IndexedDB wrapper running entirely within a Web Worker. It features a simple API, a powerful query engine, native OPFS (Origin Private File System) integration, and offline-first Progressive Web App (PWA) architecture.

## ✨ Features

- **Non-Blocking UI:** Offloads all heavy database (IndexedDB) and filesystem (OPFS) operations to a background Web Worker.
- **Native IndexedDB Indexes & Operations:** Fast $O(\log N)$ secondary index queries (`getByIndex`, `getManyByIndex`), targeted in-worker filtering (`getSomeByIndex`), aggregations (`queryByIndex`), index-driven updates (`setSomeByIndex`), and efficient deletions (`deleteByIndex`, `deleteManyByIndex`, `delSomeByIndex`).
- **OPFS Streaming API:** Read and write large files directly with `ReadableStream<Uint8Array>` (`getFileStream`, `addFileStream`), avoiding out-of-memory overhead.
- **In-Worker Schema Validation:** Declarative schema validator functions running inside the worker thread to safeguard data integrity before persisting to disk.
- **OPFS File System Integration:** Seamlessly write, read, backup, and zip files using the Origin Private File System.
- **Service Worker Explorer:** Includes a built-in OPFS file explorer hosted directly from the Service Worker (accessible via `./opfs/`).
- **Offline-First PWA:** Robust caching strategies ensuring the app works perfectly when disconnected from the internet.
- **Pure Deno Environment:** Zero local `node_modules`. Uses Deno-native tooling and ES modules (from `jsr:` and `npm:`/`esm.sh`).
- **Reactive UI:** Built with Preact, `@preact/signals` for state management, and Semantic Material Design 3 via BeerCSS.

## 📦 Monorepo Architecture

This project is organized as a Deno monorepo with the following packages:

- `packages/worker-db/`: The core database engine. Wraps `idb-keyval` and exposes a Promise-based RPC client to the main thread.
- `packages/ui/`: The Preact + Signals + BeerCSS frontend application.
- `packages/server/`: A lightweight Deno file server (`@std/http/file-server`) used to serve the `build/dist` output.
- `packages/service-worker/`: The PWA Service Worker script, handling offline caching and the `/opfs/` network interceptor.
- `packages/utils/`: Shared utilities, including the custom Deno `esbuild` build orchestration script.

## 📚 Library Usage

If you are a developer looking to use **WorkerDB** in your own project, see:
- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api.md)

### Quick Import (JSR)
```ts
import { db, opfs, ls } from "jsr:@vanaware/workerdb";
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

## 📂 OPFS Explorer

Once the application is running and the Service Worker is registered, you can navigate to:

```text
http://localhost:3000/opfs/
```

The Service Worker intercepts this fetch request and dynamically renders a visual HTML explorer for your OPFS storage directory, allowing you to browse, download, and inspect files natively stored in the browser's origin sandbox!

## 📜 License

MIT License
