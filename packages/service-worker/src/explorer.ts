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
