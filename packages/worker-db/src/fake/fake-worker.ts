// monorepo/worker-db/src/fake/fake-db.ts

// 1. Injeta o IndexedDB Fake no escopo global (self) do Worker
import "fake-indexeddb/auto";

import { FakeOPFSDirectory, } from "./fake-opfs.ts";

const _self = globalThis as unknown as Record<string, unknown>;

// 2. Injeta OPFS Fake no escopo do Worker
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory(),);
}

// 3. Agora que o ambiente do Worker está perfeitamente simulado,
// importamos a lógica real do banco de dados. O db.ts vai rodar
// achando que está em um browser de verdade!
import "../worker.ts";
