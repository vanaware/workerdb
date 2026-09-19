// src/fake/fake-worker.ts

// 1. Inject Fake IndexedDB into the global scope (self) of the Worker
import "fake-indexeddb/auto";

import { FakeOPFSDirectory } from "./fake-opfs.ts";

const _self = globalThis as unknown as Record<string, unknown>;

// 2. Inject Fake OPFS into the Worker scope
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Import real worker logic with simulated environment
import "../worker.ts";
