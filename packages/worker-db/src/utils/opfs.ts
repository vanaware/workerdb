// src/utils/opfs.ts

/**
 * Options for resolving OPFS file names.
 */
export interface OpfsResolveOptions {
  dbName?: string;
  storeName?: string;
  prefix?: string;
}

/**
 * Resolves a normalized OPFS file name based on storage type, names, and prefix.
 */
export function resolveOpfsFileName(
  type: "db" | "ls",
  fileName: string,
  opts?: OpfsResolveOptions,
): string {
  const parts: string[] = [type];
  if (type === "db") {
    if (opts?.dbName) parts.push(opts.dbName);
    if (opts?.storeName) parts.push(opts.storeName);
  }
  if (opts?.prefix) parts.push(opts.prefix);

  parts.push(fileName);
  return parts.join("_");
}

async function getBackupDir() {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle("backup", { create: true });
}

// Navigates and creates (if needed) the full path based on slash-delimited strings
async function resolvePath(filePath: string, create = false) {
  const backupDir = await getBackupDir();
  const parts = filePath.split("/");
  const fileName = parts.pop()!;
  let curr = backupDir;
  for (const p of parts) {
    curr = await curr.getDirectoryHandle(p, { create });
  }
  return { dir: curr, fileName };
}

/**
 * Writes JSON data to an OPFS file path.
 */
export async function writeJsonToOpfs(
  filePath: string,
  data: unknown,
): Promise<string> {
  const { dir, fileName } = await resolvePath(filePath, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
  return filePath;
}

/**
 * Writes a ReadableStream of bytes to an OPFS file path.
 */
export async function writeStreamToOpfs(
  filePath: string,
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const { dir, fileName } = await resolvePath(filePath, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await writable.write(value as unknown as BufferSource);
      }
    }
  } finally {
    reader.releaseLock();
  }
  await writable.close();
  return filePath;
}

/**
 * Reads and parses JSON data from an OPFS file.
 */
export async function readJsonFromOpfs(filePath: string): Promise<unknown> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Deletes a file from OPFS.
 */
export async function deleteFromOpfs(filePath: string): Promise<void> {
  const { dir, fileName } = await resolvePath(filePath, false);
  await dir.removeEntry(fileName);
}

/**
 * Gets a File handle from an OPFS file path.
 */
export async function getFileFromOpfs(filePath: string): Promise<File> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  return await fileHandle.getFile();
}

/**
 * Gets a byte ReadableStream from an OPFS file.
 */
export async function getFileStreamFromOpfs(
  filePath: string,
): Promise<ReadableStream<Uint8Array>> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.stream();
}

/**
 * Recursively lists files preserving relative paths (e.g., "MY_KEY/backup.json").
 */
export async function listOpfsFiles(
  dirHandle?: FileSystemDirectoryHandle,
  path = "",
): Promise<string[]> {
  const dir = dirHandle || await getBackupDir();
  let files: string[] = [];
  // @ts-ignore: async iterator support
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file") {
      files.push(path ? `${path}/${name}` : name);
    } else if (handle.kind === "directory") {
      const subFiles = await listOpfsFiles(
        handle,
        path ? `${path}/${name}` : name,
      );
      files = files.concat(subFiles);
    }
  }
  return files;
}

/**
 * Triggers a browser download for an OPFS file.
 */
export async function downloadOpfsFile(fileName: string): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error(
      "downloadOpfsFile can only be executed on the Main Thread (where 'document' is defined).",
    );
  }
  const file = await getFileFromOpfs(fileName);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.split("/").pop()!; // Download always uses only the final file name
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
