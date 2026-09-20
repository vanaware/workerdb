# @vanaware/opfs-explorer

> Lightweight Service Worker middleware and web UI explorer for the browser's **Origin Private File System (OPFS)**.

[![JSR](https://jsr.io/badges/@vanaware/opfs-explorer)](https://jsr.io/@vanaware/opfs-explorer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Modern web applications increasingly use the [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) for high-performance offline storage, SQLite databases (Wasm), client-side cache stores, and binary exports.

However, inspecting and debugging OPFS files can be difficult during development. `@vanaware/opfs-explorer` is a plug-and-play Service Worker router that transforms any designated URL path (such as `/opfs/`) into a web-based file explorer and file server directly inside the browser.

## Features

- 📁 **Visual Directory Explorer**: Automatically navigates folders, subdirectories, and root files with folder breadcrumbs and clickable links.
- ⚡ **Zero External Dependencies**: Pure TypeScript designed for modern web standards, Service Workers, and Deno / JSR packaging.
- 🖼️ **Content-Type Detection**: Serves JSON, text, images, PDF, HTML, CSS, JavaScript, WebAssembly, and binary streams with correct MIME types and cache headers.
- 🛠️ **Configurable Routing**: Custom URL prefixes (e.g. `/opfs/` or `/storage/debug/`), custom HTML page titles, and custom theme styling.
- 📦 **Stand-alone Functions**: Exported helpers like `listOpfsFiles()`, `getFileFromOpfs()`, and `getMimeType()` for direct programmatic OPFS manipulation.

---

## Installation

Install from [JSR](https://jsr.io/@vanaware/opfs-explorer):

```sh
# Deno
deno add jsr:@vanaware/opfs-explorer

# npm / pnpm / yarn (via npx jsr)
npx jsr add @vanaware/opfs-explorer
```

---

## Usage

### 1. In your Service Worker (`sw.ts`)

#### Option A: Handling via `handleOpfsRequest` (Recommended)

```typescript
import { handleOpfsRequest, } from "@vanaware/opfs-explorer";

self.addEventListener("fetch", async (event: FetchEvent,) => {
  const { matched, response, } = await handleOpfsRequest(event.request, {
    routePrefix: "/opfs",
    title: "App File Explorer",
  },);

  if (matched && response) {
    event.respondWith(response,);
  }
},);
```

#### Option B: Automated Event Listener with `createOpfsFetchHandler`

```typescript
import { createOpfsFetchHandler, } from "@vanaware/opfs-explorer";

self.addEventListener(
  "fetch",
  createOpfsFetchHandler({
    routePrefix: "/opfs",
    title: "OPFS Storage",
  },),
);
```

### 2. Accessing the Explorer

Open your browser and navigate to:

```
https://your-app.example.com/opfs/
```

You can now navigate directory hierarchies, download files, and view file contents directly.

---

## Programmatic API

You can also use the core utilities standalone without the HTTP router:

```typescript
import {
  getFileFromOpfs,
  getMimeType,
  listOpfsFiles,
} from "@vanaware/opfs-explorer";

// 1. List all files recursively from the OPFS root:
const allFiles = await listOpfsFiles();
console.log(allFiles,); // e.g. ["backup/db.json", "images/profile.png"]

// 2. Read a File object from OPFS:
const file = await getFileFromOpfs("backup/db.json",);
const text = await file.text();
console.log(JSON.parse(text,),);

// 3. Resolve MIME types:
console.log(getMimeType("document.pdf",),); // "application/pdf"
```

---

## Configuration Options

```typescript
export interface OpfsExplorerOptions {
  /**
   * The base URL path prefix that routes to the OPFS explorer.
   * Defaults to "/opfs".
   */
  routePrefix?: string;

  /**
   * Custom title displayed in the HTML explorer header and page <title>.
   * Defaults to "OPFS Explorer".
   */
  title?: string;

  /**
   * Optional custom CSS styles to inject into the explorer HTML interface.
   */
  customStyles?: string;

  /**
   * Optional custom root directory handle to list files from.
   * Defaults to OPFS root (navigator.storage.getDirectory()).
   */
  rootDir?: FileSystemDirectoryHandle;
}
```

---

## License

MIT © [Vanaware](https://github.com/vanaware)
