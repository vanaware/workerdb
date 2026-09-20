# Arquivo `CURRENT.md`

## Status Atual: Fase 1 Concluída & Pacote OPFS Explorer Publicável

Todas as capacidades da **Fase 1: Performance & Advanced Data Capabilities** e a infraestrutura dos pacotes JSR foram implementadas, testadas e integradas com sucesso:

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

4. **Pacote Independente `@vanaware/opfs-explorer` & Service Worker**:
   - Pacote dedicado em `packages/service-worker/` configurado para publicação no JSR como `@vanaware/opfs-explorer`.
   - **Subfolder Configurável**: O handler não possui mais rota hardcoded. Desenvolvedores podem passar nomes personalizados como string (`"files"`, `"arquivos"`, `"opfs"`) ou via objeto de opções `OpfsExplorerOptions`.
   - **Roteamento e Escopo Dinâmicos**: `resolveRoutePrefix` combina o escopo ativo do Service Worker (`/`, `/meu-repo/`) com o subfolder escolhido sem caminhos fixos.
   - `createOpfsFetchHandler`: helper de 1 linha para `self.addEventListener("fetch", createOpfsFetchHandler("files"))`.
   - `handleOpfsRequest`: handler manual com suporte a redirecionamento canônico 301.
   - Utilitários exportados: `listOpfsFiles`, `getFileFromOpfs`, `getEffectiveRootDir`, `getScopePath`, `normalizeOptions`.

5. **Localização Dinâmica na UI (GitHub Pages Ready)**:
   - `packages/ui/src/main.tsx` utiliza `new URL("./", globalThis.location.href).pathname` para resolver dinamicamente o caminho base, escopo do SW e links da UI, eliminando referências fixas a `/workerdb/`.
   - `packages/server/src/main.ts` limpo de fallbacks hardcoded.

6. **Publicação no JSR Automatizada**:
   - Workflow `.github/workflows/jsr-publish.yml` configurado com matriz de publicação para ambos os pacotes: `@vanaware/workerdb` e `@vanaware/opfs-explorer`.
   - Conformidade estrita com as diretrizes do JSR: JSDoc 100% documentado (`deno doc --lint` sem erros), `README.md` completo com exemplos em TypeScript e tabelas de referência de API.

7. **PWA & CI/CD Deployment**:
   - `manifest.json` com caminhos relativos (`./index.html`) para instalação PWA em qualquer subpasta.
   - GitHub Actions workflow (`.github/workflows/gh-pages.yml`) para build e deploy automatizado no GitHub Pages.
   - Headers anti-cache no dev-server e tratamento gracioso de redirecionamentos na inicialização do SW.

8. **Qualidade, Linter & BDD Test Suite**:
   - 64 testes BDD passando (269 steps) com 100% de sucesso (`deno task test`).
   - Linter (`deno lint`) 100% aprovado em todos os 38 arquivos do workspace.

## Próximos Passos (Fase 2 - Planejamento)

- **Live Queries / Subscriptions (Observe API)**: Implementação de listeners reativos (`db.subscribe(key, cb)` ou `db.watchQuery()`).
- **Bindings para Preact Signals**: Utilitários reativos para sincronizar coleções do WorkerDB diretamente com signals da UI.
- **Sincronização & Cloud**: Replicação de estado e ponte com File System Access API (`showDirectoryPicker`).

