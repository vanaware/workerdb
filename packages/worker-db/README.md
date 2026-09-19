# 🗄️ WorkerDB PWA - Worker-DB

O **Worker-DB** é o coração da arquitetura _Offline-First_ do WorkerDB PWA. Ele provê uma interface unificada, tipada e de altíssima performance para interagir com as APIs de persistência nativas dos navegadores modernos (`IndexedDB`, `LocalStorage` e `Origin Private File System - OPFS`).

Para garantir que a interface de usuário (UI) nunca congele, mesmo durante operações massivas de criptografia E2EE ou I/O de arquivos pesados, **todo o processamento de banco de dados e arquivos ocorre em uma thread separada (Web Worker)**.

---

## ✨ Principais Funcionalidades

- 🧵 **Non-Blocking UI:** Proxy transparente via `postMessage`. A Thread Principal apenas despacha comandos; o Worker faz o trabalho pesado.
- 🛡️ **Isolamento por Escopos:** Bancos e _Stores_ são isolados. Além disso, suportamos `prefixos` dinâmicos para isolar chaves no mesmo store (ex: `MSG_`, `CONFIG_`).
- 🔑 **Gestão Automática de IDs:** Suporte para inserção usando `_id: "auto"`, convertendo automaticamente para UUIDs curtos e limpando prefixos nos retornos.
- 🚀 **High Performance OPFS:** Manipulação nativa de arquivos no disco do dispositivo com recuperação estrita sob demanda (evitando vazamentos de memória).
- 🗜️ **Compressão Nativa (ZIP):** Empacotamento e descompactação de pastas e arquivos no OPFS utilizando a engine `fflate` em background.

---

## 🚀 1. Instalação e Importação

O **WorkerDB** está pronto para ser utilizado em projetos Deno ou navegadores modernos. Você pode importar via JSR (recomendado) ou diretamente via GitHub.

### Via JSR (Recomendado para Deno)
```ts
// Main Thread (UI/App)
import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// Service Worker / Web Worker (Acesso Direto)
import { dbsw, opfssw } from "jsr:@vanaware/workerdb/sw";
```

### Via GitHub (Alternativa sem registro)
```ts
import { db } from "https://raw.githubusercontent.com/vanaware/workerdb/main/packages/worker-db/src/mod-main.ts";
```

---

## 📦 2. Módulo: `db()` (IndexedDB)

O `db()` é a fábrica principal para salvar objetos e metadados persistentes de forma assíncrona. Ideal para Fila de Mensagens, Contatos, e Logs E2EE.

```ts
import { db, } from "jsr:@vanaware/workerdb";

// Inicializa o Worker Global (apenas na Main Thread)
db.init();

// Cria uma instância focada (Database, Store, Prefixo)
const msgStore = db("WORKERDB_DATA", "messages", "MSG_",);

// CRUD Básico
const id = await msgStore.set("auto", { text: "Olá", status: "pending", },); // Retorna MSG_xxx
const msg = await msgStore.get(id,);
await msgStore.patch(id, { status: "sent", },);
await msgStore.delete(id,);

// Operações em Lote e Consultas Remotas no Worker
await msgStore.setSome(
  (items,) => items.filter((i,) => i.status === "pending"),
  (item,) => ({ ...item, status: "sent", }),
);

const pendingCount = await msgStore.query((items,) =>
  items.filter((i,) => i.status === "pending").length
);
```

---

## 📦 3. Módulo: `ls()` (LocalStorage)

O `ls()` segue exatamente os mesmos padrões e assinaturas do `db()`, mas de forma **síncrona** interagindo com o `localStorage`. Ideal para preferências de tema, estado de autenticação ou configurações rápidas de boot.

```ts
import { ls, } from "jsr:@vanaware/workerdb";

const prefStore = ls("WORKERDB_PREF_",);

// Uso imediato (Síncrono)
prefStore.set("config", { theme: "dark", },);
const prefs = prefStore.get("config",);

// Backups delegados ao Worker-DB (OPFS)
await prefStore.backupToOpfs("backups_prefs", "ui_config.json",);
```

---

## 📦 4. Módulo: `opfs()` (Sistema de Arquivos Nativo)

A joia da coroa. O `opfs()` **herda tudo do `db()**`, mas estende a API para manipular arquivos físicos no disco. Ele adota o padrão de **Record-Key Isolation**: cada registro do banco de dados ganha a sua própria pasta isolada no FileSystem.

### Inicialização

```ts
import { opfs, } from "jsr:@vanaware/workerdb";

// Parâmetros: DB, Store, Prefixo de ID, Sub-pasta OPFS base
const drive = opfs("WORKERDB_FILES", "attachments", "ATT_", "chats",);
```

### Upload e Listagem Leve

Para não sobrecarregar a RAM (caso uma pasta tenha dezenas de arquivos gigantes), o `listFiles` retorna apenas **metadados leves**.

```ts
const pastaMsgId = "msg_12345";

// Salvando o arquivo no Worker
await drive.addFile(pastaMsgId, fileInput.files[0], "foto.png",);

// Listagem super rápida (apenas name, size, type, lastModified)
const files = await drive.listFiles(pastaMsgId,);
files.forEach((f,) => console.log(`${f.name} - ${f.size} bytes`,));
```

### Download / Leitura Sob Demanda

O arquivo em si (o `Blob`/`File`) só cruza a ponte do Worker para a Main Thread no momento exato em que for ser exibido ou baixado pelo usuário.

```ts
const rawFile = await drive.getFile(pastaMsgId, "foto.png",);
const objectUrl = URL.createObjectURL(rawFile,);
```

### Gestão e Manipulação

```ts
await drive.renFile(pastaMsgId, "foto.png", "avatar.png",);
await drive.delFile(pastaMsgId, "avatar.png",);
await drive.mvFile(pastaMsgId, "arquivo.txt", "outra_pasta_destino",);
```

---

## 🗜️ 5. API de Compressão ZIP Integrada

Ferramentas nativas do `opfs()` para compactação pesada rodando fora da UI, essencial para rotinas de exportação massiva ou agrupamento de mídias criptografadas E2EE.

```ts
// 1. Zipar todos (ou alguns) arquivos de um registro (apagando os originais)
await drive.zip(pastaMsgId, "album.zip", ["foto1.png", "foto2.png",], true,);

// 2. Extrair um ZIP já existente na pasta do registro
await drive.unzip(pastaMsgId, "album.zip",);

// 3. Adicionar ou Excluir arquivos de dentro de um ZIP (Mutações sem extração total visível)
await drive.addZip(pastaMsgId, "album.zip", novoBlob, "foto3.png",);
await drive.delZip(pastaMsgId, "album.zip", "foto1.png",);
```

---

## 🔄 6. Backups Automáticos e Recuperação

O sistema possui uma engine unificada para fazer _dump_ de stores inteiros (tanto do IndexedDB quanto do LocalStorage) e arquivá-los em segurança no OPFS, em uma pasta global chamada `/backup`.

```ts
// Gera um snapshot e joga no disco nativo (OPFS) na subpasta /backup/minha_conta
await msgStore.backupToOpfs("minha_conta", "bkp_v1.json",);

// Lê do disco nativo, trunca o banco atual, e insere os dados restaurados
await msgStore.restoreFromOpfs("minha_conta", "bkp_v1.json", true,);
```

---

## 🚧 Roadmap da Camada de Banco

- [x] Abstração de IDB em Web Worker
- [x] Sincronia de IDs (Prefixo dinâmico, interceptação "auto")
- [x] Query, SetSome, DelSome (Cálculos de Array isolados no Worker)
- [x] OPFS Integration (Manipulação de Blobs direto para o FileSystem Nativo)
- [x] OPFS Zip Compression (Integração com `fflate`)
- [x] Otimização de Performance OPFS (`listFiles` Metadata-only vs `getFile` sob demanda)
