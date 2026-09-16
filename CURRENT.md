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

4. **Documentação & Testes**:
   - BDD unit tests em `packages/worker-db/tests/db_phase1_features_test.ts` (100% aprovados).
   - Documentação atualizada em `README.md` e `docs/api.md`.
