// packages/service-worker/src/explorer.ts

/**
 * Options to configure the OPFS explorer handler.
 */
export interface OpfsExplorerOptions {
  /**
   * The base URL path prefix that routes to the OPFS explorer.
   * Defaults to `"/opfs"`.
   *
   * @example `"/opfs"` or `"/storage/opfs"`
   */
  routePrefix?: string;

  /**
   * Custom title displayed in the HTML explorer header and page `<title>`.
   * Defaults to `"OPFS Explorer"`.
   */
  title?: string;

  /**
   * Optional custom CSS styles to inject into the explorer HTML interface.
   */
  customStyles?: string;

  /**
   * Optional custom root directory handle to list files from.
   * Defaults to OPFS root (`navigator.storage.getDirectory()`).
   */
  rootDir?: FileSystemDirectoryHandle;
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
 * @param path The file path or name.
 * @returns The MIME type string.
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
 * @param filePath Relative path from OPFS root.
 * @param rootDir Optional root directory handle.
 * @returns The File instance.
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
 * @param options Explorer configuration options.
 * @returns HTML string.
 */
export function renderDirectoryHtml(
  currentPath: string,
  allFiles: string[],
  options?: OpfsExplorerOptions,
): string {
  const title = options?.title || "OPFS Explorer";
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
  const styles = options?.customStyles || defaultStyles;

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
 * Handles an incoming HTTP fetch request, intercepting matching OPFS explorer routes.
 *
 * @param request The FetchEvent Request or standard Request instance.
 * @param options Configuration options including route prefix and title.
 * @returns An `OpfsExplorerResponse` object indicating whether the request matched and the resulting Response.
 *
 * @example
 * ```ts
 * import { handleOpfsRequest } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", (event) => {
 *   const { matched, response } = handleOpfsRequest(event.request);
 *   if (matched && response) {
 *     event.respondWith(response);
 *   }
 * });
 * ```
 */
export async function handleOpfsRequest(
  request: Request,
  options?: OpfsExplorerOptions,
): Promise<OpfsExplorerResponse> {
  const url = new URL(request.url,);
  const rawPrefix = options?.routePrefix || "/opfs";
  // Normalize prefix: remove leading/trailing slashes for regex construction
  const prefix = rawPrefix.replace(/^\/+|\/+$/g, "",);
  const regex = new RegExp(`^\\/${prefix}(?:$|\\/(.*))`,);
  const match = url.pathname.match(regex,);

  if (!match) {
    return { matched: false, };
  }

  // If there's no trailing slash on base prefix, redirect to add it
  if (url.pathname === `/${prefix}`) {
    return {
      matched: true,
      response: Response.redirect(`${url.href}/`, 301,),
    };
  }

  const filePath = match[1] || "";

  if (filePath === "" || filePath.endsWith("/",)) {
    try {
      const files = await listOpfsFiles(options?.rootDir,);
      const html = renderDirectoryHtml(filePath, files, options,);
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
    const decodedPath = decodeURIComponent(filePath,);
    const file = await getFileFromOpfs(decodedPath, options?.rootDir,);
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
 * Creates a standard fetch event listener function that can be plugged into `self.addEventListener('fetch', ...)`.
 *
 * @param options Explorer configuration options.
 * @returns A listener function that handles OPFS routes automatically.
 *
 * @example
 * ```ts
 * import { createOpfsFetchHandler } from "@vanaware/opfs-explorer";
 *
 * self.addEventListener("fetch", createOpfsFetchHandler({
 *   routePrefix: "/opfs",
 *   title: "My App OPFS Explorer"
 * }));
 * ```
 */
export function createOpfsFetchHandler(
  options?: OpfsExplorerOptions,
): (event: FetchEvent,) => void {
  return (event: FetchEvent,) => {
    const url = new URL(event.request.url,);
    const rawPrefix = options?.routePrefix || "/opfs";
    const prefix = rawPrefix.replace(/^\/+|\/+$/g, "",);
    const regex = new RegExp(`^\\/${prefix}(?:$|\\/)`,);

    if (regex.test(url.pathname,)) {
      event.respondWith(
        (async () => {
          const res = await handleOpfsRequest(event.request, options,);
          return res.response || new Response("Not Found", { status: 404, },);
        })(),
      );
    }
  };
}
