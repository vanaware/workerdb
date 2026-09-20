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

#### Option A: One-liner with custom subfolder name (e.g. `"files"`, `"arquivos"`, or `"opfs"`)

```typescript
import { createOpfsFetchHandler, } from "@vanaware/opfs-explorer";

// Serves the explorer under /files/ or /{repo}/files/
self.addEventListener("fetch", createOpfsFetchHandler("files",),);

// Or in Portuguese: /arquivos/ or /{repo}/arquivos/
// self.addEventListener("fetch", createOpfsFetchHandler("arquivos"));
```

#### Option B: Automated Event Listener with Options Object

```typescript
import { createOpfsFetchHandler, } from "@vanaware/opfs-explorer";

self.addEventListener(
  "fetch",
  createOpfsFetchHandler({
    subfolder: "arquivos", // Accessible at /arquivos/ or /{repo}/arquivos/
    title: "Meus Arquivos OPFS",
  },),
);
```

#### Option C: Manual handling via `handleOpfsRequest`

```typescript
import { handleOpfsRequest, } from "@vanaware/opfs-explorer";

self.addEventListener("fetch", async (event: FetchEvent,) => {
  const { matched, response, } = await handleOpfsRequest(
    event.request,
    "files",
  );

  if (matched && response) {
    event.respondWith(response,);
  }
},);
```

### 2. Accessing the Explorer

Open your browser and navigate to your chosen subfolder:

```
https://your-app.example.com/files/
# or on GitHub Pages / subfolder deployments:
https://username.github.io/my-repo/files/
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
   * The subfolder name or route prefix (relative to the service worker scope, or absolute).
   * Can be any custom name such as "files", "arquivos", or "opfs".
   */
  subfolder?: string;

  /**
   * The base URL path prefix (relative to the service worker scope, or absolute) that routes to the OPFS explorer.
   * Defaults to "opfs".
   */
  routePrefix?: string;

  /**
   * Base scope path for the service worker.
   * Defaults to self.registration.scope pathname (or "/" if not in a service worker).
   * Automatically handles any GitHub Pages repo or subfolder deployment (e.g. "/my-repo/").
   */
  scopePath?: string;

  /**
   * Custom title displayed in the HTML explorer header and page <title>.
   * Defaults to "{subfolder} Explorer" (e.g. "Files Explorer", "Arquivos Explorer") or "OPFS Explorer".
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

  /**
   * Optional specific subfolder inside OPFS to restrict directory listing and exploration to.
   * When specified, only files within this OPFS folder will be explored and served.
   * Example: "docs", "uploads", or "backups".
   */
  opfsDir?: string;
}
```

### GitHub Pages & Subfolder Deployments

When deployed under a repository subfolder (e.g. `https://username.github.io/my-repo/`), register the Service Worker with `scope: "/my-repo/"` (or `scope: "./"`).

`@vanaware/opfs-explorer` automatically detects the active Service Worker scope and mounts your chosen subfolder at:

```
https://username.github.io/my-repo/files/
# or
https://username.github.io/my-repo/arquivos/
# or
https://username.github.io/my-repo/opfs/
```

No hardcoded paths are required—it resolves routes dynamically across localhost, custom domains, or GitHub Pages.

---

## API Reference

### Service Worker Handlers

| Function | Description |
| :--- | :--- |
| `createOpfsFetchHandler(options?)` | Creates a `(event: FetchEvent) => void` listener to plug into `self.addEventListener("fetch", ...)`. Accepts a subfolder name (e.g. `"files"`, `"arquivos"`) or `OpfsExplorerOptions`. |
| `handleOpfsRequest(request, options?)` | Manually processes a `Request`. Returns `Promise<OpfsExplorerResponse>` (`{ matched: boolean, response?: Response }`). |

### Core File & Path Utilities

| Function | Description |
| :--- | :--- |
| `listOpfsFiles(dirHandle?, path?)` | Recursively traverses OPFS and returns an array of relative file paths. |
| `getFileFromOpfs(filePath, rootDir?)` | Retrieves a native `File` object from OPFS by its path. |
| `getMimeType(path)` | Detects and returns the MIME `Content-Type` for common file extensions. |
| `resolveRoutePrefix(options?)` | Resolves the combined URL pathname prefix from the SW scope and configured subfolder. |
| `getScopePath(customScope?)` | Normalizes or auto-detects the Service Worker registration scope. |
| `getEffectiveRootDir(options?)` | Resolves the target directory handle (OPFS root or subfolder via `opfsDir`). |
| `renderDirectoryHtml(currentPath, allFiles, options?)` | Generates the HTML interface for folder navigation. |

---

## Browser Compatibility

Requires modern browser support for:
- [Origin Private File System (OPFS)](https://caniuse.com/native-filesystem-api) (Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+)
- [Service Worker API](https://caniuse.com/serviceworkers) (Standard in all modern browsers)

---

## License

MIT © [Vanaware](https://github.com/vanaware)
