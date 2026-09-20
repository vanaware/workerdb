> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém os arquivos de CÓDIGO FONTE principais da aplicação exemplo (UI).
> O projeto é o **WorkerDB [v0.3.0#mua9rvo8] ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB [v0.3.0#mua9rvo8] - Modo: UI

Gerado automaticamente em: 9/20/2026, 5:30:36 PM

---

## Arquivo: `packages/ui/public/manifest.json`

```json
{
  "name": "WorkerDB PWA",
  "short_name": "WorkerDB",
  "description": "WorkerDB Offline PWA Demo",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#1a1c19",
  "theme_color": "#9edeb6",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%239edeb6'/><text x='50' y='68' font-size='50' font-family='system-ui, sans-serif' font-weight='bold' text-anchor='middle' fill='%231a1c19'>L</text></svg>",
      "sizes": "192x192 512x512",
      "type": "image/svg+xml"
    }
  ]
}

```

---

## Arquivo: `packages/ui/src/index.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>WorkerDB PWA - Demo</title>

    <!-- Web App Manifest -->
    <link rel="manifest" href="./manifest.json">

    <!-- Favicon gerado nativamente via SVG in-line -->
    <link rel="icon" type="image/svg+xml"
      href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%239edeb6'/><text x='50' y='68' font-size='50' font-family='system-ui, sans-serif' font-weight='bold' text-anchor='middle' fill='%231a1c19'>L</text></svg>">

    <!-- BeerCSS e Material Symbols -->
    <link
      href="https://cdn.jsdelivr.net/npm/beercss@3.7.12/dist/cdn/beer.min.css"
      rel="stylesheet" />
    <script type="module"
      src="https://cdn.jsdelivr.net/npm/beercss@3.7.12/dist/cdn/beer.min.js"></script>
    <script type="module"
      src="https://cdn.jsdelivr.net/npm/material-dynamic-colors@1.1.2/dist/cdn/material-dynamic-colors.min.js"></script>

    <style>
    body {
      margin: 0;
      padding: 0;
    }
    #app {
      min-height: 100vh;
    }
    pre {
      background: #111;
      color: #0f0;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
    }
    </style>
  </head>
  <body class="dark">
    <a id="iframe-warning" class="row yellow-container"
      target="_blank"
      rel="noopener"
      style="display: none; align-items: center; justify-content: center; gap: 0.25rem; padding: 6px 12px; font-size: 0.8rem; border-bottom: 1px solid var(--border); min-height: auto; text-decoration: none; cursor: pointer;">
      <i>info</i>
      <span
        style="white-space: nowrap; font-weight: 500;">Clique para sair do modo iframe</span>
    </a>

    <script>
    if (window.self !== window.top) {
      document.addEventListener("DOMContentLoaded", () => {
        const banner = document.getElementById("iframe-warning",);
        if (banner) {
          banner.href = window.location.href;
          banner.style.display = "flex";
        }
      },);
    }
    </script>

    <div id="app">
      <main class="responsive">
        <h3>Carregando aplicação...</h3>
        <progress class="circle"></progress>
      </main>
    </div>

    <!-- Arquivo gerado pelo esbuild -->
    <script type="module" src="./main.js?v=3"></script>
  </body>
</html>

```

---

## Arquivo: `packages/ui/src/stores/app.ts`

```ts
import { signal, } from "@preact/signals";

export const activeTab = signal("opfs",);

export const opfsLog = signal("",);
export const indexLog = signal("",);
export const paginationLog = signal("",);
export const swLog = signal("",);

export const addLog = (
  logSignal: { value: string },
  msg: string,
) => {
  logSignal.value += msg + "\n";
};

export const clearLog = (logSignal: { value: string },) => {
  logSignal.value = "";
};

```

---

## Arquivo: `packages/ui/src/main.tsx`

```tsx
import { render, } from "preact";
import { db, opfs, version, } from "@vanaware/workerdb";
import {
  activeTab,
  addLog,
  indexLog,
  opfsLog,
  paginationLog,
  swLog,
} from "./stores/app.ts";

if ("serviceWorker" in navigator) {
  // Dynamically resolve base path from current location (e.g. "/" for root, or "/repo-name/" for GitHub Pages)
  // Ensures any repository name or subfolder deployment works automatically without hardcoding.
  const basePath = new URL("./", globalThis.location.href,).pathname;
  const swUrl = `${basePath}sw.js`;
  const swScope = basePath;

  const registerSW = async () => {
    try {
      const reg = await navigator.serviceWorker.register(swUrl, {
        type: "module",
        scope: swScope,
      },);
      console.log("🚀 Service Worker registrado com sucesso com escopo:", reg.scope,);
    } catch (err) {
      const errStr = String(err);
      if (errStr.includes("redirect") || errStr.includes("SecurityError")) {
        console.warn(
          "⚠️ Registro do Service Worker suspenso: O ambiente de preview/proxy iframe respondeu com redirecionamento ao carregar 'sw.js'. A especificação do navegador proíbe registro de Service Worker sob redirects. Abra o app em uma nova aba para habilitar o Service Worker e o OPFS Explorer.",
          err,
        );
        addLog(
          swLog,
          "⚠️ Notice: Service Worker registration was blocked by the browser because 'sw.js' was fetched via a proxy redirect in the preview iframe.\n\nTo enable full Service Worker & OPFS Explorer support, open the app in a new browser tab or deploy to production (e.g. GitHub Pages).",
        );
      } else {
        console.warn("Falha ao registrar SW:", err);
      }
    }
  };

  registerSW();
}

const OPFSDemo = () => {
  const runTest = async () => {
    try {
      const myOpfs = opfs("WORKERDB_DATA", "files", "FS_", "demo",);
      addLog(opfsLog, "OPFS started.",);

      const fileData = new TextEncoder().encode("Hello from OPFS!",);
      await myOpfs.addFile(
        "test-file",
        new File([fileData,], "hello.txt", { type: "text/plain", },),
        "hello.txt",
      );
      addLog(opfsLog, "File added to OPFS.",);

      const file = await myOpfs.getFile("test-file", "hello.txt",);
      if (file) {
        addLog(opfsLog, "File retrieved: " + await file.text(),);
      }

      const list = await myOpfs.listFiles("test-file",);
      addLog(opfsLog, "Files list: " + list.map((f,) => f.name).join(", ",),);
    } catch (err) {
      addLog(opfsLog, "Error: " + err,);
    }
  };

  return (
    <article class="border">
      <h4>
        Origin Private File System (OPFS)
      </h4>
      <p>
        OPFS provides a high-performance, private, persistent file system
        directly in the browser. WorkerDB gives you a clean API to interact with
        it, avoiding the complexity of native file handles.
      </p>
      <pre><code>{`const myOpfs = opfs("MY_DATA", "files", "FS_");
await myOpfs.addFile("doc-id", fileBlob, "report.pdf");
const file = await myOpfs.getFile("doc-id", "report.pdf");`}
      </code></pre>
      <div class="space">
      </div>
      <nav>
        <button type="button" class="primary" onClick={runTest}>
          Run OPFS Test
        </button>
        <a
          href={`${new URL("./", globalThis.location.href,).pathname}opfs/`}
          target="_blank"
          class="button transparent"
        >
          <i>
            open_in_new
          </i>{" "}
          Open OPFS Explorer
        </a>
      </nav>
      <pre><code>{opfsLog}</code></pre>
    </article>
  );
};

const IndexQueryDemo = () => {
  const runTest = async () => {
    try {
      db.init();
      const store = db({
        dbName: "INDEX_DEMO",
        storeName: "store",
        prefix: "TEST_",
        indexes: ["role", "age", "active",],
      },);

      addLog(indexLog, "Setting up data...",);
      await store.setMany([
        ["u1", { role: "admin", age: 30, active: 1, },],
        ["u2", { role: "user", age: 25, active: 1, },],
        ["u3", { role: "user", age: 40, active: 0, },],
        ["u4", { role: "manager", age: 35, active: 1, },],
      ],);

      const count = await store.countByIndex("active", 1,);
      addLog(indexLog, "Count of active users (countByIndex): " + count,);

      const one = await store.getOneByIndex("role", "admin",);
      addLog(indexLog, "One admin (getOneByIndex): " + JSON.stringify(one,),);

      const keys = await store.keysByIndex("role", "user",);
      addLog(
        indexLog,
        "Keys of users (keysByIndex): " + JSON.stringify(keys,),
      );

      const range = await store.getByIndex("age", { gte: 30, lte: 40, },);
      addLog(indexLog, "Users age 30-40 (Range): " + JSON.stringify(range,),);

      addLog(indexLog, "Patching inactive users to active...",);
      await store.patchByIndex("active", 0, { active: 1, },);
      const newCount = await store.countByIndex("active", 1,);
      addLog(indexLog, "Count of active users after patch: " + newCount,);
    } catch (err) {
      addLog(indexLog, "Error: " + err,);
    }
  };

  return (
    <article class="border">
      <h4>
        Indexed Queries
      </h4>
      <p>
        Querying large sets of data in IndexedDB can be slow if done manually.
        WorkerDB leverages native IDB indexes for blazing fast aggregations,
        lookups, and range filters.
      </p>
      <pre><code>{`const store = db({
  dbName: "INDEX_DEMO", storeName: "store", indexes: ["role", "age"]
});

// Native Count
const count = await store.countByIndex("active", 1);

// Range Filters
const adults = await store.getByIndex("age", { gte: 18, lte: 65 });

// Atomic Patch (Update multiple records instantly)
await store.patchByIndex("active", 0, { active: 1 });`}
      </code></pre>
      <div class="space">
      </div>
      <button type="button" class="primary" onClick={runTest}>
        Run Index Test
      </button>
      <pre><code>{indexLog}</code></pre>
    </article>
  );
};

const PaginationDemo = () => {
  const runTest = async () => {
    try {
      db.init();
      const store = db({
        dbName: "PAGINATION_DEMO",
        storeName: "logs",
        prefix: "LOG_",
        indexes: ["category",],
      },);

      const items = Array.from({ length: 15, },).map((
        _,
        i,
      ) => [`l${i}`, { category: "sys", val: i, },]);
      await store.setMany(items as [string, unknown,][],);
      addLog(paginationLog, "Inserted 15 items.",);

      addLog(paginationLog, "Page 1 (Limit 5):",);
      let res = await store.getByIndexPaginated("category", "sys", {
        limit: 5,
      },);
      addLog(
        paginationLog,
        JSON.stringify(
          res.items.map((i,) => (i as unknown as Record<string, unknown>).val),
        ),
      );
      addLog(paginationLog, "Next cursor: " + res.nextCursor,);

      addLog(paginationLog, "Page 2 (Limit 5):",);
      res = await store.getByIndexPaginated("category", "sys", {
        limit: 5,
        cursor: res.nextCursor,
      },);
      addLog(
        paginationLog,
        JSON.stringify(
          res.items.map((i,) => (i as unknown as Record<string, unknown>).val),
        ),
      );
    } catch (err) {
      addLog(paginationLog, "Error: " + err,);
    }
  };

  return (
    <article class="border">
      <h4>
        Cursor-Based Pagination
      </h4>
      <p>
        Loading thousands of records at once crashes the browser. WorkerDB
        supports native cursor-based pagination, allowing you to stream records
        efficiently using{" "}
        <code>
          getByIndexPaginated
        </code>.
      </p>
      <pre><code>{`const res = await store.getByIndexPaginated("category", "sys", { limit: 5 });
console.log(res.items);

// Fetch next page using the cursor
const nextPage = await store.getByIndexPaginated("category", "sys", {
  limit: 5,
  cursor: res.nextCursor
});`}
      </code></pre>
      <div class="space">
      </div>
      <button type="button" class="primary" onClick={runTest}>
        Run Pagination Test
      </button>
      <pre><code>{paginationLog}</code></pre>
    </article>
  );
};

const SWDemo = () => {
  const runTest = () => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      addLog(
        swLog,
        "Error: Service Worker not active.\n\nNote: If you are in the AI Studio preview environment, strict redirects might prevent the Service Worker from registering correctly during development. This feature works beautifully in production (like GitHub Pages)!",
      );
      return;
    }

    addLog(swLog, "Sending 'RUN_SW_DEMO' to Service Worker...",);
    const channel = new MessageChannel();
    channel.port1.onmessage = (event,) => {
      addLog(
        swLog,
        "Response from Service Worker:\n" +
          JSON.stringify(event.data, null, 2,),
      );
    };

    navigator.serviceWorker.controller.postMessage(
      { type: "RUN_SW_DEMO", },
      [channel.port2,],
    );
  };

  return (
    <article class="border">
      <h4>
        Service Worker Backend
      </h4>
      <p>
        WorkerDB doesn't just run on the main thread or Web Workers—it runs
        seamlessly inside your{" "}
        <strong>
          Service Worker
        </strong>!
      </p>
      <p>
        This allows you to handle background syncs, push notifications, and
        offline routing while having full access to your IndexedDB and OPFS
        databases.
      </p>
      <pre><code>{`// Inside sw.ts:
const msgStore = db("WORKERDB_DATA", "messages", "MSG_");
await msgStore.set("auto", { senderId: "system_sw", ... });`}</code></pre>
      <div class="space">
      </div>
      <button type="button" class="primary" onClick={runTest}>
        Run SW Test
      </button>
      <pre><code>{swLog}</code></pre>
    </article>
  );
};

const App = () => {
  return (
    <main class="responsive">
      <h3 class="center-align">
        WorkerDB Interactive Demo
      </h3>

      <nav class="m-b-4">
        <button
          type="button"
          class={`chip ${
            activeTab.value === "opfs" ? "active" : "transparent"
          }`}
          onClick={() => activeTab.value = "opfs"}>
          <i>
            folder
          </i>
          OPFS Explorer
        </button>
        <button
          type="button"
          class={`chip ${
            activeTab.value === "index" ? "active" : "transparent"
          }`}
          onClick={() => activeTab.value = "index"}>
          <i>
            search
          </i>
          Indexed Queries
        </button>
        <button
          type="button"
          class={`chip ${
            activeTab.value === "pagination" ? "active" : "transparent"
          }`}
          onClick={() => activeTab.value = "pagination"}>
          <i>
            list
          </i>
          Pagination
        </button>
        <button
          type="button"
          class={`chip ${activeTab.value === "sw" ? "active" : "transparent"}`}
          onClick={() => activeTab.value = "sw"}>
          <i>
            memory
          </i>
          Service Worker
        </button>
      </nav>

      <div class="space">
      </div>

      {activeTab.value === "opfs" && <OPFSDemo />}
      {activeTab.value === "index" && <IndexQueryDemo />}
      {activeTab.value === "pagination" && <PaginationDemo />}
      {activeTab.value === "sw" && <SWDemo />}

      <footer class="center-align padding surface-container-highest">
        <p class="italic small-text">
          WorkerDB v{version} — Powered by Deno & Preact
        </p>
      </footer>
    </main>
  );
};

render(<App />, document.getElementById("app",)!,);

```

---

## Arquivo: `packages/ui/deno.jsonc`

```json
{
  "name": "@workerdb/ui",
  "publish": false,

  // ----------------------------------------------------------------------
  // 🔧 Compiler Options — AJUSTADO PARA DENO 2.x
  // ----------------------------------------------------------------------
  "compilerOptions": {
    "lib": [
      "dom",
      "dom.iterable",
      "dom.asynciterable",
      "esnext"
    ],
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },

  // 📦 Gerenciamento de Dependências
  "imports": {
    // Preact Core — versão fixa e canônica
    "preact": "https://esm.sh/preact@10.29.8",
    "preact/": "https://esm.sh/preact@10.29.8/",
    "preact/jsx-runtime": "https://esm.sh/preact@10.29.8/jsx-runtime",

    // Signals — mapeados explicitamente para evitar npm
    "@preact/signals": "https://esm.sh/@preact/signals@2.11.2?deps=preact@10.29.8",
    "@preact/signals-core": "https://esm.sh/@preact/signals-core@1.14.4"
  },

  // 🛠️ Scripts de Automação
  "tasks": {
    "test": "deno test --allow-env --allow-net tests/",
    "check": "deno check src/**/*.{ts,tsx} tests/**/*.ts",
    "tests": "deno task check && deno task test"
  },
  "exclude": ["public/"],
  "exports": {
    ".": "./src/mod.ts",
    "./utils": "./src/utils/mod.ts"
  }
}

```

---

