// src/fake/fake-db.ts
// ============================================================================
// FAKE OPFS + INDEXEDDB INJECTION IN SERVICE WORKER
// ============================================================================
//
// This file should be imported AT THE BEGINNING of your service worker
// (before any import that uses db/opfs) to prepare the test/integration
// environment with fake OPFS and IndexedDB.
//
// Difference from fake-mod.ts (Main Thread):
// - Does NOT inject localStorage (does not exist in Service Workers)
// - Injects into `self` scope (ServiceWorkerGlobalScope)
// - Exports direct APIs from db.ts (no RPC proxy, since SW IS the worker)
// ============================================================================

// 1. Inject Fake IndexedDB into global scope of the Service Worker (self)
import "fake-indexeddb/auto";
import { FakeOPFSDirectory } from "./fake-opfs.ts";

const _self = self as unknown as Record<string, unknown>;

// 2. Inject Fake OPFS into the Service Worker scope
// navigator.storage.getDirectory() exists in modern Service Workers,
// so we replace it with our in-memory fake version.
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Export direct database APIs with simulated environment.
// Imports directly from db.ts since the Service Worker is already a background worker.
export { db, opfs } from "../db.ts";
