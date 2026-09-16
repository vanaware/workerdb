// monorepo/worker-db/src/fake/fake-sw.ts
// ============================================================================
// 🔧 INJEÇÃO DE FAKE OPFS + INDEXEDDB NO SERVICE WORKER
// ============================================================================
//
// Este arquivo deve ser importado NO INÍCIO do seu service worker
// (antes de qualquer import que use db/opfs) para preparar o ambiente
// de testes/integração com OPFS e IndexedDB fakes.
//
// Diferença do fake-mod.ts (Main Thread):
// - NÃO injeta localStorage (não existe em Service Workers)
// - Injeta no escopo `self` (ServiceWorkerGlobalScope)
// - Exporta APIs diretas do db.ts (sem proxy RPC, pois o SW É o worker)
// ============================================================================

// 1. Injeta o IndexedDB Fake no escopo global do Service Worker (self)
import 'fake-indexeddb/auto';
import { FakeOPFSDirectory, } from './fake-opfs.ts';

const _self = self as Record<string, unknown>;

// 2. Injeta OPFS Fake no escopo do Service Worker
// navigator.storage.getDirectory() existe em Service Workers modernos,
// então precisamos substituí-la pela nossa versão fake em memória.
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Agora que o ambiente do Service Worker está perfeitamente simulado,
// exportamos as APIs diretas do banco de dados. O db.ts vai rodar
// achando que está em um Service Worker real do browser!
//
// ⚠️ IMPORTANTE: Importamos do db.ts (não do rpc.ts) porque o Service
// Worker NÃO precisa de um Web Worker interno - ele JÁ É um worker.
export { db, opfs, } from '../db.ts';
