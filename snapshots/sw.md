> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém experimentos e código da área de @vanaware/service-worker
> O projeto é o **WorkerDB [v0.3.0#mua9rvo8] ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB [v0.3.0#mua9rvo8] - Modo: SW

Gerado automaticamente em: 9/20/2026, 5:30:37 PM

---

## Arquivo: `packages/service-worker/src/explorer.ts`

````ts
// packages/service-worker/src/explorer.ts

/**
 * Options to configure the OPFS explorer handler.
 *
 * @example Simple subfolder configuration
 * ```ts
 * const options: OpfsExplorerOptions = {
 *   subfolder: "files",
 *   title: "My Files",
 * };
 * ```
 *
 * @example Advanced configuration with restricted directory and custom styles
 * ```ts
 * const options: OpfsExplorerOptions = {
 *   subfolder: "arquivos",
 *   title: "Meus Arquivos",
 *   opfsDir: "backups", // Restrict exploration to the "backups" folder inside OPFS
 *   customStyles: "body { font-family: monospace; background: #222; color: #eee; }",
 * };
 * ```
 */
export interface OpfsExplorerOptions {
  /**
   * The subfolder name or route prefix (relative to the service worker scope, or absolute) that routes to the OPFS explorer.
   * Can be any custom subfolder name such as `"files"`, `"arquivos"`, or `"opfs"`.
   * Convenient alias for `routePrefix`.
   *
   * @example `"files"`, `"arquivos"`, or `"opfs"`
   */
  subfolder?: string;

  /**
   * The base URL path prefix (relative to the service worker scope, or absolute) that routes to the OPFS explorer.
   * Defaults to `"opfs"`.
   *
   * When inside a scope like `"/workerdb/"` or `"/my-repo/"`, the explorer routes at `"/my-repo/files"`.
   *
   * @example `"files"`, `"arquivos"`, `"opfs"`, `"/files"`, or `"/storage/opfs"`
   */
  routePrefix?: string;

  /**
   * Base scope path for the service worker.
   * If not provided, automatically derived from `self.registration.scope` when running in a Service Worker environment,
   * or defaults to `"/"`.
   *
   * @example `"/workerdb/"`, `"/my-repo/"`, or `"/"`
   */
  scopePath?: string;

  /**
   * Custom title displayed in the HTML explorer header and page `<title>`.
   * Defaults to `"{subfolder} Explorer"` or `"OPFS Explorer"`.
   *
   * @example `"Meus Arquivos"`, `"Attachments Explorer"`
   */
  title?: string;

  /**
   * Optional custom CSS styles to inject into the explorer HTML interface.
   *
   * @example `"body { font-family: sans-serif; background: #111; color: #fff; }"`
   */
  customStyles?: string;

  /**
   * Optional custom root directory handle to list files from.
   * Defaults to the OPFS root (`navigator.storage.getDirectory()`).
   */
  rootDir?: FileSystemDirectoryHandle;

  /**
   * Optional specific subfolder inside OPFS to restrict directory listing and exploration to.
   * When specified, only files within this OPFS folder will be explored and served.
   *
   * @example `"docs"`, `"uploads"`, or `"backups"`
   */
  opfsDir?: string;
}

/**
 * Result returned by `handleOpfsRequest`.
 */
export interface OpfsExplorerResponse {
  /**
   * Whether the request was matched and handled by the OPFS explorer router.
   */
  matched: boolean;

  /**
   * The HTTP Response if the request was handled, or null/undefined if not matched.
   */
  response?: Response;
}

/**
 * Resolves the Content-Type header for a given file path based on its extension.
 *
 * @param path The file path or name (e.g. `"data.json"`, `"doc.pdf"`, `"image.png"`).
 * @returns The MIME type string, defaulting to `"application/octet-stream"`.
 *
 * @example
 * ```ts
 * getMimeType("report.json"); // "application/json; charset=utf-8"
 * getMimeType("avatar.png");   // "image/png"
 * getMimeType("manual.pdf");   // "application/pdf"
 * ```
 */
export function getMimeType(path: string,): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json",)) return "application/json; charset=utf-8";
  if (lower.endsWith(".txt",) || lower.endsWith(".md",)) {
    return "text/plain; charset=utf-8";
  }
  if (lower.endsWith(".html",) || lower.endsWith(".htm",)) {
    return "text/html; charset=utf-8";
  }
  if (lower.endsWith(".png",)) return "image/png";
  if (lower.endsWith(".jpg",) || lower.endsWith(".jpeg",)) return "image/jpeg";
  if (lower.endsWith(".gif",)) return "image/gif";
  if (lower.endsWith(".svg",)) return "image/svg+xml";
  if (lower.endsWith(".webp",)) return "image/webp";
  if (lower.endsWith(".pdf",)) return "application/pdf";
  if (lower.endsWith(".wasm",)) return "application/wasm";
  if (lower.endsWith(".js",) || lower.endsWith(".mjs",)) {
    return "application/javascript; charset=utf-8";
  }
  if (lower.endsWith(".css",)) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

/**
 * Recursively lists all file paths in the OPFS directory starting from the given handle (or OPFS root).
 *
 * @param dirHandle Optional directory handle to list from (defaults to OPFS root).
 * @param path Relative path prefix accumulated during recursion.
 * @returns Array of relative file paths (e.g. `["demo/file.txt", "backup/data.json"]`).
 *
 * @example
 * ```ts
 * const files = await listOpfsFiles();
 * console.log(files); // ["backup/db.json", "images/photo.png"]
 * ```
 */
export async function listOpfsFiles(
  dirHandle?: FileSystemDirectoryHandle,
  path = "",
): Promise<string[]> {
  const dir = dirHandle || (await navigator.storage.getDirectory());
  let files: string[] = [];
  // @ts-ignore: async iterator support across browser/worker environments
  for await (const [name, handle,] of dir.entries()) {
    if (handle.kind === "file") {
      files.push(path ? `${path}/${name}` : name,);
    } else if (handle.kind === "directory") {
      const subFiles = await listOpfsFiles(
        handle,
        path ? `${path}/${name}` : name,
      );
      files = files.concat(subFiles,);
    }
  }
  return files;
}

/**
 * Resolves a file path and returns a `File` object from OPFS.
 *
 * @param filePath Relative path from OPFS root (e.g. `"backups/db.json"`).
 * @param rootDir Optional root directory handle (defaults to OPFS root).
 * @returns The resolved `File` instance.
 * @throws {Error} When the file path is invalid or the directory / file does not exist.
 *
 * @example
 * ```ts
 * const file = await getFileFromOpfs("data.json");
 * const content = await file.text();
 * ```
 */
export async function getFileFromOpfs(
  filePath: string,
  rootDir?: FileSystemDirectoryHandle,
): Promise<File> {
  const root = rootDir || (await navigator.storage.getDirectory());
  const parts = filePath.split("/",).filter(Boolean,);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error(`Invalid file path: ${filePath}`,);
  }
  let curr = root;
  for (const p of parts) {
    curr = await curr.getDirectoryHandle(p, { create: false, },);
  }
  const fileHandle = await curr.getFileHandle(fileName, { create: false, },);
  return await fileHandle.getFile();
}

/**
 * Generates an HTML response page displaying directory contents and navigation links.
 *
 * @param currentPath Current folder path (empty string for root).
 * @param allFiles List of all files in the OPFS file system.
 * @param options Explorer configuration options or custom subfolder string (e.g. `"files"`).
 * @returns HTML document string.
 *
 * @example
 * ```ts
 * const html = renderDirectoryHtml("images/", ["images/logo.png"], "files");
 * ```
 */
export function renderDirectoryHtml(
  currentPath: string,
  allFiles: string[],
  options?: string | OpfsExplorerOptions,
): string {
  const opts = normalizeOptions(options,);
  const rawPrefix = opts.subfolder ?? opts.routePrefix ?? "opfs";
  const defaultTitle = rawPrefix.toLowerCase() === "opfs"
    ? "OPFS Explorer"
    : `${rawPrefix.charAt(0,).toUpperCase() + rawPrefix.slice(1,)} Explorer`;
  const title = opts.title || defaultTitle;
  const defaultStyles = `
    body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: #1a1c19; color: #e2e3dd; margin: 0; line-height: 1.5; }
    h1 { margin-top: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 8px; }
    a { color: #9edeb6; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    a:hover { text-decoration: underline; color: #bdf4d4; }
    ul { list-style-type: none; padding: 0; margin: 16px 0; }
    li { padding: 8px 12px; border-bottom: 1px solid #2d312d; border-radius: 4px; display: flex; align-items: center; }
    li:hover { background: #252824; }
    .back { font-weight: bold; color: #d0c5af; }
    .empty { color: #8c9388; font-style: italic; padding: 12px 0; }
  `;
  const styles = opts.customStyles || defaultStyles;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}${currentPath ? ` - /${currentPath}` : ""}</title>
  <style>${styles}</style>
</head>
<body>
  <h1>📁 ${title}${
    currentPath
      ? ` <span style="font-size:0.85em; opacity:0.8;">/${currentPath}</span>`
      : ""
  }</h1>
  <ul>`;

  if (currentPath !== "") {
    html += `<li><a class="back" href="../">🔙 ../</a></li>`;
  }

  const entries = new Set<string>();

  for (const f of allFiles) {
    if (currentPath === "" || f.startsWith(currentPath,)) {
      const remainder = currentPath === "" ? f : f.slice(currentPath.length,);
      const slashIdx = remainder.indexOf("/",);
      if (slashIdx === -1) {
        if (remainder) entries.add(remainder,);
      } else {
        entries.add(remainder.slice(0, slashIdx + 1,),);
      }
    }
  }

  const sortedEntries = Array.from(entries,).sort((a, b,) => {
    const aIsDir = a.endsWith("/",);
    const bIsDir = b.endsWith("/",);
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b,);
  },);

  if (sortedEntries.length === 0) {
    html +=
      `<li class="empty">No files or directories found in this folder.</li>`;
  } else {
    for (const entry of sortedEntries) {
      const isDir = entry.endsWith("/",);
      const icon = isDir ? "📁" : "📄";
      html += `<li><a href="${entry}">${icon} ${entry}</a></li>`;
    }
  }

  html += `  </ul>
</body>
</html>`;

  return html;
}

/**
 * Resolves the scope path of the Service Worker.
 * If `customScope` is explicitly provided, it will be normalized with leading and trailing slashes.
 * Otherwise, if running in a Service Worker environment with `self.registration.scope`,
 * the pathname of `self.registration.scope` is extracted.
 * Defaults to `"/"`.
 *
 * @param customScope Optional custom scope path (e.g. `"/workerdb/"` or `"my-app"`).
 * @returns Normalized scope path with leading and trailing slashes (e.g. `"/workerdb/"` or `"/"`).
 *
 * @example
 * ```ts
 * getScopePath();              // "/" (or pathname of self.registration.scope)
 * getScopePath("/my-repo/");   // "/my-repo/"
 * getScopePath("my-repo");     // "/my-repo/"
 * ```
 */
export function getScopePath(customScope?: string): string {
  if (customScope !== undefined) {
    let s = customScope.trim();
    if (!s.startsWith("/")) s = `/${s}`;
    if (!s.endsWith("/")) s = `${s}/`;
    return s;
  }
  try {
    if (
      typeof self !== "undefined" &&
      "registration" in self &&
      (self as unknown as { registration?: { scope?: string } }).registration?.scope
    ) {
      const scopeUrl = (self as unknown as { registration: { scope: string } }).registration.scope;
      const pathname = new URL(scopeUrl).pathname;
      return pathname.endsWith("/") ? pathname : `${pathname}/`;
    }
  } catch {
    // Ignore URL parse error and fall back to root
  }
  return "/";
}

/**
 * Normalizes options passed to OPFS explorer handlers.
 * Allows passing either a subfolder string directly (e.g. `"files"`, `"arquivos"`, `"opfs"`) or an options object.
 *
 * @param options A subfolder string or OpfsExplorerOptions configuration object.
 * @returns A normalized `OpfsExplorerOptions` object.
 *
 * @example
 * ```ts
 * normalizeOptions("files"); // { subfolder: "files", routePrefix: "files" }
 * normalizeOptions({ subfolder: "arquivos", title: "Meus Arquivos" });
 * ```
 */
export function normalizeOptions(
  options?: string | OpfsExplorerOptions,
): OpfsExplorerOptions {
  if (typeof options === "string") {
    return { subfolder: options, routePrefix: options, };
  }
  return options ?? {};
}

/**
 * Resolves the target directory handle in OPFS for listing or getting files.
 * Supports restricting to a specific subfolder via `options.opfsDir`.
 *
 * @param options Explorer configuration options containing optional `rootDir` or `opfsDir`.
 * @returns Promise resolving to the effective `FileSystemDirectoryHandle`.
 *
 * @example
 * ```ts
 * // Default root handle
 * const root = await getEffectiveRootDir();
 *
 * // Restricted to "backups" folder inside OPFS
 * const backupsDir = await getEffectiveRootDir({ opfsDir: "backups" });
 * ```
 */
export async function getEffectiveRootDir(
  options?: OpfsExplorerOptions,
): Promise<FileSystemDirectoryHandle> {
  let root = options?.rootDir || (await navigator.storage.getDirectory());
  if (options?.opfsDir) {
    const parts = options.opfsDir.split("/",).filter(Boolean,);
    for (const p of parts) {
      root = await root.getDirectoryHandle(p, { create: false, },);
    }
  }
  return root;
}

/**
 * Resolves the full URL pathname prefix for the OPFS explorer by combining
 * the Service Worker scope path and the explorer subfolder / route prefix.
 *
 * For example:
 * - Scope: `"/"`, Subfolder: `"files"` -> `"/files"`
 * - Scope: `"/my-repo/"`, Subfolder: `"files"` -> `"/my-repo/files"`
 * - Scope: `"/my-repo/"`, Subfolder: `"arquivos"` -> `"/my-repo/arquivos"`
 * - Scope: `"/my-repo/"`, Subfolder: `"opfs"` -> `"/my-repo/opfs"`
 * - Scope: `"/my-repo/"`, Route prefix: `"/my-repo/files"` -> `"/my-repo/files"`
 *
 * @param options Explorer configuration options or subfolder string (e.g. `"files"`, `"arquivos"`).
 * @returns Resolved pathname prefix with a leading slash and no trailing slash (e.g. `"/my-repo/files"`).
 *
 * @example
 * ```ts
 * resolveRoutePrefix("files"); // "/files"
 * resolveRoutePrefix({ scopePath: "/my-app/", subfolder: "arquivos" }); // "/my-app/arquivos"
 * ```
 */
export function resolveRoutePrefix(
  options?: string | OpfsExplorerOptions,
): string {
  const opts = normalizeOptions(options,);
  const scopePath = getScopePath(opts.scopePath,);
  const rawPrefix = opts.subfolder ?? opts.routePrefix ?? "opfs";

  // Clean rawPrefix: remove leading and trailing slashes / dot-slashes
  const cleanPrefix = rawPrefix.replace(/^(\.\/|\/)+|\/+$/g, "",);
  // Clean scopePath: remove leading and trailing slashes
  const cleanScope = scopePath.replace(/^\/+|\/+$/g, "",);

  if (!cleanScope) {
    return cleanPrefix ? `/${cleanPrefix}` : "/opfs";
  }

  // If cleanPrefix already starts with cleanScope, avoid duplicating it
  if (cleanPrefix === cleanScope || cleanPrefix.startsWith(`${cleanScope}/`,)) {
    return `/${cleanPrefix}`;
  }

  return `/${cleanScope}/${cleanPrefix || "opfs"}`;
}

/**
 * Handles an incoming HTTP fetch request, intercepting matching OPFS explorer routes.
 * Accepts either an options object or a custom subfolder string (e.g. `"files"`, `"arquivos"`, `"opfs"`).
 *
 * @param request The FetchEvent Request or standard Request instance.
 * @param options Configuration options including subfolder, route prefix, and title, or a subfolder string.
 * @returns An `OpfsExplorerResponse` object indicating whether the request matched and the resulting Response.
 *
 * @example Handling with a custom subfolder string
 * ```ts
 * import { handleOpfsRequest } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", async (event) => {
 *   const { matched, response } = await handleOpfsRequest(event.request, "files");
 *   if (matched && response) {
 *     event.respondWith(response);
 *   }
 * });
 * ```
 *
 * @example Handling with a full options configuration
 * ```ts
 * import { handleOpfsRequest } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", async (event) => {
 *   const { matched, response } = await handleOpfsRequest(event.request, {
 *     subfolder: "arquivos",
 *     title: "Arquivos Locais",
 *   });
 *   if (matched && response) {
 *     event.respondWith(response);
 *   }
 * });
 * ```
 */
export async function handleOpfsRequest(
  request: Request,
  options?: string | OpfsExplorerOptions,
): Promise<OpfsExplorerResponse> {
  const opts = normalizeOptions(options,);
  const url = new URL(request.url,);
  const effectivePrefix = resolveRoutePrefix(opts,);
  const escapedPrefix = effectivePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&",);
  const regex = new RegExp(`^${escapedPrefix}(?:$|\\/(.*))`,);
  const match = url.pathname.match(regex,);

  if (!match) {
    return { matched: false, };
  }

  // If there's no trailing slash on base prefix, redirect to add it
  if (url.pathname === effectivePrefix) {
    return {
      matched: true,
      response: Response.redirect(`${url.href}/`, 301,),
    };
  }

  const filePath = match[1] || "";

  if (filePath === "" || filePath.endsWith("/",)) {
    try {
      const rootDir = await getEffectiveRootDir(opts,);
      const files = await listOpfsFiles(rootDir,);
      const html = renderDirectoryHtml(filePath, files, opts,);
      return {
        matched: true,
        response: new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },),
      };
    } catch (err) {
      return {
        matched: true,
        response: new Response(
          `Error listing OPFS files: ${(err as Error).message}`,
          {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8", },
          },
        ),
      };
    }
  }

  try {
    const rootDir = await getEffectiveRootDir(opts,);
    const decodedPath = decodeURIComponent(filePath,);
    const file = await getFileFromOpfs(decodedPath, rootDir,);
    const contentType = getMimeType(decodedPath,);

    return {
      matched: true,
      response: new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        },
      },),
    };
  } catch (err) {
    return {
      matched: true,
      response: new Response(
        `File not found: ${decodeURIComponent(filePath,)}\n\n${
          (err as Error).message
        }`,
        {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8", },
        },
      ),
    };
  }
}

/**
 * Creates a standard fetch event listener function that can be plugged directly into `self.addEventListener('fetch', ...)`.
 * Accepts either an options object or a custom subfolder string (e.g. `"files"`, `"arquivos"`, `"opfs"`).
 *
 * @param options Explorer configuration options or custom subfolder name.
 * @returns A listener function `(event: FetchEvent) => void` that handles OPFS routes automatically.
 *
 * @example Quick 1-liner with custom subfolder name
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * // Accessible at /files/ or /{repo}/files/
 * self.addEventListener("fetch", createOpfsFetchHandler("files"));
 *
 * // Or in Portuguese:
 * // self.addEventListener("fetch", createOpfsFetchHandler("arquivos"));
 * ```
 *
 * @example With full configuration options
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", createOpfsFetchHandler({
 *   subfolder: "arquivos",
 *   title: "Meus Arquivos OPFS",
 *   opfsDir: "backups", // Restrict exploration to the "backups" folder inside OPFS
 * }));
 * ```
 */
export function createOpfsFetchHandler(
  options?: string | OpfsExplorerOptions,
): (event: FetchEvent,) => void {
  const opts = normalizeOptions(options,);
  return (event: FetchEvent,) => {
    const url = new URL(event.request.url,);
    const effectivePrefix = resolveRoutePrefix(opts,);
    const escapedPrefix = effectivePrefix.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const regex = new RegExp(`^${escapedPrefix}(?:$|\\/)`,);

    if (regex.test(url.pathname,)) {
      event.respondWith(
        (async () => {
          const res = await handleOpfsRequest(event.request, opts,);
          return res.response || new Response("Not Found", { status: 404, },);
        })(),
      );
    }
  };
}

````

---

## Arquivo: `packages/service-worker/src/mod.ts`

````ts
// packages/service-worker/src/mod.ts
/**
 * @module @vanaware/opfs-explorer
 * @description Lightweight Service Worker middleware and UI Explorer for the Origin Private File System (OPFS).
 *
 * Provides instant browser-based directory navigation, file inspections, and stream downloading for OPFS files directly inside your Service Worker.
 *
 * Fully configurable with custom subfolder routes (e.g. `"files"`, `"arquivos"`, `"opfs"`), auto-adapting to any Service Worker scope (including GitHub Pages repositories and subfolder deployments).
 *
 * @example Quick Start — 1-line fetch handler with custom subfolder
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * // Automatically intercepts requests under /files/ or /{repo}/files/
 * self.addEventListener("fetch", createOpfsFetchHandler("files"));
 *
 * // Or in Portuguese:
 * // self.addEventListener("fetch", createOpfsFetchHandler("arquivos"));
 * ```
 *
 * @example Advanced Configuration with Options Object
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", createOpfsFetchHandler({
 *   subfolder: "arquivos",
 *   title: "Meus Arquivos no OPFS",
 *   opfsDir: "backups", // Restrict exploration to a specific OPFS directory
 * }));
 * ```
 *
 * @example Manual Request Handling with `handleOpfsRequest`
 * ```ts
 * import { handleOpfsRequest } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", async (event) => {
 *   const { matched, response } = await handleOpfsRequest(event.request, "files");
 *   if (matched && response) {
 *     event.respondWith(response);
 *   }
 * });
 * ```
 *
 * @example Standalone Programmatic Usage (no Service Worker router needed)
 * ```ts
 * import { listOpfsFiles, getFileFromOpfs } from "@vanaware/opfs-explorer";
 *
 * const files = await listOpfsFiles();
 * console.log("OPFS Files:", files);
 *
 * const file = await getFileFromOpfs("backup/data.json");
 * const data = JSON.parse(await file.text());
 * ```
 */

export {
  createOpfsFetchHandler,
  getEffectiveRootDir,
  getFileFromOpfs,
  getMimeType,
  getScopePath,
  handleOpfsRequest,
  listOpfsFiles,
  normalizeOptions,
  renderDirectoryHtml,
  resolveRoutePrefix,
} from "./explorer.ts";

export type { OpfsExplorerOptions, OpfsExplorerResponse, } from "./explorer.ts";

````

---

## Arquivo: `packages/service-worker/src/sw.ts`

```ts
// packages/service-worker/src/sw.ts
/// <reference lib="webworker" />

import { db, } from "@vanaware/workerdb/sw";
import {
  createOpfsFetchHandler,
  handleOpfsRequest,
  listOpfsFiles,
} from "./explorer.ts";

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", () => {
  sw.skipWaiting();
},);

sw.addEventListener("activate", (event,) => {
  event.waitUntil(sw.clients.claim(),);
},);

// Intercept fetch requests for the OPFS Explorer route (relative to Service Worker scope).
// Developers can pass any custom subfolder name (e.g. "files", "arquivos", "opfs")
// or an options object to customize route prefix, title, and root directory.
sw.addEventListener(
  "fetch",
  createOpfsFetchHandler("opfs",),
);

// Demo Message IPC handler
sw.addEventListener("message", async (event,) => {
  if (event.data && event.data.type === "RUN_SW_DEMO") {
    try {
      const msgStore = db("WORKERDB_DATA", "messages", "MSG_",);

      const insertedId = await msgStore.set("auto", {
        senderId: "system_sw",
        recipientId: "all",
        content: "Mensagem gravada diretamente pelo Service Worker!",
        status: "delivered",
        priority: 99,
        timestamp: Date.now(),
      },);

      const allMessages = await msgStore.values();

      // Utilizando o padrão Record-Key ("auto_backups") dentro da pasta física global /backup
      const backupName = await msgStore.backupToOpfs(
        "auto_backups",
        "sw_auto_backup.json",
      );
      const opfsFiles = await listOpfsFiles();

      event.ports[0]?.postMessage({
        success: true,
        payload: {
          insertedId,
          totalMessages: allMessages.length,
          backupName,
          opfsFiles,
        },
      },);
    } catch (error) {
      event.ports[0]?.postMessage({
        success: false,
        error: (error as Error).message,
      },);
    }
  }
},);

```

---

## Arquivo: `packages/service-worker/tests/explorer_test.ts`

```ts
// packages/service-worker/tests/explorer_test.ts
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import "../../worker-db/src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../../worker-db/src/fake/fake-opfs.ts";
import {
  createOpfsFetchHandler,
  getFileFromOpfs,
  getMimeType,
  getScopePath,
  handleOpfsRequest,
  listOpfsFiles,
  normalizeOptions,
  renderDirectoryHtml,
  resolveRoutePrefix,
} from "../src/mod.ts";

describe("@vanaware/opfs-explorer", () => {
  it("determines correct mime types", () => {
    assertEquals(getMimeType("data.json",), "application/json; charset=utf-8",);
    assertEquals(getMimeType("README.md",), "text/plain; charset=utf-8",);
    assertEquals(getMimeType("index.html",), "text/html; charset=utf-8",);
    assertEquals(getMimeType("photo.png",), "image/png",);
    assertEquals(getMimeType("photo.JPG",), "image/jpeg",);
    assertEquals(getMimeType("app.wasm",), "application/wasm",);
    assertEquals(
      getMimeType("script.js",),
      "application/javascript; charset=utf-8",
    );
    assertEquals(getMimeType("unknown.xyz",), "application/octet-stream",);
  });

  it("renders directory html properly", () => {
    const files = ["backup/data.json", "demo/file.txt", "root-file.json",];
    const html = renderDirectoryHtml("", files, { title: "Custom Explorer", },);

    assert(html.includes("Custom Explorer",),);
    assert(html.includes("backup/",),);
    assert(html.includes("demo/",),);
    assert(html.includes("root-file.json",),);
  });

  it("handles OPFS routing correctly with fake OPFS", async () => {
    FakeOPFSDirectory.clear();
    const fakeRoot = new FakeOPFSDirectory("",);
    const demoDir = fakeRoot.getDirectoryHandle("demo", { create: true, },);
    const fileHandle = demoDir.getFileHandle("test.txt", { create: true, },);
    const writable = fileHandle.createWritable();
    await writable.write("hello world",);
    writable.close();

    // Route matching non-opfs path
    const nonOpfsReq = new Request("https://example.com/api/users",);
    const res1 = await handleOpfsRequest(nonOpfsReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res1.matched, false,);

    // Route matching opfs base redirect
    const redirectReq = new Request("https://example.com/opfs",);
    const res2 = await handleOpfsRequest(redirectReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res2.matched, true,);
    assertEquals(res2.response?.status, 301,);

    // Route matching opfs root folder
    const rootReq = new Request("https://example.com/opfs/",);
    const res3 = await handleOpfsRequest(rootReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res3.matched, true,);
    assertEquals(res3.response?.status, 200,);
    const htmlText = await res3.response?.text();
    assert(htmlText?.includes("demo/",),);

    // Route matching file request
    const fileReq = new Request("https://example.com/opfs/demo/test.txt",);
    const res4 = await handleOpfsRequest(fileReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res4.matched, true,);
    assertEquals(res4.response?.status, 200,);
    assertEquals(
      res4.response?.headers.get("Content-Type",),
      "text/plain; charset=utf-8",
    );
    const fileContent = await res4.response?.text();
    assertEquals(fileContent, "hello world",);
  });

  it("createOpfsFetchHandler responds to matching paths", async () => {
    FakeOPFSDirectory.clear();
    const fakeRoot = new FakeOPFSDirectory("",);
    const fileHandle = fakeRoot.getFileHandle("app.json", { create: true, },);
    const writable = fileHandle.createWritable();
    await writable.write(JSON.stringify({ active: true, },),);
    writable.close();

    const handler = createOpfsFetchHandler({
      routePrefix: "/opfs",
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);

    let respondedWith: Response | null = null;
    const fakeEvent = {
      request: new Request("https://example.com/opfs/app.json",),
      respondWith: (promise: Promise<Response>,) => {
        promise.then((res,) => {
          respondedWith = res;
        },);
      },
    } as unknown as FetchEvent;

    handler(fakeEvent,);

    // Wait for promise resolution
    await new Promise((r,) => setTimeout(r, 50,));
    assert(respondedWith !== null,);
    assertEquals((respondedWith as unknown as Response).status, 200,);
    assertEquals(
      (respondedWith as unknown as Response).headers.get("Content-Type",),
      "application/json; charset=utf-8",
    );
  });

  describe("Service Worker scope resolution", () => {
    it("getScopePath normalizes custom scope properly", () => {
      assertEquals(getScopePath(), "/",);
      assertEquals(getScopePath("workerdb",), "/workerdb/",);
      assertEquals(getScopePath("/workerdb",), "/workerdb/",);
      assertEquals(getScopePath("/workerdb/",), "/workerdb/",);
      assertEquals(getScopePath(" /workerdb/ "), "/workerdb/",);
    });

    it("resolveRoutePrefix combines scope and route prefix correctly", () => {
      // Root scope
      assertEquals(resolveRoutePrefix(), "/opfs",);
      assertEquals(resolveRoutePrefix({ routePrefix: "opfs", },), "/opfs",);
      assertEquals(resolveRoutePrefix({ routePrefix: "/opfs", },), "/opfs",);
      assertEquals(
        resolveRoutePrefix({ routePrefix: "/storage/opfs", },),
        "/storage/opfs",
      );

      // Custom GitHub Pages scope /workerdb/
      assertEquals(
        resolveRoutePrefix({ scopePath: "/workerdb/", },),
        "/workerdb/opfs",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "opfs",
        },),
        "/workerdb/opfs",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "/opfs",
        },),
        "/workerdb/opfs",
      );
      // If already prefixed with scope
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "/workerdb/opfs",
        },),
        "/workerdb/opfs",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "./opfs",
        },),
        "/workerdb/opfs",
      );
    });

    it("handles OPFS routing with scope /workerdb/ (GitHub Pages setup)", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const demoDir = fakeRoot.getDirectoryHandle("demo", { create: true, },);
      const fileHandle = demoDir.getFileHandle("test.txt", { create: true, },);
      const writable = fileHandle.createWritable();
      await writable.write("github pages opfs content",);
      writable.close();

      const options = {
        scopePath: "/workerdb/",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      };

      // Non-matching path outside opfs
      const nonMatch = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/index.html",),
        options,
      );
      assertEquals(nonMatch.matched, false,);

      // Non-matching path at root
      const nonMatchRoot = await handleOpfsRequest(
        new Request("https://vanaware.github.io/other",),
        options,
      );
      assertEquals(nonMatchRoot.matched, false,);

      // Base redirect: /workerdb/opfs -> /workerdb/opfs/
      const redirectReq = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/opfs",),
        options,
      );
      assertEquals(redirectReq.matched, true,);
      assertEquals(redirectReq.response?.status, 301,);
      assertEquals(
        redirectReq.response?.headers.get("Location",),
        "https://vanaware.github.io/workerdb/opfs/",
      );

      // Root folder listing: /workerdb/opfs/
      const rootReq = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/opfs/",),
        options,
      );
      assertEquals(rootReq.matched, true,);
      assertEquals(rootReq.response?.status, 200,);
      const htmlText = await rootReq.response?.text();
      assert(htmlText?.includes("demo/",),);

      // File retrieval: /workerdb/opfs/demo/test.txt
      const fileReq = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/opfs/demo/test.txt",),
        options,
      );
      assertEquals(fileReq.matched, true,);
      assertEquals(fileReq.response?.status, 200,);
      assertEquals(
        fileReq.response?.headers.get("Content-Type",),
        "text/plain; charset=utf-8",
      );
      const fileText = await fileReq.response?.text();
      assertEquals(fileText, "github pages opfs content",);
    });

    it("createOpfsFetchHandler handles requests under scope /workerdb/", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const fileHandle = fakeRoot.getFileHandle("data.json", { create: true, },);
      const writable = fileHandle.createWritable();
      await writable.write(JSON.stringify({ deployed: true, },),);
      writable.close();

      const handler = createOpfsFetchHandler({
        scopePath: "/workerdb/",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      },);

      let respondedWith: Response | null = null;
      const fakeEvent = {
        request: new Request(
          "https://vanaware.github.io/workerdb/opfs/data.json",
        ),
        respondWith: (promise: Promise<Response>,) => {
          promise.then((res,) => {
            respondedWith = res;
          },);
        },
      } as unknown as FetchEvent;

      handler(fakeEvent,);

      await new Promise((r,) => setTimeout(r, 50,));
      assert(respondedWith !== null,);
      assertEquals((respondedWith as unknown as Response).status, 200,);
      const json = await (respondedWith as unknown as Response).json();
      assertEquals(json, { deployed: true, },);
    });
  });

  describe("Custom subfolder configuration (files, arquivos, etc.)", () => {
    it("normalizeOptions normalizes strings and objects correctly", () => {
      assertEquals(normalizeOptions(), {},);
      assertEquals(normalizeOptions("files",), {
        subfolder: "files",
        routePrefix: "files",
      },);
      assertEquals(normalizeOptions("arquivos",), {
        subfolder: "arquivos",
        routePrefix: "arquivos",
      },);
      assertEquals(
        normalizeOptions({ subfolder: "arquivos", title: "Meus Arquivos", },),
        { subfolder: "arquivos", title: "Meus Arquivos", },
      );
    });

    it("resolveRoutePrefix handles custom subfolder strings and options", () => {
      assertEquals(resolveRoutePrefix("files",), "/files",);
      assertEquals(resolveRoutePrefix("arquivos",), "/arquivos",);
      assertEquals(resolveRoutePrefix({ subfolder: "arquivos", },), "/arquivos",);
      assertEquals(
        resolveRoutePrefix({ scopePath: "/my-app/", subfolder: "files", },),
        "/my-app/files",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/my-app/",
          subfolder: "arquivos",
        },),
        "/my-app/arquivos",
      );
    });

    it("renderDirectoryHtml dynamically computes title based on subfolder", () => {
      const html1 = renderDirectoryHtml("", [], "files",);
      assert(html1.includes("Files Explorer",),);

      const html2 = renderDirectoryHtml("", [], "arquivos",);
      assert(html2.includes("Arquivos Explorer",),);

      const html3 = renderDirectoryHtml("", [], {
        subfolder: "arquivos",
        title: "Painel de Documentos",
      },);
      assert(html3.includes("Painel de Documentos",),);
    });

    it("handleOpfsRequest intercepts custom subfolder 'arquivos'", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const demoDir = fakeRoot.getDirectoryHandle("docs", { create: true, },);
      const fileHandle = demoDir.getFileHandle("nota.txt", { create: true, },);
      const writable = fileHandle.createWritable();
      await writable.write("conteudo em arquivos",);
      writable.close();

      const options = {
        scopePath: "/my-repo/",
        subfolder: "arquivos",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      };

      // Base redirect: /my-repo/arquivos -> /my-repo/arquivos/
      const redirectRes = await handleOpfsRequest(
        new Request("https://user.github.io/my-repo/arquivos",),
        options,
      );
      assertEquals(redirectRes.matched, true,);
      assertEquals(redirectRes.response?.status, 301,);
      assertEquals(
        redirectRes.response?.headers.get("Location",),
        "https://user.github.io/my-repo/arquivos/",
      );

      // File request: /my-repo/arquivos/docs/nota.txt
      const fileRes = await handleOpfsRequest(
        new Request("https://user.github.io/my-repo/arquivos/docs/nota.txt",),
        options,
      );
      assertEquals(fileRes.matched, true,);
      assertEquals(fileRes.response?.status, 200,);
      assertEquals(await fileRes.response?.text(), "conteudo em arquivos",);
    });

    it("createOpfsFetchHandler works with string subfolder shortcut", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const fileHandle = fakeRoot.getFileHandle("report.csv", {
        create: true,
      },);
      const writable = fileHandle.createWritable();
      await writable.write("id,name\n1,Alpha",);
      writable.close();

      // Passing options object with custom subfolder "files" and fake root
      const handler = createOpfsFetchHandler({
        subfolder: "files",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      },);

      let respondedWith: Response | null = null;
      const fakeEvent = {
        request: new Request("https://example.com/files/report.csv",),
        respondWith: (promise: Promise<Response>,) => {
          promise.then((res,) => {
            respondedWith = res;
          },);
        },
      } as unknown as FetchEvent;

      handler(fakeEvent,);

      await new Promise((r,) => setTimeout(r, 50,));
      assert(respondedWith !== null,);
      assertEquals((respondedWith as unknown as Response).status, 200,);
      const text = await (respondedWith as unknown as Response).text();
      assertEquals(text, "id,name\n1,Alpha",);
    });
  });
});

```

---

## Arquivo: `packages/service-worker/deno.jsonc`

```json
{
  "name": "@vanaware/opfs-explorer",
  "version": "0.3.0#mua9rvo8",
  "description": "Lightweight Service Worker middleware and UI Explorer for the Origin Private File System (OPFS).",
  "author": "Vanaware",
  "license": "MIT",
  // ----------------------------------------------------------------------
  // 🔧 Compiler Options específicos do pacote
  // ----------------------------------------------------------------------
  "compilerOptions": {
    "lib": [
      "webworker",
      "webworker.asynciterable",
      "webworker.iterable"
    ]
  },
  "imports": {},
  "tasks": {
    "test": "deno test -P",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "check": "deno check src/**/*.{ts,tsx} tests/**/*.ts",
    "fmt:check": "deno fmt --check",
    "lint:fix": "deno lint --fix",
    "lint:doc": "deno doc --lint src/mod.ts",
    "tests": "deno task check && deno task lint && deno task fmt:check && deno task test"
  },
  "exports": {
    ".": "./src/mod.ts"
  },
  "publish": {
    "include": [
      "src/**/*.ts",
      "README.md",
      "docs/**/*.md",
      "deno.jsonc"
    ],
    "exclude": [
      "src/sw.ts",
      "tests"
    ]
  },
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["ban-untagged-todo"],
      "exclude": ["no-unused-vars"]
    },
    "include": [
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "test": {
    "permissions": {
      "read": true,
      "write": true,
      "net": true,
      "env": true,
      "sys": true,
      "run": true,
      "ffi": true,
      "import": true
    },
    "include": [
      "tests/**/*test.ts"
    ],
    "exclude": [
      "src/**/*.{ts,tsx}"
    ]
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 80,
    "indentWidth": 2,
    "semiColons": true,
    "singleQuote": false,
    "proseWrap": "preserve",
    "trailingCommas": "always",
    "json.trailingCommas": "never",
    "operatorPosition": "maintain",
    "jsx.bracketPosition": "sameLine",
    "jsx.forceNewLinesSurroundingContent": true,
    "jsx.multiLineParens": "always",
    "newLineKind": "lf",
    "include": [
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "exclude": [
    "docs"
  ]
}

```

---

## Arquivo: `packages/service-worker/README.md`

````md
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

````

---

