// monorepo/worker-db/src/fake/fake-mod.ts
// 1. Injeta o IndexedDB Fake globalmente (Main Thread)
import "fake-indexeddb/auto";
import { FakeOPFSDirectory, } from "./fake-opfs.ts";
import { FakeLocalStorage, } from "./fake-local-storage.ts";

const _global = globalThis as Record<string, unknown>;

// 2. Injeta OPFS Fake (Main Thread)
if (!_global.navigator) _global.navigator = {};
const navigator = _global.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory(),);
}

// 3. Injeta LocalStorage Fake (Main Thread)
if (
  !_global.localStorage ||
  _global.localStorage.constructor.name !== "FakeLocalStorage"
) {
  try {
    Object.defineProperty(_global, "localStorage", {
      value: new FakeLocalStorage(),
      writable: true,
      configurable: true,
    },);
  } catch {
    _global.localStorage = new FakeLocalStorage();
  }
}

// 4. Exportamos tudo do módulo principal para que o demo.ts consuma
export * from "../mod-main.ts";

// 5. O PULO DO GATO: Forçamos a inicialização do módulo para usar o Worker Fake.
// 🔥 CORREÇÃO: O arquivo se chama fake-worker.ts, não fake-db.ts
// O Deno resolve arquivos .ts nativamente em Workers usando import.meta.url
import { db, } from "../mod-main.ts";
const fakeWorkerUrl = new URL("./fake-worker.ts", import.meta.url,);
db.init(fakeWorkerUrl,);

// 6. Exportamos as funções de assertivas customizadas
export {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "./assert.ts";
