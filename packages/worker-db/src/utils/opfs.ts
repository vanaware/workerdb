// ## Arquivo: monorepo/worker-db/src/utils/opfs_utils.ts
export interface OpfsResolveOptions {
  dbName?: string;
  storeName?: string;
  prefix?: string;
}

export function resolveOpfsFileName(
  type: 'db' | 'ls',
  fileName: string,
  opts?: OpfsResolveOptions,
): string {
  const parts: string[] = [type,];
  if (type === 'db') {
    if (opts?.dbName) parts.push(opts.dbName,);
    if (opts?.storeName) parts.push(opts.storeName,);
  }
  if (opts?.prefix) parts.push(opts.prefix,);

  parts.push(fileName,);
  return parts.join('_',);
}

async function getBackupDir() {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle('backup', { create: true, },);
}

// Navega e cria (se necessário) o caminho completo baseado em strings com '/'
async function resolvePath(filePath: string, create = false,) {
  const backupDir = await getBackupDir();
  const parts = filePath.split('/',);
  const fileName = parts.pop()!;
  let curr = backupDir;
  for (const p of parts) {
    curr = await curr.getDirectoryHandle(p, { create, },);
  }
  return { dir: curr, fileName, };
}

export async function writeJsonToOpfs(filePath: string, data: unknown,): Promise<string> {
  const { dir, fileName, } = await resolvePath(filePath, true,);
  const fileHandle = await dir.getFileHandle(fileName, { create: true, },);
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data,),);
  await writable.close();
  return filePath;
}

export async function readJsonFromOpfs(filePath: string,): Promise<unknown> {
  const { dir, fileName, } = await resolvePath(filePath, false,);
  const fileHandle = await dir.getFileHandle(fileName,);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text,);
}

export async function deleteFromOpfs(filePath: string,): Promise<void> {
  const { dir, fileName, } = await resolvePath(filePath, false,);
  await dir.removeEntry(fileName,);
}

export async function getFileFromOpfs(filePath: string,): Promise<File> {
  const { dir, fileName, } = await resolvePath(filePath, false,);
  const fileHandle = await dir.getFileHandle(fileName,);
  return await fileHandle.getFile();
}

// Lista recursivamente arquivos mantendo o path relativo (ex: "MINHA_KEY/backup.json")
export async function listOpfsFiles(
  dirHandle?: FileSystemDirectoryHandle,
  path = '',
): Promise<string[]> {
  const dir = dirHandle || await getBackupDir();
  let files: string[] = [];
  // @ts-ignore: async iterator support
  for await (const [name, handle,] of dir.entries()) {
    if (handle.kind === 'file') {
      files.push(path ? `${path}/${name}` : name,);
    } else if (handle.kind === 'directory') {
      const subFiles = await listOpfsFiles(handle, path ? `${path}/${name}` : name,);
      files = files.concat(subFiles,);
    }
  }
  return files;
}

export async function downloadOpfsFile(fileName: string,): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error(
      "downloadOpfsFile só pode ser executado na Main Thread (onde 'document' existe).",
    );
  }
  const file = await getFileFromOpfs(fileName,);
  const url = URL.createObjectURL(file,);
  const a = document.createElement('a',);
  a.href = url;
  a.download = fileName.split('/',).pop()!; // Download sempre usa apenas o nome do arquivo final
  document.body.appendChild(a,);
  a.click();
  document.body.removeChild(a,);
  URL.revokeObjectURL(url,);
}
