export class FakeOPFSFileHandle {
  public kind: "file" | "directory" = "file";

  constructor(
    private fullPath: string,
    private storage: Map<string, Uint8Array>,
  ) {}

  createWritable() {
    const chunks: Uint8Array[] = [];
    const storage = this.storage;
    const fullPath = this.fullPath;
    return {
      async write(data: Uint8Array | string | Blob | ArrayBuffer,) {
        let chunk: Uint8Array;
        if (data instanceof Uint8Array) {
          chunk = data;
        } else if (data instanceof ArrayBuffer) {
          chunk = new Uint8Array(data,);
        } else if (data instanceof Blob) {
          chunk = new Uint8Array(await data.arrayBuffer(),);
        } else {
          chunk = new TextEncoder().encode(String(data,),);
        }
        chunks.push(chunk,);
      },
      close() {
        const totalLen = chunks.reduce((acc, c,) => acc + c.length, 0,);
        const merged = new Uint8Array(totalLen,);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset,);
          offset += c.length;
        }
        storage.set(fullPath, merged,);
      },
    };
  }

  getFile(): Promise<File> {
    const content = this.storage.get(this.fullPath,);
    if (content === undefined) {
      throw new Error(`File ${this.fullPath} not found in Fake OPFS`,);
    }
    const fileName = this.fullPath.split("/",).pop() || "file";
    return Promise.resolve(
      new File([content as BlobPart,], fileName, {
        type: "application/octet-stream",
        lastModified: Date.now(),
      },),
    );
  }
}

export class FakeOPFSDirectory {
  public kind: "file" | "directory" = "directory";
  private static sharedStorage = new Map<string, Uint8Array>();

  constructor(private path: string = "",) {}

  getDirectoryHandle(name: string, options?: { create?: boolean },) {
    return new FakeOPFSDirectory(this.path ? `${this.path}/${name}` : name,);
  }

  getFileHandle(name: string, options?: { create?: boolean },) {
    const fullPath = this.path ? `${this.path}/${name}` : name;
    if (!options?.create && !FakeOPFSDirectory.sharedStorage.has(fullPath,)) {
      throw new Error(`File ${fullPath} not found in Fake OPFS`,);
    }
    return new FakeOPFSFileHandle(fullPath, FakeOPFSDirectory.sharedStorage,);
  }

  removeEntry(name: string,) {
    const fullPath = this.path ? `${this.path}/${name}` : name;
    FakeOPFSDirectory.sharedStorage.delete(fullPath,);
    for (const key of Array.from(FakeOPFSDirectory.sharedStorage.keys())) {
      if (key === fullPath || key.startsWith(`${fullPath}/`,)) {
        FakeOPFSDirectory.sharedStorage.delete(key,);
      }
    }
  }

  async *keys() {
    const yieldedDirs = new Set<string>();
    for (const key of FakeOPFSDirectory.sharedStorage.keys()) {
      if (this.path && key.startsWith(`${this.path}/`,)) {
        const localPath = key.slice(this.path.length + 1,);
        const slashIdx = localPath.indexOf("/",);
        if (slashIdx === -1) {
          yield localPath;
        } else {
          const dirName = localPath.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield dirName;
          }
        }
      } else if (!this.path) {
        const slashIdx = key.indexOf("/",);
        if (slashIdx === -1) {
          yield key;
        } else {
          const dirName = key.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield dirName;
          }
        }
      }
    }
  }

  async *entries() {
    const yieldedDirs = new Set<string>();
    for (const key of FakeOPFSDirectory.sharedStorage.keys()) {
      if (this.path && key.startsWith(`${this.path}/`,)) {
        const localPath = key.slice(this.path.length + 1,);
        const slashIdx = localPath.indexOf("/",);
        if (slashIdx === -1) {
          yield [
            localPath,
            new FakeOPFSFileHandle(key, FakeOPFSDirectory.sharedStorage,),
          ] as const;
        } else {
          const dirName = localPath.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield [
              dirName,
              new FakeOPFSDirectory(
                this.path ? `${this.path}/${dirName}` : dirName,
              ),
            ] as const;
          }
        }
      } else if (!this.path) {
        const slashIdx = key.indexOf("/",);
        if (slashIdx === -1) {
          yield [
            key,
            new FakeOPFSFileHandle(key, FakeOPFSDirectory.sharedStorage,),
          ] as const;
        } else {
          const dirName = key.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield [
              dirName,
              new FakeOPFSDirectory(dirName,),
            ] as const;
          }
        }
      }
    }
  }

  async *values() {
    for await (const [, handle,] of this.entries()) {
      yield handle;
    }
  }

  static clear() {
    FakeOPFSDirectory.sharedStorage.clear();
  }
}
