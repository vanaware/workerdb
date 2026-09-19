# Arquivo `CURRENT.md`

## Status Atual: Fase 1 Concluída com Sucesso

Todas as capacidades da **Fase 1: Performance & Advanced Data Capabilities** foram implementadas, testadas e integradas:

1. **Native IndexedDB Indexes & Index Operations**:
   - Criação declarativa de índices via `indexes: string[]` em `db()` e `db.ts`.
   - `getByIndex(indexName, query)`: busca indexada $O(\log N)$.
   - `getManyByIndex(indexName, queries)`: busca em lote para múltiplos valores de índice.
   - `getSomeByIndex(indexName, query, filterFn, context)`: filtra apenas o subconjunto indexado, sem carregar a base inteira em memória.
   - `queryByIndex(indexName, query, fn, context)`: agrega/transforma o subconjunto indexado dentro do Web Worker.
   - `deleteByIndex(indexName, query)`: remove todos os registros que casam com o índice em $O(\log N)$ sem ler payloads para a memória.
   - `deleteManyByIndex(indexName, queries)`: remove múltiplos grupos indexados em lote.
   - `delSomeByIndex(indexName, query, filterFn, context)`: filtra e remove registros do subconjunto indexado.
   - `setSomeByIndex(indexName, query, selectFn, updateFn, context)`: filtra e atualiza registros do subconjunto indexado com validação de esquema.

2. **Streaming OPFS API**:
   - `addFileStream(key, fileName, stream)`: gravação de arquivos grandes via `ReadableStream<Uint8Array>`.
   - `getFileStream(key, fileName)`: leitura com streaming transferível via RPC.

3. **In-Worker Schema Validation**:
   - Validador síncrono no Web Worker (`validator: (item) => boolean`) protegendo `set`, `setMany` e `patch`.

4. **Service Worker Integration & OPFS Explorer**:
   - `RUN_SW_DEMO` IPC channel via `MessageChannel` for Service Worker communication.
   - Built-in OPFS file system HTML explorer served directly by Service Worker (`/opfs/`).
   - Interactive UI Tab in Preact app with real-time Service Worker test console and direct link to OPFS explorer.

5. **PWA & CI/CD Deployment**:
   - `manifest.json` configured with relative paths (`./index.html`) for PWA installability.
   - GitHub Actions workflow (`.github/workflows/gh-pages.yml`) for automated building and subfolder deployment on GitHub Pages.
   - Cache-busting headers (`Cache-Control: no-store`) in `packages/server/src/main.ts` and automated SW unregistration recovery in `packages/ui/src/main.tsx`.

6. **Documentação & Testes**:
   - BDD unit tests em `packages/worker-db/tests/db_phase1_features_test.ts` (100% aprovados).
   - Documentação atualizada em `README.md`, `AGENTS.md` e `docs/api.md`.

7. **Melhorias Técnicas & Refatoração (Pós-Fase 1)**:
   - **Deno-Native Architecture**: Migração completa para Deno, removendo dependências Node.js locais e `node_modules`.
   - **Preact Signals**: Refatoração total da UI (`packages/ui/src/main.tsx`) para utilizar `@preact/signals` em vez de `useState`/`useEffect`, centralizando o estado em `packages/ui/src/stores/app.ts`.
   - **Cleanup de Dependências**: Consolidação de imports no `deno.jsonc` raiz e pacotes específicos, mantendo apenas dependências ativas e otimizadas (via `esm.sh` com suporte a Deno 2.x).
   - **Otimização de Utils**: Limpeza de funções utilitárias não utilizadas e migração de `id-utils` para `worker-db` com suite de testes dedicada.
   - **Internalização do `idb-keyval`**: Implementação nativa e enxuta em `packages/worker-db/src/utils/idb-keyval.ts` com tipagens completas, eliminando a dependência externa `npm:idb-keyval` e cobrindo todas as operações com testes BDD em `packages/worker-db/tests/idb-keyval.test.ts` (100% aprovados).

## Próximos Passos (Fase 2 - Planejamento)

*Aguardando definições de requisitos para a Fase 2.* Sugestões:
- Replicação Sincronizada (Sync engine básica).
- Suporte a CouchDB/PouchDB protocol.
- Interface Visual para gerenciamento de Coleções.
