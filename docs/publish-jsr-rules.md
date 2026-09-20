# Diretrizes de Documentação e Publicação no JSR

> **Nota para Agentes de IA:** Este documento define os padrões obrigatórios para documentação (README.md e JSDoc) e as regras de configuração do `deno.json` para publicação no JSR. Siga estas diretrizes rigorosamente ao gerar ou refatorar código neste repositório.

---

## 📌 Sumário

1. [Visão Geral](#-visão-geral)
2. [Padrões para o README.md](#-padrões-para-o-readmemd)
3. [Padrões para Comentários JSDoc](#-padrões-para-comentários-jsdoc)
4. [Recomendações de Uso e Qualidade](#-recomendações-de-uso-e-qualidade)
5. [Configuração de `publish: false` em Workspaces](#-configuração-de-publish-false-em-workspaces)
6. [Configuração de `publish.include` e `publish.exclude`](#-configuração-de-publishinclude-e-publishexclude)
7. [Checklist Antes de Publicar](#-checklist-antes-de-publicar)

---

## 🎯 Visão Geral

Todo pacote publicado no JSR deve ter **duas camadas de documentação**:

| Camada | Arquivo/Local | Propósito | Público-Alvo |
| :--- | :--- | :--- | :--- |
| **Guia Rápido** | `README.md` na raiz | Explicar *por que* usar o pacote e como começar. | Desenvolvedores avaliando adotar o pacote. |
| **Referência da API** | Comentários JSDoc no código | Documentar *como* usar cada símbolo exportado. | Desenvolvedores que já usam o pacote. |

Ambas as camadas impactam diretamente a **pontuação de qualidade do JSR** e a experiência do usuário final (incluindo autocompletar no editor).

---

## 📝 Padrões para o README.md

### Localização e Formato
- **Arquivo:** `README.md` 
- **Localização:** Obrigatório, na raiz do pacote, não é o mesmo README da raiz do worspace, cada pacote a ser publicado precisa de seu próprio README.
- **Sintaxe:** Markdown padrão (GFM - GitHub Flavored Markdown).
- **Idioma:** Inglês (mantenha consistência e use o mesmo idioma em toda a documentação a ser publicada).

### Estrutura Obrigatória

O README **deve** conter, no mínimo, as seguintes seções nesta ordem:

1. **Título** (`# Nome do Pacote`) — usar o nome real do pacote, sem o escopo.
2. **Descrição curta** — uma ou duas frases explicando o que o pacote faz.
3. **Instalação** — bloco de código com o comando `deno add`.
4. **Uso Básico** — **obrigatório** um bloco de código funcional mostrando import + uso real.
5. **Documentação** — link para a página do pacote no JSR (referência da API).

### Estrutura Recomendada (Adicional)

- **Features** — lista de bullets com os principais recursos.
- **API Overview** — tabela ou lista dos principais exports.
- **Exemplos Avançados** — casos de uso além do "hello world".

### Exemplo de Template

````markdown
# nome-do-pacote

Uma breve descrição de uma ou duas frases sobre o que este pacote faz.

## Instalação

```bash
deno add jsr:@seu-escopo/nome-do-pacote
```

## Uso

```ts
import { funcaoPrincipal } from "jsr:@seu-escopo/nome-do-pacote";

const resultado = funcaoPrincipal({ opcao: "valor" });
console.log(resultado);
```

## Features

- ✅ Recurso A
- ✅ Recurso B
- ✅ Recurso C

## Documentação

Para a referência completa da API, visite a
[página do pacote no JSR](https://jsr.io/@vanaware/nome-do-pacote).

````

### ⚠️ Regras Críticas
- **NUNCA** deixe o README vazio ou com apenas o título.
- **SEMPRE** inclua um bloco de código no README — o JSR usa isso para pontuar o pacote.
- **NÃO** duplique toda a documentação JSDoc aqui; o README é visão geral, não referência.

---

## 📚 Padrões para Comentários JSDoc

### Regras Gerais
- **Local:** Imediatamente acima de **cada símbolo exportado** (função, classe, interface, tipo, constante).
- **Sintaxe:** Bloco `/** ... */` com cada linha interna iniciando por `*`.
- **Idioma:** Manter o mesmo do README.
- **Obrigatoriedade:** Todo `export` **deve** ter JSDoc. Sem exceção.

### Estrutura do Bloco

1. **Resumo** (primeira linha) — frase curta e imperativa. Aparece em tooltips do editor.
2. **Descrição detalhada** (opcional) — parágrafo(s) adicional(is) com contexto.
3. **Tags** — na ordem: `@param`, `@returns`, `@throws`, `@example`, `@see`.
4. **Exemplo** — sempre que a função não for trivial.

### Exemplo Completo — Função

````ts
/**
 * Busca registros no banco de dados usando a consulta fornecida.
 *
 * Realiza normalização de entrada e aplica limite padrão quando não
 * especificado, evitando sobrecarga em consultas muito amplas.
 *
 * @param query - Consulta textual. Deve ter entre 1 e 50 caracteres.
 * @param limit - Número máximo de itens a retornar. Padrão: `20`.
 * @returns Array com os registros encontrados. Vazio se nada corresponder.
 * @throws {Error} Se `query` estiver vazia ou exceder 50 caracteres.
 *
 * @example
 * ```ts
 * const resultados = search("Deno");
 * console.log(resultados); // ["Deno", "Deno Deploy"]
 * ```
 *
 * @see {@link normalizeQuery} para detalhes da normalização.
 */
export function search(query: string, limit: number = 20): string[] {
  // ...
}
````

### Exemplo Completo — Interface / Tipo

````ts
/**
 * Opções aceitas pelo cliente HTTP.
 */
export interface ClientOptions {
  /** URL base para todas as requisições. */
  baseUrl: string;

  /** Tempo limite em milissegundos. Padrão: `5000`. */
  timeout?: number;

  /** Cabeçalhos adicionais enviados em cada requisição. */
  headers?: Record<string, string>;
}
````

### Exemplo Completo — Classe

````ts
/**
 * Cliente HTTP leve com suporte a retry automático.
 *
 * @example
 * ```ts
 * const client = new Client({ baseUrl: "https://api.example.com" });
 * const data = await client.get("/users");
 * ```
 */
export class Client {
  /**
   * Cria uma nova instância do cliente.
   *
   * @param options - Configurações do cliente.
   */
  constructor(options: ClientOptions) {
    // ...
  }

  /**
   * Executa uma requisição GET.
   *
   * @param path - Caminho relativo à `baseUrl`.
   * @returns Resposta parseada como JSON.
   */
  async get<T>(path: string): Promise<T> {
    // ...
  }
}
````

### Tags Suportadas e Quando Usar

| Tag | Uso |
| :--- | :--- |
| `@param` | Descrever **cada** parâmetro. Use `-` após o nome. |
| `@returns` | Descrever o valor de retorno (omita apenas se `void`). |
| `@throws` | Tipos e condições de erro lançados. |
| `@example` | Bloco de código executável. Sempre em cercas ` ```ts `. |
| `@see` | Referência cruzada. Combine com `{@link Symbol}`. |
| `@deprecated` | Marcar símbolos obsoletos e indicar substituto. |
| `@since` | Versão em que o símbolo foi introduzido. |

### Links Internos
Use `{@link <Símbolo>}` para criar links clicáveis entre símbolos na documentação gerada:

```ts
/**
 * Atalho para {@link Client.get} com timeout customizado.
 */
export function quickGet(path: string) { /* ... */ }
```

### ⚠️ Regras Críticas
- **NÃO** use JSDoc para comentários internos de linha — use `//`.
- **NÃO** documente símbolos não exportados (a menos que sejam úteis para contexto).
- **SEMPRE** coloque o `@example` **após** `@returns`/`@throws`.
- **NUNCA** escreva "TODO" dentro de JSDoc; use comentários normais.

---

## ✅ Recomendações de Uso e Qualidade

1. **README e JSDoc são complementares** — nunca um substitui o outro.
2. **Escreva exemplos reais** — evite `foo`/`bar`; use nomes que reflitam o domínio.
3. **Mantenha o README curto** — se passar de ~150 linhas, crie uma pasta `docs/` dentro do diretório do pacote.
4. **Valide antes de commitar:**
   ```bash
   deno doc --lint mod.ts
   ```
   Isso aponta exports sem JSDoc e tags malformadas.
5. **Valide antes de publicar:**
   ```bash
   deno publish --dry-run
   ```
   Inspecione o output para confirmar que apenas os arquivos desejados serão enviados.
6. **Atualize o JSDoc ao refatorar** — nunca deixe documentação divergente do código.
7. **Use `@deprecated`** ao invés de remover símbolos abruptamente — quebre consumidores com aviso.

---

## 🏢 Configuração de `publish: false` em Workspaces

Em um **workspace Deno** (definido por `workspace` no `deno.json` raiz), o comando `deno publish` tenta publicar **todos os membros** que possuem `name` e `exports`.

Para **excluir um membro interno** (pacotes utilitários compartilhados, ferramentas de build, etc.), defina `"publish": false` no `deno.json` desse membro.

### Estrutura Real no WorkerDB

No monorepo do WorkerDB, temos múltiplos pacotes publicados e pacotes de aplicação/infraestrutura interna:

```
/
├── deno.jsonc                 # workspace raiz
├── packages/
│   ├── worker-db/             # publicado no JSR como @vanaware/workerdb
│   │   └── deno.jsonc
│   ├── service-worker/        # publicado no JSR como @vanaware/opfs-explorer
│   │   └── deno.jsonc
│   ├── ui/                    # app frontend (publish: false)
│   │   └── deno.jsonc
│   ├── server/                # dev/prod server Deno (publish: false)
│   │   └── deno.jsonc
│   └── utils/                 # scripts de bundling/build (publish: false)
│       └── deno.jsonc
```

O workflow de CI/CD em `.github/workflows/jsr-publish.yml` executa a matriz de publicação automatizada para `packages/worker-db` e `packages/service-worker`.

### Estrutura de Exemplo Genérica

```
/
├── deno.json              # workspace raiz
├── packages/
│   ├── core/
│   │   └── deno.json      # publicado no JSR
│   ├── utils-internal/
│   │   └── deno.json      # NÃO publicado
│   └── cli/
│       └── deno.json      # publicado no JSR
```

### `deno.json` raiz (workspace)

```json
{
  "workspace": [
    "./packages/core",
    "./packages/utils-internal",
    "./packages/cli"
  ]
}
```

### `packages/core/deno.json` (publicado)

```json
{
  "name": "@seu-escopo/core",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT"
}
```
> **Importante:** Caso os campos license e version não estejam configurados no deno.jsonc (ou deno.json) do pacote, configure com o mesmo valor encontrado no deno.jsonc raiz do workspace.

### `packages/utils-internal/deno.json` (NÃO publicado)

```json
{
  "name": "@seu-escopo/utils-internal",
  "version": "0.0.0",
  "exports": "./mod.ts",
  "publish": false
}
```

> **Importante:** Mesmo com `publish: false`, o pacote ainda pode ser importado por outros membros do workspace via `jsr:@seu-escopo/utils-internal` durante o desenvolvimento. Ele apenas não será enviado ao registro.

> **Regra fundamental:** Caso alguma função do pacote que não será publicado esteja em uso por um pacote que será publicado, o desenvolvedor deverá ser alertado e uma documentação de BUG deve ser criada com todas as referidas funções que deverão ser analisadas e devidamente tratadas antes da publicação do pacote.

---

## 🗂️ Configuração de `publish.include` e `publish.exclude`

### Regras Básicas
- Os padrões são avaliados **relativos à raiz do pacote** (onde está o `deno.json` do pacote a ser publicado).
- Use **globs POSIX** com `/` como separador (funciona em Windows também).
- **`publish.include`** — lista branca. Se definido, **somente** o que casar será publicado.
- **`publish.exclude`** — lista negra. Aplicada **após** o `include`.
- Se apenas `exclude` for definido, tudo é incluído por padrão e depois filtrado.
- **NUNCA** inclua `deno.json` no `exclude` — ele é sempre publicado automaticamente.

### Globs Recomendados

#### Incluir apenas o código-fonte publicável

```json
{
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ]
  }
}
```

#### Excluir arquivos de desenvolvimento

```json
{
  "publish": {
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "tests/",
      "test/",
      "bench/",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "TODO.md",
      "CHANGELOG.md",
      ".github/",
      "*.config.ts",
      "build.ts",
      "bundle.ts",
      "deploy.ts",
      "deno.lock",
      ".gitignore"
    ]
  }
}
```

### Combinação Recomendada (Include + Exclude)

A abordagem mais segura é **combinar ambos**: um `include` restritivo que define o que é código, e um `exclude` para varrer resíduos.

```json
{
  "name": "@seu-escopo/seu-pacote",
  "version": "1.0.0",
  "exports": "./mod.ts",
  "license": "MIT",
  "publish": {
    "include": [
      "src/**/*.ts",
      "mod.ts",
      "README.md",
      "LICENSE"
    ],
    "exclude": [
      "**/*_test.ts",
      "**/*.test.ts",
      "**/*_bench.ts",
      "src/**/__mocks__/**",
      "examples/",
      "scripts/",
      "docs/",
      "planning/",
      "AGENTS.md",
      "CURRENT.md",
      "CHANGELOG.md",
      ".github/"
    ]
  }
}
```

### Mapa de Decisão: Incluir ou Excluir?

| Arquivo/Pasta | Ação | Justificativa |
| :--- | :--- | :--- |
| `src/**/*.ts` | ✅ Incluir | Código-fonte principal. |
| `mod.ts` | ✅ Incluir | Ponto de entrada principal. |
| `README.md` | ✅ Incluir | Exibido no JSR. |
| `**/*_test.ts` | ❌ Excluir | Testes não vão para o registro. |
| `tests/`, `test/` | ❌ Excluir | Idem. |
| `examples/` | ❌ Excluir | Exemplos grandes ou não-API. |
| `scripts/` | ❌ Excluir | Scripts de build/deploy. |
| `build.ts`, `bundle.ts`, `deploy.ts` | ❌ Excluir | Ferramentas de dev. |
| `docs/` | ❌ Excluir o docs da raiz pode incluir o subset do pacote | Documentação estendida da raiz do workspace fica no repo, documentação essencial reduzida do pacote pode incluir. |
| `planning/` | ❌ Excluir | Planejamento interno. |
| `AGENTS.md`, `CURRENT.md` | ❌ Excluir | Metadados para agentes de IA. |
| `CHANGELOG.md` | ⚠️ Excluir | Útil para consumidores, mas aumenta o pacote. |
| `deno.lock` | ❌ Excluir | Reconstruído pelo consumidor. |
| `.github/` | ❌ Excluir | CI/CD. |
| `deno.json` | 🚫 Nunca listar | Sempre publicado automaticamente. |

### Padrões Glob de Referência

| Padrão | Casa com |
| :--- | :--- |
| `src/**/*.ts` | Todos os `.ts` em `src/` recursivamente. |
| `**/*_test.ts` | Qualquer arquivo terminando em `_test.ts`. |
| `**/*.test.ts` | Qualquer arquivo terminando em `.test.ts`. |
| `test/` | Todo o diretório `test/`. |
| `**/__mocks__/**` | Qualquer diretório `__mocks__` em qualquer nível. |
| `scripts/**` | Tudo dentro de `scripts/`. |
| `*.config.ts` | Arquivos `.config.ts` na raiz. |

### ⚠️ Erros Comuns a Evitar
- **Não** use `./` no início dos padrões (`"./src/**"` ❌ → `"src/**"` ✅).
- **Não** use `\` como separador — sempre `/`.
- **Não** inclua `deno.json` no `exclude` — quebra a publicação.
- **Não** use `include` e `exclude` contraditórios (ex: incluir `src/**` e excluir `src/`).
- **Sempre** valide com `deno publish --dry-run` antes de publicar de verdade.

---

## ✅ Checklist Antes de Publicar

Execute na ordem:

- [ ] `deno fmt --check` — formatação consistente.
- [ ] `deno lint` — sem avisos.
- [ ] `deno check mod.ts` — sem erros de tipo.
- [ ] `deno test` — todos os testes passando.
- [ ] `deno doc --lint mod.ts` — sem exports sem JSDoc.
- [ ] `README.md` revisado e com bloco de código de exemplo.
- [ ] `deno.jsonc` com `name`, `version`, `exports`, `license` corretos.
- [ ] `publish.include` e `publish.exclude` revisados.
- [ ] `deno publish --dry-run` — inspecionar arquivos listados.
- [ ] Versão incrementada conforme SemVer, temos um script de sanitização a ser executado antes da publicação.
- [ ] `deno publish` — publicar de fato.

---

## 📎 Referências

- [Documentação oficial do JSR](https://jsr.io/docs)
- [Escrevendo documentação para JSR](https://jsr.io/docs/writing-docs)
- [Configuração `deno.jsonc`](https://docs.deno.com/runtime/fundamentals/configuration/)
- [Globs no Deno](https://docs.deno.com/runtime/fundamentals/configuration/#glob-patterns)