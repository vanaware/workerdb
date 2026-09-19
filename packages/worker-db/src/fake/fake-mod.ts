/**
 * @module @vanaware/workerdb/fake
 * @description Testing and simulation environment for Main Thread applications.
 * Automatically injects in-memory IndexedDB (via fake-indexeddb), simulated OPFS,
 * and a Mock Web Worker for end-to-end testing in Node.js or Deno without headless browsers.
 */

// 1. Inject Fake IndexedDB globally (Main Thread)
import "fake-indexeddb/auto";
import { FakeOPFSDirectory } from "./fake-opfs.ts";
import { FakeLocalStorage } from "./fake-local-storage.ts";

const _global = globalThis as Record<string, unknown>;

// 2. Inject Fake OPFS (Main Thread)
if (!_global.navigator) _global.navigator = {};
const navigator = _global.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Inject Fake LocalStorage (Main Thread)
if (
  !_global.localStorage ||
  _global.localStorage.constructor.name !== "FakeLocalStorage"
) {
  try {
    Object.defineProperty(_global, "localStorage", {
      value: new FakeLocalStorage(),
      writable: true,
      configurable: true,
    });
  } catch {
    _global.localStorage = new FakeLocalStorage();
  }
}

// 4. Export everything from main module
export * from "../mod-main.ts";

// 5. Initialize the module to use the Fake Worker.
// Deno resolves .ts files natively in Workers using import.meta.url
import { db } from "../mod-main.ts";
const fakeWorkerUrl = new URL("./fake-worker.ts", import.meta.url);
db.init(fakeWorkerUrl);
