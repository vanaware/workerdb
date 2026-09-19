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

This project is organized as a Deno monorepo:

- `packages/worker-db/`: The core persistence engine (JSR: `@vanaware/workerdb`).
- `packages/ui/`: The Preact-based reactive frontend application.
- `packages/server/`: A lightweight Deno file server for production delivery.
- `packages/service-worker/`: PWA logic and OPFS explorer network interceptor.
- `packages/utils/`: Shared build tools and esbuild orquestration scripts.

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
