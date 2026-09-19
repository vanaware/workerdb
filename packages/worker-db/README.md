# 🗄️ WorkerDB Core

**Asynchronous database layer for Web Workers, IndexedDB, and OPFS.**

WorkerDB provides a unified, typed, and high-performance interface to interact with native browser persistence APIs (`IndexedDB`, `LocalStorage`, and `Origin Private File System`). 

To ensure the UI never freezes, even during heavy E2EE cryptography or massive file I/O, **all database and file processing occurs in a background Web Worker.**

## ✨ Core Features

- 🧵 **Non-Blocking UI:** Transparent RPC proxy via `postMessage`.
- 🛡️ **Scope Isolation:** Database stores and record-level isolation with dynamic prefixes.
- 🔑 **Automatic ID Management:** Native support for UUID generation and short IDs.
- 🚀 **High Performance OPFS:** Direct file system manipulation with metadata-only discovery.
- 🗜️ **Native ZIP Engine:** Background compression and extraction using `fflate`.
- 🔄 **Backup & Recovery:** Integrated snapshot engine for OPFS and IndexedDB.

---

## 🚀 1. Instalação e Importação

O **WorkerDB** está pronto para ser utilizado em projetos Deno ou navegadores modernos. Você pode importar via JSR (recomendado) ou diretamente via GitHub.

### Via JSR (Recomendado para Deno)
```ts
// Main Thread (UI/App via RPC Proxy não-bloqueante)
import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// Web Worker Standalone ou Composto
import "jsr:@vanaware/workerdb/worker";
import { handleWorkerMessage } from "jsr:@vanaware/workerdb/worker";

// Service Worker / Web Worker (Acesso Direto sem RPC)
import { dbsw, opfssw } from "jsr:@vanaware/workerdb/sw";
```

---

## ⚙️ 2. Configurando o Web Worker na UI

Para garantir que a UI nunca trave durante operações intensivas de banco ou processamento de arquivos OPFS/ZIP, o `db()` e o `opfs()` na Main Thread operam como um **Proxy RPC transparente** que delega o trabalho para um Web Worker em background.

Por isso, **o seu app web precisa disponibilizar o arquivo `.js` compilado do Worker** para ser carregado pelo navegador.

### 📦 2.1 Como fazer o Bundle do Worker

Você pode empacotar o worker fornecido pelo subpath `jsr:@vanaware/workerdb/worker` de forma direta:

#### Opção A: Script com esbuild + Deno 2 (Recomendado)
Crie um script de build (ex: `build-worker.ts`):

```ts
import * as esbuild from "npm:esbuild@0.28.2";
import { denoPlugins } from "jsr:@deno/esbuild-plugin@1.2.1";

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["jsr:@vanaware/workerdb/worker"],
  outfile: "./public/worker.js",
  bundle: true,
  format: "esm",
  minify: true,
});

esbuild.stop();
console.log("✅ Worker compilado em ./public/worker.js");
```

Execute com:
```bash
deno run -A build-worker.ts
```

#### Opção B: Usando Deno 2 Bundle API (`--unstable-bundle`)
Crie um arquivo local `src/worker.ts`:
```ts
// src/worker.ts
import "jsr:@vanaware/workerdb/worker";
```

E compile para a sua pasta pública:
```bash
deno run --unstable-bundle -A ./src/worker.ts --output ./public/worker.js
```

---

### 📂 2.2 Onde Salvar o Arquivo Gerado?

Salve o arquivo bundle gerado na pasta de arquivos estáticos públicos do seu projeto (por exemplo, `./public/worker.js`, `./static/worker.js` ou `./dist/worker.js`). Ele deve ser servido como um asset estático acessível via HTTP pelo navegador.

---

### 🚀 2.3 Como Inicializar na UI

Por padrão, `db()` e `opfs()` procuram o worker no caminho relativo `./worker.js`:

```ts
import { db, opfs } from "jsr:@vanaware/workerdb";

// Inicialização com o caminho padrão ("./worker.js"):
db.init(); 
```

#### Usando outro nome ou caminho personalizado (Ex: `workerdb.min.js`):
Se você salvou o arquivo com outro nome (como `workerdb.min.js`) ou em um subdiretório (como `/assets/worker.js`), passe o caminho ou `URL` para `init()`:

```ts
import { db, opfs } from "jsr:@vanaware/workerdb";

// Caminho relativo personalizado:
db.init("./workerdb.min.js");

// Ou caminho absoluto / URL resolvida:
db.init(new URL("./assets/worker.js", import.meta.url));

// O mesmo caminho se aplica a qualquer chamada opfs:
opfs.init("./workerdb.js");
```

---

### 🧩 2.4 Composição em um Web Worker Existente

Se a sua aplicação já possui um Web Worker próprio para outras tarefas de background e você deseja unificar tudo no mesmo worker sem criar múltiplos threads, utilize a função exportada `handleWorkerMessage`:

```ts
// src/meu-app-worker.ts
import { handleWorkerMessage } from "jsr:@vanaware/workerdb/worker";

self.addEventListener("message", async (event: MessageEvent) => {
  // Comandos do WorkerDB contêm `command` e `requestId`
  if (event.data?.command && event.data?.requestId) {
    await handleWorkerMessage(event);
    return;
  }

  // Suas outras mensagens personalizadas do app:
  if (event.data?.type === "PROCESSAR_AUDIO") {
    // seu código aqui...
  }
});
```

---

## 📦 3. Módulo: `db()` (IndexedDB)

O `db()` é a fábrica principal para salvar objetos e metadados persistentes de forma assíncrona. Ideal para Fila de Mensagens, Contatos, e Logs E2EE.

```ts
import { db } from "jsr:@vanaware/workerdb";

// Inicializa o Worker Global (apenas na Main Thread)
db.init();

// Cria uma instância focada (Database, Store, Prefixo)
const msgStore = db("WORKERDB_DATA", "messages", "MSG_");

// CRUD Básico
const id = await msgStore.set("auto", { text: "Olá", status: "pending" }); // Retorna MSG_xxx
const msg = await msgStore.get(id);
await msgStore.patch(id, { status: "sent" });
await msgStore.delete(id);

// Operações em Lote e Consultas Remotas no Worker
await msgStore.setSome(
  (items) => items.filter((i) => i.status === "pending"),
  (item) => ({ ...item, status: "sent" })
);

const pendingCount = await msgStore.query((items) =>
  items.filter((i) => i.status === "pending").length
);
```

---

## 📦 4. Módulo: `ls()` (LocalStorage)

O `ls()` segue exatamente os mesmos padrões e assinaturas do `db()`, mas de forma **síncrona** interagindo com o `localStorage`. Ideal para preferências de tema, estado de autenticação ou configurações rápidas de boot.

```ts
import { ls } from "jsr:@vanaware/workerdb";

const prefStore = ls("WORKERDB_PREF_");

// Uso imediato (Síncrono)
prefStore.set("config", { theme: "dark" });
const prefs = prefStore.get("config");

// Backups delegados ao Worker-DB (OPFS)
await prefStore.backupToOpfs("backups_prefs", "ui_config.json");
```

---

## 📦 5. Módulo: `opfs()` (Sistema de Arquivos Nativo)

A joia da coroa. O `opfs()` **herda tudo do `db()`**, mas estende a API para manipular arquivos físicos no disco. Ele adota o padrão de **Record-Key Isolation**: cada registro do banco de dados ganha a sua própria pasta isolada no FileSystem.

### Inicialização

```ts
import { opfs } from "jsr:@vanaware/workerdb";

// Parâmetros: DB, Store, Prefixo de ID, Sub-pasta OPFS base
const drive = opfs("WORKERDB_FILES", "attachments", "ATT_", "chats");
```

### Upload e Listagem Leve

Para não sobrecarregar a RAM (caso uma pasta tenha dezenas de arquivos gigantes), o `listFiles` retorna apenas **metadados leves**.

```ts
const pastaMsgId = "msg_12345";

// Salvando o arquivo no Worker
await drive.addFile(pastaMsgId, fileInput.files[0], "foto.png");

// Listagem super rápida (apenas name, size, type, lastModified)
const files = await drive.listFiles(pastaMsgId);
files.forEach((f) => console.log(`${f.name} - ${f.size} bytes`));
```

### Download / Leitura Sob Demanda

O arquivo em si (o `Blob`/`File`) só cruza a ponte do Worker para a Main Thread no momento exato em que for ser exibido ou baixado pelo usuário.

```ts
const rawFile = await drive.getFile(pastaMsgId, "foto.png");
const objectUrl = URL.createObjectURL(rawFile);
```

### Gestão e Manipulação

```ts
await drive.renFile(pastaMsgId, "foto.png", "avatar.png");
await drive.delFile(pastaMsgId, "avatar.png");
await drive.mvFile(pastaMsgId, "arquivo.txt", "outra_pasta_destino");
```

---

## 🗜️ 6. API de Compressão ZIP Integrada

Ferramentas nativas do `opfs()` para compactação pesada rodando fora da UI, essencial para rotinas de exportação massiva ou agrupamento de mídias criptografadas E2EE.

```ts
// 1. Zipar todos (ou alguns) arquivos de um registro (apagando os originais)
await drive.zip(pastaMsgId, "album.zip", ["foto1.png", "foto2.png"], true);

// 2. Extrair um ZIP já existente na pasta do registro
await drive.unzip(pastaMsgId, "album.zip");

// 3. Adicionar ou Excluir arquivos de dentro de um ZIP (Mutações sem extração total visível)
await drive.addZip(pastaMsgId, "album.zip", novoBlob, "foto3.png");
await drive.delZip(pastaMsgId, "album.zip", "foto1.png");
```

---

## 🔄 7. Backups Automáticos e Recuperação

O sistema possui uma engine unificada para fazer _dump_ de stores inteiros (tanto do IndexedDB quanto do LocalStorage) e arquivá-los em segurança no OPFS, em uma pasta global chamada `/backup`.

```ts
// Gera um snapshot e joga no disco nativo (OPFS) na subpasta /backup/minha_conta
await msgStore.backupToOpfs("minha_conta", "bkp_v1.json");

// Lê do disco nativo, trunca o banco atual, e insere os dados restaurados
await msgStore.restoreFromOpfs("minha_conta", "bkp_v1.json", true);
```

---

## 🚧 8. Roadmap da Camada de Banco

- [x] Abstração de IDB em Web Worker
- [x] Sincronia de IDs (Prefixo dinâmico, interceptação "auto")
- [x] Query, SetSome, DelSome (Cálculos de Array isolados no Worker)
- [x] OPFS Integration (Manipulação de Blobs direto para o FileSystem Nativo)
- [x] OPFS Zip Compression (Integração com `fflate`)
- [x] Otimização de Performance OPFS (`listFiles` Metadata-only vs `getFile` sob demanda)
