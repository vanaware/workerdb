> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém experimentos e código da área de @vanaware/workerdb
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB [v0.4.1#mujy03ud] - Modo: WORKERDB

Gerado automaticamente em: 2026-09-27T15:22:02.895Z

---

## Arquivo: `packages/worker-db/README.md`

````md
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

## 🚀 1. Installation and Import

**WorkerDB** is ready for use in Deno projects or modern browsers. You can import via JSR (recommended) or directly from your package manager.

### Via JSR (Recommended for Deno)
```ts
// Main Thread (UI/App via non-blocking RPC Proxy)
import { db, opfs, ls } from "jsr:@vanaware/workerdb";

// Standalone or Composed Web Worker
import "jsr:@vanaware/workerdb/worker";
import { handleWorkerMessage } from "jsr:@vanaware/workerdb/worker";

// Service Worker / Web Worker (Direct access without RPC)
import { dbsw, opfssw } from "jsr:@vanaware/workerdb/sw";
```

---

## ⚙️ 2. Configuring the Web Worker in the UI

To ensure the UI never hangs during heavy database operations or OPFS/ZIP file processing, `db()` and `opfs()` on the Main Thread operate as a **transparent RPC Proxy** that delegates work to a background Web Worker.

For this reason, **your web application must serve the compiled Worker `.js` file** so the browser can load it.

### 📦 2.1 Bundling the Worker

You can bundle the worker provided by the `jsr:@vanaware/workerdb/worker` subpath directly:

#### Option A: Script with esbuild + Deno 2 (Recommended)
Create a build script (e.g. `build-worker.ts`):

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
console.log("✅ Worker compiled to ./public/worker.js");
```

Run with:
```bash
deno run -A build-worker.ts
```

#### Option B: Using Deno 2 Bundle API (`--unstable-bundle`)
Create a local file `src/worker.ts`:
```ts
// src/worker.ts
import "jsr:@vanaware/workerdb/worker";
```

And compile it to your public directory:
```bash
deno run --unstable-bundle -A ./src/worker.ts --output ./public/worker.js
```

---

### 📂 2.2 Where to Save the Output File

Save the generated bundle in your project's public static assets directory (for example, `./public/worker.js`, `./static/worker.js`, or `./dist/worker.js`). It must be served as an HTTP-accessible static asset by the browser.

---

### 🚀 2.3 Initializing in the UI

By default, `db()` and `opfs()` look for the worker at the relative path `./worker.js`:

```ts
import { db, opfs } from "jsr:@vanaware/workerdb";

// Initialization with the default path ("./worker.js"):
db.init(); 
```

#### Using a custom name or path (e.g. `workerdb.min.js`):
If you saved the bundle under another name (such as `workerdb.min.js`) or in a subdirectory (such as `/assets/worker.js`), pass the path or `URL` to `init()`:

```ts
import { db, opfs } from "jsr:@vanaware/workerdb";

// Custom relative path:
db.init("./workerdb.min.js");

// Or absolute path / resolved URL:
db.init(new URL("./assets/worker.js", import.meta.url));

// The same worker path is shared by opfs:
opfs.init("./workerdb.min.js");
```

---

### 🧩 2.4 Composing inside an Existing Web Worker

If your application already has its own Web Worker for other background tasks and you want to unify everything into a single worker without spawning multiple threads, use the exported `handleWorkerMessage` function:

```ts
// src/my-app-worker.ts
import { handleWorkerMessage } from "jsr:@vanaware/workerdb/worker";

self.addEventListener("message", async (event: MessageEvent) => {
  // WorkerDB commands contain `command` and `requestId`
  if (event.data?.command && event.data?.requestId) {
    await handleWorkerMessage(event);
    return;
  }

  // Your application's custom messages:
  if (event.data?.type === "PROCESS_AUDIO") {
    // your custom background logic...
  }
});
```

---

## 📦 3. Module: `db()` (IndexedDB)

`db()` is the primary factory for persisting objects and structured metadata asynchronously. Ideal for message queues, contact lists, and E2EE session logs.

```ts
import { db } from "jsr:@vanaware/workerdb";

// Initialize the Global Worker (Main Thread only)
db.init();

// Create a scoped instance (Database, Store, Prefix)
const msgStore = db("WORKERDB_DATA", "messages", "MSG_");

// Basic CRUD
const id = await msgStore.set("auto", { text: "Hello", status: "pending" }); // Returns MSG_xxx
const msg = await msgStore.get(id);
await msgStore.patch(id, { status: "sent" });
await msgStore.delete(id);

// Batch operations and remote queries executed in the Worker
await msgStore.setSome(
  (items) => items.filter((i) => i.status === "pending"),
  (item) => ({ ...item, status: "sent" })
);

const pendingCount = await msgStore.query((items) =>
  items.filter((i) => i.status === "pending").length
);
```

---

## 📦 4. Module: `ls()` (LocalStorage)

`ls()` follows the exact same patterns and signatures as `db()`, but operates **synchronously** directly against `localStorage`. Ideal for theme preferences, authentication state, or rapid boot configurations.

```ts
import { ls } from "jsr:@vanaware/workerdb";

const prefStore = ls("WORKERDB_PREF_");

// Immediate synchronous usage
prefStore.set("config", { theme: "dark" });
const prefs = prefStore.get("config");

// Asynchronous backups delegated to Worker-DB (OPFS)
await prefStore.backupToOpfs("backups_prefs", "ui_config.json");
```

---

## 📦 5. Module: `opfs()` (Origin Private File System)

The crown jewel. `opfs()` **inherits all capabilities from `db()`**, but extends the API to manage physical files on disk. It adopts the **Record-Key Isolation** pattern: each database record key is paired with its own isolated directory in the FileSystem.

### Initialization

```ts
import { opfs } from "jsr:@vanaware/workerdb";

// Parameters: DB, Store, ID Prefix, Base OPFS subfolder
const drive = opfs("WORKERDB_FILES", "attachments", "ATT_", "chats");
```

### Upload and Lightweight Listing

To avoid overloading RAM (e.g. if a directory contains dozens of large files), `listFiles` returns only **lightweight metadata**.

```ts
const msgRecordId = "msg_12345";

// Saving file in the background Worker
await drive.addFile(msgRecordId, fileInput.files[0], "photo.png");

// Ultra-fast listing (only name, size, type, lastModified)
const files = await drive.listFiles(msgRecordId);
files.forEach((f) => console.log(`${f.name} - ${f.size} bytes`));
```

### On-Demand Download / Read

The raw file content (`Blob` / `File`) only crosses the bridge from the Worker to the Main Thread when explicitly requested for display or download.

```ts
const rawFile = await drive.getFile(msgRecordId, "photo.png");
const objectUrl = URL.createObjectURL(rawFile);
```

### File Management and Manipulation

```ts
await drive.renFile(msgRecordId, "photo.png", "avatar.png");
await drive.delFile(msgRecordId, "avatar.png");
await drive.mvFile(msgRecordId, "file.txt", "other_destination_folder");
```

---

## 🗜️ 6. Integrated ZIP Compression API

Built-in native tools in `opfs()` for heavy compression running completely outside the UI thread—essential for bulk exports or archiving encrypted E2EE media.

```ts
// 1. Zip all (or selected) files in a record folder (optionally deleting originals)
await drive.zip(msgRecordId, "album.zip", ["photo1.png", "photo2.png"], true);

// 2. Unzip an existing archive in the record folder
await drive.unzip(msgRecordId, "album.zip");

// 3. Add or delete files within an existing ZIP archive
await drive.addZip(msgRecordId, "album.zip", newBlob, "photo3.png");
await drive.delZip(msgRecordId, "album.zip", "photo1.png");
```

---

## 🔄 7. Automated Backups and Recovery

The system provides a unified engine to create snapshots of entire stores (both IndexedDB and LocalStorage) and archive them securely in OPFS under a global `/backup` directory.

```ts
// Generate a snapshot and save to disk (OPFS) under /backup/my_account
await msgStore.backupToOpfs("my_account", "bkp_v1.json");

// Read from disk, truncate the current store, and restore snapshot data
await msgStore.restoreFromOpfs("my_account", "bkp_v1.json", true);
```

---

## 🚧 8. Roadmap

- [x] IndexedDB abstraction in Web Worker
- [x] ID synchronization (Dynamic prefix, "auto" interception)
- [x] Query, SetSome, DelSome (Isolated array calculations in Worker)
- [x] OPFS Integration (Blob operations directly in native FileSystem)
- [x] OPFS ZIP Compression (Powered by `fflate`)
- [x] OPFS Performance Optimization (`listFiles` metadata-only vs on-demand `getFile`)

````

---

## Arquivo: `packages/worker-db/deno.jsonc`

```json
{
  "name": "@vanaware/workerdb",
  "version": "0.4.1#mujy03ud",
  "description": "Indexeddb wrapper on Web Worker, with a simple API and a powerful query engine.",
  "author": "Vanaware",
  "license": "MIT",
  // ----------------------------------------------------------------------
  // 🔧 Compiler Options específicos do pacote
  // ----------------------------------------------------------------------
  "compilerOptions": {
    "lib": [
      "dom", 
      "dom.iterable", 
      "dom.asynciterable", 
      "esnext"
    ]
  },
  "imports": {
    "fake-indexeddb": "npm:fake-indexeddb@^6.2.5",
    "fake-indexeddb/auto": "npm:fake-indexeddb@^6.2.5/auto",
    "fflate": "npm:fflate@^0.8.3"
  },
  "tasks": {
    "test": "deno test -P",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "check": "deno check src/**/*.{ts,tsx} example/**/*.{ts,tsx} tests/**/*.ts",
    "fmt:check": "deno fmt --check",
    "lint:fix": "deno lint --fix",
    "lint:doc": "deno doc --lint src/mod-main.ts src/mod-sw.ts src/fake/fake-mod.ts src/fake/fake-db.ts",
    "tests": "deno task check && deno task lint && deno task fmt:check && deno task test",
    "demo": "deno run --allow-env --allow-read --allow-net ./example/demo.ts"
  },
  // ----------------------------------------------------------------------
  // 🎯 Exports via subpaths (Deno não suporta conditional exports)
  //
  // Uso no código fonte:
  //   - Main Thread:  import { db, opfs, ls } from "@vanaware/workerdb";
  //   - Service Worker: import { dbsw, opfssw } from "@vanaware/workerdb/sw";
  //   - Web Worker:   import { dbsw, opfssw } from "@vanaware/workerdb/sw";
  // ----------------------------------------------------------------------
  "exports": {
    // Entry point padrão — Main Thread (browser)
    // Retorna db(), opfs(), ls() com Web Worker interno para otimização
    ".": "./src/mod-main.ts",
    // Subpath para Service Worker e Web Worker
    // Retorna db(), opfs() com acesso direto (sem Web Worker interno)
    "./sw": "./src/mod-sw.ts",
    "./fake": "./src/fake/fake-mod.ts",
    "./swfake": "./src/fake/fake-db.ts",
    "./worker": "./src/worker.ts"
  },
  "publish": {
    "include": [
      "src/**/*.ts",
      "README.md",
      "docs/**/*.md",
      "dist/workerdb.min.js",
      "dist/workerdb.min.js.map",
      "deno.jsonc"
    ],
    "exclude": [
      "tests",
      "example"
    ]
  },
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["ban-untagged-todo"],
      "exclude": ["no-unused-vars"]
    },
    "include": [
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "test": {
    "permissions": {
      "read": true,
      "write": true,
      "net": true,
      "env": true,
      "sys": true,
      "run": true,
      "ffi": true,
      "import": true
    },
    "include": [
      "tests/**/*test.ts"
    ],
    "exclude": [
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}"
    ]
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 80,
    "indentWidth": 2,
    "semiColons": true,
    "singleQuote": false,
    "proseWrap": "preserve",
    "trailingCommas": "always",
    "json.trailingCommas": "never",
    "operatorPosition": "maintain",
    "jsx.bracketPosition": "sameLine",
    "jsx.forceNewLinesSurroundingContent": true,
    "jsx.multiLineParens": "always",
    "newLineKind": "lf",
    "include": [
      "example/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}",
      "tests/**/*test.ts"
    ]
  },
  "exclude": [
    "docs"
  ]
}

```

---

## Arquivo: `packages/worker-db/dist/workerdb.min.js`

```js
/*!
 * WorkerDB v0.4.1#mujy03ud
 * (c) 2026 Vanaware - MIT License
 */

var pt=Object.defineProperty;var f=(e,t)=>pt(e,"name",{value:t,configurable:!0});function j(e){return new Promise((t,n)=>{e.oncomplete=e.onsuccess=()=>t(e.result),e.onabort=e.onerror=()=>n(e.error)})}f(j,"promisifyRequest");function xt(e,t){let n,r=f(()=>{if(n)return n;let i=indexedDB.open(e);return i.onupgradeneeded=()=>i.result.createObjectStore(t),n=j(i),n.then(a=>{a.onclose=()=>{n=void 0}},()=>{n=void 0}),n},"getDB");return(i,a)=>r().then(s=>a(s.transaction(t,i).objectStore(t)))}f(xt,"createStore");var Oe;function ie(){return Oe||(Oe=xt("keyval-store","keyval")),Oe}f(ie,"defaultGetStore");function $e(e,t=ie()){return t("readonly",n=>j(n.get(e)))}f($e,"get");function Ke(e,t,n=ie()){return n("readwrite",r=>(r.put(t,e),j(r.transaction)))}f(Ke,"set");function ge(e,t=ie()){return t("readwrite",n=>(e.forEach(r=>n.put(r[1],r[0])),j(n.transaction)))}f(ge,"setMany");function Je(e,t=ie()){return t("readonly",n=>Promise.all(e.map(r=>j(n.get(r)))))}f(Je,"getMany");function et(e,t=ie()){return t("readwrite",n=>(n.delete(e),j(n.transaction)))}f(et,"del");function de(e,t=ie()){return t("readwrite",n=>(e.forEach(r=>n.delete(r)),j(n.transaction)))}f(de,"delMany");function tt(e=ie()){return e("readwrite",t=>(t.clear(),j(t.transaction)))}f(tt,"clear");function rt(e,t){return e.openCursor().onsuccess=function(){this.result&&(t(this.result),this.result.continue())},j(e.transaction)}f(rt,"eachCursor");function Ve(e=ie()){return e("readonly",t=>{if(t.getAllKeys)return j(t.getAllKeys());let n=[];return rt(t,r=>n.push(r.key)).then(()=>n)})}f(Ve,"keys");function ae(e=ie()){return e("readonly",t=>{if(t.getAll&&t.getAllKeys)return Promise.all([j(t.getAllKeys()),j(t.getAll())]).then(([r,i])=>r.map((a,s)=>[a,i[s]]));let n=[];return rt(t,r=>n.push([r.key,r.value])).then(()=>n)})}f(ae,"entries");var z=Uint8Array,G=Uint16Array,Le=Int32Array,De=new z([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),ze=new z([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),_e=new z([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),lt=f(function(e,t){for(var n=new G(31),r=0;r<31;++r)n[r]=t+=1<<e[r-1];for(var i=new Le(n[30]),r=1;r<30;++r)for(var a=n[r];a<n[r+1];++a)i[a]=a-n[r]<<5|r;return{b:n,r:i}},"freb"),ct=lt(De,2),ut=ct.b,He=ct.r;ut[28]=258,He[258]=28;var ht=lt(ze,0),mt=ht.b,nt=ht.r,Ze=new G(32768);for(E=0;E<32768;++E)se=(E&43690)>>1|(E&21845)<<1,se=(se&52428)>>2|(se&13107)<<2,se=(se&61680)>>4|(se&3855)<<4,Ze[E]=((se&65280)>>8|(se&255)<<8)>>1;var se,E,te=f((function(e,t,n){for(var r=e.length,i=0,a=new G(t);i<r;++i)e[i]&&++a[e[i]-1];var s=new G(t);for(i=1;i<t;++i)s[i]=s[i-1]+a[i-1]<<1;var o;if(n){o=new G(1<<t);var l=15-t;for(i=0;i<r;++i)if(e[i])for(var c=i<<4|e[i],h=t-e[i],u=s[e[i]-1]++<<h,d=u|(1<<h)-1;u<=d;++u)o[Ze[u]>>l]=c}else for(o=new G(r),i=0;i<r;++i)e[i]&&(o[i]=Ze[s[e[i]-1]++]>>15-e[i]);return o}),"hMap"),ce=new z(288);for(E=0;E<144;++E)ce[E]=8;var E;for(E=144;E<256;++E)ce[E]=9;var E;for(E=256;E<280;++E)ce[E]=7;var E;for(E=280;E<288;++E)ce[E]=8;var E,Ee=new z(32);for(E=0;E<32;++E)Ee[E]=5;var E,bt=te(ce,9,0),St=te(ce,9,1),It=te(Ee,5,0),Et=te(Ee,5,1),qe=f(function(e){for(var t=e[0],n=1;n<e.length;++n)e[n]>t&&(t=e[n]);return t},"max"),Q=f(function(e,t,n){var r=t/8|0;return(e[r]|e[r+1]<<8)>>(t&7)&n},"bits"),We=f(function(e,t){var n=t/8|0;return(e[n]|e[n+1]<<8|e[n+2]<<16)>>(t&7)},"bits16"),je=f(function(e){return(e+7)/8|0},"shft"),Fe=f(function(e,t,n){return(t==null||t<0)&&(t=0),(n==null||n>e.length)&&(n=e.length),new z(e.subarray(t,n))},"slc");var Ft=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],C=f(function(e,t,n){var r=new Error(t||Ft[e]);if(r.code=e,Error.captureStackTrace&&Error.captureStackTrace(r,C),!n)throw r;return r},"err"),Bt=f(function(e,t,n,r){var i=e.length,a=r?r.length:0;if(!i||t.f&&!t.l)return n||new z(0);var s=!n,o=s||t.i!=2,l=t.i;s&&(n=new z(i*3));var c=f(function(me){var be=n.length;if(me>be){var we=new z(Math.max(be*2,me));we.set(n),n=we}},"cbuf"),h=t.f||0,u=t.p||0,d=t.b||0,y=t.l,p=t.d,v=t.m,m=t.n,B=i*8;do{if(!y){h=Q(e,u,1);var N=Q(e,u+1,3);if(u+=3,N)if(N==1)y=St,p=Et,v=9,m=5;else if(N==2){var T=Q(e,u,31)+257,M=Q(e,u+10,15)+4,S=T+Q(e,u+5,31)+1;u+=14;for(var x=new z(S),O=new z(19),k=0;k<M;++k)O[_e[k]]=Q(e,u+k*3,7);u+=M*3;for(var W=qe(O),le=(1<<W)-1,Z=te(O,W,1),k=0;k<S;){var _=Z[Q(e,u,le)];u+=_&15;var I=_>>4;if(I<16)x[k++]=I;else{var $=0,A=0;for(I==16?(A=3+Q(e,u,3),u+=2,$=x[k-1]):I==17?(A=3+Q(e,u,7),u+=3):I==18&&(A=11+Q(e,u,127),u+=7);A--;)x[k++]=$}}var H=x.subarray(0,T),K=x.subarray(T);v=qe(H),m=qe(K),y=te(H,v,1),p=te(K,m,1)}else C(1);else{var I=je(u)+4,b=e[I-4]|e[I-3]<<8,P=I+b;if(P>i){l&&C(0);break}o&&c(d+b),n.set(e.subarray(I,P),d),t.b=d+=b,t.p=u=P*8,t.f=h;continue}if(u>B){l&&C(0);break}}o&&c(d+131072);for(var xe=(1<<v)-1,L=(1<<m)-1,ne=u;;ne=u){var $=y[We(e,u)&xe],R=$>>4;if(u+=$&15,u>B){l&&C(0);break}if($||C(2),R<256)n[d++]=R;else if(R==256){ne=u,y=null;break}else{var Y=R-254;if(R>264){var k=R-257,D=De[k];Y=Q(e,u,(1<<D)-1)+ut[k],u+=D}var J=p[We(e,u)&L],ye=J>>4;J||C(3),u+=J&15;var K=mt[ye];if(ye>3){var D=ze[ye];K+=We(e,u)&(1<<D)-1,u+=D}if(u>B){l&&C(0);break}o&&c(d+131072);var ve=d+Y;if(d<K){var Ne=a-K,Ae=Math.min(K,ve);for(Ne+d<0&&C(3);d<Ae;++d)n[d]=r[Ne+d]}for(;d<ve;++d)n[d]=n[d-K]}}t.l=y,t.p=ne,t.b=d,t.f=h,y&&(h=1,t.m=v,t.d=p,t.n=m)}while(!h);return d!=n.length&&s?Fe(n,0,d):n.subarray(0,d)},"inflt"),oe=f(function(e,t,n){n<<=t&7;var r=t/8|0;e[r]|=n,e[r+1]|=n>>8},"wbits"),Se=f(function(e,t,n){n<<=t&7;var r=t/8|0;e[r]|=n,e[r+1]|=n>>8,e[r+2]|=n>>16},"wbits16"),Ce=f(function(e,t){for(var n=[],r=0;r<e.length;++r)e[r]&&n.push({s:r,f:e[r]});var i=n.length,a=n.slice();if(!i)return{t:yt,l:0};if(i==1){var s=new z(n[0].s+1);return s[n[0].s]=1,{t:s,l:1}}n.sort(function(P,T){return P.f-T.f}),n.push({s:-1,f:25001});var o=n[0],l=n[1],c=0,h=1,u=2;for(n[0]={s:-1,f:o.f+l.f,l:o,r:l};h!=i-1;)o=n[n[c].f<n[u].f?c++:u++],l=n[c!=h&&n[c].f<n[u].f?c++:u++],n[h++]={s:-1,f:o.f+l.f,l:o,r:l};for(var d=a[0].s,r=1;r<i;++r)a[r].s>d&&(d=a[r].s);var y=new G(d+1),p=Re(n[h-1],y,0);if(p>t){var r=0,v=0,m=p-t,B=1<<m;for(a.sort(function(T,M){return y[M.s]-y[T.s]||T.f-M.f});r<i;++r){var N=a[r].s;if(y[N]>t)v+=B-(1<<p-y[N]),y[N]=t;else break}for(v>>=m;v>0;){var I=a[r].s;y[I]<t?v-=1<<t-y[I]++-1:++r}for(;r>=0&&v;--r){var b=a[r].s;y[b]==t&&(--y[b],++v)}p=t}return{t:new z(y),l:p}},"hTree"),Re=f(function(e,t,n){return e.s==-1?Math.max(Re(e.l,t,n+1),Re(e.r,t,n+1)):t[e.s]=n},"ln"),it=f(function(e){for(var t=e.length;t&&!e[--t];);for(var n=new G(++t),r=0,i=e[0],a=1,s=f(function(l){n[r++]=l},"w"),o=1;o<=t;++o)if(e[o]==i&&o!=t)++a;else{if(!i&&a>2){for(;a>138;a-=138)s(32754);a>2&&(s(a>10?a-11<<5|28690:a-3<<5|12305),a=0)}else if(a>3){for(s(i),--a;a>6;a-=6)s(8304);a>2&&(s(a-3<<5|8208),a=0)}for(;a--;)s(i);a=1,i=e[o]}return{c:n.subarray(0,r),n:t}},"lc"),Ie=f(function(e,t){for(var n=0,r=0;r<t.length;++r)n+=e[r]*t[r];return n},"clen"),dt=f(function(e,t,n){var r=n.length,i=je(t+2);e[i]=r&255,e[i+1]=r>>8,e[i+2]=e[i]^255,e[i+3]=e[i+1]^255;for(var a=0;a<r;++a)e[i+a+4]=n[a];return(i+4+r)*8},"wfblk"),at=f(function(e,t,n,r,i,a,s,o,l,c,h){oe(t,h++,n),++i[256];for(var u=Ce(i,15),d=u.t,y=u.l,p=Ce(a,15),v=p.t,m=p.l,B=it(d),N=B.c,I=B.n,b=it(v),P=b.c,T=b.n,M=new G(19),S=0;S<N.length;++S)++M[N[S]&31];for(var S=0;S<P.length;++S)++M[P[S]&31];for(var x=Ce(M,7),O=x.t,k=x.l,W=19;W>4&&!O[_e[W-1]];--W);var le=c+5<<3,Z=Ie(i,ce)+Ie(a,Ee)+s,_=Ie(i,d)+Ie(a,v)+s+14+3*W+Ie(M,O)+2*M[16]+3*M[17]+7*M[18];if(l>=0&&le<=Z&&le<=_)return dt(t,h,e.subarray(l,l+c));var $,A,H,K;if(oe(t,h,1+(_<Z)),h+=2,_<Z){$=te(d,y,0),A=d,H=te(v,m,0),K=v;var xe=te(O,k,0);oe(t,h,I-257),oe(t,h+5,T-1),oe(t,h+10,W-4),h+=14;for(var S=0;S<W;++S)oe(t,h+3*S,O[_e[S]]);h+=3*W;for(var L=[N,P],ne=0;ne<2;++ne)for(var R=L[ne],S=0;S<R.length;++S){var Y=R[S]&31;oe(t,h,xe[Y]),h+=O[Y],Y>15&&(oe(t,h,R[S]>>5&127),h+=R[S]>>12)}}else $=bt,A=ce,H=It,K=Ee;for(var S=0;S<o;++S){var D=r[S];if(D>255){var Y=D>>18&31;Se(t,h,$[Y+257]),h+=A[Y+257],Y>7&&(oe(t,h,D>>23&31),h+=De[Y]);var J=D&31;Se(t,h,H[J]),h+=K[J],J>3&&(Se(t,h,D>>5&8191),h+=ze[J])}else Se(t,h,$[D]),h+=A[D]}return Se(t,h,$[256]),h+A[256]},"wblk"),Nt=new Le([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),yt=new z(0),At=f(function(e,t,n,r,i,a){var s=a.z||e.length,o=new z(r+s+5*(1+Math.ceil(s/7e3))+i),l=o.subarray(r,o.length-i),c=a.l,h=(a.r||0)&7;if(t){h&&(l[0]=a.r>>3);for(var u=Nt[t-1],d=u>>13,y=u&8191,p=(1<<n)-1,v=a.p||new G(32768),m=a.h||new G(p+1),B=Math.ceil(n/3),N=2*B,I=f(function(Te){return(e[Te]^e[Te+1]<<B^e[Te+2]<<N)&p},"hsh"),b=new Le(25e3),P=new G(288),T=new G(32),M=0,S=0,x=a.i||0,O=0,k=a.w||0,W=0;x+2<s;++x){var le=I(x),Z=x&32767,_=m[le];if(v[Z]=_,m[le]=Z,k<=x){var $=s-x;if((M>7e3||O>24576)&&($>423||!c)){h=at(e,l,0,b,P,T,S,O,W,x-W,h),O=M=S=0,W=x;for(var A=0;A<286;++A)P[A]=0;for(var A=0;A<30;++A)T[A]=0}var H=2,K=0,xe=y,L=Z-_&32767;if($>2&&le==I(x-L))for(var ne=Math.min(d,$)-1,R=Math.min(32767,x),Y=Math.min(258,$);L<=R&&--xe&&Z!=_;){if(e[x+H]==e[x+H-L]){for(var D=0;D<Y&&e[x+D]==e[x+D-L];++D);if(D>H){if(H=D,K=L,D>ne)break;for(var J=Math.min(L,D-2),ye=0,A=0;A<J;++A){var ve=x-L+A&32767,Ne=v[ve],Ae=ve-Ne&32767;Ae>ye&&(ye=Ae,_=ve)}}}Z=_,_=v[Z],L+=Z-_&32767}if(K){b[O++]=268435456|He[H]<<18|nt[K];var me=He[H]&31,be=nt[K]&31;S+=De[me]+ze[be],++P[257+me],++T[be],k=x+H,++M}else b[O++]=e[x],++P[e[x]]}}for(x=Math.max(x,k);x<s;++x)b[O++]=e[x],++P[e[x]];h=at(e,l,c,b,P,T,S,O,W,x-W,h),c||(a.r=h&7|l[h/8|0]<<3,h-=7,a.h=m,a.p=v,a.i=x,a.w=k)}else{for(var x=a.w||0;x<s+c;x+=65535){var we=x+65535;we>=s&&(l[h/8|0]=c,we=s),h=dt(l,h+1,e.subarray(x,we))}a.i=s}return Fe(o,0,r+je(h)+i)},"dflt"),Dt=(function(){for(var e=new Int32Array(256),t=0;t<256;++t){for(var n=t,r=9;--r;)n=(n&1&&-306674912)^n>>>1;e[t]=n}return e})(),zt=f(function(){var e=-1;return{p:f(function(t){for(var n=e,r=0;r<t.length;++r)n=Dt[n&255^t[r]]^n>>>8;e=n},"p"),d:f(function(){return~e},"d")}},"crc");var Mt=f(function(e,t,n,r,i){if(!i&&(i={l:1},t.dictionary)){var a=t.dictionary.subarray(-32768),s=new z(a.length+e.length);s.set(a),s.set(e,a.length),e=s,i.w=a.length}return At(e,t.level==null?6:t.level,t.mem==null?i.l?Math.ceil(Math.max(8,Math.min(13,Math.log(e.length)))*1.5):20:12+t.mem,n,r,i)},"dopt"),vt=f(function(e,t){var n={};for(var r in e)n[r]=e[r];for(var r in t)n[r]=t[r];return n},"mrg");var ee=f(function(e,t){return e[t]|e[t+1]<<8},"b2"),X=f(function(e,t){return(e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24)>>>0},"b4"),Ue=f(function(e,t){return X(e,t)+X(e,t+4)*4294967296},"b8"),V=f(function(e,t,n){for(;n;++t)e[t]=n,n>>>=8},"wbytes");function kt(e,t){return Mt(e,t||{},0,0)}f(kt,"deflateSync");function Pt(e,t){return Bt(e,{i:2},t&&t.out,t&&t.dictionary)}f(Pt,"inflateSync");var wt=f(function(e,t,n,r){for(var i in e){var a=e[i],s=t+i,o=r;Array.isArray(a)&&(o=vt(r,a[1]),a=a[0]),ArrayBuffer.isView(a)?n[s]=[a,o]:(n[s+="/"]=[new z(0),o],wt(a,s,n,r))}},"fltn"),st=typeof TextEncoder<"u"&&new TextEncoder,Ye=typeof TextDecoder<"u"&&new TextDecoder,Tt=0;try{Ye.decode(yt,{stream:!0}),Tt=1}catch{}var Ot=f(function(e){for(var t="",n=0;;){var r=e[n++],i=(r>127)+(r>223)+(r>239);if(n+i>e.length)return{s:t,r:Fe(e,n-1)};i?i==3?(r=((r&15)<<18|(e[n++]&63)<<12|(e[n++]&63)<<6|e[n++]&63)-65536,t+=String.fromCharCode(55296|r>>10,56320|r&1023)):i&1?t+=String.fromCharCode((r&31)<<6|e[n++]&63):t+=String.fromCharCode((r&15)<<12|(e[n++]&63)<<6|e[n++]&63):t+=String.fromCharCode(r)}},"dutf8");function ot(e,t){if(t){for(var n=new z(e.length),r=0;r<e.length;++r)n[r]=e.charCodeAt(r);return n}if(st)return st.encode(e);for(var i=e.length,a=new z(e.length+(e.length>>1)),s=0,o=f(function(h){a[s++]=h},"w"),r=0;r<i;++r){if(s+5>a.length){var l=new z(s+8+(i-r<<1));l.set(a),a=l}var c=e.charCodeAt(r);c<128||t?o(c):c<2048?(o(192|c>>6),o(128|c&63)):c>55295&&c<57344?(c=65536+(c&1047552)|e.charCodeAt(++r)&1023,o(240|c>>18),o(128|c>>12&63),o(128|c>>6&63),o(128|c&63)):(o(224|c>>12),o(128|c>>6&63),o(128|c&63))}return Fe(a,0,s)}f(ot,"strToU8");function $t(e,t){if(t){for(var n="",r=0;r<e.length;r+=16384)n+=String.fromCharCode.apply(null,e.subarray(r,r+16384));return n}else{if(Ye)return Ye.decode(e);var i=Ot(e),a=i.s,n=i.r;return n.length&&C(8),a}}f($t,"strFromU8");var Kt=f(function(e,t){return t+30+ee(e,t+26)+ee(e,t+28)},"slzh"),Vt=f(function(e,t,n){var r=ee(e,t+28),i=ee(e,t+30),a=$t(e.subarray(t+46,t+46+r),!(ee(e,t+8)&2048)),s=t+46+r,o=qt(e,s,i,n,X(e,t+20),X(e,t+24),X(e,t+42)),l=o[0],c=o[1],h=o[2];return[ee(e,t+10),l,c,a,s+i+ee(e,t+32),h]},"zh"),qt=f(function(e,t,n,r,i,a,s){var o=i==4294967295,l=a==4294967295,c=s==4294967295,h=t+n,u=o+l+c;if(r&&u){for(;t+4<h;t+=4+ee(e,t+2))if(ee(e,t)==1)return[o?Ue(e,t+4+8*l):i,l?Ue(e,t+4):a,c?Ue(e,t+4+8*(l+o)):s,1];r<2&&C(13)}return[i,a,s,0]},"z64hs"),Ge=f(function(e){var t=0;if(e)for(var n in e){var r=e[n].length;r>65535&&C(9),t+=r+4}return t},"exfl"),ft=f(function(e,t,n,r,i,a,s,o){var l=r.length,c=n.extra,h=o&&o.length,u=Ge(c);V(e,t,s!=null?33639248:67324752),t+=4,s!=null&&(e[t++]=20,e[t++]=n.os),e[t]=20,t+=2,e[t++]=n.flag<<1|(a<0&&8),e[t++]=i&&8,e[t++]=n.compression&255,e[t++]=n.compression>>8;var d=new Date(n.mtime==null?Date.now():n.mtime),y=d.getFullYear()-1980;if((y<0||y>119)&&C(10),V(e,t,y<<25|d.getMonth()+1<<21|d.getDate()<<16|d.getHours()<<11|d.getMinutes()<<5|d.getSeconds()>>1),t+=4,a!=-1&&(V(e,t,n.crc),V(e,t+4,a<0?-a-2:a),V(e,t+8,n.size)),V(e,t+12,l),V(e,t+14,u),t+=16,s!=null&&(V(e,t,h),V(e,t+6,n.attrs),V(e,t+10,s),t+=14),e.set(r,t),t+=l,u)for(var p in c){var v=c[p],m=v.length;V(e,t,+p),V(e,t+2,m),e.set(v,t+4),t+=4+m}return h&&(e.set(o,t),t+=h),t},"wzh"),Wt=f(function(e,t,n,r,i){V(e,t,101010256),V(e,t+8,n),V(e,t+10,n),V(e,t+12,r),V(e,t+16,i)},"wzf");function Me(e,t){t||(t={});var n={},r=[];wt(e,"",n,t);var i=0,a=0;for(var s in n){var o=n[s],l=o[0],c=o[1],h=c.level==0?0:8,u=ot(s),d=u.length,y=c.comment,p=y&&ot(y),v=p&&p.length,m=Ge(c.extra);d>65535&&C(11);var B=h?kt(l,c):l,N=B.length,I=zt();I.p(l),r.push(vt(c,{size:l.length,crc:I.d(),c:B,f:u,m:p,u:d!=s.length||p&&y.length!=v,o:i,compression:h})),i+=30+d+m+N,a+=76+2*(d+m)+(v||0)+N}for(var b=new z(a+22),P=i,T=a-i,M=0;M<r.length;++M){var u=r[M];ft(b,u.o,u,u.f,u.u,u.c.length);var S=30+u.f.length+Ge(u.extra);b.set(u.c,u.o+S),ft(b,i,u,u.f,u.u,u.c.length,u.o,u.m),i+=16+S+(u.m?u.m.length:0)}return Wt(b,i,r.length,T,P),b}f(Me,"zipSync");function ke(e,t){for(var n={},r=e.length-22;X(e,r)!=101010256;--r)(!r||e.length-r>65558)&&C(13);var i=ee(e,r+8);if(!i)return{};var a=X(e,r+16),s=X(e,r-20)==117853008;if(s){var o=X(e,r-12);s=X(e,o)==101075792,s&&(i=X(e,o+32),a=X(e,o+48))}for(var l=t&&t.filter,c=0;c<i;++c){var h=Vt(e,a,s),u=h[0],d=h[1],y=h[2],p=h[3],v=h[4],m=h[5],B=Kt(e,m);a=v,(!l||l({name:p,size:d,originalSize:y,compression:u}))&&(u?u==8?n[p]=Pt(e.subarray(B,B+d),{out:new z(y)}):C(14,"unknown compression type "+u):n[p]=Fe(e,B,B+d))}return n}f(ke,"unzipSync");function fe(){if(typeof crypto<"u"&&crypto.getRandomValues){let e=new Uint8Array(12);return crypto.getRandomValues(e),Array.from(e,t=>t.toString(16).padStart(2,"0")).join("").substring(0,12)}return Ct()}f(fe,"gerarId");function Ct(){return Date.now().toString(36)+Math.random().toString(36).substring(2,8)}f(Ct,"gerarIdFallback");function Pe(e){return`${e}${fe()}`}f(Pe,"gerarIdComPrefixo");function re(e,t,n=""){if(!t||typeof t!="object"||Array.isArray(t))return t;let r=String(e);return{_id:n&&r.startsWith(n)?r.slice(n.length):r,...t}}f(re,"formatDbItem");function ue(e,t,n=""){let r=t&&typeof t=="object"&&!Array.isArray(t)?t._id:void 0;r==="auto"&&(r=fe());let i=e==="auto"?fe():e,a=i||"";if(r?n&&r.startsWith(n)?a=r:a=n?`${n}${r}`:r:i&&(n&&i.startsWith(n)?a=i:a=n?`${n}${i}`:i),!a)throw new Error("A key or an '_id' attribute on the object must be provided.");if(t&&typeof t=="object"&&!Array.isArray(t)&&"_id"in t){let{_id:s,...o}=t;return{key:a,cleanVal:o}}return{key:a,cleanVal:t}}f(ue,"prepareForSave");function he(e){if(e==null)throw new Error("Query cannot be null");if(typeof e!="object"||e instanceof Date||Array.isArray(e)||e instanceof ArrayBuffer||"lower"in e||"upper"in e)return e;let t=e;if(t.eq!==void 0)return IDBKeyRange.only(t.eq);if((t.gt!==void 0||t.gte!==void 0)&&(t.lt!==void 0||t.lte!==void 0)){let n=t.gt!==void 0?t.gt:t.gte,r=t.lt!==void 0?t.lt:t.lte;return IDBKeyRange.bound(n,r,t.gt!==void 0,t.lt!==void 0)}return t.gt!==void 0||t.gte!==void 0?IDBKeyRange.lowerBound(t.gt!==void 0?t.gt:t.gte,t.gt!==void 0):t.lt!==void 0||t.lte!==void 0?IDBKeyRange.upperBound(t.lt!==void 0?t.lt:t.lte,t.lt!==void 0):e}f(he,"buildIDBQuery");var Xe=new Map;function Ut(e,t,n,r){let i=indexedDB.open(e,r);i.onupgradeneeded=()=>{let s=i.result;if(s.objectStoreNames.contains(t)){if(n){let o=i.transaction.objectStore(t);for(let l of n)o.indexNames.contains(l)||o.createIndex(l,l)}}else{let o=s.createObjectStore(t);if(n)for(let l of n)o.createIndex(l,l)}};let a=new Promise((s,o)=>{i.onsuccess=()=>s(i.result),i.onerror=()=>o(i.error)});return(s,o)=>a.then(l=>o(l.transaction(t,s).objectStore(t)))}f(Ut,"createStoreWithIndexes");function F(e,t="keyval",n,r){if(!e)return;let i=`${e}:${t}:${r||1}`;return Xe.has(i)||Xe.set(i,Ut(e,t,n,r)),Xe.get(i)}f(F,"getCustomStore");function Be(e,t){let n=e;return t&&(n=n.filter(([r])=>typeof r=="string"&&r.startsWith(t))),n.map(([r,i])=>re(r,i,t))}f(Be,"formatDbEntries");async function U(e="",t,n=!1){let r=await navigator.storage.getDirectory(),a=(e?`${e}/${t}`:t).split("/").filter(Boolean),s=r;for(let o of a)s=await s.getDirectoryHandle(o,{create:n});return s}f(U,"getRecordDir");function pe(e,t,n){if(e===void 0)return;if(n){if(!n(e))throw new Error(`Validation failed for item: ${JSON.stringify(e)}`);return}if(!t)return;if(!new Function("val",`return (${t})(val);`)(e))throw new Error(`Validation failed for item: ${JSON.stringify(e)}`)}f(pe,"validateDbItem");var w={get:f(async(e,t)=>{let n=F(t?.dbName,t?.storeName,t?.indexes,t?.dbVersion),r=t?.prefix&&!e.startsWith(t.prefix)?`${t.prefix}${e}`:e,i=await $e(r,n);return i!==void 0?re(r,i,t?.prefix):void 0},"get"),set:f(async(e,t,n)=>{let r,i,a=n||{};typeof e!="string"?(r=void 0,i=e,t&&(a=t)):(r=e,i=t);let s=F(a.dbName,a.storeName,a.indexes,a.dbVersion),{key:o,cleanVal:l}=ue(r,i,a.prefix);return pe(l,a.validatorStr,a.validator),await Ke(o,l,s),o},"set"),update:f(async(e,t,n)=>{let r=await w.get(e,n),i=t(r);await w.set(e,i,n)},"update"),patch:f(async(e,t,n,r)=>{let i=F(r?.dbName,r?.storeName,r?.indexes,r?.dbVersion),a=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,s=await $e(a,i)||{},o;typeof t=="function"?o=t(re(a,s,r?.prefix),n):o=Object.assign({},s,t);let{key:l,cleanVal:c}=ue(a,o,r?.prefix);return pe(c,r?.validatorStr,r?.validator),await Ke(l,c,i),re(l,c,r?.prefix)},"patch"),delete:f(async(e,t)=>{let n=F(t?.dbName,t?.storeName,t?.indexes,t?.dbVersion),r=t?.prefix&&!e.startsWith(t.prefix)?`${t.prefix}${e}`:e;await et(r,n)},"delete"),getMany:f(async(e,t)=>{let n=F(t?.dbName,t?.storeName,t?.indexes,t?.dbVersion),r=e.map(a=>t?.prefix&&!a.startsWith(t.prefix)?`${t.prefix}${a}`:a);return(await Je(r,n)).map((a,s)=>a!==void 0?re(r[s],a,t?.prefix):void 0)},"getMany"),setMany:f(async(e,t)=>{let n=F(t?.dbName,t?.storeName,t?.indexes,t?.dbVersion),r=e.map(([i,a])=>{let{key:s,cleanVal:o}=ue(i,a,t?.prefix);return pe(o,t?.validatorStr,t?.validator),[s,o]});await ge(r,n)},"setMany"),deleteMany:f(async(e,t)=>{let n=F(t?.dbName,t?.storeName,t?.indexes,t?.dbVersion),r=e.map(i=>t?.prefix&&!i.startsWith(t.prefix)?`${t.prefix}${i}`:i);await de(r,n)},"deleteMany"),keys:f(async e=>{let t=F(e?.dbName,e?.storeName,e?.indexes,e?.dbVersion),n=await Ve(t);return e?.prefix?n.filter(r=>typeof r=="string"&&r.startsWith(e.prefix)):n},"keys"),values:f(async e=>{let t=F(e?.dbName,e?.storeName,e?.indexes,e?.dbVersion),n=await ae(t);return Be(n,e?.prefix)},"values"),entries:f(async e=>{let t=F(e?.dbName,e?.storeName,e?.indexes,e?.dbVersion),n=await ae(t);return e?.prefix?n.filter(([r])=>typeof r=="string"&&r.startsWith(e.prefix)):n},"entries"),clear:f(async e=>{let t=F(e?.dbName,e?.storeName,e?.indexes,e?.dbVersion);if(e?.prefix){let r=(await Ve(t)).filter(i=>typeof i=="string"&&i.startsWith(e.prefix));await de(r,t)}else await tt(t)},"clear"),countByIndex:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");return await r("readonly",i=>new Promise((a,s)=>{try{let o=i.index(e),l=t!==void 0?o.count(he(t)):o.count();l.onsuccess=()=>a(l.result),l.onerror=()=>s(l.error)}catch(o){s(o)}}))},"countByIndex"),getOneByIndex:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");return await r("readonly",i=>new Promise((a,s)=>{try{let o=i.index(e),l=he(t),c=o.get(l),h=o.getKey(l),u,d,y=!1,p=!1,v=f(()=>{y&&p&&a(u!==void 0&&d!==void 0?re(String(d),u,n?.prefix):void 0)},"checkDone");c.onsuccess=()=>{u=c.result,y=!0,v()},c.onerror=()=>s(c.error),h.onsuccess=()=>{d=h.result,p=!0,v()},h.onerror=()=>s(h.error)}catch(o){s(o)}}))},"getOneByIndex"),keysByIndex:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");return await r("readonly",i=>new Promise((a,s)=>{try{let l=i.index(e).getAllKeys(he(t));l.onsuccess=()=>{let c=l.result.map(h=>String(h));a(c)},l.onerror=()=>s(l.error)}catch(o){s(o)}}))},"keysByIndex"),patchByIndex:f(async(e,t,n,r)=>{await w.setSomeByIndex(e,t,i=>i,(i,a)=>Object.assign({},i,a),n,r)},"patchByIndex"),getByIndexPaginated:f(async(e,t,n,r)=>{let i=F(r?.dbName,r?.storeName,r?.indexes,r?.dbVersion);if(!i)throw new Error("dbName or storeName is required to query indexes");return await i("readonly",a=>new Promise((s,o)=>{try{let l=a.index(e),c=he(t),h=n.direction||"next",u=n.limit||50,d=[],y=l.openCursor(c,h),p=!1,v,m;if(n.cursor)try{let I=JSON.parse(n.cursor);v=I[0],m=I[1]}catch{}let B,N;y.onsuccess=I=>{let b=I.target.result;if(!b){s({items:d,nextCursor:d.length>0&&B!==void 0&&N!==void 0?JSON.stringify([B,N]):void 0});return}if(!p&&v!==void 0&&m!==void 0&&(p=!0,b.continuePrimaryKey)){b.continuePrimaryKey(v,m);return}if(p&&m!==void 0&&b.primaryKey===m&&b.key===v){m=void 0,b.continue();return}if(!p&&m!==void 0){b.primaryKey===m&&b.key===v&&(p=!0,m=void 0),b.continue();return}d.push(re(String(b.primaryKey),b.value,r?.prefix)),B=b.key,N=b.primaryKey,d.length>=u?s({items:d,nextCursor:JSON.stringify([B,N])}):b.continue()},y.onerror=()=>o(y.error)}catch(l){o(l)}}))},"getByIndexPaginated"),getByIndex:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");return await r("readonly",i=>new Promise((a,s)=>{try{let o=i.index(e),l=he(t),c=o.getAll(l),h=o.getAllKeys(l),u=null,d=null,y=f(()=>{if(u!==null&&d!==null){let p=u.map((v,m)=>re(String(d[m]),v,n?.prefix));a(p)}},"checkDone");c.onsuccess=()=>{u=c.result,y()},c.onerror=()=>s(c.error),h.onsuccess=()=>{d=h.result,y()},h.onerror=()=>s(h.error)}catch(o){s(o)}}))},"getByIndex"),getManyByIndex:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");return await r("readonly",i=>new Promise((a,s)=>{try{let o=i.index(e),l=new Map;if(t.length===0)return a([]);let c=0;for(let h of t){let u=he(h),d=o.getAll(u),y=o.getAllKeys(u),p=null,v=null,m=f(()=>{p!==null&&v!==null&&(p.forEach((B,N)=>{let I=String(v[N]);l.has(I)||l.set(I,re(I,B,n?.prefix))}),c++,c===t.length&&a(Array.from(l.values())))},"check");d.onsuccess=()=>{p=d.result,m()},d.onerror=()=>s(d.error),y.onsuccess=()=>{v=y.result,m()},y.onerror=()=>s(y.error)}}catch(o){s(o)}}))},"getManyByIndex"),getSomeByIndex:f(async(e,t,n,r,i)=>{let a=await w.getByIndex(e,t,i),s=n(a,r);if(!Array.isArray(s))throw new Error("The injected function in GET_SOME_BY_INDEX must return an Array.");return s},"getSomeByIndex"),queryByIndex:f(async(e,t,n,r,i)=>{let a=await w.getByIndex(e,t,i);return n(a,r)},"queryByIndex"),deleteByIndex:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");let i=await r("readonly",a=>new Promise((s,o)=>{try{let c=a.index(e).getAllKeys(he(t));c.onsuccess=()=>{s(c.result.map(h=>String(h)))},c.onerror=()=>o(c.error)}catch(l){o(l)}}));i.length>0&&await de(i,r)},"deleteByIndex"),deleteManyByIndex:f(async(e,t,n)=>{if(t.length===0)return;let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);if(!r)throw new Error("dbName or storeName is required to query indexes");let i=await r("readonly",a=>new Promise((s,o)=>{try{let l=a.index(e),c=new Set,h=0;for(let u of t){let d=l.getAllKeys(he(u));d.onsuccess=()=>{for(let y of d.result)c.add(String(y));h++,h===t.length&&s(Array.from(c))},d.onerror=()=>o(d.error)}}catch(l){o(l)}}));i.length>0&&await de(i,r)},"deleteManyByIndex"),delSomeByIndex:f(async(e,t,n,r,i)=>{let a=F(i?.dbName,i?.storeName,i?.indexes,i?.dbVersion),s=await w.getByIndex(e,t,i),o=n(s,r);if(!Array.isArray(o))throw new Error("The injected function in DEL_SOME_BY_INDEX must return an Array.");let l=o.map(c=>{if(!c||c._id===void 0)throw new Error("Items returned in DEL_SOME_BY_INDEX must contain an '_id' property.");return i?.prefix&&!c._id.startsWith(i.prefix)?`${i.prefix}${c._id}`:c._id});l.length>0&&await de(l,a)},"delSomeByIndex"),setSomeByIndex:f(async(e,t,n,r,i,a)=>{let s=F(a?.dbName,a?.storeName,a?.indexes,a?.dbVersion),o=await w.getByIndex(e,t,a),l=n(o,i);if(!Array.isArray(l))throw new Error("The selector function in SET_SOME_BY_INDEX must return an Array.");let c=l.map(h=>{if(!h||h._id===void 0)throw new Error("Items selected in SET_SOME_BY_INDEX must contain an '_id' property.");let u=r(h,i),{key:d,cleanVal:y}=ue(void 0,u,a?.prefix);return pe(y,a?.validatorStr,a?.validator),[d,y]});c.length>0&&await ge(c,s)},"setSomeByIndex"),query:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion),i=await ae(r),a=Be(i,n?.prefix);return e(a,t)},"query"),getSome:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion),i=await ae(r),a=Be(i,n?.prefix),s=e(a,t);if(!Array.isArray(s))throw new Error("The injected function in GET_SOME must return an Array.");return s},"getSome"),delSome:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion),i=await ae(r),a=Be(i,n?.prefix),s=e(a,t);if(!Array.isArray(s))throw new Error("The injected function in DEL_SOME must return an Array.");let o=s.map(l=>{if(!l||l._id===void 0)throw new Error("Items returned in DEL_SOME must contain an '_id' property.");return n?.prefix&&!l._id.startsWith(n.prefix)?`${n.prefix}${l._id}`:l._id});await de(o,r)},"delSome"),setSome:f(async(e,t,n,r)=>{let i=F(r?.dbName,r?.storeName,r?.indexes,r?.dbVersion),a=await ae(i),s=Be(a,r?.prefix),o=e(s,n);if(!Array.isArray(o))throw new Error("The selector function in SET_SOME must return an Array.");let l=o.map(c=>{if(!c||c._id===void 0)throw new Error("Items selected in SET_SOME must contain an '_id' property.");let h=t(c,n),{key:u,cleanVal:d}=ue(void 0,h,r?.prefix);return pe(d,r?.validatorStr,r?.validator),[u,d]});await ge(l,i)},"setSome"),exportDB:f(async e=>{let t=F(e?.dbName,e?.storeName,e?.indexes,e?.dbVersion),n=await ae(t),r=e?.prefix?n.filter(([i])=>typeof i=="string"&&i.startsWith(e.prefix)):n;return Object.fromEntries(r)},"exportDB"),importDB:f(async(e,t=!1,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion);t&&await w.clear(n);let i=Object.entries(e).map(([a,s])=>{let{key:o,cleanVal:l}=ue(a,s,n?.prefix);return pe(l,n?.validatorStr,n?.validator),[o,l]});await ge(i,r)},"importDB"),backupToOpfs:f(async(e,t,n)=>{let r=F(n?.dbName,n?.storeName,n?.indexes,n?.dbVersion),i=await ae(r),a=n?.prefix?i.filter(([d])=>typeof d=="string"&&d.startsWith(n.prefix)):i,s=Object.fromEntries(a),o=t||"backup.json",l=n?.prefix&&!e.startsWith(n.prefix)?`${n.prefix}${e}`:e,u=await(await(await U("backup",l,!0)).getFileHandle(o,{create:!0})).createWritable();return await u.write(new Blob([JSON.stringify(s)],{type:"application/json"})),await u.close(),`${l}/${o}`},"backupToOpfs"),restoreFromOpfs:f(async(e,t,n=!1,r)=>{let i=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,a=await U("backup",i,!1),s=t.includes("/")?t.split("/").pop():t,l=await(await a.getFileHandle(s)).getFile(),c=JSON.parse(await l.text()),h=F(r?.dbName,r?.storeName,r?.indexes,r?.dbVersion);n&&await w.clear(r);let u=Object.entries(c).map(([d,y])=>{let{key:p,cleanVal:v}=ue(d,y,r?.prefix);return[p,v]});await ge(u,h)},"restoreFromOpfs"),init:f(e=>{},"init"),restart:f(()=>{},"restart"),terminate:f(()=>{},"terminate"),gerarId:fe,gerarIdComPrefixo:f(e=>Pe(e||""),"gerarIdComPrefixo")},q={...w,listFiles:f(async(e,t)=>{let n=t?.prefix&&!e.startsWith(t.prefix)?`${t.prefix}${e}`:e,r=await U(t?.basePath,n,!0),i=[];for await(let[a,s]of r.entries())if(s.kind==="file"){let o=await s.getFile();i.push({name:a,size:o.size,type:o.type,lastModified:o.lastModified})}return i},"listFiles"),getFile:f(async(e,t,n)=>{let r=n?.prefix&&!e.startsWith(n.prefix)?`${n.prefix}${e}`:e;return await(await(await U(n?.basePath,r,!1)).getFileHandle(t)).getFile()},"getFile"),getFileStream:f(async(e,t,n)=>{let r=n?.prefix&&!e.startsWith(n.prefix)?`${n.prefix}${e}`:e;return(await(await(await U(n?.basePath,r,!1)).getFileHandle(t)).getFile()).stream()},"getFileStream"),addFile:f(async(e,t,n,r)=>{let i=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,o=await(await(await U(r?.basePath,i,!0)).getFileHandle(n,{create:!0})).createWritable();await o.write(new Blob([await t.arrayBuffer()])),await o.close()},"addFile"),addFileStream:f(async(e,t,n,r)=>{let i,a;typeof t=="string"?(a=t,i=n):(i=t,a=n);let s=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,c=await(await(await U(r?.basePath,s,!0)).getFileHandle(a,{create:!0})).createWritable(),h=i.getReader();try{for(;;){let{done:u,value:d}=await h.read();if(u)break;d&&await c.write(d)}}finally{h.releaseLock()}await c.close()},"addFileStream"),delFile:f(async(e,t,n)=>{let r=n?.prefix&&!e.startsWith(n.prefix)?`${n.prefix}${e}`:e;await(await U(n?.basePath,r,!1)).removeEntry(t)},"delFile"),renFile:f(async(e,t,n,r)=>{let i=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,a=await U(r?.basePath,i,!1),o=await(await a.getFileHandle(t)).getFile(),c=await(await a.getFileHandle(n,{create:!0})).createWritable();await c.write(new Blob([await o.arrayBuffer()])),await c.close(),await a.removeEntry(t)},"renFile"),mvFile:f(async(e,t,n,r)=>{let i=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,a=await U(r?.basePath,i,!1),o=await(await a.getFileHandle(t)).getFile(),l=r?.prefix&&!n.startsWith(r.prefix)?`${r.prefix}${n}`:n,u=await(await(await U(r?.basePath,l,!0)).getFileHandle(t,{create:!0})).createWritable();await u.write(new Blob([await o.arrayBuffer()])),await u.close(),await a.removeEntry(t)},"mvFile"),zip:f(async(e,t,n,r=!1,i)=>{let a=i?.prefix&&!e.startsWith(i.prefix)?`${i.prefix}${e}`:e,s=await U(i?.basePath,a,!1),o={};for await(let[u,d]of s.entries())if(d.kind==="file"&&(!n||n.includes(u))){let y=await d.getFile();o[u]=new Uint8Array(await y.arrayBuffer())}let l=Me(o),h=await(await s.getFileHandle(t,{create:!0})).createWritable();if(await h.write(new Blob([l])),await h.close(),r)for(let u of Object.keys(o))await s.removeEntry(u)},"zip"),unzip:f(async(e,t,n=!1,r)=>{let i=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,a=await U(r?.basePath,i,!1),s=await a.getFileHandle(t),o=new Uint8Array(await(await s.getFile()).arrayBuffer()),l=ke(o);for(let[c,h]of Object.entries(l))if(!c.includes("/")){let d=await(await a.getFileHandle(c,{create:!0})).createWritable();await d.write(new Blob([h])),await d.close()}n&&await a.removeEntry(t)},"unzip"),addZip:f(async(e,t,n,r,i)=>{let a=i?.prefix&&!e.startsWith(i.prefix)?`${i.prefix}${e}`:e,o=await(await U(i?.basePath,a,!1)).getFileHandle(t),l=new Uint8Array(await(await o.getFile()).arrayBuffer()),c=ke(l);c[r]=new Uint8Array(await n.arrayBuffer());let h=Me(c),u=await o.createWritable();await u.write(new Blob([h])),await u.close()},"addZip"),delZip:f(async(e,t,n,r)=>{let i=r?.prefix&&!e.startsWith(r.prefix)?`${r.prefix}${e}`:e,s=await(await U(r?.basePath,i,!1)).getFileHandle(t),o=new Uint8Array(await(await s.getFile()).arrayBuffer()),l=ke(o);delete l[n];let c=Me(l),h=await s.createWritable();await h.write(new Blob([c])),await h.close()},"delZip")},g=q;function gt(e,t="keyval",n="",r){let i;return typeof e=="object"&&e!==null?i={...e}:i={dbName:e,storeName:t,prefix:n,...r},{get:f(a=>w.get(a,i),"get"),set:f((a,s)=>w.set(a,s,i),"set"),update:f((a,s)=>w.update(a,s,i),"update"),patch:f((a,s,o)=>w.patch(a,s,o,i),"patch"),delete:f(a=>w.delete(a,i),"delete"),getMany:f(a=>w.getMany(a,i),"getMany"),setMany:f(a=>w.setMany(a,i),"setMany"),deleteMany:f(a=>w.deleteMany(a,i),"deleteMany"),keys:f(()=>w.keys(i),"keys"),values:f(()=>w.values(i),"values"),entries:f(()=>w.entries(i),"entries"),clear:f(()=>w.clear(i),"clear"),countByIndex:f((a,s)=>w.countByIndex(a,s,i),"countByIndex"),getOneByIndex:f((a,s)=>w.getOneByIndex(a,s,i),"getOneByIndex"),keysByIndex:f((a,s)=>w.keysByIndex(a,s,i),"keysByIndex"),patchByIndex:f((a,s,o)=>w.patchByIndex(a,s,o,i),"patchByIndex"),getByIndexPaginated:f((a,s,o)=>w.getByIndexPaginated(a,s,o,i),"getByIndexPaginated"),getByIndex:f((a,s)=>w.getByIndex(a,s,i),"getByIndex"),getManyByIndex:f((a,s)=>w.getManyByIndex(a,s,i),"getManyByIndex"),getSomeByIndex:f((a,s,o,l)=>w.getSomeByIndex(a,s,o,l,i),"getSomeByIndex"),queryByIndex:f((a,s,o,l)=>w.queryByIndex(a,s,o,l,i),"queryByIndex"),deleteByIndex:f((a,s)=>w.deleteByIndex(a,s,i),"deleteByIndex"),deleteManyByIndex:f((a,s)=>w.deleteManyByIndex(a,s,i),"deleteManyByIndex"),delSomeByIndex:f((a,s,o,l)=>w.delSomeByIndex(a,s,o,l,i),"delSomeByIndex"),setSomeByIndex:f((a,s,o,l,c)=>w.setSomeByIndex(a,s,o,l,c,i),"setSomeByIndex"),query:f((a,s)=>w.query(a,s,i),"query"),getSome:f((a,s)=>w.getSome(a,s,i),"getSome"),delSome:f((a,s)=>w.delSome(a,s,i),"delSome"),setSome:f((a,s,o)=>w.setSome(a,s,o,i),"setSome"),exportDB:f(()=>w.exportDB(i),"exportDB"),importDB:f((a,s=!1)=>w.importDB(a,s,i),"importDB"),backupToOpfs:f((a,s)=>w.backupToOpfs(a,s,i),"backupToOpfs"),restoreFromOpfs:f((a,s,o=!1)=>w.restoreFromOpfs(a,s,o,i),"restoreFromOpfs"),init:f(a=>w.init(a),"init"),restart:f(()=>w.restart(),"restart"),terminate:f(()=>w.terminate(),"terminate"),gerarId:fe,gerarIdComPrefixo:f(()=>i.prefix?Pe(i.prefix):fe(),"gerarIdComPrefixo")}}f(gt,"createScopedDb");function _t(e,t="keyval",n="",r="",i){let a;return typeof e=="object"&&e!==null?a={...e}:a={dbName:e,storeName:t,prefix:n,basePath:r,...i},{...gt(a),listFiles:f(s=>q.listFiles(s,a),"listFiles"),getFile:f((s,o)=>q.getFile(s,o,a),"getFile"),getFileStream:f((s,o)=>q.getFileStream(s,o,a),"getFileStream"),addFile:f((s,o,l)=>q.addFile(s,o,l,a),"addFile"),addFileStream:f((s,o,l)=>q.addFileStream(s,o,l,a),"addFileStream"),delFile:f((s,o)=>q.delFile(s,o,a),"delFile"),renFile:f((s,o,l)=>q.renFile(s,o,l,a),"renFile"),mvFile:f((s,o,l)=>q.mvFile(s,o,l,a),"mvFile"),zip:f((s,o,l,c=!1)=>q.zip(s,o,l,c,a),"zip"),unzip:f((s,o,l=!1)=>q.unzip(s,o,l,a),"unzip"),addZip:f((s,o,l,c)=>q.addZip(s,o,l,c,a),"addZip"),delZip:f((s,o,l)=>q.delZip(s,o,l,a),"delZip"),init:f(s=>q.init(s),"init"),restart:f(()=>q.restart(),"restart"),terminate:f(()=>q.terminate(),"terminate"),gerarId:fe,gerarIdComPrefixo:f(()=>a.prefix?Pe(a.prefix):fe(),"gerarIdComPrefixo")}}f(_t,"createScopedOpfs");var tr=Object.assign((e,t,n,r)=>gt(e,t,n,r),w),rr=Object.assign((e,t,n,r="",i)=>_t(e,t,n,r,i),q);var Qe="v0.4.1#mujy03ud";console.log(`[DB] \u{1F30C} Worker-db loaded (v${Qe}).`);async function Ht(e){if(!e.data||typeof e.data!="object"||!("requestId"in e.data)||!("command"in e.data))return;let{requestId:t,command:n,args:r={}}=e.data;try{let i={dbName:r.dbName,storeName:r.storeName,prefix:r.prefix,indexes:r.indexes,dbVersion:r.dbVersion,validatorStr:r.validatorStr},a={...i,basePath:r.basePath},s;switch(n){case"VERSION":s={version:Qe};break;case"GET":s=await g.get(r.key,i);break;case"SET":r.key!==void 0?s=await g.set(r.key,r.val,i):s=await g.set(r.val,i);break;case"DELETE":s=await g.delete(r.key,i);break;case"GET_MANY":s=await g.getMany(r.keys,i);break;case"SET_MANY":s=await g.setMany(r.entries,i);break;case"DEL_MANY":s=await g.deleteMany(r.keys,i);break;case"KEYS":s=await g.keys(i);break;case"VALUES":s=await g.values(i);break;case"ENTRIES":s=await g.entries(i);break;case"CLEAR":s=await g.clear(i);break;case"PATCH":{let o;r.fnStr?o=new Function("prev","ctx",`return (${r.fnStr})(prev, ctx);`):o=r.patch,s=await g.patch(r.key,o,r.context,i);break}case"QUERY":{let o=new Function("items","ctx",`return (${r.fnStr})(items, ctx);`);s=await g.query(o,r.context,i);break}case"GET_SOME":{let o=new Function("items","ctx",`return (${r.fnStr})(items, ctx);`);s=await g.getSome(o,r.context,i);break}case"DEL_SOME":{let o=new Function("items","ctx",`return (${r.fnStr})(items, ctx);`);s=await g.delSome(o,r.context,i);break}case"SET_SOME":{let o=new Function("items","ctx",`return (${r.selectFnStr})(items, ctx);`),l=new Function("item","ctx",`return (${r.updateFnStr})(item, ctx);`);s=await g.setSome(o,l,r.context,i);break}case"EXPORT":s=await g.exportDB(i);break;case"IMPORT":s=await g.importDB(r.data,r.clearFirst,i);break;case"BACKUP_OPFS":s=await g.backupToOpfs(r.key,r.fileName,i);break;case"RESTORE_OPFS":s=await g.restoreFromOpfs(r.key,r.fileName,r.clearFirst,i);break;case"OPFS_LIST":s=await g.listFiles(r.key,a);break;case"OPFS_GET":s=await g.getFile(r.key,r.fileName,a);break;case"OPFS_ADD":s=await g.addFile(r.key,r.file,r.fileName,a);break;case"OPFS_DEL":s=await g.delFile(r.key,r.fileName,a);break;case"OPFS_REN":s=await g.renFile(r.key,r.oldName,r.newName,a);break;case"OPFS_MV":s=await g.mvFile(r.key,r.fileName,r.newKey,a);break;case"OPFS_ZIP":s=await g.zip(r.key,r.zipName,r.filesToZip,r.deleteOriginals,a);break;case"OPFS_UNZIP":s=await g.unzip(r.key,r.zipName,r.deleteZip,a);break;case"OPFS_ADDZIP":s=await g.addZip(r.key,r.zipName,r.file,r.fileName,a);break;case"OPFS_DELZIP":s=await g.delZip(r.key,r.zipName,r.fileName,a);break;case"GET_BY_INDEX":s=await g.getByIndex(r.indexName,r.query,i);break;case"COUNT_BY_INDEX":s=await g.countByIndex(r.indexName,r.query,i);break;case"GET_ONE_BY_INDEX":s=await g.getOneByIndex(r.indexName,r.query,i);break;case"KEYS_BY_INDEX":s=await g.keysByIndex(r.indexName,r.query,i);break;case"PATCH_BY_INDEX":s=await g.patchByIndex(r.indexName,r.query,r.patch,i);break;case"GET_BY_INDEX_PAGINATED":s=await g.getByIndexPaginated(r.indexName,r.query,r.paginationOpts,i);break;case"GET_MANY_BY_INDEX":s=await g.getManyByIndex(r.indexName,r.queries,i);break;case"GET_SOME_BY_INDEX":{let o=new Function("items","ctx",`return (${r.fnStr})(items, ctx);`);s=await g.getSomeByIndex(r.indexName,r.query,o,r.context,i);break}case"QUERY_BY_INDEX":{let o=new Function("items","ctx",`return (${r.fnStr})(items, ctx);`);s=await g.queryByIndex(r.indexName,r.query,o,r.context,i);break}case"DELETE_BY_INDEX":s=await g.deleteByIndex(r.indexName,r.query,i);break;case"DELETE_MANY_BY_INDEX":s=await g.deleteManyByIndex(r.indexName,r.queries,i);break;case"DEL_SOME_BY_INDEX":{let o=new Function("items","ctx",`return (${r.fnStr})(items, ctx);`);s=await g.delSomeByIndex(r.indexName,r.query,o,r.context,i);break}case"SET_SOME_BY_INDEX":{let o=new Function("items","ctx",`return (${r.selectFnStr})(items, ctx);`),l=new Function("item","ctx",`return (${r.updateFnStr})(item, ctx);`);s=await g.setSomeByIndex(r.indexName,r.query,o,l,r.context,i);break}case"OPFS_ADD_STREAM":s=await g.addFileStream(r.key,r.stream,r.fileName,a);break;case"OPFS_GET_STREAM":{let o=await g.getFileStream(r.key,r.fileName,a);self.postMessage({requestId:t,success:!0,result:o},[o]);return}default:throw new Error(`Unknown command: ${n}`)}self.postMessage({requestId:t,success:!0,result:s})}catch(i){self.postMessage({requestId:t,success:!1,error:i.message})}}f(Ht,"handleWorkerMessage");typeof self<"u"&&typeof self.postMessage=="function"&&typeof self.document>"u"&&self.addEventListener("message",e=>{Ht(e)});export{Ht as handleWorkerMessage};

```

---

## Arquivo: `packages/worker-db/dist/workerdb.min.js.map`

````map
{
  "version": 3,
  "sources": ["../src/utils/packages/worker-db/src/utils/idb-keyval.ts", "../../../../../.cache/deno/npm/registry.npmjs.org/fflate/0.8.3/esm/browser.js", "../src/utils/packages/worker-db/src/utils/id.ts", "../src/packages/worker-db/src/db.ts", "../src/utils/packages/worker-db/src/utils/version.ts", "../src/packages/worker-db/src/worker.ts"],
  "sourcesContent": ["/**\n * @module @workerdb/utils/idb-keyval\n * @description Lightweight IndexedDB key-value helper based on idb-keyval patterns.\n */\n\n/**\n * Wraps an IDBRequest or IDBTransaction in a standard Promise.\n *\n * @param request The IDBRequest or IDBTransaction to convert to a Promise.\n * @returns A Promise that resolves with the request result or transaction completion.\n */\nexport function promisifyRequest<T = undefined>(\n  request: IDBRequest<T> | IDBTransaction,\n): Promise<T> {\n  return new Promise<T>((resolve, reject) => {\n    // IDBTransaction uses oncomplete, IDBRequest uses onsuccess\n    // deno-lint-ignore no-explicit-any\n    (request as any).oncomplete = (request as any).onsuccess = () =>\n      resolve((request as IDBRequest<T>).result);\n    // deno-lint-ignore no-explicit-any\n    (request as any).onabort = (request as any).onerror = () =>\n      reject(request.error);\n  });\n}\n\n/**\n * Function type representing a store execution callback.\n */\nexport type UseStore = <T>(\n  txMode: IDBTransactionMode,\n  callback: (store: IDBObjectStore) => T | PromiseLike<T>,\n) => Promise<T>;\n\n/**\n * Creates a custom store invoker for a given database and store name.\n *\n * @param dbName Name of the IndexedDB database.\n * @param storeName Name of the object store.\n * @returns A UseStore callback function.\n */\nexport function createStore(dbName: string, storeName: string): UseStore {\n  let dbp: Promise<IDBDatabase> | undefined;\n  const getDB = (): Promise<IDBDatabase> => {\n    if (dbp) return dbp;\n    const request = indexedDB.open(dbName);\n    request.onupgradeneeded = () => request.result.createObjectStore(storeName);\n    dbp = promisifyRequest(request);\n    dbp.then(\n      (db) => {\n        db.onclose = () => {\n          dbp = undefined;\n        };\n      },\n      () => {\n        dbp = undefined;\n      },\n    );\n    return dbp;\n  };\n  return (txMode, callback) =>\n    getDB().then((db) =>\n      callback(db.transaction(storeName, txMode).objectStore(storeName))\n    );\n}\n\nlet defaultGetStoreFunc: UseStore | undefined;\n\n/**\n * Returns the default store instance ('keyval-store', 'keyval').\n *\n * @returns The default UseStore function.\n */\nexport function defaultGetStore(): UseStore {\n  if (!defaultGetStoreFunc) {\n    defaultGetStoreFunc = createStore(\"keyval-store\", \"keyval\");\n  }\n  return defaultGetStoreFunc;\n}\n\n/**\n * Retrieves a value by its key.\n *\n * @param key Key to query.\n * @param customStore Optional custom store callback.\n * @returns Value or undefined if not found.\n */\nexport function get<T = unknown>(\n  key: IDBValidKey,\n  customStore: UseStore = defaultGetStore(),\n): Promise<T | undefined> {\n  return customStore(\"readonly\", (store) =>\n    promisifyRequest<T>(store.get(key) as IDBRequest<T>)\n  );\n}\n\n/**\n * Sets a value for a specific key.\n *\n * @param key Key to store against.\n * @param value Value to store.\n * @param customStore Optional custom store callback.\n */\nexport function set(\n  key: IDBValidKey,\n  value: unknown,\n  customStore: UseStore = defaultGetStore(),\n): Promise<void> {\n  return customStore(\"readwrite\", (store) => {\n    store.put(value, key);\n    return promisifyRequest(store.transaction!);\n  });\n}\n\n/**\n * Sets multiple key-value pairs at once atomically.\n *\n * @param entries Array of [key, value] pairs.\n * @param customStore Optional custom store callback.\n */\nexport function setMany(\n  entries: [IDBValidKey, unknown][],\n  customStore: UseStore = defaultGetStore(),\n): Promise<void> {\n  return customStore(\"readwrite\", (store) => {\n    entries.forEach((entry) => store.put(entry[1], entry[0]));\n    return promisifyRequest(store.transaction!);\n  });\n}\n\n/**\n * Retrieves multiple values by their keys in order.\n *\n * @param keys Array of keys to retrieve.\n * @param customStore Optional custom store callback.\n * @returns Array of retrieved values or undefined for missing keys.\n */\nexport function getMany<T = unknown>(\n  keys: IDBValidKey[],\n  customStore: UseStore = defaultGetStore(),\n): Promise<(T | undefined)[]> {\n  return customStore(\"readonly\", (store) =>\n    Promise.all(\n      keys.map((key) => promisifyRequest<T>(store.get(key) as IDBRequest<T>)),\n    )\n  );\n}\n\n/**\n * Updates a value atomically using an updater callback.\n *\n * @param key Key to update.\n * @param updater Function to compute the new value from the previous value.\n * @param customStore Optional custom store callback.\n */\nexport function update<T = unknown>(\n  key: IDBValidKey,\n  updater: (oldValue: T | undefined) => T,\n  customStore: UseStore = defaultGetStore(),\n): Promise<void> {\n  return customStore(\n    \"readwrite\",\n    (store) =>\n      new Promise<void>((resolve, reject) => {\n        const req = store.get(key);\n        req.onsuccess = () => {\n          try {\n            store.put(updater(req.result), key);\n            resolve(promisifyRequest(store.transaction!));\n          } catch (err) {\n            reject(err);\n          }\n        };\n        req.onerror = () => reject(req.error);\n      }),\n  );\n}\n\n/**\n * Deletes a particular key from the store.\n *\n * @param key Key to delete.\n * @param customStore Optional custom store callback.\n */\nexport function del(\n  key: IDBValidKey,\n  customStore: UseStore = defaultGetStore(),\n): Promise<void> {\n  return customStore(\"readwrite\", (store) => {\n    store.delete(key);\n    return promisifyRequest(store.transaction!);\n  });\n}\n\n/**\n * Deletes multiple keys at once.\n *\n * @param keys Keys to delete.\n * @param customStore Optional custom store callback.\n */\nexport function delMany(\n  keys: IDBValidKey[],\n  customStore: UseStore = defaultGetStore(),\n): Promise<void> {\n  return customStore(\"readwrite\", (store) => {\n    keys.forEach((key) => store.delete(key));\n    return promisifyRequest(store.transaction!);\n  });\n}\n\n/**\n * Clears all entries from the store.\n *\n * @param customStore Optional custom store callback.\n */\nexport function clear(\n  customStore: UseStore = defaultGetStore(),\n): Promise<void> {\n  return customStore(\"readwrite\", (store) => {\n    store.clear();\n    return promisifyRequest(store.transaction!);\n  });\n}\n\nfunction eachCursor(\n  store: IDBObjectStore,\n  callback: (cursor: IDBCursorWithValue) => void,\n): Promise<void> {\n  store.openCursor().onsuccess = function () {\n    if (!this.result) return;\n    callback(this.result);\n    this.result.continue();\n  };\n  return promisifyRequest(store.transaction!);\n}\n\n/**\n * Retrieves all keys stored in the object store.\n *\n * @param customStore Optional custom store callback.\n * @returns Array of keys.\n */\nexport function keys<KeyType extends IDBValidKey = IDBValidKey>(\n  customStore: UseStore = defaultGetStore(),\n): Promise<KeyType[]> {\n  return customStore(\"readonly\", (store) => {\n    if (store.getAllKeys) {\n      return promisifyRequest(\n        store.getAllKeys() as unknown as IDBRequest<KeyType[]>,\n      );\n    }\n    const items: KeyType[] = [];\n    return eachCursor(store, (cursor) => items.push(cursor.key as KeyType)).then(\n      () => items,\n    );\n  });\n}\n\n/**\n * Retrieves all values stored in the object store.\n *\n * @param customStore Optional custom store callback.\n * @returns Array of values.\n */\nexport function values<T = unknown>(\n  customStore: UseStore = defaultGetStore(),\n): Promise<T[]> {\n  return customStore(\"readonly\", (store) => {\n    if (store.getAll) {\n      return promisifyRequest(store.getAll() as IDBRequest<T[]>);\n    }\n    const items: T[] = [];\n    return eachCursor(store, (cursor) => items.push(cursor.value as T)).then(\n      () => items,\n    );\n  });\n}\n\n/**\n * Retrieves all [key, value] pairs stored in the object store.\n *\n * @param customStore Optional custom store callback.\n * @returns Array of [key, value] entries.\n */\nexport function entries<\n  KeyType extends IDBValidKey = IDBValidKey,\n  ValueType = unknown,\n>(\n  customStore: UseStore = defaultGetStore(),\n): Promise<[KeyType, ValueType][]> {\n  return customStore(\"readonly\", (store) => {\n    if (store.getAll && store.getAllKeys) {\n      return Promise.all([\n        promisifyRequest(\n          store.getAllKeys() as unknown as IDBRequest<KeyType[]>,\n        ),\n        promisifyRequest(store.getAll() as IDBRequest<ValueType[]>),\n      ]).then(([keysList, valuesList]) =>\n        keysList.map((key, i) => [key, valuesList[i]] as [KeyType, ValueType])\n      );\n    }\n    const items: [KeyType, ValueType][] = [];\n    return eachCursor(store, (cursor) =>\n      items.push([cursor.key as KeyType, cursor.value as ValueType])\n    ).then(() => items);\n  });\n}\n", "// DEFLATE is a complex format; to read this code, you should probably check the RFC first:\n// https://tools.ietf.org/html/rfc1951\n// You may also wish to take a look at the guide I made about this program:\n// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad\n// Some of the following code is similar to that of UZIP.js:\n// https://github.com/photopea/UZIP.js\n// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.\n// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint\n// is better for memory in most engines (I *think*).\nvar ch2 = {};\nvar wk = (function (c, id, msg, transfer, cb) {\n    var w = new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([\n        c + ';addEventListener(\"error\",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'\n    ], { type: 'text/javascript' }))));\n    w.onmessage = function (e) {\n        var d = e.data, ed = d.$e$;\n        if (ed) {\n            var err = new Error(ed[0]);\n            err['code'] = ed[1];\n            err.stack = ed[2];\n            cb(err, null);\n        }\n        else\n            cb(null, d);\n    };\n    w.postMessage(msg, transfer);\n    return w;\n});\n\n// aliases for shorter compressed code (most minifers don't do this)\nvar u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;\n// fixed length extra bits\nvar fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);\n// fixed distance extra bits\nvar fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);\n// code length index map\nvar clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);\n// get base, reverse index map from extra bits\nvar freb = function (eb, start) {\n    var b = new u16(31);\n    for (var i = 0; i < 31; ++i) {\n        b[i] = start += 1 << eb[i - 1];\n    }\n    // numbers here are at max 18 bits\n    var r = new i32(b[30]);\n    for (var i = 1; i < 30; ++i) {\n        for (var j = b[i]; j < b[i + 1]; ++j) {\n            r[j] = ((j - b[i]) << 5) | i;\n        }\n    }\n    return { b: b, r: r };\n};\nvar _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;\n// we can ignore the fact that the other numbers are wrong; they never happen anyway\nfl[28] = 258, revfl[258] = 28;\nvar _b = freb(fdeb, 0), fd = _b.b, revfd = _b.r;\n// map of value to reverse (assuming 16 bits)\nvar rev = new u16(32768);\nfor (var i = 0; i < 32768; ++i) {\n    // reverse table algorithm from SO\n    var x = ((i & 0xAAAA) >> 1) | ((i & 0x5555) << 1);\n    x = ((x & 0xCCCC) >> 2) | ((x & 0x3333) << 2);\n    x = ((x & 0xF0F0) >> 4) | ((x & 0x0F0F) << 4);\n    rev[i] = (((x & 0xFF00) >> 8) | ((x & 0x00FF) << 8)) >> 1;\n}\n// create huffman tree from u8 \"map\": index -> code length for code index\n// mb (max bits) must be at most 15\n// TODO: optimize/split up?\nvar hMap = (function (cd, mb, r) {\n    var s = cd.length;\n    // index\n    var i = 0;\n    // u16 \"map\": index -> # of codes with bit length = index\n    var l = new u16(mb);\n    // length of cd must be 288 (total # of codes)\n    for (; i < s; ++i) {\n        if (cd[i])\n            ++l[cd[i] - 1];\n    }\n    // u16 \"map\": index -> minimum code for bit length = index\n    var le = new u16(mb);\n    for (i = 1; i < mb; ++i) {\n        le[i] = (le[i - 1] + l[i - 1]) << 1;\n    }\n    var co;\n    if (r) {\n        // u16 \"map\": index -> number of actual bits, symbol for code\n        co = new u16(1 << mb);\n        // bits to remove for reverser\n        var rvb = 15 - mb;\n        for (i = 0; i < s; ++i) {\n            // ignore 0 lengths\n            if (cd[i]) {\n                // num encoding both symbol and bits read\n                var sv = (i << 4) | cd[i];\n                // free bits\n                var r_1 = mb - cd[i];\n                // start value\n                var v = le[cd[i] - 1]++ << r_1;\n                // m is end value\n                for (var m = v | ((1 << r_1) - 1); v <= m; ++v) {\n                    // every 16 bit value starting with the code yields the same result\n                    co[rev[v] >> rvb] = sv;\n                }\n            }\n        }\n    }\n    else {\n        co = new u16(s);\n        for (i = 0; i < s; ++i) {\n            if (cd[i]) {\n                co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);\n            }\n        }\n    }\n    return co;\n});\n// fixed length tree\nvar flt = new u8(288);\nfor (var i = 0; i < 144; ++i)\n    flt[i] = 8;\nfor (var i = 144; i < 256; ++i)\n    flt[i] = 9;\nfor (var i = 256; i < 280; ++i)\n    flt[i] = 7;\nfor (var i = 280; i < 288; ++i)\n    flt[i] = 8;\n// fixed distance tree\nvar fdt = new u8(32);\nfor (var i = 0; i < 32; ++i)\n    fdt[i] = 5;\n// fixed length map\nvar flm = /*#__PURE__*/ hMap(flt, 9, 0), flrm = /*#__PURE__*/ hMap(flt, 9, 1);\n// fixed distance map\nvar fdm = /*#__PURE__*/ hMap(fdt, 5, 0), fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);\n// find max of array\nvar max = function (a) {\n    var m = a[0];\n    for (var i = 1; i < a.length; ++i) {\n        if (a[i] > m)\n            m = a[i];\n    }\n    return m;\n};\n// read d, starting at bit p and mask with m\nvar bits = function (d, p, m) {\n    var o = (p / 8) | 0;\n    return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;\n};\n// read d, starting at bit p continuing for at least 16 bits\nvar bits16 = function (d, p) {\n    var o = (p / 8) | 0;\n    return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));\n};\n// get end of byte\nvar shft = function (p) { return ((p + 7) / 8) | 0; };\n// typed array slice - allows garbage collector to free original reference,\n// while being more compatible than .slice\nvar slc = function (v, s, e) {\n    if (s == null || s < 0)\n        s = 0;\n    if (e == null || e > v.length)\n        e = v.length;\n    // can't use .constructor in case user-supplied\n    return new u8(v.subarray(s, e));\n};\n/**\n * Codes for errors generated within this library\n */\nexport var FlateErrorCode = {\n    UnexpectedEOF: 0,\n    InvalidBlockType: 1,\n    InvalidLengthLiteral: 2,\n    InvalidDistance: 3,\n    StreamFinished: 4,\n    NoStreamHandler: 5,\n    InvalidHeader: 6,\n    NoCallback: 7,\n    InvalidUTF8: 8,\n    ExtraFieldTooLong: 9,\n    InvalidDate: 10,\n    FilenameTooLong: 11,\n    StreamFinishing: 12,\n    InvalidZipData: 13,\n    UnknownCompressionMethod: 14\n};\n// error codes\nvar ec = [\n    'unexpected EOF',\n    'invalid block type',\n    'invalid length/literal',\n    'invalid distance',\n    'stream finished',\n    'no stream handler',\n    , // determined by compression function\n    'no callback',\n    'invalid UTF-8 data',\n    'extra field too long',\n    'date not in range 1980-2099',\n    'filename too long',\n    'stream finishing',\n    'invalid zip data'\n    // determined by unknown compression method\n];\n;\nvar err = function (ind, msg, nt) {\n    var e = new Error(msg || ec[ind]);\n    e.code = ind;\n    if (Error.captureStackTrace)\n        Error.captureStackTrace(e, err);\n    if (!nt)\n        throw e;\n    return e;\n};\n// expands raw DEFLATE data\nvar inflt = function (dat, st, buf, dict) {\n    // source length       dict length\n    var sl = dat.length, dl = dict ? dict.length : 0;\n    if (!sl || st.f && !st.l)\n        return buf || new u8(0);\n    var noBuf = !buf;\n    // have to estimate size\n    var resize = noBuf || st.i != 2;\n    // no state\n    var noSt = st.i;\n    // Assumes roughly 33% compression ratio average\n    if (noBuf)\n        buf = new u8(sl * 3);\n    // ensure buffer can fit at least l elements\n    var cbuf = function (l) {\n        var bl = buf.length;\n        // need to increase size to fit\n        if (l > bl) {\n            // Double or set to necessary, whichever is greater\n            var nbuf = new u8(Math.max(bl * 2, l));\n            nbuf.set(buf);\n            buf = nbuf;\n        }\n    };\n    //  last chunk         bitpos           bytes\n    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;\n    // total bits\n    var tbts = sl * 8;\n    do {\n        if (!lm) {\n            // BFINAL - this is only 1 when last chunk is next\n            final = bits(dat, pos, 1);\n            // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman\n            var type = bits(dat, pos + 1, 3);\n            pos += 3;\n            if (!type) {\n                // go to end of byte boundary\n                var s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;\n                if (t > sl) {\n                    if (noSt)\n                        err(0);\n                    break;\n                }\n                // ensure size\n                if (resize)\n                    cbuf(bt + l);\n                // Copy over uncompressed data\n                buf.set(dat.subarray(s, t), bt);\n                // Get new bitpos, update byte count\n                st.b = bt += l, st.p = pos = t * 8, st.f = final;\n                continue;\n            }\n            else if (type == 1)\n                lm = flrm, dm = fdrm, lbt = 9, dbt = 5;\n            else if (type == 2) {\n                //  literal                            lengths\n                var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;\n                var tl = hLit + bits(dat, pos + 5, 31) + 1;\n                pos += 14;\n                // length+distance tree\n                var ldt = new u8(tl);\n                // code length tree\n                var clt = new u8(19);\n                for (var i = 0; i < hcLen; ++i) {\n                    // use index map to get real code\n                    clt[clim[i]] = bits(dat, pos + i * 3, 7);\n                }\n                pos += hcLen * 3;\n                // code lengths bits\n                var clb = max(clt), clbmsk = (1 << clb) - 1;\n                // code lengths map\n                var clm = hMap(clt, clb, 1);\n                for (var i = 0; i < tl;) {\n                    var r = clm[bits(dat, pos, clbmsk)];\n                    // bits read\n                    pos += r & 15;\n                    // symbol\n                    var s = r >> 4;\n                    // code length to copy\n                    if (s < 16) {\n                        ldt[i++] = s;\n                    }\n                    else {\n                        //  copy   count\n                        var c = 0, n = 0;\n                        if (s == 16)\n                            n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];\n                        else if (s == 17)\n                            n = 3 + bits(dat, pos, 7), pos += 3;\n                        else if (s == 18)\n                            n = 11 + bits(dat, pos, 127), pos += 7;\n                        while (n--)\n                            ldt[i++] = c;\n                    }\n                }\n                //    length tree                 distance tree\n                var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);\n                // max length bits\n                lbt = max(lt);\n                // max dist bits\n                dbt = max(dt);\n                lm = hMap(lt, lbt, 1);\n                dm = hMap(dt, dbt, 1);\n            }\n            else\n                err(1);\n            if (pos > tbts) {\n                if (noSt)\n                    err(0);\n                break;\n            }\n        }\n        // Make sure the buffer can hold this + the largest possible addition\n        // Maximum chunk size (practically, theoretically infinite) is 2^17\n        if (resize)\n            cbuf(bt + 131072);\n        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;\n        var lpos = pos;\n        for (;; lpos = pos) {\n            // bits read, code\n            var c = lm[bits16(dat, pos) & lms], sym = c >> 4;\n            pos += c & 15;\n            if (pos > tbts) {\n                if (noSt)\n                    err(0);\n                break;\n            }\n            if (!c)\n                err(2);\n            if (sym < 256)\n                buf[bt++] = sym;\n            else if (sym == 256) {\n                lpos = pos, lm = null;\n                break;\n            }\n            else {\n                var add = sym - 254;\n                // no extra bits needed if less\n                if (sym > 264) {\n                    // index\n                    var i = sym - 257, b = fleb[i];\n                    add = bits(dat, pos, (1 << b) - 1) + fl[i];\n                    pos += b;\n                }\n                // dist\n                var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;\n                if (!d)\n                    err(3);\n                pos += d & 15;\n                var dt = fd[dsym];\n                if (dsym > 3) {\n                    var b = fdeb[dsym];\n                    dt += bits16(dat, pos) & (1 << b) - 1, pos += b;\n                }\n                if (pos > tbts) {\n                    if (noSt)\n                        err(0);\n                    break;\n                }\n                if (resize)\n                    cbuf(bt + 131072);\n                var end = bt + add;\n                if (bt < dt) {\n                    var shift = dl - dt, dend = Math.min(dt, end);\n                    if (shift + bt < 0)\n                        err(3);\n                    for (; bt < dend; ++bt)\n                        buf[bt] = dict[shift + bt];\n                }\n                for (; bt < end; ++bt)\n                    buf[bt] = buf[bt - dt];\n            }\n        }\n        st.l = lm, st.p = lpos, st.b = bt, st.f = final;\n        if (lm)\n            final = 1, st.m = lbt, st.d = dm, st.n = dbt;\n    } while (!final);\n    // don't reallocate for streams or user buffers\n    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);\n};\n// starting at p, write the minimum number of bits that can hold v to d\nvar wbits = function (d, p, v) {\n    v <<= p & 7;\n    var o = (p / 8) | 0;\n    d[o] |= v;\n    d[o + 1] |= v >> 8;\n};\n// starting at p, write the minimum number of bits (>8) that can hold v to d\nvar wbits16 = function (d, p, v) {\n    v <<= p & 7;\n    var o = (p / 8) | 0;\n    d[o] |= v;\n    d[o + 1] |= v >> 8;\n    d[o + 2] |= v >> 16;\n};\n// creates code lengths from a frequency table\nvar hTree = function (d, mb) {\n    // Need extra info to make a tree\n    var t = [];\n    for (var i = 0; i < d.length; ++i) {\n        if (d[i])\n            t.push({ s: i, f: d[i] });\n    }\n    var s = t.length;\n    var t2 = t.slice();\n    if (!s)\n        return { t: et, l: 0 };\n    if (s == 1) {\n        var v = new u8(t[0].s + 1);\n        v[t[0].s] = 1;\n        return { t: v, l: 1 };\n    }\n    t.sort(function (a, b) { return a.f - b.f; });\n    // after i2 reaches last ind, will be stopped\n    // freq must be greater than largest possible number of symbols\n    t.push({ s: -1, f: 25001 });\n    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;\n    t[0] = { s: -1, f: l.f + r.f, l: l, r: r };\n    // efficient algorithm from UZIP.js\n    // i0 is lookbehind, i2 is lookahead - after processing two low-freq\n    // symbols that combined have high freq, will start processing i2 (high-freq,\n    // non-composite) symbols instead\n    // see https://reddit.com/r/photopea/comments/ikekht/uzipjs_questions/\n    while (i1 != s - 1) {\n        l = t[t[i0].f < t[i2].f ? i0++ : i2++];\n        r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];\n        t[i1++] = { s: -1, f: l.f + r.f, l: l, r: r };\n    }\n    var maxSym = t2[0].s;\n    for (var i = 1; i < s; ++i) {\n        if (t2[i].s > maxSym)\n            maxSym = t2[i].s;\n    }\n    // code lengths\n    var tr = new u16(maxSym + 1);\n    // max bits in tree\n    var mbt = ln(t[i1 - 1], tr, 0);\n    if (mbt > mb) {\n        // more algorithms from UZIP.js\n        // TODO: find out how this code works (debt)\n        //  ind    debt\n        var i = 0, dt = 0;\n        //    left            cost\n        var lft = mbt - mb, cst = 1 << lft;\n        t2.sort(function (a, b) { return tr[b.s] - tr[a.s] || a.f - b.f; });\n        for (; i < s; ++i) {\n            var i2_1 = t2[i].s;\n            if (tr[i2_1] > mb) {\n                dt += cst - (1 << (mbt - tr[i2_1]));\n                tr[i2_1] = mb;\n            }\n            else\n                break;\n        }\n        dt >>= lft;\n        while (dt > 0) {\n            var i2_2 = t2[i].s;\n            if (tr[i2_2] < mb)\n                dt -= 1 << (mb - tr[i2_2]++ - 1);\n            else\n                ++i;\n        }\n        for (; i >= 0 && dt; --i) {\n            var i2_3 = t2[i].s;\n            if (tr[i2_3] == mb) {\n                --tr[i2_3];\n                ++dt;\n            }\n        }\n        mbt = mb;\n    }\n    return { t: new u8(tr), l: mbt };\n};\n// get the max length and assign length codes\nvar ln = function (n, l, d) {\n    return n.s == -1\n        ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1))\n        : (l[n.s] = d);\n};\n// length codes generation\nvar lc = function (c) {\n    var s = c.length;\n    // Note that the semicolon was intentional\n    while (s && !c[--s])\n        ;\n    var cl = new u16(++s);\n    //  ind      num         streak\n    var cli = 0, cln = c[0], cls = 1;\n    var w = function (v) { cl[cli++] = v; };\n    for (var i = 1; i <= s; ++i) {\n        if (c[i] == cln && i != s)\n            ++cls;\n        else {\n            if (!cln && cls > 2) {\n                for (; cls > 138; cls -= 138)\n                    w(32754);\n                if (cls > 2) {\n                    w(cls > 10 ? ((cls - 11) << 5) | 28690 : ((cls - 3) << 5) | 12305);\n                    cls = 0;\n                }\n            }\n            else if (cls > 3) {\n                w(cln), --cls;\n                for (; cls > 6; cls -= 6)\n                    w(8304);\n                if (cls > 2)\n                    w(((cls - 3) << 5) | 8208), cls = 0;\n            }\n            while (cls--)\n                w(cln);\n            cls = 1;\n            cln = c[i];\n        }\n    }\n    return { c: cl.subarray(0, cli), n: s };\n};\n// calculate the length of output from tree, code lengths\nvar clen = function (cf, cl) {\n    var l = 0;\n    for (var i = 0; i < cl.length; ++i)\n        l += cf[i] * cl[i];\n    return l;\n};\n// writes a fixed block\n// returns the new bit pos\nvar wfblk = function (out, pos, dat) {\n    // no need to write 00 as type: TypedArray defaults to 0\n    var s = dat.length;\n    var o = shft(pos + 2);\n    out[o] = s & 255;\n    out[o + 1] = s >> 8;\n    out[o + 2] = out[o] ^ 255;\n    out[o + 3] = out[o + 1] ^ 255;\n    for (var i = 0; i < s; ++i)\n        out[o + i + 4] = dat[i];\n    return (o + 4 + s) * 8;\n};\n// writes a block\nvar wblk = function (dat, out, final, syms, lf, df, eb, li, bs, bl, p) {\n    wbits(out, p++, final);\n    ++lf[256];\n    var _a = hTree(lf, 15), dlt = _a.t, mlb = _a.l;\n    var _b = hTree(df, 15), ddt = _b.t, mdb = _b.l;\n    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;\n    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;\n    var lcfreq = new u16(19);\n    for (var i = 0; i < lclt.length; ++i)\n        ++lcfreq[lclt[i] & 31];\n    for (var i = 0; i < lcdt.length; ++i)\n        ++lcfreq[lcdt[i] & 31];\n    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;\n    var nlcc = 19;\n    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)\n        ;\n    var flen = (bl + 5) << 3;\n    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;\n    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];\n    if (bs >= 0 && flen <= ftlen && flen <= dtlen)\n        return wfblk(out, p, dat.subarray(bs, bs + bl));\n    var lm, ll, dm, dl;\n    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;\n    if (dtlen < ftlen) {\n        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;\n        var llm = hMap(lct, mlcb, 0);\n        wbits(out, p, nlc - 257);\n        wbits(out, p + 5, ndc - 1);\n        wbits(out, p + 10, nlcc - 4);\n        p += 14;\n        for (var i = 0; i < nlcc; ++i)\n            wbits(out, p + 3 * i, lct[clim[i]]);\n        p += 3 * nlcc;\n        var lcts = [lclt, lcdt];\n        for (var it = 0; it < 2; ++it) {\n            var clct = lcts[it];\n            for (var i = 0; i < clct.length; ++i) {\n                var len = clct[i] & 31;\n                wbits(out, p, llm[len]), p += lct[len];\n                if (len > 15)\n                    wbits(out, p, (clct[i] >> 5) & 127), p += clct[i] >> 12;\n            }\n        }\n    }\n    else {\n        lm = flm, ll = flt, dm = fdm, dl = fdt;\n    }\n    for (var i = 0; i < li; ++i) {\n        var sym = syms[i];\n        if (sym > 255) {\n            var len = (sym >> 18) & 31;\n            wbits16(out, p, lm[len + 257]), p += ll[len + 257];\n            if (len > 7)\n                wbits(out, p, (sym >> 23) & 31), p += fleb[len];\n            var dst = sym & 31;\n            wbits16(out, p, dm[dst]), p += dl[dst];\n            if (dst > 3)\n                wbits16(out, p, (sym >> 5) & 8191), p += fdeb[dst];\n        }\n        else {\n            wbits16(out, p, lm[sym]), p += ll[sym];\n        }\n    }\n    wbits16(out, p, lm[256]);\n    return p + ll[256];\n};\n// deflate options (nice << 13) | chain\nvar deo = /*#__PURE__*/ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);\n// empty\nvar et = /*#__PURE__*/ new u8(0);\n// compresses data into a raw DEFLATE buffer\nvar dflt = function (dat, lvl, plvl, pre, post, st) {\n    var s = st.z || dat.length;\n    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);\n    // writing to this writes to the output buffer\n    var w = o.subarray(pre, o.length - post);\n    var lst = st.l;\n    var pos = (st.r || 0) & 7;\n    if (lvl) {\n        if (pos)\n            w[0] = st.r >> 3;\n        var opt = deo[lvl - 1];\n        var n = opt >> 13, c = opt & 8191;\n        var msk_1 = (1 << plvl) - 1;\n        //    prev 2-byte val map    curr 2-byte val map\n        var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);\n        var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;\n        var hsh = function (i) { return (dat[i] ^ (dat[i + 1] << bs1_1) ^ (dat[i + 2] << bs2_1)) & msk_1; };\n        // 24576 is an arbitrary number of maximum symbols per block\n        // 424 buffer for last block\n        var syms = new i32(25000);\n        // length/literal freq   distance freq\n        var lf = new u16(288), df = new u16(32);\n        //  l/lcnt  exbits  index          l/lind  waitdx          blkpos\n        var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;\n        for (; i + 2 < s; ++i) {\n            // hash value\n            var hv = hsh(i);\n            // index mod 32768    previous index mod\n            var imod = i & 32767, pimod = head[hv];\n            prev[imod] = pimod;\n            head[hv] = imod;\n            // We always should modify head and prev, but only add symbols if\n            // this data is not yet processed (\"wait\" for wait index)\n            if (wi <= i) {\n                // bytes remaining\n                var rem = s - i;\n                if ((lc_1 > 7000 || li > 24576) && (rem > 423 || !lst)) {\n                    pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);\n                    li = lc_1 = eb = 0, bs = i;\n                    for (var j = 0; j < 286; ++j)\n                        lf[j] = 0;\n                    for (var j = 0; j < 30; ++j)\n                        df[j] = 0;\n                }\n                //  len    dist   chain\n                var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;\n                if (rem > 2 && hv == hsh(i - dif)) {\n                    var maxn = Math.min(n, rem) - 1;\n                    var maxd = Math.min(32767, i);\n                    // max possible length\n                    // not capped at dif because decompressors implement \"rolling\" index population\n                    var ml = Math.min(258, rem);\n                    while (dif <= maxd && --ch_1 && imod != pimod) {\n                        if (dat[i + l] == dat[i + l - dif]) {\n                            var nl = 0;\n                            for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)\n                                ;\n                            if (nl > l) {\n                                l = nl, d = dif;\n                                // break out early when we reach \"nice\" (we are satisfied enough)\n                                if (nl > maxn)\n                                    break;\n                                // now, find the rarest 2-byte sequence within this\n                                // length of literals and search for that instead.\n                                // Much faster than just using the start\n                                var mmd = Math.min(dif, nl - 2);\n                                var md = 0;\n                                for (var j = 0; j < mmd; ++j) {\n                                    var ti = i - dif + j & 32767;\n                                    var pti = prev[ti];\n                                    var cd = ti - pti & 32767;\n                                    if (cd > md)\n                                        md = cd, pimod = ti;\n                                }\n                            }\n                        }\n                        // check the previous match\n                        imod = pimod, pimod = prev[imod];\n                        dif += imod - pimod & 32767;\n                    }\n                }\n                // d will be nonzero only when a match was found\n                if (d) {\n                    // store both dist and len data in one int32\n                    // Make sure this is recognized as a len/dist with 28th bit (2^28)\n                    syms[li++] = 268435456 | (revfl[l] << 18) | revfd[d];\n                    var lin = revfl[l] & 31, din = revfd[d] & 31;\n                    eb += fleb[lin] + fdeb[din];\n                    ++lf[257 + lin];\n                    ++df[din];\n                    wi = i + l;\n                    ++lc_1;\n                }\n                else {\n                    syms[li++] = dat[i];\n                    ++lf[dat[i]];\n                }\n            }\n        }\n        for (i = Math.max(i, wi); i < s; ++i) {\n            syms[li++] = dat[i];\n            ++lf[dat[i]];\n        }\n        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);\n        if (!lst) {\n            st.r = (pos & 7) | w[(pos / 8) | 0] << 3;\n            // shft(pos) now 1 less if pos & 7 != 0\n            pos -= 7;\n            st.h = head, st.p = prev, st.i = i, st.w = wi;\n        }\n    }\n    else {\n        for (var i = st.w || 0; i < s + lst; i += 65535) {\n            // end\n            var e = i + 65535;\n            if (e >= s) {\n                // write final block\n                w[(pos / 8) | 0] = lst;\n                e = s;\n            }\n            pos = wfblk(w, pos + 1, dat.subarray(i, e));\n        }\n        st.i = s;\n    }\n    return slc(o, 0, pre + shft(pos) + post);\n};\n// CRC32 table\nvar crct = /*#__PURE__*/ (function () {\n    var t = new Int32Array(256);\n    for (var i = 0; i < 256; ++i) {\n        var c = i, k = 9;\n        while (--k)\n            c = ((c & 1) && -306674912) ^ (c >>> 1);\n        t[i] = c;\n    }\n    return t;\n})();\n// CRC32\nvar crc = function () {\n    var c = -1;\n    return {\n        p: function (d) {\n            // closures have awful performance\n            var cr = c;\n            for (var i = 0; i < d.length; ++i)\n                cr = crct[(cr & 255) ^ d[i]] ^ (cr >>> 8);\n            c = cr;\n        },\n        d: function () { return ~c; }\n    };\n};\n// Adler32\nvar adler = function () {\n    var a = 1, b = 0;\n    return {\n        p: function (d) {\n            // closures have awful performance\n            var n = a, m = b;\n            var l = d.length | 0;\n            for (var i = 0; i != l;) {\n                var e = Math.min(i + 2655, l);\n                for (; i < e; ++i)\n                    m += n += d[i];\n                n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);\n            }\n            a = n, b = m;\n        },\n        d: function () {\n            a %= 65521, b %= 65521;\n            return (a & 255) << 24 | (a & 0xFF00) << 8 | (b & 255) << 8 | (b >> 8);\n        }\n    };\n};\n;\n// deflate with opts\nvar dopt = function (dat, opt, pre, post, st) {\n    if (!st) {\n        st = { l: 1 };\n        if (opt.dictionary) {\n            var dict = opt.dictionary.subarray(-32768);\n            var newDat = new u8(dict.length + dat.length);\n            newDat.set(dict);\n            newDat.set(dat, dict.length);\n            dat = newDat;\n            st.w = dict.length;\n        }\n    }\n    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? (st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20) : (12 + opt.mem), pre, post, st);\n};\n// Walmart object spread\nvar mrg = function (a, b) {\n    var o = {};\n    for (var k in a)\n        o[k] = a[k];\n    for (var k in b)\n        o[k] = b[k];\n    return o;\n};\n// worker clone\n// This is possibly the craziest part of the entire codebase, despite how simple it may seem.\n// The only parameter to this function is a closure that returns an array of variables outside of the function scope.\n// We're going to try to figure out the variable names used in the closure as strings because that is crucial for workerization.\n// We will return an object mapping of true variable name to value (basically, the current scope as a JS object).\n// The reason we can't just use the original variable names is minifiers mangling the toplevel scope.\n// This took me three weeks to figure out how to do.\nvar wcln = function (fn, fnStr, td) {\n    var dt = fn();\n    var st = fn.toString();\n    var ks = st.slice(st.indexOf('[') + 1, st.lastIndexOf(']')).replace(/\\s+/g, '').split(',');\n    for (var i = 0; i < dt.length; ++i) {\n        var v = dt[i], k = ks[i];\n        if (typeof v == 'function') {\n            fnStr += ';' + k + '=';\n            var st_1 = v.toString();\n            if (v.prototype) {\n                // for global objects\n                if (st_1.indexOf('[native code]') != -1) {\n                    var spInd = st_1.indexOf(' ', 8) + 1;\n                    fnStr += st_1.slice(spInd, st_1.indexOf('(', spInd));\n                }\n                else {\n                    fnStr += st_1;\n                    for (var t in v.prototype)\n                        fnStr += ';' + k + '.prototype.' + t + '=' + v.prototype[t].toString();\n                }\n            }\n            else\n                fnStr += st_1;\n        }\n        else\n            td[k] = v;\n    }\n    return fnStr;\n};\nvar ch = [];\n// clone bufs\nvar cbfs = function (v) {\n    var tl = [];\n    for (var k in v) {\n        if (v[k].buffer) {\n            tl.push((v[k] = new v[k].constructor(v[k])).buffer);\n        }\n    }\n    return tl;\n};\n// use a worker to execute code\nvar wrkr = function (fns, init, id, cb) {\n    if (!ch[id]) {\n        var fnStr = '', td_1 = {}, m = fns.length - 1;\n        for (var i = 0; i < m; ++i)\n            fnStr = wcln(fns[i], fnStr, td_1);\n        ch[id] = { c: wcln(fns[m], fnStr, td_1), e: td_1 };\n    }\n    var td = mrg({}, ch[id].e);\n    return wk(ch[id].c + ';onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=' + init.toString() + '}', id, td, cbfs(td), cb);\n};\n// base async inflate fn\nvar bInflt = function () { return [u8, u16, i32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gopt]; };\nvar bDflt = function () { return [u8, u16, i32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf]; };\n// gzip extra\nvar gze = function () { return [gzh, gzhl, wbytes, crc, crct]; };\n// gunzip extra\nvar guze = function () { return [gzs, gzl]; };\n// zlib extra\nvar zle = function () { return [zlh, wbytes, adler]; };\n// unzlib extra\nvar zule = function () { return [zls]; };\n// post buf\nvar pbf = function (msg) { return postMessage(msg, [msg.buffer]); };\n// get opts\nvar gopt = function (o) { return o && {\n    out: o.size && new u8(o.size),\n    dictionary: o.dictionary\n}; };\n// async helper\nvar cbify = function (dat, opts, fns, init, id, cb) {\n    var w = wrkr(fns, init, id, function (err, dat) {\n        w.terminate();\n        cb(err, dat);\n    });\n    w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);\n    return function () { w.terminate(); };\n};\n// auto stream\nvar astrm = function (strm) {\n    strm.ondata = function (dat, final) { return postMessage([dat, final], [dat.buffer]); };\n    return function (ev) {\n        if (ev.data[0]) {\n            strm.push(ev.data[0], ev.data[1]);\n            postMessage([ev.data[0].length]);\n        }\n        else\n            strm.flush(ev.data[1]);\n    };\n};\n// async stream attach\nvar astrmify = function (fns, strm, opts, init, id, flush, ext) {\n    var t;\n    var w = wrkr(fns, init, id, function (err, dat) {\n        if (err)\n            w.terminate(), strm.ondata.call(strm, err);\n        else if (!Array.isArray(dat))\n            ext(dat);\n        else if (dat.length == 1) {\n            strm.queuedSize -= dat[0];\n            if (strm.ondrain)\n                strm.ondrain(dat[0]);\n        }\n        else {\n            if (dat[1])\n                w.terminate();\n            strm.ondata.call(strm, err, dat[0], dat[1]);\n        }\n    });\n    w.postMessage(opts);\n    strm.queuedSize = 0;\n    strm.push = function (d, f) {\n        if (!strm.ondata)\n            err(5);\n        if (t)\n            strm.ondata(err(4, 0, 1), null, !!f);\n        strm.queuedSize += d.length;\n        // can fail for cross-realm Uint8Array, but ok - only a small performance penalty\n        w.postMessage([d, t = f], d.buffer instanceof ArrayBuffer ? [d.buffer] : []);\n    };\n    strm.terminate = function () { w.terminate(); };\n    if (flush) {\n        strm.flush = function (sync) { w.postMessage([0, sync]); };\n    }\n};\n// read 2 bytes\nvar b2 = function (d, b) { return d[b] | (d[b + 1] << 8); };\n// read 4 bytes\nvar b4 = function (d, b) { return (d[b] | (d[b + 1] << 8) | (d[b + 2] << 16) | (d[b + 3] << 24)) >>> 0; };\n// read 8 bytes\nvar b8 = function (d, b) { return b4(d, b) + (b4(d, b + 4) * 4294967296); };\n// write bytes\nvar wbytes = function (d, b, v) {\n    for (; v; ++b)\n        d[b] = v, v >>>= 8;\n};\n// gzip header\nvar gzh = function (c, o) {\n    var fn = o.filename;\n    c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3; // assume Unix\n    if (o.mtime != 0)\n        wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1000));\n    if (fn) {\n        c[3] = 8;\n        for (var i = 0; i <= fn.length; ++i)\n            c[i + 10] = fn.charCodeAt(i);\n    }\n};\n// gzip footer: -8 to -4 = CRC, -4 to -0 is length\n// gzip start\nvar gzs = function (d) {\n    if (d[0] != 31 || d[1] != 139 || d[2] != 8)\n        err(6, 'invalid gzip data');\n    var flg = d[3];\n    var st = 10;\n    if (flg & 4)\n        st += (d[10] | d[11] << 8) + 2;\n    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])\n        ;\n    return st + (flg & 2);\n};\n// gzip length\nvar gzl = function (d) {\n    var l = d.length;\n    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;\n};\n// gzip header length\nvar gzhl = function (o) { return 10 + (o.filename ? o.filename.length + 1 : 0); };\n// zlib header\nvar zlh = function (c, o) {\n    var lv = o.level, fl = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;\n    c[0] = 120, c[1] = (fl << 6) | (o.dictionary && 32);\n    c[1] |= 31 - ((c[0] << 8) | c[1]) % 31;\n    if (o.dictionary) {\n        var h = adler();\n        h.p(o.dictionary);\n        wbytes(c, 2, h.d());\n    }\n};\n// zlib start\nvar zls = function (d, dict) {\n    if ((d[0] & 15) != 8 || (d[0] >> 4) > 7 || ((d[0] << 8 | d[1]) % 31))\n        err(6, 'invalid zlib data');\n    if ((d[1] >> 5 & 1) == +!dict)\n        err(6, 'invalid zlib data: ' + (d[1] & 32 ? 'need' : 'unexpected') + ' dictionary');\n    return (d[1] >> 3 & 4) + 2;\n};\nfunction StrmOpt(opts, cb) {\n    if (typeof opts == 'function')\n        cb = opts, opts = {};\n    this.ondata = cb;\n    return opts;\n}\n/**\n * Streaming DEFLATE compression\n */\nvar Deflate = /*#__PURE__*/ (function () {\n    function Deflate(opts, cb) {\n        if (typeof opts == 'function')\n            cb = opts, opts = {};\n        this.ondata = cb;\n        this.o = opts || {};\n        this.s = { l: 0, i: 32768, w: 32768, z: 32768 };\n        // Buffer length must always be 0 mod 32768 for index calculations to be correct when modifying head and prev\n        // 98304 = 32768 (lookback) + 65536 (common chunk size)\n        this.b = new u8(98304);\n        if (this.o.dictionary) {\n            var dict = this.o.dictionary.subarray(-32768);\n            this.b.set(dict, 32768 - dict.length);\n            this.s.i = 32768 - dict.length;\n        }\n    }\n    Deflate.prototype.p = function (c, f) {\n        this.ondata(dopt(c, this.o, 0, 0, this.s), f);\n    };\n    /**\n     * Pushes a chunk to be deflated\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Deflate.prototype.push = function (chunk, final) {\n        if (!this.ondata)\n            err(5);\n        if (this.s.l)\n            err(4);\n        var endLen = chunk.length + this.s.z;\n        if (endLen > this.b.length) {\n            if (endLen > 2 * this.b.length - 32768) {\n                var newBuf = new u8(endLen & -32768);\n                newBuf.set(this.b.subarray(0, this.s.z));\n                this.b = newBuf;\n            }\n            var split = this.b.length - this.s.z;\n            this.b.set(chunk.subarray(0, split), this.s.z);\n            this.s.z = this.b.length;\n            this.p(this.b, false);\n            this.b.set(this.b.subarray(-32768));\n            this.b.set(chunk.subarray(split), 32768);\n            this.s.z = chunk.length - split + 32768;\n            this.s.i = 32766, this.s.w = 32768;\n        }\n        else {\n            this.b.set(chunk, this.s.z);\n            this.s.z += chunk.length;\n        }\n        this.s.l = final & 1;\n        if (this.s.z > this.s.w + 8191 || final) {\n            this.p(this.b, final || false);\n            this.s.w = this.s.i, this.s.i -= 2;\n        }\n        if (final) {\n            // cleanup unneeded buffers/state to reduce memory usage\n            this.s = this.o = {};\n            this.b = et;\n        }\n    };\n    /**\n     * Flushes buffered uncompressed data. Useful to immediately retrieve the\n     * deflated output for small inputs.\n     * @param sync Whether to flush to a byte boundary. A sync flush takes 4-5\n     *             extra bytes, but guarantees all pushed data is immediately\n     *             decompressible. A separate DEFLATE stream may be concatenated\n     *             with the current output after a sync flush.\n     */\n    Deflate.prototype.flush = function (sync) {\n        if (!this.ondata)\n            err(5);\n        if (this.s.l)\n            err(4);\n        this.p(this.b, false);\n        this.s.w = this.s.i, this.s.i -= 2;\n        // could technically skip writing the type-0 block for (this.s.r & 7) == 0,\n        // but the deterministic trailer (00 00 FF FF) is useful in some situations\n        if (sync) {\n            var c = new u8(6);\n            c[0] = this.s.r >> 3;\n            // write empty, non-final type-0 block\n            var ep = wfblk(c, this.s.r, et);\n            this.s.r = 0;\n            this.ondata(c.subarray(0, ep >> 3), false);\n        }\n    };\n    return Deflate;\n}());\nexport { Deflate };\n/**\n * Asynchronous streaming DEFLATE compression\n */\nvar AsyncDeflate = /*#__PURE__*/ (function () {\n    function AsyncDeflate(opts, cb) {\n        astrmify([\n            bDflt,\n            function () { return [astrm, Deflate]; }\n        ], this, StrmOpt.call(this, opts, cb), function (ev) {\n            var strm = new Deflate(ev.data);\n            onmessage = astrm(strm);\n        }, 6, 1);\n    }\n    return AsyncDeflate;\n}());\nexport { AsyncDeflate };\nexport function deflate(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return cbify(data, opts, [\n        bDflt,\n    ], function (ev) { return pbf(deflateSync(ev.data[0], ev.data[1])); }, 0, cb);\n}\n/**\n * Compresses data with DEFLATE without any wrapper\n * @param data The data to compress\n * @param opts The compression options\n * @returns The deflated version of the data\n */\nexport function deflateSync(data, opts) {\n    return dopt(data, opts || {}, 0, 0);\n}\n/**\n * Streaming DEFLATE decompression\n */\nvar Inflate = /*#__PURE__*/ (function () {\n    function Inflate(opts, cb) {\n        // no StrmOpt here to avoid adding to workerizer\n        if (typeof opts == 'function')\n            cb = opts, opts = {};\n        this.ondata = cb;\n        var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);\n        this.s = { i: 0, b: dict ? dict.length : 0 };\n        this.o = new u8(32768);\n        this.p = new u8(0);\n        if (dict)\n            this.o.set(dict);\n    }\n    Inflate.prototype.e = function (c) {\n        if (!this.ondata)\n            err(5);\n        if (this.d)\n            err(4);\n        if (!this.p.length)\n            this.p = c;\n        else if (c.length) {\n            var n = new u8(this.p.length + c.length);\n            n.set(this.p), n.set(c, this.p.length), this.p = n;\n        }\n    };\n    Inflate.prototype.c = function (final) {\n        this.s.i = +(this.d = final || false);\n        var bts = this.s.b;\n        var dt = inflt(this.p, this.s, this.o);\n        this.ondata(slc(dt, bts, this.s.b), this.d);\n        this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;\n        this.p = slc(this.p, (this.s.p / 8) | 0), this.s.p &= 7;\n    };\n    /**\n     * Pushes a chunk to be inflated\n     * @param chunk The chunk to push\n     * @param final Whether this is the final chunk\n     */\n    Inflate.prototype.push = function (chunk, final) {\n        this.e(chunk), this.c(final);\n    };\n    return Inflate;\n}());\nexport { Inflate };\n/**\n * Asynchronous streaming DEFLATE decompression\n */\nvar AsyncInflate = /*#__PURE__*/ (function () {\n    function AsyncInflate(opts, cb) {\n        astrmify([\n            bInflt,\n            function () { return [astrm, Inflate]; }\n        ], this, StrmOpt.call(this, opts, cb), function (ev) {\n            var strm = new Inflate(ev.data);\n            onmessage = astrm(strm);\n        }, 7, 0);\n    }\n    return AsyncInflate;\n}());\nexport { AsyncInflate };\nexport function inflate(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return cbify(data, opts, [\n        bInflt\n    ], function (ev) { return pbf(inflateSync(ev.data[0], gopt(ev.data[1]))); }, 1, cb);\n}\nexport function inflateSync(data, opts) {\n    return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);\n}\n// before you yell at me for not just using extends, my reason is that TS inheritance is hard to workerize.\n/**\n * Streaming GZIP compression\n */\nvar Gzip = /*#__PURE__*/ (function () {\n    function Gzip(opts, cb) {\n        this.c = crc();\n        this.l = 0;\n        this.v = 1;\n        Deflate.call(this, opts, cb);\n    }\n    /**\n     * Pushes a chunk to be GZIPped\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Gzip.prototype.push = function (chunk, final) {\n        this.c.p(chunk);\n        this.l += chunk.length;\n        Deflate.prototype.push.call(this, chunk, final);\n    };\n    Gzip.prototype.p = function (c, f) {\n        var raw = dopt(c, this.o, this.v && gzhl(this.o), f && 8, this.s);\n        if (this.v)\n            gzh(raw, this.o), this.v = 0;\n        if (f)\n            wbytes(raw, raw.length - 8, this.c.d()), wbytes(raw, raw.length - 4, this.l);\n        this.ondata(raw, f);\n    };\n    /**\n     * Flushes buffered uncompressed data. Useful to immediately retrieve the\n     * GZIPped output for small inputs.\n     * @param sync Whether to flush to a byte boundary. A sync flush takes 4-5\n     *             extra bytes, but guarantees all pushed data is immediately\n     *             decompressible.\n     */\n    Gzip.prototype.flush = function (sync) {\n        Deflate.prototype.flush.call(this, sync);\n    };\n    return Gzip;\n}());\nexport { Gzip };\n/**\n * Asynchronous streaming GZIP compression\n */\nvar AsyncGzip = /*#__PURE__*/ (function () {\n    function AsyncGzip(opts, cb) {\n        astrmify([\n            bDflt,\n            gze,\n            function () { return [astrm, Deflate, Gzip]; }\n        ], this, StrmOpt.call(this, opts, cb), function (ev) {\n            var strm = new Gzip(ev.data);\n            onmessage = astrm(strm);\n        }, 8, 1);\n    }\n    return AsyncGzip;\n}());\nexport { AsyncGzip };\nexport function gzip(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return cbify(data, opts, [\n        bDflt,\n        gze,\n        function () { return [gzipSync]; }\n    ], function (ev) { return pbf(gzipSync(ev.data[0], ev.data[1])); }, 2, cb);\n}\n/**\n * Compresses data with GZIP\n * @param data The data to compress\n * @param opts The compression options\n * @returns The gzipped version of the data\n */\nexport function gzipSync(data, opts) {\n    if (!opts)\n        opts = {};\n    var c = crc(), l = data.length;\n    c.p(data);\n    var d = dopt(data, opts, gzhl(opts), 8), s = d.length;\n    return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;\n}\n/**\n * Streaming single or multi-member GZIP decompression\n */\nvar Gunzip = /*#__PURE__*/ (function () {\n    function Gunzip(opts, cb) {\n        this.v = 1;\n        this.r = 0;\n        Inflate.call(this, opts, cb);\n    }\n    /**\n     * Pushes a chunk to be GUNZIPped\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Gunzip.prototype.push = function (chunk, final) {\n        Inflate.prototype.e.call(this, chunk);\n        this.r += chunk.length;\n        if (this.v) {\n            var p = this.p.subarray(this.v - 1);\n            var s = p.length > 3 ? gzs(p) : 4;\n            if (s > p.length) {\n                if (!final)\n                    return;\n            }\n            else if (this.v > 1 && this.onmember) {\n                this.onmember(this.r - p.length);\n            }\n            this.p = p.subarray(s), this.v = 0;\n        }\n        // necessary to prevent TS from using the closure value\n        // This allows for workerization to function correctly\n        Inflate.prototype.c.call(this, 0);\n        // process concatenated GZIP\n        if (this.s.f && !this.s.l) {\n            this.v = shft(this.s.p) + 9;\n            this.s = { i: 0 };\n            this.o = new u8(0);\n            this.push(new u8(0), final);\n        }\n        else if (final) {\n            Inflate.prototype.c.call(this, final);\n        }\n    };\n    return Gunzip;\n}());\nexport { Gunzip };\n/**\n * Asynchronous streaming single or multi-member GZIP decompression\n */\nvar AsyncGunzip = /*#__PURE__*/ (function () {\n    function AsyncGunzip(opts, cb) {\n        var _this = this;\n        astrmify([\n            bInflt,\n            guze,\n            function () { return [astrm, Inflate, Gunzip]; }\n        ], this, StrmOpt.call(this, opts, cb), function (ev) {\n            var strm = new Gunzip(ev.data);\n            strm.onmember = function (offset) { return postMessage(offset); };\n            onmessage = astrm(strm);\n        }, 9, 0, function (offset) { return _this.onmember && _this.onmember(offset); });\n    }\n    return AsyncGunzip;\n}());\nexport { AsyncGunzip };\nexport function gunzip(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return cbify(data, opts, [\n        bInflt,\n        guze,\n        function () { return [gunzipSync]; }\n    ], function (ev) { return pbf(gunzipSync(ev.data[0], ev.data[1])); }, 3, cb);\n}\nexport function gunzipSync(data, opts) {\n    var st = gzs(data);\n    if (st + 8 > data.length)\n        err(6, 'invalid gzip data');\n    return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);\n}\n/**\n * Streaming Zlib compression\n */\nvar Zlib = /*#__PURE__*/ (function () {\n    function Zlib(opts, cb) {\n        this.c = adler();\n        this.v = 1;\n        Deflate.call(this, opts, cb);\n    }\n    /**\n     * Pushes a chunk to be zlibbed\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Zlib.prototype.push = function (chunk, final) {\n        this.c.p(chunk);\n        Deflate.prototype.push.call(this, chunk, final);\n    };\n    Zlib.prototype.p = function (c, f) {\n        var raw = dopt(c, this.o, this.v && (this.o.dictionary ? 6 : 2), f && 4, this.s);\n        if (this.v)\n            zlh(raw, this.o), this.v = 0;\n        if (f)\n            wbytes(raw, raw.length - 4, this.c.d());\n        this.ondata(raw, f);\n    };\n    /**\n     * Flushes buffered uncompressed data. Useful to immediately retrieve the\n     * zlibbed output for small inputs.\n     * @param sync Whether to flush to a byte boundary. A sync flush takes 4-5\n     *             extra bytes, but guarantees all pushed data is immediately\n     *             decompressible.\n     */\n    Zlib.prototype.flush = function (sync) {\n        Deflate.prototype.flush.call(this, sync);\n    };\n    return Zlib;\n}());\nexport { Zlib };\n/**\n * Asynchronous streaming Zlib compression\n */\nvar AsyncZlib = /*#__PURE__*/ (function () {\n    function AsyncZlib(opts, cb) {\n        astrmify([\n            bDflt,\n            zle,\n            function () { return [astrm, Deflate, Zlib]; }\n        ], this, StrmOpt.call(this, opts, cb), function (ev) {\n            var strm = new Zlib(ev.data);\n            onmessage = astrm(strm);\n        }, 10, 1);\n    }\n    return AsyncZlib;\n}());\nexport { AsyncZlib };\nexport function zlib(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return cbify(data, opts, [\n        bDflt,\n        zle,\n        function () { return [zlibSync]; }\n    ], function (ev) { return pbf(zlibSync(ev.data[0], ev.data[1])); }, 4, cb);\n}\n/**\n * Compress data with Zlib\n * @param data The data to compress\n * @param opts The compression options\n * @returns The zlib-compressed version of the data\n */\nexport function zlibSync(data, opts) {\n    if (!opts)\n        opts = {};\n    var a = adler();\n    a.p(data);\n    var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);\n    return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;\n}\n/**\n * Streaming Zlib decompression\n */\nvar Unzlib = /*#__PURE__*/ (function () {\n    function Unzlib(opts, cb) {\n        Inflate.call(this, opts, cb);\n        this.v = opts && opts.dictionary ? 2 : 1;\n    }\n    /**\n     * Pushes a chunk to be unzlibbed\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Unzlib.prototype.push = function (chunk, final) {\n        Inflate.prototype.e.call(this, chunk);\n        if (this.v) {\n            if (this.p.length < 6 && !final)\n                return;\n            this.p = this.p.subarray(zls(this.p, this.v - 1)), this.v = 0;\n        }\n        if (final) {\n            if (this.p.length < 4)\n                err(6, 'invalid zlib data');\n            this.p = this.p.subarray(0, -4);\n        }\n        // necessary to prevent TS from using the closure value\n        // This allows for workerization to function correctly\n        Inflate.prototype.c.call(this, final);\n    };\n    return Unzlib;\n}());\nexport { Unzlib };\n/**\n * Asynchronous streaming Zlib decompression\n */\nvar AsyncUnzlib = /*#__PURE__*/ (function () {\n    function AsyncUnzlib(opts, cb) {\n        astrmify([\n            bInflt,\n            zule,\n            function () { return [astrm, Inflate, Unzlib]; }\n        ], this, StrmOpt.call(this, opts, cb), function (ev) {\n            var strm = new Unzlib(ev.data);\n            onmessage = astrm(strm);\n        }, 11, 0);\n    }\n    return AsyncUnzlib;\n}());\nexport { AsyncUnzlib };\nexport function unzlib(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return cbify(data, opts, [\n        bInflt,\n        zule,\n        function () { return [unzlibSync]; }\n    ], function (ev) { return pbf(unzlibSync(ev.data[0], gopt(ev.data[1]))); }, 5, cb);\n}\nexport function unzlibSync(data, opts) {\n    return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);\n}\n// Default algorithm for compression (used because having a known output size allows faster decompression)\nexport { gzip as compress, AsyncGzip as AsyncCompress };\nexport { gzipSync as compressSync, Gzip as Compress };\n/**\n * Streaming GZIP, Zlib, or raw DEFLATE decompression\n */\nvar Decompress = /*#__PURE__*/ (function () {\n    function Decompress(opts, cb) {\n        this.o = StrmOpt.call(this, opts, cb) || {};\n        this.G = Gunzip;\n        this.I = Inflate;\n        this.Z = Unzlib;\n    }\n    // init substream\n    // overriden by AsyncDecompress\n    Decompress.prototype.i = function () {\n        var _this = this;\n        this.s.ondata = function (dat, final) {\n            _this.ondata(dat, final);\n        };\n    };\n    /**\n     * Pushes a chunk to be decompressed\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Decompress.prototype.push = function (chunk, final) {\n        if (!this.ondata)\n            err(5);\n        if (!this.s) {\n            if (this.p && this.p.length) {\n                var n = new u8(this.p.length + chunk.length);\n                n.set(this.p), n.set(chunk, this.p.length);\n            }\n            else\n                this.p = chunk;\n            if (this.p.length > 2) {\n                this.s = (this.p[0] == 31 && this.p[1] == 139 && this.p[2] == 8)\n                    ? new this.G(this.o)\n                    : ((this.p[0] & 15) != 8 || (this.p[0] >> 4) > 7 || ((this.p[0] << 8 | this.p[1]) % 31))\n                        ? new this.I(this.o)\n                        : new this.Z(this.o);\n                this.i();\n                this.s.push(this.p, final);\n                this.p = null;\n            }\n        }\n        else\n            this.s.push(chunk, final);\n    };\n    return Decompress;\n}());\nexport { Decompress };\n/**\n * Asynchronous streaming GZIP, Zlib, or raw DEFLATE decompression\n */\nvar AsyncDecompress = /*#__PURE__*/ (function () {\n    function AsyncDecompress(opts, cb) {\n        Decompress.call(this, opts, cb);\n        this.queuedSize = 0;\n        this.G = AsyncGunzip;\n        this.I = AsyncInflate;\n        this.Z = AsyncUnzlib;\n    }\n    AsyncDecompress.prototype.i = function () {\n        var _this = this;\n        this.s.ondata = function (err, dat, final) {\n            _this.ondata(err, dat, final);\n        };\n        this.s.ondrain = function (size) {\n            _this.queuedSize -= size;\n            if (_this.ondrain)\n                _this.ondrain(size);\n        };\n    };\n    /**\n     * Pushes a chunk to be decompressed\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    AsyncDecompress.prototype.push = function (chunk, final) {\n        this.queuedSize += chunk.length;\n        Decompress.prototype.push.call(this, chunk, final);\n    };\n    return AsyncDecompress;\n}());\nexport { AsyncDecompress };\nexport function decompress(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    return (data[0] == 31 && data[1] == 139 && data[2] == 8)\n        ? gunzip(data, opts, cb)\n        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))\n            ? inflate(data, opts, cb)\n            : unzlib(data, opts, cb);\n}\n/**\n * Expands compressed GZIP, Zlib, or raw DEFLATE data, automatically detecting the format\n * @param data The data to decompress\n * @param opts The decompression options\n * @returns The decompressed version of the data\n */\nexport function decompressSync(data, opts) {\n    return (data[0] == 31 && data[1] == 139 && data[2] == 8)\n        ? gunzipSync(data, opts)\n        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))\n            ? inflateSync(data, opts)\n            : unzlibSync(data, opts);\n}\n// flatten a directory structure\nvar fltn = function (d, p, t, o) {\n    for (var k in d) {\n        var val = d[k], n = p + k, op = o;\n        if (Array.isArray(val))\n            op = mrg(o, val[1]), val = val[0];\n        if (ArrayBuffer.isView(val))\n            t[n] = [val, op];\n        else {\n            t[n += '/'] = [new u8(0), op];\n            fltn(val, n, t, o);\n        }\n    }\n};\n// text encoder\nvar te = typeof TextEncoder != 'undefined' && /*#__PURE__*/ new TextEncoder();\n// text decoder\nvar td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();\n// text decoder stream\nvar tds = 0;\ntry {\n    td.decode(et, { stream: true });\n    tds = 1;\n}\ncatch (e) { }\n// decode UTF8\nvar dutf8 = function (d) {\n    for (var r = '', i = 0;;) {\n        var c = d[i++];\n        var eb = (c > 127) + (c > 223) + (c > 239);\n        if (i + eb > d.length)\n            return { s: r, r: slc(d, i - 1) };\n        if (!eb)\n            r += String.fromCharCode(c);\n        else if (eb == 3) {\n            c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | (d[i++] & 63)) - 65536,\n                r += String.fromCharCode(55296 | (c >> 10), 56320 | (c & 1023));\n        }\n        else if (eb & 1)\n            r += String.fromCharCode((c & 31) << 6 | (d[i++] & 63));\n        else\n            r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | (d[i++] & 63));\n    }\n};\n/**\n * Streaming UTF-8 decoding\n */\nvar DecodeUTF8 = /*#__PURE__*/ (function () {\n    /**\n     * Creates a UTF-8 decoding stream\n     * @param cb The callback to call whenever data is decoded\n     */\n    function DecodeUTF8(cb) {\n        this.ondata = cb;\n        if (tds)\n            this.t = new TextDecoder();\n        else\n            this.p = et;\n    }\n    /**\n     * Pushes a chunk to be decoded from UTF-8 binary\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    DecodeUTF8.prototype.push = function (chunk, final) {\n        if (!this.ondata)\n            err(5);\n        final = !!final;\n        if (this.t) {\n            this.ondata(this.t.decode(chunk, { stream: true }), final);\n            if (final) {\n                if (this.t.decode().length)\n                    err(8);\n                this.t = null;\n            }\n            return;\n        }\n        if (!this.p)\n            err(4);\n        var dat = new u8(this.p.length + chunk.length);\n        dat.set(this.p);\n        dat.set(chunk, this.p.length);\n        var _a = dutf8(dat), s = _a.s, r = _a.r;\n        if (final) {\n            if (r.length)\n                err(8);\n            this.p = null;\n        }\n        else\n            this.p = r;\n        this.ondata(s, final);\n    };\n    return DecodeUTF8;\n}());\nexport { DecodeUTF8 };\n/**\n * Streaming UTF-8 encoding\n */\nvar EncodeUTF8 = /*#__PURE__*/ (function () {\n    /**\n     * Creates a UTF-8 decoding stream\n     * @param cb The callback to call whenever data is encoded\n     */\n    function EncodeUTF8(cb) {\n        this.ondata = cb;\n    }\n    /**\n     * Pushes a chunk to be encoded to UTF-8\n     * @param chunk The string data to push\n     * @param final Whether this is the last chunk\n     */\n    EncodeUTF8.prototype.push = function (chunk, final) {\n        if (!this.ondata)\n            err(5);\n        if (this.d)\n            err(4);\n        this.ondata(strToU8(chunk), this.d = final || false);\n    };\n    return EncodeUTF8;\n}());\nexport { EncodeUTF8 };\n/**\n * Converts a string into a Uint8Array for use with compression/decompression methods\n * @param str The string to encode\n * @param latin1 Whether or not to interpret the data as Latin-1. This should\n *               not need to be true unless decoding a binary string.\n * @returns The string encoded in UTF-8/Latin-1 binary\n */\nexport function strToU8(str, latin1) {\n    if (latin1) {\n        var ar_1 = new u8(str.length);\n        for (var i = 0; i < str.length; ++i)\n            ar_1[i] = str.charCodeAt(i);\n        return ar_1;\n    }\n    if (te)\n        return te.encode(str);\n    var l = str.length;\n    var ar = new u8(str.length + (str.length >> 1));\n    var ai = 0;\n    var w = function (v) { ar[ai++] = v; };\n    for (var i = 0; i < l; ++i) {\n        if (ai + 5 > ar.length) {\n            var n = new u8(ai + 8 + ((l - i) << 1));\n            n.set(ar);\n            ar = n;\n        }\n        var c = str.charCodeAt(i);\n        if (c < 128 || latin1)\n            w(c);\n        else if (c < 2048)\n            w(192 | (c >> 6)), w(128 | (c & 63));\n        else if (c > 55295 && c < 57344)\n            c = 65536 + (c & 1023 << 10) | (str.charCodeAt(++i) & 1023),\n                w(240 | (c >> 18)), w(128 | ((c >> 12) & 63)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));\n        else\n            w(224 | (c >> 12)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));\n    }\n    return slc(ar, 0, ai);\n}\n/**\n * Converts a Uint8Array to a string\n * @param dat The data to decode to string\n * @param latin1 Whether or not to interpret the data as Latin-1. This should\n *               not need to be true unless encoding to binary string.\n * @returns The original UTF-8/Latin-1 string\n */\nexport function strFromU8(dat, latin1) {\n    if (latin1) {\n        var r = '';\n        for (var i = 0; i < dat.length; i += 16384)\n            r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));\n        return r;\n    }\n    else if (td) {\n        return td.decode(dat);\n    }\n    else {\n        var _a = dutf8(dat), s = _a.s, r = _a.r;\n        if (r.length)\n            err(8);\n        return s;\n    }\n}\n;\n// deflate bit flag\nvar dbf = function (l) { return l == 1 ? 3 : l < 6 ? 2 : l == 9 ? 1 : 0; };\n// skip local zip header\nvar slzh = function (d, b) { return b + 30 + b2(d, b + 26) + b2(d, b + 28); };\n// read zip header\nvar zh = function (d, b, z) {\n    var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;\n    var _a = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a[0], su = _a[1], off = _a[2];\n    return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];\n};\n// read zip64 header sizes\nvar z64hs = function (d, b, l, z, sc, su, off) {\n    var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;\n    var nf = nsc + nsu + noff;\n    if (z && nf) {\n        for (; b + 4 < e; b += 4 + b2(d, b + 2)) {\n            if (b2(d, b) == 1) {\n                return [\n                    nsc ? b8(d, b + 4 + 8 * nsu) : sc,\n                    nsu ? b8(d, b + 4) : su,\n                    noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,\n                    1\n                ];\n            }\n        }\n        // z == 2 for unknown whether or not zip64\n        if (z < 2)\n            err(13);\n    }\n    return [sc, su, off, 0];\n};\n// extra field length\nvar exfl = function (ex) {\n    var le = 0;\n    if (ex) {\n        for (var k in ex) {\n            var l = ex[k].length;\n            if (l > 65535)\n                err(9);\n            le += l + 4;\n        }\n    }\n    return le;\n};\n// write zip header\nvar wzh = function (d, b, f, fn, u, c, ce, co) {\n    var fl = fn.length, ex = f.extra, col = co && co.length;\n    var exl = exfl(ex);\n    wbytes(d, b, ce != null ? 0x2014B50 : 0x4034B50), b += 4;\n    if (ce != null)\n        d[b++] = 20, d[b++] = f.os;\n    d[b] = 20, b += 2; // spec compliance? what's that?\n    d[b++] = (f.flag << 1) | (c < 0 && 8), d[b++] = u && 8;\n    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;\n    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;\n    if (y < 0 || y > 119)\n        err(10);\n    wbytes(d, b, (y << 25) | ((dt.getMonth() + 1) << 21) | (dt.getDate() << 16) | (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1)), b += 4;\n    if (c != -1) {\n        wbytes(d, b, f.crc);\n        wbytes(d, b + 4, c < 0 ? -c - 2 : c);\n        wbytes(d, b + 8, f.size);\n    }\n    wbytes(d, b + 12, fl);\n    wbytes(d, b + 14, exl), b += 16;\n    if (ce != null) {\n        wbytes(d, b, col);\n        wbytes(d, b + 6, f.attrs);\n        wbytes(d, b + 10, ce), b += 14;\n    }\n    d.set(fn, b);\n    b += fl;\n    if (exl) {\n        for (var k in ex) {\n            var exf = ex[k], l = exf.length;\n            wbytes(d, b, +k);\n            wbytes(d, b + 2, l);\n            d.set(exf, b + 4), b += 4 + l;\n        }\n    }\n    if (col)\n        d.set(co, b), b += col;\n    return b;\n};\n// write zip footer (end of central directory)\nvar wzf = function (o, b, c, d, e) {\n    wbytes(o, b, 0x6054B50); // skip disk\n    wbytes(o, b + 8, c);\n    wbytes(o, b + 10, c);\n    wbytes(o, b + 12, d);\n    wbytes(o, b + 16, e);\n};\n/**\n * A pass-through stream to keep data uncompressed in a ZIP archive.\n */\nvar ZipPassThrough = /*#__PURE__*/ (function () {\n    /**\n     * Creates a pass-through stream that can be added to ZIP archives\n     * @param filename The filename to associate with this data stream\n     */\n    function ZipPassThrough(filename) {\n        this.filename = filename;\n        this.c = crc();\n        this.size = 0;\n        this.compression = 0;\n    }\n    /**\n     * Processes a chunk and pushes to the output stream. You can override this\n     * method in a subclass for custom behavior, but by default this passes\n     * the data through. You must call this.ondata(err, chunk, final) at some\n     * point in this method.\n     * @param chunk The chunk to process\n     * @param final Whether this is the last chunk\n     */\n    ZipPassThrough.prototype.process = function (chunk, final) {\n        this.ondata(null, chunk, final);\n    };\n    /**\n     * Pushes a chunk to be added. If you are subclassing this with a custom\n     * compression algorithm, note that you must push data from the source\n     * file only, pre-compression.\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    ZipPassThrough.prototype.push = function (chunk, final) {\n        if (!this.ondata)\n            err(5);\n        this.c.p(chunk);\n        this.size += chunk.length;\n        if (final)\n            this.crc = this.c.d();\n        // we shouldn't really do this cast, but properly handling ArrayBufferLike\n        // makes the API unergonomic with Buffer\n        this.process(chunk, final || false);\n    };\n    return ZipPassThrough;\n}());\nexport { ZipPassThrough };\n// I don't extend because TypeScript extension adds 1kB of runtime bloat\n/**\n * Streaming DEFLATE compression for ZIP archives. Prefer using AsyncZipDeflate\n * for better performance\n */\nvar ZipDeflate = /*#__PURE__*/ (function () {\n    /**\n     * Creates a DEFLATE stream that can be added to ZIP archives\n     * @param filename The filename to associate with this data stream\n     * @param opts The compression options\n     */\n    function ZipDeflate(filename, opts) {\n        var _this = this;\n        if (!opts)\n            opts = {};\n        ZipPassThrough.call(this, filename);\n        this.d = new Deflate(opts, function (dat, final) {\n            _this.ondata(null, dat, final);\n        });\n        this.compression = 8;\n        this.flag = dbf(opts.level);\n    }\n    ZipDeflate.prototype.process = function (chunk, final) {\n        try {\n            this.d.push(chunk, final);\n        }\n        catch (e) {\n            this.ondata(e, null, final);\n        }\n    };\n    /**\n     * Pushes a chunk to be deflated\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    ZipDeflate.prototype.push = function (chunk, final) {\n        ZipPassThrough.prototype.push.call(this, chunk, final);\n    };\n    return ZipDeflate;\n}());\nexport { ZipDeflate };\n/**\n * Asynchronous streaming DEFLATE compression for ZIP archives\n */\nvar AsyncZipDeflate = /*#__PURE__*/ (function () {\n    /**\n     * Creates an asynchronous DEFLATE stream that can be added to ZIP archives\n     * @param filename The filename to associate with this data stream\n     * @param opts The compression options\n     */\n    function AsyncZipDeflate(filename, opts) {\n        var _this = this;\n        if (!opts)\n            opts = {};\n        ZipPassThrough.call(this, filename);\n        this.d = new AsyncDeflate(opts, function (err, dat, final) {\n            _this.ondata(err, dat, final);\n        });\n        this.compression = 8;\n        this.flag = dbf(opts.level);\n        this.terminate = this.d.terminate;\n    }\n    AsyncZipDeflate.prototype.process = function (chunk, final) {\n        this.d.push(chunk, final);\n    };\n    /**\n     * Pushes a chunk to be deflated\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    AsyncZipDeflate.prototype.push = function (chunk, final) {\n        ZipPassThrough.prototype.push.call(this, chunk, final);\n    };\n    return AsyncZipDeflate;\n}());\nexport { AsyncZipDeflate };\n// TODO: Better tree shaking\n/**\n * A zippable archive to which files can incrementally be added\n */\nvar Zip = /*#__PURE__*/ (function () {\n    /**\n     * Creates an empty ZIP archive to which files can be added\n     * @param cb The callback to call whenever data for the generated ZIP archive\n     *           is available\n     */\n    function Zip(cb) {\n        this.ondata = cb;\n        this.u = [];\n        this.d = 1;\n    }\n    /**\n     * Adds a file to the ZIP archive\n     * @param file The file stream to add\n     */\n    Zip.prototype.add = function (file) {\n        var _this = this;\n        if (!this.ondata)\n            err(5);\n        // finishing or finished\n        if (this.d & 2)\n            this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);\n        else {\n            var f = strToU8(file.filename), fl_1 = f.length;\n            var com = file.comment, o = com && strToU8(com);\n            var u = fl_1 != file.filename.length || (o && (com.length != o.length));\n            var hl_1 = fl_1 + exfl(file.extra) + 30;\n            if (fl_1 > 65535)\n                this.ondata(err(11, 0, 1), null, false);\n            var header = new u8(hl_1);\n            wzh(header, 0, file, f, u, -1);\n            var chks_1 = [header];\n            var pAll_1 = function () {\n                for (var _i = 0, chks_2 = chks_1; _i < chks_2.length; _i++) {\n                    var chk = chks_2[_i];\n                    _this.ondata(null, chk, false);\n                }\n                chks_1 = [];\n            };\n            var tr_1 = this.d;\n            this.d = 0;\n            var ind_1 = this.u.length;\n            var uf_1 = mrg(file, {\n                f: f,\n                u: u,\n                o: o,\n                t: function () {\n                    if (file.terminate)\n                        file.terminate();\n                },\n                r: function () {\n                    pAll_1();\n                    if (tr_1) {\n                        var nxt = _this.u[ind_1 + 1];\n                        if (nxt)\n                            nxt.r();\n                        else\n                            _this.d = 1;\n                    }\n                    tr_1 = 1;\n                }\n            });\n            var cl_1 = 0;\n            file.ondata = function (err, dat, final) {\n                if (err) {\n                    _this.ondata(err, dat, final);\n                    _this.terminate();\n                }\n                else {\n                    cl_1 += dat.length;\n                    chks_1.push(dat);\n                    if (final) {\n                        var dd = new u8(16);\n                        wbytes(dd, 0, 0x8074B50);\n                        wbytes(dd, 4, file.crc);\n                        wbytes(dd, 8, cl_1);\n                        wbytes(dd, 12, file.size);\n                        chks_1.push(dd);\n                        uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;\n                        if (tr_1)\n                            uf_1.r();\n                        tr_1 = 1;\n                    }\n                    else if (tr_1)\n                        pAll_1();\n                }\n            };\n            this.u.push(uf_1);\n        }\n    };\n    /**\n     * Ends the process of adding files and prepares to emit the final chunks.\n     * This *must* be called after adding all desired files for the resulting\n     * ZIP file to work properly.\n     */\n    Zip.prototype.end = function () {\n        var _this = this;\n        if (this.d & 2) {\n            this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);\n            return;\n        }\n        if (this.d)\n            this.e();\n        else\n            this.u.push({\n                r: function () {\n                    if (!(_this.d & 1))\n                        return;\n                    _this.u.splice(-1, 1);\n                    _this.e();\n                },\n                t: function () { }\n            });\n        this.d = 3;\n    };\n    Zip.prototype.e = function () {\n        var bt = 0, l = 0, tl = 0;\n        for (var _i = 0, _a = this.u; _i < _a.length; _i++) {\n            var f = _a[_i];\n            tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);\n        }\n        var out = new u8(tl + 22);\n        for (var _b = 0, _c = this.u; _b < _c.length; _b++) {\n            var f = _c[_b];\n            wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);\n            bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;\n        }\n        wzf(out, bt, this.u.length, tl, l);\n        this.ondata(null, out, true);\n        this.d = 2;\n    };\n    /**\n     * A method to terminate any internal workers used by the stream. Subsequent\n     * calls to add() will fail.\n     */\n    Zip.prototype.terminate = function () {\n        for (var _i = 0, _a = this.u; _i < _a.length; _i++) {\n            var f = _a[_i];\n            f.t();\n        }\n        this.d = 2;\n    };\n    return Zip;\n}());\nexport { Zip };\nexport function zip(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    var r = {};\n    fltn(data, '', r, opts);\n    var k = Object.keys(r);\n    var lft = k.length, o = 0, tot = 0;\n    var slft = lft, files = new Array(lft);\n    var term = [];\n    var tAll = function () {\n        for (var i = 0; i < term.length; ++i)\n            term[i]();\n    };\n    var cbd = function (a, b) {\n        mt(function () { cb(a, b); });\n    };\n    mt(function () { cbd = cb; });\n    var cbf = function () {\n        var out = new u8(tot + 22), oe = o, cdl = tot - o;\n        tot = 0;\n        for (var i = 0; i < slft; ++i) {\n            var f = files[i];\n            try {\n                var l = f.c.length;\n                wzh(out, tot, f, f.f, f.u, l);\n                var badd = 30 + f.f.length + exfl(f.extra);\n                var loc = tot + badd;\n                out.set(f.c, loc);\n                wzh(out, o, f, f.f, f.u, l, tot, f.m), o += 16 + badd + (f.m ? f.m.length : 0), tot = loc + l;\n            }\n            catch (e) {\n                return cbd(e, null);\n            }\n        }\n        wzf(out, o, files.length, cdl, oe);\n        cbd(null, out);\n    };\n    if (!lft)\n        cbf();\n    var _loop_1 = function (i) {\n        var fn = k[i];\n        var _a = r[fn], file = _a[0], p = _a[1];\n        var c = crc(), size = file.length;\n        c.p(file);\n        var f = strToU8(fn), s = f.length;\n        var com = p.comment, m = com && strToU8(com), ms = m && m.length;\n        var exl = exfl(p.extra);\n        var compression = p.level == 0 ? 0 : 8;\n        var cbl = function (e, d) {\n            if (e) {\n                tAll();\n                cbd(e, null);\n            }\n            else {\n                var l = d.length;\n                files[i] = mrg(p, {\n                    size: size,\n                    crc: c.d(),\n                    c: d,\n                    f: f,\n                    m: m,\n                    u: s != fn.length || (m && (com.length != ms)),\n                    compression: compression\n                });\n                o += 30 + s + exl + l;\n                tot += 76 + 2 * (s + exl) + (ms || 0) + l;\n                if (!--lft)\n                    cbf();\n            }\n        };\n        if (s > 65535)\n            cbl(err(11, 0, 1), null);\n        if (!compression)\n            cbl(null, file);\n        else if (size < 160000) {\n            try {\n                cbl(null, deflateSync(file, p));\n            }\n            catch (e) {\n                cbl(e, null);\n            }\n        }\n        else\n            term.push(deflate(file, p, cbl));\n    };\n    // Cannot use lft because it can decrease\n    for (var i = 0; i < slft; ++i) {\n        _loop_1(i);\n    }\n    return tAll;\n}\n/**\n * Synchronously creates a ZIP file. Prefer using `zip` for better performance\n * with more than one file.\n * @param data The directory structure for the ZIP archive\n * @param opts The main options, merged with per-file options\n * @returns The generated ZIP archive\n */\nexport function zipSync(data, opts) {\n    if (!opts)\n        opts = {};\n    var r = {};\n    var files = [];\n    fltn(data, '', r, opts);\n    var o = 0;\n    var tot = 0;\n    for (var fn in r) {\n        var _a = r[fn], file = _a[0], p = _a[1];\n        var compression = p.level == 0 ? 0 : 8;\n        var f = strToU8(fn), s = f.length;\n        var com = p.comment, m = com && strToU8(com), ms = m && m.length;\n        var exl = exfl(p.extra);\n        if (s > 65535)\n            err(11);\n        var d = compression ? deflateSync(file, p) : file, l = d.length;\n        var c = crc();\n        c.p(file);\n        files.push(mrg(p, {\n            size: file.length,\n            crc: c.d(),\n            c: d,\n            f: f,\n            m: m,\n            u: s != fn.length || (m && (com.length != ms)),\n            o: o,\n            compression: compression\n        }));\n        o += 30 + s + exl + l;\n        tot += 76 + 2 * (s + exl) + (ms || 0) + l;\n    }\n    var out = new u8(tot + 22), oe = o, cdl = tot - o;\n    for (var i = 0; i < files.length; ++i) {\n        var f = files[i];\n        wzh(out, f.o, f, f.f, f.u, f.c.length);\n        var badd = 30 + f.f.length + exfl(f.extra);\n        out.set(f.c, f.o + badd);\n        wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);\n    }\n    wzf(out, o, files.length, cdl, oe);\n    return out;\n}\n/**\n * Streaming pass-through decompression for ZIP archives\n */\nvar UnzipPassThrough = /*#__PURE__*/ (function () {\n    function UnzipPassThrough() {\n    }\n    UnzipPassThrough.prototype.push = function (chunk, final) {\n        // same as ZipPassThrough: cast to retain Buffer ergonomics\n        this.ondata(null, chunk, final);\n    };\n    UnzipPassThrough.compression = 0;\n    return UnzipPassThrough;\n}());\nexport { UnzipPassThrough };\n/**\n * Streaming DEFLATE decompression for ZIP archives. Prefer AsyncZipInflate for\n * better performance.\n */\nvar UnzipInflate = /*#__PURE__*/ (function () {\n    /**\n     * Creates a DEFLATE decompression that can be used in ZIP archives\n     */\n    function UnzipInflate() {\n        var _this = this;\n        this.i = new Inflate(function (dat, final) {\n            _this.ondata(null, dat, final);\n        });\n    }\n    UnzipInflate.prototype.push = function (chunk, final) {\n        try {\n            this.i.push(chunk, final);\n        }\n        catch (e) {\n            this.ondata(e, null, final);\n        }\n    };\n    UnzipInflate.compression = 8;\n    return UnzipInflate;\n}());\nexport { UnzipInflate };\n/**\n * Asynchronous streaming DEFLATE decompression for ZIP archives\n */\nvar AsyncUnzipInflate = /*#__PURE__*/ (function () {\n    /**\n     * Creates a DEFLATE decompression that can be used in ZIP archives\n     */\n    function AsyncUnzipInflate(_, sz) {\n        var _this = this;\n        if (sz < 320000) {\n            this.i = new Inflate(function (dat, final) {\n                _this.ondata(null, dat, final);\n            });\n        }\n        else {\n            this.i = new AsyncInflate(function (err, dat, final) {\n                _this.ondata(err, dat, final);\n            });\n            this.terminate = this.i.terminate;\n        }\n    }\n    AsyncUnzipInflate.prototype.push = function (chunk, final) {\n        if (this.i.terminate)\n            chunk = slc(chunk, 0);\n        this.i.push(chunk, final);\n    };\n    AsyncUnzipInflate.compression = 8;\n    return AsyncUnzipInflate;\n}());\nexport { AsyncUnzipInflate };\n/**\n * A ZIP archive decompression stream that emits files as they are discovered\n */\nvar Unzip = /*#__PURE__*/ (function () {\n    /**\n     * Creates a ZIP decompression stream\n     * @param cb The callback to call whenever a file in the ZIP archive is found\n     */\n    function Unzip(cb) {\n        this.onfile = cb;\n        this.k = [];\n        this.o = {\n            0: UnzipPassThrough\n        };\n        this.p = et;\n    }\n    /**\n     * Pushes a chunk to be unzipped\n     * @param chunk The chunk to push\n     * @param final Whether this is the last chunk\n     */\n    Unzip.prototype.push = function (chunk, final) {\n        var _this = this;\n        if (!this.onfile)\n            err(5);\n        if (!this.p)\n            err(4);\n        if (this.c > 0) {\n            var len = Math.min(this.c, chunk.length);\n            var toAdd = chunk.subarray(0, len);\n            this.c -= len;\n            if (this.d)\n                this.d.push(toAdd, !this.c);\n            else\n                this.k[0].push(toAdd);\n            chunk = chunk.subarray(len);\n            if (chunk.length)\n                return this.push(chunk, final);\n        }\n        else {\n            var f = 0, i = 0, is = void 0, buf = void 0;\n            if (!this.p.length)\n                buf = chunk;\n            else if (!chunk.length)\n                buf = this.p;\n            else {\n                buf = new u8(this.p.length + chunk.length);\n                buf.set(this.p), buf.set(chunk, this.p.length);\n            }\n            var l = buf.length, oc = this.c, add = oc && this.d;\n            var _loop_2 = function () {\n                var sig = b4(buf, i);\n                if (sig == 0x4034B50) {\n                    f = 1, is = i;\n                    this_1.d = null;\n                    this_1.c = 0;\n                    var bf = b2(buf, i + 6), cmp_1 = b2(buf, i + 8), u = bf & 2048, dd = bf & 8, fnl = b2(buf, i + 26), es = b2(buf, i + 28);\n                    if (l > i + 30 + fnl + es) {\n                        var chks_3 = [];\n                        this_1.k.unshift(chks_3);\n                        f = 2;\n                        var lsc = b4(buf, i + 18), lsu = b4(buf, i + 22);\n                        var fn_1 = strFromU8(buf.subarray(i + 30, i += 30 + fnl), !u);\n                        var _a = z64hs(buf, i, es, 2, lsc, lsu, 0), sc_1 = _a[0], su_1 = _a[1], z64 = _a[3];\n                        if (dd)\n                            sc_1 = -1 - z64;\n                        i += es;\n                        this_1.c = sc_1;\n                        var d_1;\n                        var file_1 = {\n                            name: fn_1,\n                            compression: cmp_1,\n                            start: function () {\n                                if (!file_1.ondata)\n                                    err(5);\n                                if (!sc_1)\n                                    file_1.ondata(null, et, true);\n                                else {\n                                    var ctr = _this.o[cmp_1];\n                                    if (!ctr)\n                                        file_1.ondata(err(14, 'unknown compression type ' + cmp_1, 1), null, false);\n                                    d_1 = sc_1 < 0 ? new ctr(fn_1) : new ctr(fn_1, sc_1, su_1);\n                                    d_1.ondata = function (err, dat, final) { file_1.ondata(err, dat, final); };\n                                    for (var _i = 0, chks_4 = chks_3; _i < chks_4.length; _i++) {\n                                        var dat = chks_4[_i];\n                                        d_1.push(dat, false);\n                                    }\n                                    if (_this.k[0] == chks_3 && _this.c)\n                                        _this.d = d_1;\n                                    else\n                                        d_1.push(et, true);\n                                }\n                            },\n                            terminate: function () {\n                                if (d_1 && d_1.terminate)\n                                    d_1.terminate();\n                            }\n                        };\n                        if (sc_1 >= 0)\n                            file_1.size = sc_1, file_1.originalSize = su_1;\n                        this_1.onfile(file_1);\n                    }\n                    return \"break\";\n                }\n                else if (oc) {\n                    if (sig == 0x8074B50) {\n                        is = i += 12 + (oc == -2 && 8), f = 3, this_1.c = 0;\n                        return \"break\";\n                    }\n                    else if (sig == 0x2014B50) {\n                        is = i -= 4, f = 3, this_1.c = 0;\n                        return \"break\";\n                    }\n                }\n            };\n            var this_1 = this;\n            for (; i < l - 4; ++i) {\n                var state_1 = _loop_2();\n                if (state_1 === \"break\")\n                    break;\n            }\n            this.p = et;\n            if (oc < 0) {\n                var dat = f ? buf.subarray(0, is - 12 - (oc == -2 && 8) - (b4(buf, is - 16) == 0x8074B50 && 4)) : buf.subarray(0, i);\n                if (add)\n                    add.push(dat, !!f);\n                else\n                    this.k[+(f == 2)].push(dat);\n            }\n            if (f & 2)\n                return this.push(buf.subarray(i), final);\n            this.p = buf.subarray(i);\n        }\n        if (final) {\n            if (this.c)\n                err(13);\n            this.p = null;\n        }\n    };\n    /**\n     * Registers a decoder with the stream, allowing for files compressed with\n     * the compression type provided to be expanded correctly\n     * @param decoder The decoder constructor\n     */\n    Unzip.prototype.register = function (decoder) {\n        this.o[decoder.compression] = decoder;\n    };\n    return Unzip;\n}());\nexport { Unzip };\nvar mt = typeof queueMicrotask == 'function' ? queueMicrotask : typeof setTimeout == 'function' ? setTimeout : function (fn) { fn(); };\nexport function unzip(data, opts, cb) {\n    if (!cb)\n        cb = opts, opts = {};\n    if (typeof cb != 'function')\n        err(7);\n    var term = [];\n    var tAll = function () {\n        for (var i = 0; i < term.length; ++i)\n            term[i]();\n    };\n    var files = {};\n    var cbd = function (a, b) {\n        mt(function () { cb(a, b); });\n    };\n    mt(function () { cbd = cb; });\n    var e = data.length - 22;\n    for (; b4(data, e) != 0x6054B50; --e) {\n        if (!e || data.length - e > 65558) {\n            cbd(err(13, 0, 1), null);\n            return tAll;\n        }\n    }\n    ;\n    var lft = b2(data, e + 8);\n    if (lft) {\n        var c = lft;\n        var o = b4(data, e + 16);\n        var z = b4(data, e - 20) == 0x7064B50;\n        if (z) {\n            var ze = b4(data, e - 12);\n            z = b4(data, ze) == 0x6064B50;\n            if (z) {\n                c = lft = b4(data, ze + 32);\n                o = b4(data, ze + 48);\n            }\n        }\n        var fltr = opts && opts.filter;\n        var _loop_3 = function (i) {\n            var _a = zh(data, o, z), c_1 = _a[0], sc = _a[1], su = _a[2], fn = _a[3], no = _a[4], off = _a[5], b = slzh(data, off);\n            o = no;\n            var cbl = function (e, d) {\n                if (e) {\n                    tAll();\n                    cbd(e, null);\n                }\n                else {\n                    if (d)\n                        files[fn] = d;\n                    if (!--lft)\n                        cbd(null, files);\n                }\n            };\n            if (!fltr || fltr({\n                name: fn,\n                size: sc,\n                originalSize: su,\n                compression: c_1\n            })) {\n                if (!c_1)\n                    cbl(null, slc(data, b, b + sc));\n                else if (c_1 == 8) {\n                    var infl = data.subarray(b, b + sc);\n                    // Synchronously decompress under 512KB, or barely-compressed data\n                    if (su < 524288 || sc > 0.8 * su) {\n                        try {\n                            cbl(null, inflateSync(infl, { out: new u8(su) }));\n                        }\n                        catch (e) {\n                            cbl(e, null);\n                        }\n                    }\n                    else\n                        term.push(inflate(infl, { size: su }, cbl));\n                }\n                else\n                    cbl(err(14, 'unknown compression type ' + c_1, 1), null);\n            }\n            else\n                cbl(null, null);\n        };\n        for (var i = 0; i < c; ++i) {\n            _loop_3(i);\n        }\n    }\n    else\n        cbd(null, {});\n    return tAll;\n}\n/**\n * Synchronously decompresses a ZIP archive. Prefer using `unzip` for better\n * performance with more than one file.\n * @param data The raw compressed ZIP file\n * @param opts The ZIP extraction options\n * @returns The decompressed files\n */\nexport function unzipSync(data, opts) {\n    var files = {};\n    var e = data.length - 22;\n    for (; b4(data, e) != 0x6054B50; --e) {\n        if (!e || data.length - e > 65558)\n            err(13);\n    }\n    ;\n    var c = b2(data, e + 8);\n    if (!c)\n        return {};\n    var o = b4(data, e + 16);\n    var z = b4(data, e - 20) == 0x7064B50;\n    if (z) {\n        var ze = b4(data, e - 12);\n        z = b4(data, ze) == 0x6064B50;\n        if (z) {\n            c = b4(data, ze + 32);\n            o = b4(data, ze + 48);\n        }\n    }\n    var fltr = opts && opts.filter;\n    for (var i = 0; i < c; ++i) {\n        var _a = zh(data, o, z), c_2 = _a[0], sc = _a[1], su = _a[2], fn = _a[3], no = _a[4], off = _a[5], b = slzh(data, off);\n        o = no;\n        if (!fltr || fltr({\n            name: fn,\n            size: sc,\n            originalSize: su,\n            compression: c_2\n        })) {\n            if (!c_2)\n                files[fn] = slc(data, b, b + sc);\n            else if (c_2 == 8)\n                files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });\n            else\n                err(14, 'unknown compression type ' + c_2);\n        }\n    }\n    return files;\n}\n", "// src/utils/id-utils.ts\n\n/**\n * Type extending an object with an `_id` property.\n * @template T The base object type.\n */\nexport type WithId<T> = T & { _id: string };\n\n/**\n * Generates a short, secure unique identifier.\n * Uses Web Crypto API if available, otherwise falls back to a mathematical generator.\n *\n * @returns {string} Generated 12-character ID (hexadecimal or base36).\n *\n * @example\n * ```ts\n * const id = gerarId();\n * console.log(id); // \"a1b2c3d4e5f6\"\n * ```\n */\nexport function gerarId(): string {\n  if (typeof crypto !== \"undefined\" && crypto.getRandomValues) {\n    const array = new Uint8Array(12);\n    crypto.getRandomValues(array);\n    return Array.from(array, (byte) => byte.toString(16).padStart(2, \"0\"))\n      .join(\"\").substring(\n        0,\n        12,\n      );\n  }\n  return gerarIdFallback();\n}\n\n/**\n * Fallback for ID generation if crypto.getRandomValues is unavailable.\n * Combines a base36 timestamp with a random string.\n *\n * @returns {string} Temporary ID.\n */\nexport function gerarIdFallback(): string {\n  return Date.now().toString(36) +\n    Math.random().toString(36).substring(2, 8);\n}\n\n/**\n * Validates whether a string has an acceptable WorkerDB ID format.\n *\n * @param {string} id The ID to validate.\n * @returns {boolean} True if the ID is valid (non-empty string up to 24 characters).\n */\nexport function validarId(id: string): boolean {\n  return typeof id === \"string\" && id.length > 0 && id.length <= 24;\n}\n\n/**\n * Generates a prefixed unique ID.\n *\n * @param {string} prefix The prefix to prepend to the ID.\n * @returns {string} The prefixed ID.\n */\nexport function gerarIdComPrefixo(prefix: string): string {\n  return `${prefix}${gerarId()}`;\n}\n\n/**\n * Dynamically injects the `_id` field into an object when reading from storage,\n * stripping the prefix if present.\n *\n * @param {IDBValidKey} key The raw IndexedDB/LocalStorage key.\n * @param {unknown} val The raw stored value.\n * @param {string} [prefix=\"\"] The prefix to remove from the key.\n * @returns {unknown} The object with the injected `_id` field.\n * @internal\n */\nexport function formatDbItem(\n  key: IDBValidKey,\n  val: unknown,\n  prefix = \"\",\n): unknown {\n  if (!val || typeof val !== \"object\" || Array.isArray(val)) return val;\n  const keyStr = String(key);\n  const _id = prefix && keyStr.startsWith(prefix)\n    ? keyStr.slice(prefix.length)\n    : keyStr;\n  return { _id, ...val };\n}\n\n/**\n * Prepares a record for storage, generating automatic keys and stripping the internal `_id`.\n *\n * @param {string | undefined | null} key Suggested key or \"auto\".\n * @param {unknown} val Object to be saved.\n * @param {string} [prefix=\"\"] Prefix to apply to the final key.\n * @returns {{ key: string; cleanVal: unknown }} Object containing the final key and sanitized value.\n * @throws {Error} If no key can be determined.\n * @internal\n */\nexport function prepareForSave(\n  key: string | undefined | null,\n  val: unknown,\n  prefix = \"\",\n): { key: string; cleanVal: unknown } {\n  let rawId = val && typeof val === \"object\" && !Array.isArray(val)\n    ? (val as Record<string, unknown>)._id as string | undefined\n    : undefined;\n\n  if (rawId === \"auto\") {\n    rawId = gerarId();\n  }\n\n  // Intercept key provided as \"auto\" via direct parameter or setMany tuple\n  const processKey = key === \"auto\" ? gerarId() : key;\n\n  let finalKey = processKey || \"\";\n\n  if (rawId) {\n    if (prefix && rawId.startsWith(prefix)) {\n      finalKey = rawId;\n    } else {\n      finalKey = prefix ? `${prefix}${rawId}` : rawId;\n    }\n  } else if (processKey) {\n    if (prefix && processKey.startsWith(prefix)) {\n      finalKey = processKey;\n    } else {\n      finalKey = prefix ? `${prefix}${processKey}` : processKey;\n    }\n  }\n\n  if (!finalKey) {\n    throw new Error(\n      \"A key or an '_id' attribute on the object must be provided.\",\n    );\n  }\n\n  if (\n    val && typeof val === \"object\" && !Array.isArray(val) &&\n    \"_id\" in (val as Record<string, unknown>)\n  ) {\n    const { _id: _, ...cleanVal } = val as Record<string, unknown>;\n    return { key: finalKey, cleanVal };\n  }\n\n  return { key: finalKey, cleanVal: val };\n}\n", "// src/db.ts\n// Central database module: Single source of truth for IDB and OPFS manipulation.\nimport {\n  clear,\n  createStore,\n  del,\n  delMany,\n  entries,\n  get,\n  getMany,\n  keys,\n  set,\n  setMany,\n  type UseStore,\n  values,\n} from \"./utils/idb-keyval.ts\";\nimport { unzipSync, zipSync } from \"fflate\";\n\nimport {\n  formatDbItem,\n  gerarId,\n  gerarIdComPrefixo,\n  prepareForSave,\n  type WithId,\n} from \"./utils/id.ts\";\n\n// ============================================================================\n// TYPE DEFINITIONS (Single Source of Truth)\n// ============================================================================\n/**\n * Configuration options for IndexedDB Object Stores.\n */\nexport interface DbStoreOptions {\n  /** Name of the IndexedDB database. */\n  dbName?: string;\n  /** Name of the object store within the database. */\n  storeName?: string;\n  /** Optional prefix for key isolation in this instance. */\n  prefix?: string;\n  /** List of field names to index. */\n  indexes?: string[];\n  /** Database version (incremental). */\n  dbVersion?: number;\n  /** String representation of validation function (used across RPC). */\n  validatorStr?: string;\n  /** Optional validation function for saved records. */\n  validator?: (val: unknown) => boolean;\n}\n\n/**\n * Extended options for OPFS storage.\n */\nexport interface OpfsStoreOptions extends DbStoreOptions {\n  /** Base path (root directory) in OPFS. */\n  basePath?: string;\n}\n\n/**\n * File metadata in OPFS.\n */\nexport interface OpfsFileInfo {\n  /** Name of the file. */\n  name: string;\n  /** Size in bytes. */\n  size: number;\n  /** MIME type of the file. */\n  type: string;\n  /** Timestamp of last modification. */\n  lastModified: number;\n}\n\n/**\n * Query range for index operations.\n */\nexport interface IndexRange {\n  /** Exact match value. */\n  eq?: IDBValidKey;\n  /** Greater than. */\n  gt?: IDBValidKey;\n  /** Greater than or equal to. */\n  gte?: IDBValidKey;\n  /** Less than. */\n  lt?: IDBValidKey;\n  /** Less than or equal to. */\n  lte?: IDBValidKey;\n}\n\n/** Query type for index operations (IDBValidKey, IDBKeyRange, or IndexRange). */\nexport type IndexQuery = IDBValidKey | IDBKeyRange | IndexRange;\n\n/**\n * Main interface for database operations (IndexedDB).\n * @template TDefault Default record type.\n */\nexport interface WorkerDbAPI<TDefault = unknown> {\n  /** Retrieves a record by key. */\n  get: <T = TDefault>(key: string, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;\n  /** Sets a record (key/value or value with auto-generated ID). */\n  set: <T = TDefault>(keyOrVal: string | T, val?: T | DbStoreOptions, opts?: DbStoreOptions) => Promise<string>;\n  /** Updates a record via an updater callback function. */\n  update: <T = TDefault>(key: string, updater: (val: WithId<T> | undefined) => T, opts?: DbStoreOptions) => Promise<void>;\n  /** Applies a partial patch to a record. */\n  patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown>(\n    key: string,\n    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),\n    context?: C,\n    opts?: DbStoreOptions\n  ) => Promise<WithId<T>>;\n  /** Deletes a record by key. */\n  delete: (key: string, opts?: DbStoreOptions) => Promise<void>;\n  /** Retrieves multiple records by keys. */\n  getMany: <T = TDefault>(keysList: string[], opts?: DbStoreOptions) => Promise<(WithId<T> | undefined)[]>;\n  /** Sets multiple key-value pairs in batch. */\n  setMany: (entriesList: [string, unknown][], opts?: DbStoreOptions) => Promise<void>;\n  /** Deletes multiple records by keys in batch. */\n  deleteMany: (keysList: string[], opts?: DbStoreOptions) => Promise<void>;\n  /** Retrieves all keys in the store. */\n  keys: (opts?: DbStoreOptions) => Promise<string[]>;\n  /** Retrieves all values in the store. */\n  values: <T = TDefault>(opts?: DbStoreOptions) => Promise<T[]>;\n  /** Retrieves all [key, value] pairs in the store. */\n  entries: <T = TDefault>(opts?: DbStoreOptions) => Promise<[string, T][]>;\n  /** Clears all records in the store. */\n  clear: (opts?: DbStoreOptions) => Promise<void>;\n  /** Counts records matching an index query. */\n  countByIndex: (indexName: string, query?: IndexQuery, opts?: DbStoreOptions) => Promise<number>;\n  /** Retrieves a single record by index query. */\n  getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;\n  /** Retrieves all keys matching an index query. */\n  keysByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<string[]>;\n  /** Applies a partial patch to records matching an index query. */\n  patchByIndex: <T = TDefault>(indexName: string, query: IndexQuery, patch: Partial<T>, opts?: DbStoreOptions) => Promise<void>;\n  /** Retrieves indexed records with cursor-based pagination. */\n  getByIndexPaginated: <T = TDefault>(\n    indexName: string,\n    query: IndexQuery,\n    paginationOpts: { limit?: number; cursor?: string; direction?: \"next\" | \"prev\" | \"nextunique\" | \"prevunique\" },\n    opts?: DbStoreOptions\n  ) => Promise<{ items: WithId<T>[]; nextCursor?: string }>;\n  /** Retrieves records matching an index query. */\n  getByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T>[]>;\n  /** Retrieves records matching multiple index queries. */\n  getManyByIndex: <T = TDefault>(indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<WithId<T>[]>;\n  /** Filters indexed records in the Worker using a selector function. */\n  getSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;\n  /** Executes an aggregation query over indexed records in the Worker. */\n  queryByIndex: <T = TDefault, R = unknown, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;\n  /** Deletes records matching an index query. */\n  deleteByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<void>;\n  /** Deletes records matching multiple index queries. */\n  deleteManyByIndex: (indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<void>;\n  /** Deletes a subset of indexed records selected by a function in the Worker. */\n  delSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;\n  /** Updates a subset of indexed records selected by a function in the Worker. */\n  setSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;\n  /** Executes a query function over stored items in the Worker. */\n  query: <T = TDefault, R = unknown, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;\n  /** Filters records in the Worker using a selector function. */\n  getSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;\n  /** Deletes filtered records in the Worker using a selector function. */\n  delSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;\n  /** Updates filtered records in the Worker using a selector and updater function. */\n  setSome: <T = TDefault, C = unknown>(selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;\n  /** Exports database records to a JSON object. */\n  exportDB: (opts?: DbStoreOptions) => Promise<Record<string, unknown>>;\n  /** Imports records from a JSON object into the database. */\n  importDB: (data: Record<string, unknown>, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;\n  /** Backs up database records to OPFS. */\n  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions) => Promise<string>;\n  /** Restores database records from an OPFS backup file. */\n  restoreFromOpfs: (key: string, fileName: string, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;\n  /** Initializes the Worker. */\n  init: (workerPath?: string | URL) => void;\n  /** Restarts the Worker. */\n  restart: () => void;\n  /** Terminates the Worker. */\n  terminate: () => void;\n  /** Generates a random unique ID. */\n  gerarId: () => string;\n  /** Generates a random unique ID with prefix. */\n  gerarIdComPrefixo: (prefix?: string) => string;\n}\n\n/**\n * Extended interface for file system operations (OPFS).\n * @template TDefault Default record type.\n */\nexport interface WorkerOpfsAPI<TDefault = unknown> extends WorkerDbAPI<TDefault> {\n  /** Lists files with lightweight metadata. */\n  listFiles: (key: string, opts?: OpfsStoreOptions) => Promise<OpfsFileInfo[]>;\n  /** Retrieves a file. */\n  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<File>;\n  /** Retrieves a byte stream of a file. */\n  getFileStream: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<ReadableStream<Uint8Array>>;\n  /** Adds a file. */\n  addFile: (key: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Adds a file via a byte stream. */\n  addFileStream: (key: string, streamOrFileName: ReadableStream<Uint8Array> | string, fileNameOrStream: string | ReadableStream<Uint8Array>, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Deletes a file. */\n  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Renames a file. */\n  renFile: (key: string, oldName: string, newName: string, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Moves a file to another record key. */\n  mvFile: (key: string, fileName: string, newKey: string, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Compresses files into a ZIP archive. */\n  zip: (key: string, zipName: string, filesToZip?: string[], deleteOriginals?: boolean, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Extracts files from a ZIP archive. */\n  unzip: (key: string, zipName: string, deleteZip?: boolean, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Adds a file into an existing ZIP archive. */\n  addZip: (key: string, zipName: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;\n  /** Removes a file from an existing ZIP archive. */\n  delZip: (key: string, zipName: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;\n}\n\n/**\n * Converts an IndexQuery (value, key range, or boundary object) into an IDBValidKey or IDBKeyRange.\n *\n * @param query The index query specification.\n * @returns The converted IDBValidKey or native IDBKeyRange.\n * @throws {Error} If query is null or undefined.\n */\nexport function buildIDBQuery(query: IndexQuery): IDBValidKey | IDBKeyRange {\n  if (query == null) throw new Error(\"Query cannot be null\");\n  if (\n    typeof query !== \"object\" || query instanceof Date ||\n    Array.isArray(query) || query instanceof ArrayBuffer\n  ) {\n    return query as IDBValidKey;\n  }\n  if (\"lower\" in query || \"upper\" in query) {\n    return query as IDBKeyRange;\n  }\n\n  const q = query as IndexRange;\n  if (q.eq !== undefined) return IDBKeyRange.only(q.eq);\n  if (\n    (q.gt !== undefined || q.gte !== undefined) &&\n    (q.lt !== undefined || q.lte !== undefined)\n  ) {\n    const lower = q.gt !== undefined ? q.gt : q.gte!;\n    const upper = q.lt !== undefined ? q.lt : q.lte!;\n    return IDBKeyRange.bound(\n      lower,\n      upper,\n      q.gt !== undefined,\n      q.lt !== undefined,\n    );\n  }\n  if (q.gt !== undefined || q.gte !== undefined) {\n    return IDBKeyRange.lowerBound(\n      q.gt !== undefined ? q.gt : q.gte!,\n      q.gt !== undefined,\n    );\n  }\n  if (q.lt !== undefined || q.lte !== undefined) {\n    return IDBKeyRange.upperBound(\n      q.lt !== undefined ? q.lt : q.lte!,\n      q.lt !== undefined,\n    );\n  }\n  return query as unknown as IDBValidKey;\n}\n\n// ============================================================================\n\nconst storeCache = new Map<string, UseStore>();\n\nfunction createStoreWithIndexes(dbName: string, storeName: string, indexes?: string[], dbVersion?: number): UseStore {\n  const request = indexedDB.open(dbName, dbVersion);\n  request.onupgradeneeded = () => {\n    const db = request.result;\n    if (!db.objectStoreNames.contains(storeName)) {\n      const store = db.createObjectStore(storeName);\n      if (indexes) {\n        for (const index of indexes) {\n          store.createIndex(index, index);\n        }\n      }\n    } else if (indexes) {\n      // If store exists but we requested indexes, try to add them\n      const store = request.transaction!.objectStore(storeName);\n      for (const index of indexes) {\n        if (!store.indexNames.contains(index)) {\n          store.createIndex(index, index);\n        }\n      }\n    }\n  };\n  const dbp = new Promise<IDBDatabase>((resolve, reject) => {\n    request.onsuccess = () => resolve(request.result);\n    request.onerror = () => reject(request.error);\n  });\n  return (txMode, callback) =>\n    dbp.then((db) =>\n      callback(db.transaction(storeName, txMode).objectStore(storeName))\n    );\n}\n\nfunction getCustomStore(\n  dbName?: string,\n  storeName = \"keyval\",\n  indexes?: string[],\n  dbVersion?: number\n): UseStore | undefined {\n  if (!dbName) return undefined;\n  // Incorporate version into cache key if provided so it recreates if version changes\n  const cacheKey = `${dbName}:${storeName}:${dbVersion || 1}`;\n  if (!storeCache.has(cacheKey)) {\n    storeCache.set(cacheKey, createStoreWithIndexes(dbName, storeName, indexes, dbVersion));\n  }\n  return storeCache.get(cacheKey);\n}\n\nfunction formatDbEntries(\n  rawEntries: [IDBValidKey, unknown,][],\n  prefix?: string,\n) {\n  let items = rawEntries;\n  if (prefix) {\n    items = items.filter(([k,],) =>\n      typeof k === \"string\" && k.startsWith(prefix,)\n    );\n  }\n  return items.map(([k, v,],) => formatDbItem(k, v, prefix,));\n}\n\nasync function getRecordDir(\n  basePath = \"\",\n  rawKey: string,\n  create = false,\n): Promise<FileSystemDirectoryHandle> {\n  const root = await navigator.storage.getDirectory();\n  const fullPath = basePath ? `${basePath}/${rawKey}` : rawKey;\n  const parts = fullPath.split(\"/\",).filter(Boolean,);\n  let curr = root;\n  for (const p of parts) curr = await curr.getDirectoryHandle(p, { create, },);\n  return curr;\n}\n\nfunction validateDbItem(\n  val: unknown,\n  validatorStr?: string,\n  validator?: (val: unknown,) => boolean,\n) {\n  if (val === undefined) return;\n  if (validator) {\n    if (!validator(val,)) {\n      throw new Error(`Validation failed for item: ${JSON.stringify(val,)}`,);\n    }\n    return;\n  }\n  if (!validatorStr) return;\n  const validatorFn = new Function(\"val\", `return (${validatorStr})(val);`,);\n  if (!validatorFn(val,)) {\n    throw new Error(`Validation failed for item: ${JSON.stringify(val,)}`,);\n  }\n}\n\n/**\n * Global API for direct IndexedDB access in the Worker.\n */\nexport const globalSwDbAPI: WorkerDbAPI<unknown> = {\n  get: async <T,>(\n    key: string,\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T> | undefined> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const val = await get(rawKey, store,);\n    return val !== undefined\n      ? formatDbItem(rawKey, val, opts?.prefix,) as WithId<T>\n      : undefined;\n  },\n\n  set: async <T,>(\n    keyOrVal: string | T,\n    val?: T | DbStoreOptions,\n    opts?: DbStoreOptions,\n  ): Promise<string> => {\n    let keyToSave: string | undefined;\n    let valToSave: unknown;\n    let options: DbStoreOptions = opts || {};\n    if (typeof keyOrVal !== \"string\") {\n      keyToSave = undefined;\n      valToSave = keyOrVal;\n      if (val) options = val as DbStoreOptions;\n    } else {\n      keyToSave = keyOrVal;\n      valToSave = val;\n    }\n    const store = getCustomStore(options.dbName, options.storeName, options.indexes, options.dbVersion);\n    const { key, cleanVal, } = prepareForSave(\n      keyToSave,\n      valToSave,\n      options.prefix,\n    );\n    validateDbItem(cleanVal, options.validatorStr, options.validator,);\n    await set(key, cleanVal, store,);\n    return key;\n  },\n\n  update: async <T,>(\n    key: string,\n    updater: (val: WithId<T> | undefined,) => T,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const currentVal = await globalSwDbAPI.get<T>(key, opts,);\n    const newVal = updater(currentVal,);\n    await globalSwDbAPI.set(key, newVal, opts,);\n  },\n\n  patch: async <T extends Record<string, unknown>, C = unknown,>(\n    key: string,\n    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T>> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const current = (await get(rawKey, store,)) || {};\n\n    let updated: unknown;\n    if (typeof patchOrFn === \"function\") {\n      updated = patchOrFn(\n        formatDbItem(rawKey, current, opts?.prefix,) as WithId<T>,\n        context,\n      );\n    } else {\n      updated = Object.assign({}, current, patchOrFn,);\n    }\n    const { key: finalKey, cleanVal, } = prepareForSave(\n      rawKey,\n      updated,\n      opts?.prefix,\n    );\n    validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);\n    await set(finalKey, cleanVal, store,);\n    return formatDbItem(finalKey, cleanVal, opts?.prefix,) as WithId<T>;\n  },\n\n  delete: async (key: string, opts?: DbStoreOptions,): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    await del(rawKey, store,);\n  },\n\n  getMany: async <T,>(\n    keysList: string[],\n    opts?: DbStoreOptions,\n  ): Promise<(WithId<T> | undefined)[]> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const fullKeys = keysList.map((k,) =>\n      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k\n    );\n    const rawValues = await getMany(fullKeys, store,);\n    return rawValues.map((val, idx,) =>\n      val !== undefined\n        ? formatDbItem(fullKeys[idx]!, val, opts?.prefix,) as WithId<T>\n        : undefined\n    );\n  },\n\n  setMany: async (\n    entriesList: [string, unknown,][],\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const entriesToSet: [string, unknown,][] = entriesList.map(([k, v,],) => {\n      const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);\n      validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);\n      return [key, cleanVal,];\n    },);\n    await setMany(entriesToSet, store,);\n  },\n\n  deleteMany: async (\n    keysList: string[],\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const fullKeys = keysList.map((k,) =>\n      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k\n    );\n    await delMany(fullKeys, store,);\n  },\n\n  keys: async (opts?: DbStoreOptions,): Promise<string[]> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const allKeys = await keys(store,);\n    return opts?.prefix\n      ? allKeys.filter((k,) =>\n        typeof k === \"string\" && k.startsWith(opts.prefix!,)\n      ) as string[]\n      : allKeys as string[];\n  },\n\n  values: async <T,>(opts?: DbStoreOptions,): Promise<T[]> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const allEntries = await entries(store,);\n    return formatDbEntries(allEntries, opts?.prefix,) as unknown as T[];\n  },\n\n  entries: async <T,>(opts?: DbStoreOptions,): Promise<[string, T,][]> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const allEntries = await entries(store,);\n    return opts?.prefix\n      ? allEntries.filter(([k,],) =>\n        typeof k === \"string\" && k.startsWith(opts.prefix!,)\n      ) as [\n        string,\n        T,\n      ][]\n      : allEntries as [string, T,][];\n  },\n\n  clear: async (opts?: DbStoreOptions,): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    if (opts?.prefix) {\n      const allKeys = await keys(store,);\n      const keysToDelete = allKeys.filter((k,) =>\n        typeof k === \"string\" && k.startsWith(opts.prefix!,)\n      );\n      await delMany(keysToDelete, store,);\n    } else {\n      await clear(store,);\n    }\n  },\n\n  countByIndex: async (\n    indexName: string,\n    query?: IndexQuery,\n    opts?: DbStoreOptions,\n  ): Promise<number> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\");\n    }\n    return await store(\"readonly\", (idbStore) => {\n      return new Promise<number>((resolve, reject) => {\n        try {\n          const index = idbStore.index(indexName);\n          const req = query !== undefined ? index.count(buildIDBQuery(query)) : index.count();\n          req.onsuccess = () => resolve(req.result);\n          req.onerror = () => reject(req.error);\n        } catch (err) {\n          reject(err);\n        }\n      });\n    });\n  },\n\n  getOneByIndex: async <T>(\n    indexName: string,\n    query: IndexQuery,\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T> | undefined> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\");\n    }\n    return await store(\"readonly\", (idbStore) => {\n      return new Promise<WithId<T> | undefined>((resolve, reject) => {\n        try {\n          const index = idbStore.index(indexName);\n          const idbQuery = buildIDBQuery(query);\n          const req = index.get(idbQuery);\n          const keyReq = index.getKey(idbQuery);\n          \n          let val: unknown | undefined = undefined;\n          let key: IDBValidKey | undefined = undefined;\n          let valDone = false;\n          let keyDone = false;\n\n          const checkDone = () => {\n             if (valDone && keyDone) {\n                if (val !== undefined && key !== undefined) {\n                   resolve(formatDbItem(String(key), val, opts?.prefix) as WithId<T>);\n                } else {\n                   resolve(undefined);\n                }\n             }\n          };\n\n          req.onsuccess = () => {\n            val = req.result;\n            valDone = true;\n            checkDone();\n          };\n          req.onerror = () => reject(req.error);\n\n          keyReq.onsuccess = () => {\n            key = keyReq.result;\n            keyDone = true;\n            checkDone();\n          };\n          keyReq.onerror = () => reject(keyReq.error);\n        } catch (err) {\n          reject(err);\n        }\n      });\n    });\n  },\n\n  keysByIndex: async (\n    indexName: string,\n    query: IndexQuery,\n    opts?: DbStoreOptions,\n  ): Promise<string[]> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\");\n    }\n    return await store(\"readonly\", (idbStore) => {\n       return new Promise<string[]>((resolve, reject) => {\n          try {\n             const index = idbStore.index(indexName);\n             const req = index.getAllKeys(buildIDBQuery(query));\n             req.onsuccess = () => {\n                const keys = req.result.map(k => String(k));\n                resolve(keys);\n             };\n             req.onerror = () => reject(req.error);\n          } catch(err) {\n             reject(err);\n          }\n       });\n    });\n  },\n\n  patchByIndex: async <T>(\n    indexName: string,\n    query: IndexQuery,\n    patch: Partial<T>,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n     await globalSwDbAPI.setSomeByIndex<T, Partial<T>>(\n        indexName,\n        query,\n        (items) => items, // select all matched\n        (item, patchObj) => Object.assign({}, item, patchObj) as WithId<T>,\n        patch,\n        opts\n     );\n  },\n\n  getByIndexPaginated: async <T>(\n    indexName: string,\n    query: IndexQuery,\n    paginationOpts: { limit?: number; cursor?: string; direction?: \"next\" | \"prev\" | \"nextunique\" | \"prevunique\" },\n    opts?: DbStoreOptions,\n  ): Promise<{ items: WithId<T>[]; nextCursor?: string }> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\");\n    }\n    return await store(\"readonly\", (idbStore) => {\n      return new Promise<{ items: WithId<T>[]; nextCursor?: string }>((resolve, reject) => {\n        try {\n          const index = idbStore.index(indexName);\n          const idbQuery = buildIDBQuery(query);\n          const direction = paginationOpts.direction || \"next\";\n          const limit = paginationOpts.limit || 50;\n          \n          const items: WithId<T>[] = [];\n          const req = index.openCursor(idbQuery, direction);\n          let advanced = false;\n          let targetIndexKey: unknown;\n          let targetPrimaryKey: unknown;\n\n          if (paginationOpts.cursor) {\n             try {\n                const parsed = JSON.parse(paginationOpts.cursor);\n                targetIndexKey = parsed[0];\n                targetPrimaryKey = parsed[1];\n             } catch (e) {\n                // invalid cursor, ignore\n             }\n          }\n\n          let lastIndexKey: IDBValidKey | undefined;\n          let lastPrimaryKey: IDBValidKey | undefined;\n\n          req.onsuccess = (event) => {\n             const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;\n             \n             if (!cursor) {\n                resolve({ \n                  items, \n                  nextCursor: items.length > 0 && lastIndexKey !== undefined && lastPrimaryKey !== undefined \n                    ? JSON.stringify([lastIndexKey, lastPrimaryKey]) \n                    : undefined \n                });\n                return;\n             }\n\n             if (!advanced && targetIndexKey !== undefined && targetPrimaryKey !== undefined) {\n                advanced = true;\n                if (cursor.continuePrimaryKey) {\n                   cursor.continuePrimaryKey(targetIndexKey as IDBValidKey, targetPrimaryKey as IDBValidKey);\n                   return;\n                }\n             }\n\n             if (advanced && targetPrimaryKey !== undefined && cursor.primaryKey === targetPrimaryKey && cursor.key === targetIndexKey) {\n                 targetPrimaryKey = undefined; \n                 cursor.continue();\n                 return;\n             }\n             \n             if (!advanced && targetPrimaryKey !== undefined) {\n                if (cursor.primaryKey === targetPrimaryKey && cursor.key === targetIndexKey) {\n                   advanced = true;\n                   targetPrimaryKey = undefined;\n                }\n                cursor.continue();\n                return;\n             }\n\n             items.push(formatDbItem(String(cursor.primaryKey), cursor.value, opts?.prefix) as WithId<T>);\n             lastIndexKey = cursor.key;\n             lastPrimaryKey = cursor.primaryKey;\n\n             if (items.length >= limit) {\n                resolve({ \n                   items, \n                   nextCursor: JSON.stringify([lastIndexKey, lastPrimaryKey]) \n                });\n             } else {\n                cursor.continue();\n             }\n          };\n          req.onerror = () => reject(req.error);\n        } catch (err) {\n          reject(err);\n        }\n      });\n    });\n  },\n\n  getByIndex: async <T,>(\n    indexName: string,\n    query: IndexQuery,\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T>[]> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\",);\n    }\n    return await store(\"readonly\", (idbStore,) => {\n      return new Promise<WithId<T>[]>((resolve, reject,) => {\n        try {\n          const index = idbStore.index(indexName,);\n          const idbQuery = buildIDBQuery(query,);\n          const req = index.getAll(idbQuery,);\n          const keysReq = index.getAllKeys(idbQuery,);\n          let values: unknown[] | null = null;\n          let keys: IDBValidKey[] | null = null;\n\n          const checkDone = () => {\n            if (values !== null && keys !== null) {\n              const formatted = values.map((val, i,) =>\n                formatDbItem(String(keys![i],), val, opts?.prefix,) as WithId<T>\n              );\n              resolve(formatted,);\n            }\n          };\n\n          req.onsuccess = () => {\n            values = req.result;\n            checkDone();\n          };\n          req.onerror = () => reject(req.error,);\n\n          keysReq.onsuccess = () => {\n            keys = keysReq.result;\n            checkDone();\n          };\n          keysReq.onerror = () => reject(keysReq.error,);\n        } catch (err) {\n          reject(err,);\n        }\n      },);\n    },);\n  },\n\n  getManyByIndex: async <T,>(\n    indexName: string,\n    queries: IndexQuery[],\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T>[]> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\",);\n    }\n    return await store(\"readonly\", (idbStore,) => {\n      return new Promise<WithId<T>[]>((resolve, reject,) => {\n        try {\n          const index = idbStore.index(indexName,);\n          const resultsMap = new Map<string, WithId<T>>();\n          if (queries.length === 0) {\n            return resolve([],);\n          }\n          let completed = 0;\n          for (const q of queries) {\n            const idbQuery = buildIDBQuery(q,);\n            const req = index.getAll(idbQuery,);\n            const keysReq = index.getAllKeys(idbQuery,);\n            let vals: unknown[] | null = null;\n            let keys: IDBValidKey[] | null = null;\n\n            const check = () => {\n              if (vals !== null && keys !== null) {\n                vals.forEach((val, i,) => {\n                  const keyStr = String(keys![i],);\n                  if (!resultsMap.has(keyStr,)) {\n                    resultsMap.set(\n                      keyStr,\n                      formatDbItem(keyStr, val, opts?.prefix,) as WithId<T>,\n                    );\n                  }\n                },);\n                completed++;\n                if (completed === queries.length) {\n                  resolve(Array.from(resultsMap.values(),),);\n                }\n              }\n            };\n\n            req.onsuccess = () => {\n              vals = req.result;\n              check();\n            };\n            req.onerror = () => reject(req.error,);\n\n            keysReq.onsuccess = () => {\n              keys = keysReq.result;\n              check();\n            };\n            keysReq.onerror = () => reject(keysReq.error,);\n          }\n        } catch (err) {\n          reject(err,);\n        }\n      },);\n    },);\n  },\n\n  getSomeByIndex: async <T, C = unknown,>(\n    indexName: string,\n    query: IndexQuery,\n    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T>[]> => {\n    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);\n    const selectedItems = fn(matched, context);\n    if (!Array.isArray(selectedItems)) {\n      throw new Error(\n        \"The injected function in GET_SOME_BY_INDEX must return an Array.\",\n      );\n    }\n    return selectedItems;\n  },\n\n  queryByIndex: async <T, R, C = unknown,>(\n    indexName: string,\n    query: IndexQuery,\n    fn: (items: WithId<T>[], ctx?: C,) => R,\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<R> => {\n    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts,);\n    return fn(matched, context,);\n  },\n\n  deleteByIndex: async (\n    indexName: string,\n    query: IndexQuery,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\",);\n    }\n    const keysToDelete = await store(\"readonly\", (idbStore,) => {\n      return new Promise<string[]>((resolve, reject,) => {\n        try {\n          const index = idbStore.index(indexName,);\n          const keysReq = index.getAllKeys(buildIDBQuery(query,),);\n          keysReq.onsuccess = () => {\n            resolve(keysReq.result.map((k,) => String(k,)),);\n          };\n          keysReq.onerror = () => reject(keysReq.error,);\n        } catch (err) {\n          reject(err,);\n        }\n      },);\n    },);\n    if (keysToDelete.length > 0) {\n      await delMany(keysToDelete, store,);\n    }\n  },\n\n  deleteManyByIndex: async (\n    indexName: string,\n    queries: IndexQuery[],\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    if (queries.length === 0) return;\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    if (!store) {\n      throw new Error(\"dbName or storeName is required to query indexes\",);\n    }\n    const allKeysToDelete = await store(\"readonly\", (idbStore,) => {\n      return new Promise<string[]>((resolve, reject,) => {\n        try {\n          const index = idbStore.index(indexName,);\n          const keySet = new Set<string>();\n          let completed = 0;\n          for (const q of queries) {\n            const req = index.getAllKeys(buildIDBQuery(q,),);\n            req.onsuccess = () => {\n              for (const k of req.result) {\n                keySet.add(String(k,));\n              }\n              completed++;\n              if (completed === queries.length) {\n                resolve(Array.from(keySet,),);\n              }\n            };\n            req.onerror = () => reject(req.error,);\n          }\n        } catch (err) {\n          reject(err,);\n        }\n      },);\n    },);\n    if (allKeysToDelete.length > 0) {\n      await delMany(allKeysToDelete, store,);\n    }\n  },\n\n  delSomeByIndex: async <T, C = unknown,>(\n    indexName: string,\n    query: IndexQuery,\n    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);\n    const selectedItems = fn(matched, context);\n    if (!Array.isArray(selectedItems)) {\n      throw new Error(\n        \"The injected function in DEL_SOME_BY_INDEX must return an Array.\",\n      );\n    }\n    const keysToDelete: string[] = selectedItems.map((item: WithId<T>) => {\n      if (!item || item._id === undefined) {\n        throw new Error(\n          \"Items returned in DEL_SOME_BY_INDEX must contain an '_id' property.\",\n        );\n      }\n      return opts?.prefix && !item._id.startsWith(opts.prefix)\n        ? `${opts.prefix}${item._id}`\n        : item._id;\n    });\n    if (keysToDelete.length > 0) {\n      await delMany(keysToDelete, store);\n    }\n  },\n\n  setSomeByIndex: async <T, C = unknown>(\n    indexName: string,\n    query: IndexQuery,\n    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(\n      opts?.dbName,\n      opts?.storeName,\n      opts?.indexes,\n      opts?.dbVersion,\n    );\n    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);\n    const selectedItems = selectFn(matched, context);\n    if (!Array.isArray(selectedItems)) {\n      throw new Error(\n        \"The selector function in SET_SOME_BY_INDEX must return an Array.\",\n      );\n    }\n    const entriesToSet: [string, unknown][] = selectedItems.map(\n      (item: WithId<T>) => {\n        if (!item || item._id === undefined) {\n          throw new Error(\n            \"Items selected in SET_SOME_BY_INDEX must contain an '_id' property.\",\n          );\n        }\n        const updatedItem = updateFn(item, context);\n        const { key, cleanVal } = prepareForSave(\n          undefined,\n          updatedItem,\n          opts?.prefix,\n        );\n        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator);\n        return [key, cleanVal];\n      },\n    );\n    if (entriesToSet.length > 0) {\n      await setMany(entriesToSet, store,);\n    }\n  },\n\n  query: async <T, R, C = unknown,>(\n    fn: (items: WithId<T>[], ctx?: C,) => R,\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<R> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawEntries = await entries(store,);\n    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);\n    return fn(formattedItems as WithId<T>[], context,);\n  },\n\n  getSome: async <T, C = unknown>(\n    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<WithId<T>[]> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawEntries = await entries(store);\n    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);\n    const selectedItems = fn(formattedItems as WithId<T>[], context);\n    if (!Array.isArray(selectedItems)) {\n      throw new Error(\"The injected function in GET_SOME must return an Array.\");\n    }\n    return selectedItems;\n  },\n\n  delSome: async <T, C = unknown>(\n    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawEntries = await entries(store);\n    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);\n    const selectedItems = fn(formattedItems as WithId<T>[], context);\n\n    if (!Array.isArray(selectedItems)) {\n      throw new Error(\"The injected function in DEL_SOME must return an Array.\");\n    }\n\n    const keysToDelete: string[] = selectedItems.map((item: WithId<T>) => {\n      if (!item || item._id === undefined) {\n        throw new Error(\n          \"Items returned in DEL_SOME must contain an '_id' property.\",\n        );\n      }\n      return opts?.prefix && !item._id.startsWith(opts.prefix)\n        ? `${opts.prefix}${item._id}`\n        : item._id;\n    });\n    await delMany(keysToDelete, store);\n  },\n\n  setSome: async <T, C = unknown>(\n    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,\n    context?: C,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const rawEntries = await entries(store);\n    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);\n\n    const selectedItems = selectFn(formattedItems as WithId<T>[], context);\n    if (!Array.isArray(selectedItems)) {\n      throw new Error(\n        \"The selector function in SET_SOME must return an Array.\",\n      );\n    }\n\n    const entriesToSet: [string, unknown][] = selectedItems.map(\n      (item: WithId<T>) => {\n        if (!item || item._id === undefined) {\n          throw new Error(\n            \"Items selected in SET_SOME must contain an '_id' property.\",\n          );\n        }\n        const updatedItem = updateFn(item, context);\n        const { key, cleanVal } = prepareForSave(\n          undefined,\n          updatedItem,\n          opts?.prefix,\n        );\n        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator);\n        return [key, cleanVal];\n      },\n    );\n    await setMany(entriesToSet, store);\n  },\n\n  exportDB: async (\n    opts?: DbStoreOptions,\n  ): Promise<Record<string, unknown>> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const allEntries = await entries(store,);\n    const filtered = opts?.prefix\n      ? allEntries.filter(([k,],) =>\n        typeof k === \"string\" && k.startsWith(opts.prefix!,)\n      )\n      : allEntries;\n    return Object.fromEntries(filtered,);\n  },\n\n  importDB: async (\n    data: Record<string, unknown>,\n    clearFirst = false,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    if (clearFirst) await globalSwDbAPI.clear(opts,);\n\n    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(\n      ([k, v,],) => {\n        const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);\n        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);\n        return [key, cleanVal,];\n      },\n    );\n    await setMany(entriesToImport, store,);\n  },\n\n  backupToOpfs: async (\n    key: string,\n    fileName?: string,\n    opts?: DbStoreOptions,\n  ): Promise<string> => {\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    const allEntries = await entries(store,);\n    const filtered = opts?.prefix\n      ? allEntries.filter(([k,],) =>\n        typeof k === \"string\" && k.startsWith(opts.prefix!,)\n      )\n      : allEntries;\n    const data = Object.fromEntries(filtered,);\n\n    const finalName = fileName || \"backup.json\";\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n\n    const dir = await getRecordDir(\"backup\", rawKey, true,);\n    const fileHandle = await dir.getFileHandle(finalName, { create: true, },);\n    const w = await fileHandle.createWritable();\n    await w.write(\n      new Blob([JSON.stringify(data,),], { type: \"application/json\", },),\n    );\n    await w.close();\n\n    return `${rawKey}/${finalName}`;\n  },\n\n  restoreFromOpfs: async (\n    key: string,\n    fileName: string,\n    clearFirst = false,\n    opts?: DbStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(\"backup\", rawKey, false,);\n\n    const finalName = fileName.includes(\"/\",)\n      ? fileName.split(\"/\",).pop()!\n      : fileName;\n\n    const fileHandle = await dir.getFileHandle(finalName,);\n    const file = await fileHandle.getFile();\n    const data = JSON.parse(await file.text(),);\n\n    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);\n    if (clearFirst) await globalSwDbAPI.clear(opts,);\n\n    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(\n      ([k, v,],) => {\n        const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);\n        return [key, cleanVal,];\n      },\n    );\n    await setMany(entriesToImport, store,);\n  },\n\n  init: (_workerPath?: string | URL): void => {\n    // No-op no Worker\n  },\n  restart: (): void => {\n    // No-op no Worker\n  },\n  terminate: (): void => {\n    // No-op no Worker\n  },\n  gerarId,\n  gerarIdComPrefixo: (prefix?: string): string =>\n    gerarIdComPrefixo(prefix || \"\"),\n};\n\n/**\n * Global API for direct File System (OPFS) access in the Worker.\n */\nexport const globalSwOpfsAPI: WorkerOpfsAPI<unknown> = {\n  ...globalSwDbAPI,\n\n  listFiles: async (\n    key: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<OpfsFileInfo[]> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, true,);\n    const filesList = [];\n    // @ts-ignore: Deno API for directory entries\n    for await (const [name, handle,] of dir.entries()) {\n      if (handle.kind === \"file\") {\n        const file = await handle.getFile();\n        filesList.push({\n          name,\n          size: file.size,\n          type: file.type,\n          lastModified: file.lastModified,\n        },);\n      }\n    }\n    return filesList;\n  },\n\n  getFile: async (\n    key: string,\n    fileName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<File> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const fileHandle = await dir.getFileHandle(fileName,);\n    return await fileHandle.getFile();\n  },\n\n  getFileStream: async (\n    key: string,\n    fileName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<ReadableStream<Uint8Array>> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const fileHandle = await dir.getFileHandle(fileName,);\n    const file = await fileHandle.getFile();\n    return file.stream();\n  },\n\n  addFile: async (\n    key: string,\n    file: File | Blob,\n    fileName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, true,);\n    const fh = await dir.getFileHandle(fileName, { create: true, },);\n    const w = await fh.createWritable();\n    await w.write(new Blob([await file.arrayBuffer(),],),);\n    await w.close();\n  },\n\n  addFileStream: async (\n    key: string,\n    streamOrFileName: ReadableStream<Uint8Array> | string,\n    fileNameOrStream: string | ReadableStream<Uint8Array>,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    let stream: ReadableStream<Uint8Array>;\n    let fileName: string;\n    if (typeof streamOrFileName === \"string\") {\n      fileName = streamOrFileName;\n      stream = fileNameOrStream as ReadableStream<Uint8Array>;\n    } else {\n      stream = streamOrFileName;\n      fileName = fileNameOrStream as string;\n    }\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, true,);\n    const fh = await dir.getFileHandle(fileName, { create: true, },);\n    const w = await fh.createWritable();\n    const reader = stream.getReader();\n    try {\n      while (true) {\n        const { done, value, } = await reader.read();\n        if (done) break;\n        if (value) {\n          await w.write(value as unknown as BufferSource,);\n        }\n      }\n    } finally {\n      reader.releaseLock();\n    }\n    await w.close();\n  },\n\n  delFile: async (\n    key: string,\n    fileName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    await dir.removeEntry(fileName,);\n  },\n\n  renFile: async (\n    key: string,\n    oldName: string,\n    newName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const oldFile = await dir.getFileHandle(oldName,);\n    const fileData = await oldFile.getFile();\n    const newFile = await dir.getFileHandle(newName, { create: true, },);\n    const w = await newFile.createWritable();\n    await w.write(new Blob([await fileData.arrayBuffer(),],),);\n    await w.close();\n    await dir.removeEntry(oldName,);\n  },\n\n  mvFile: async (\n    key: string,\n    fileName: string,\n    newKey: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const fileHandle = await dir.getFileHandle(fileName,);\n    const fileData = await fileHandle.getFile();\n\n    const rawNewKey = opts?.prefix && !newKey.startsWith(opts.prefix,)\n      ? `${opts.prefix}${newKey}`\n      : newKey;\n    const targetDir = await getRecordDir(opts?.basePath, rawNewKey, true,);\n\n    const newFile = await targetDir.getFileHandle(fileName, { create: true, },);\n    const w = await newFile.createWritable();\n    await w.write(new Blob([await fileData.arrayBuffer(),],),);\n    await w.close();\n    await dir.removeEntry(fileName,);\n  },\n\n  zip: async (\n    key: string,\n    zipName: string,\n    filesToZip?: string[],\n    deleteOriginals = false,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const filesRecord: Record<string, Uint8Array> = {};\n\n    // @ts-ignore: Deno API for directory entries\n    for await (const [name, handle,] of dir.entries()) {\n      if (\n        handle.kind === \"file\" && (!filesToZip || filesToZip.includes(name,))\n      ) {\n        const f = await handle.getFile();\n        filesRecord[name] = new Uint8Array(await f.arrayBuffer(),);\n      }\n    }\n\n    const zippedData = zipSync(filesRecord,);\n    const zipFileHandle = await dir.getFileHandle(zipName, { create: true, },);\n    const w = await zipFileHandle.createWritable();\n    await w.write(new Blob([zippedData as BlobPart,],),);\n    await w.close();\n\n    if (deleteOriginals) {\n      for (const name of Object.keys(filesRecord,)) {\n        await dir.removeEntry(name,);\n      }\n    }\n  },\n\n  unzip: async (\n    key: string,\n    zipName: string,\n    deleteZip = false,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const zipFileHandle = await dir.getFileHandle(zipName,);\n    const zipBuffer = new Uint8Array(\n      await (await zipFileHandle.getFile()).arrayBuffer(),\n    );\n\n    const unzipped = unzipSync(zipBuffer,);\n    for (const [name, data,] of Object.entries(unzipped,)) {\n      if (!name.includes(\"/\",)) {\n        const fh = await dir.getFileHandle(name, { create: true, },);\n        const w = await fh.createWritable();\n        await w.write(new Blob([data as BlobPart,],),);\n        await w.close();\n      }\n    }\n\n    if (deleteZip) await dir.removeEntry(zipName,);\n  },\n\n  addZip: async (\n    key: string,\n    zipName: string,\n    file: File | Blob,\n    fileName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const zipFileHandle = await dir.getFileHandle(zipName,);\n    const zipBuffer = new Uint8Array(\n      await (await zipFileHandle.getFile()).arrayBuffer(),\n    );\n    const currentZipData = unzipSync(zipBuffer,);\n\n    currentZipData[fileName] = new Uint8Array(await file.arrayBuffer(),);\n\n    const newZippedData = zipSync(currentZipData,);\n    const w = await zipFileHandle.createWritable();\n    await w.write(new Blob([newZippedData as BlobPart,],),);\n    await w.close();\n  },\n\n  delZip: async (\n    key: string,\n    zipName: string,\n    fileName: string,\n    opts?: OpfsStoreOptions,\n  ): Promise<void> => {\n    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)\n      ? `${opts.prefix}${key}`\n      : key;\n    const dir = await getRecordDir(opts?.basePath, rawKey, false,);\n    const zipFileHandle = await dir.getFileHandle(zipName,);\n    const zipBuffer = new Uint8Array(\n      await (await zipFileHandle.getFile()).arrayBuffer(),\n    );\n    const currentZipData = unzipSync(zipBuffer,);\n\n    delete currentZipData[fileName];\n\n    const newZippedData = zipSync(currentZipData,);\n    const w = await zipFileHandle.createWritable();\n    await w.write(new Blob([newZippedData as BlobPart,],),);\n    await w.close();\n  },\n};\n\n// Internal API export consumed by RPC proxy (rpc.ts)\nexport const internalAPI: WorkerOpfsAPI<unknown> = globalSwOpfsAPI;\n\nexport function createScopedDb<TDefault = unknown>(\n  dbName?: string | DbStoreOptions,\n  storeName = \"keyval\",\n  prefix = \"\",\n  extraOpts?: Partial<DbStoreOptions>,\n): WorkerDbAPI<TDefault> {\n  let opts: DbStoreOptions;\n  if (typeof dbName === \"object\" && dbName !== null) {\n    opts = { ...dbName, };\n  } else {\n    opts = { dbName, storeName, prefix, ...extraOpts, };\n  }\n  return {\n    get: <T = TDefault,>(key: string,) => globalSwDbAPI.get<T>(key, opts,),\n    set: <T = TDefault,>(keyOrVal: string | T, val?: T,) =>\n      globalSwDbAPI.set<T>(keyOrVal, val, opts,),\n    update: <T = TDefault,>(\n      key: string,\n      updater: (val: WithId<T> | undefined,) => T,\n    ) => globalSwDbAPI.update<T>(key, updater, opts,),\n    patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown,>(\n      key: string,\n      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),\n      context?: C,\n    ) => globalSwDbAPI.patch<T, C>(key, patchOrFn, context, opts,),\n    delete: (key: string,) => globalSwDbAPI.delete(key, opts,),\n    getMany: <T = TDefault,>(keys: string[],) =>\n      globalSwDbAPI.getMany<T>(keys, opts,),\n    setMany: (entries: [string, unknown,][],) =>\n      globalSwDbAPI.setMany(entries, opts,),\n    deleteMany: (keys: string[],) => globalSwDbAPI.deleteMany(keys, opts,),\n    keys: () => globalSwDbAPI.keys(opts,),\n    values: <T = TDefault,>() => globalSwDbAPI.values<T>(opts,),\n    entries: <T = TDefault,>() => globalSwDbAPI.entries<T>(opts,),\n    clear: () => globalSwDbAPI.clear(opts,),\n    countByIndex: (indexName: string, query?: IndexQuery) =>\n      globalSwDbAPI.countByIndex(indexName, query, opts),\n    getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery) =>\n      globalSwDbAPI.getOneByIndex<T>(indexName, query, opts),\n    keysByIndex: (indexName: string, query: IndexQuery) =>\n      globalSwDbAPI.keysByIndex(indexName, query, opts),\n    patchByIndex: <T = TDefault>(\n      indexName: string,\n      query: IndexQuery,\n      patch: Partial<T>,\n    ) => globalSwDbAPI.patchByIndex<T>(indexName, query, patch, opts),\n    getByIndexPaginated: <T = TDefault>(\n      indexName: string,\n      query: IndexQuery,\n      paginationOpts: {\n        limit?: number;\n        cursor?: string;\n        direction?: \"next\" | \"prev\" | \"nextunique\" | \"prevunique\";\n      },\n    ) =>\n      globalSwDbAPI.getByIndexPaginated<T>(\n        indexName,\n        query,\n        paginationOpts,\n        opts,\n      ),\n    getByIndex: <T = TDefault>(indexName: string, query: IndexQuery) =>\n      globalSwDbAPI.getByIndex<T>(indexName, query, opts),\n    getManyByIndex: <T = TDefault>(\n      indexName: string,\n      queries: IndexQuery[],\n    ) => globalSwDbAPI.getManyByIndex<T>(indexName, queries, opts),\n    getSomeByIndex: <T = TDefault, C = unknown>(\n      indexName: string,\n      query: IndexQuery,\n      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n      context?: C,\n    ) =>\n      globalSwDbAPI.getSomeByIndex<T, C>(\n        indexName,\n        query,\n        fn,\n        context,\n        opts,\n      ),\n    queryByIndex: <T = TDefault, R = unknown, C = unknown>(\n      indexName: string,\n      query: IndexQuery,\n      fn: (items: WithId<T>[], ctx?: C) => R,\n      context?: C,\n    ) =>\n      globalSwDbAPI.queryByIndex<T, R, C>(\n        indexName,\n        query,\n        fn,\n        context,\n        opts,\n      ),\n    deleteByIndex: (indexName: string, query: IndexQuery) =>\n      globalSwDbAPI.deleteByIndex(indexName, query, opts),\n    deleteManyByIndex: (indexName: string, queries: IndexQuery[]) =>\n      globalSwDbAPI.deleteManyByIndex(indexName, queries, opts),\n    delSomeByIndex: <T = TDefault, C = unknown>(\n      indexName: string,\n      query: IndexQuery,\n      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n      context?: C,\n    ) => globalSwDbAPI.delSomeByIndex<T, C>(\n      indexName,\n      query,\n      fn,\n      context,\n      opts,\n    ),\n    setSomeByIndex: <T = TDefault, C = unknown>(\n      indexName: string,\n      query: IndexQuery,\n      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,\n      context?: C,\n    ) => globalSwDbAPI.setSomeByIndex<T, C>(\n      indexName,\n      query,\n      selectFn,\n      updateFn,\n      context,\n      opts,\n    ),\n    query: <T = TDefault, R = unknown, C = unknown>(\n      fn: (items: WithId<T>[], ctx?: C) => R,\n      context?: C,\n    ) => globalSwDbAPI.query<T, R, C>(fn, context, opts),\n    getSome: <T = TDefault, C = unknown>(\n      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n      context?: C,\n    ) => globalSwDbAPI.getSome<T, C>(fn, context, opts),\n    delSome: <T = TDefault, C = unknown>(\n      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n      context?: C,\n    ) => globalSwDbAPI.delSome<T, C>(fn, context, opts),\n    setSome: <T = TDefault, C = unknown>(\n      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],\n      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,\n      context?: C,\n    ) => globalSwDbAPI.setSome<T, C>(selectFn, updateFn, context, opts),\n    exportDB: () => globalSwDbAPI.exportDB(opts),\n    importDB: (data: Record<string, unknown>, clearFirst = false) =>\n      globalSwDbAPI.importDB(data, clearFirst, opts),\n    backupToOpfs: (key: string, fileName?: string) =>\n      globalSwDbAPI.backupToOpfs(key, fileName, opts),\n    restoreFromOpfs: (key: string, fileName: string, clearFirst = false) =>\n      globalSwDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),\n    init: (workerPath?: string | URL) => globalSwDbAPI.init(workerPath),\n    restart: () => globalSwDbAPI.restart(),\n    terminate: () => globalSwDbAPI.terminate(),\n    gerarId,\n    gerarIdComPrefixo: () =>\n      opts.prefix ? gerarIdComPrefixo(opts.prefix) : gerarId(),\n  };\n}\n\nexport function createScopedOpfs<TDefault = unknown>(\n  dbName?: string | OpfsStoreOptions,\n  storeName = \"keyval\",\n  prefix = \"\",\n  basePath = \"\",\n  extraOpts?: Partial<OpfsStoreOptions>,\n): WorkerOpfsAPI<TDefault> {\n  let opts: OpfsStoreOptions;\n  if (typeof dbName === \"object\" && dbName !== null) {\n    opts = { ...dbName, };\n  } else {\n    opts = { dbName, storeName, prefix, basePath, ...extraOpts, };\n  }\n  return {\n    ...createScopedDb<TDefault>(opts,),\n    listFiles: (key: string,) => globalSwOpfsAPI.listFiles(key, opts,),\n    getFile: (key: string, fileName: string,) =>\n      globalSwOpfsAPI.getFile(key, fileName, opts,),\n    getFileStream: (key: string, fileName: string,) =>\n      globalSwOpfsAPI.getFileStream(key, fileName, opts,),\n    addFile: (key: string, file: File | Blob, fileName: string,) =>\n      globalSwOpfsAPI.addFile(key, file, fileName, opts,),\n    addFileStream: (\n      key: string,\n      streamOrFileName: ReadableStream<Uint8Array> | string,\n      fileNameOrStream: string | ReadableStream<Uint8Array>,\n    ) =>\n      globalSwOpfsAPI.addFileStream(\n        key,\n        streamOrFileName as unknown as string,\n        fileNameOrStream as unknown as ReadableStream<Uint8Array>,\n        opts,\n      ),\n    delFile: (key: string, fileName: string,) =>\n      globalSwOpfsAPI.delFile(key, fileName, opts,),\n    renFile: (key: string, oldName: string, newName: string,) =>\n      globalSwOpfsAPI.renFile(key, oldName, newName, opts,),\n    mvFile: (key: string, fileName: string, newKey: string,) =>\n      globalSwOpfsAPI.mvFile(key, fileName, newKey, opts,),\n    zip: (\n      key: string,\n      zipName: string,\n      filesToZip?: string[],\n      deleteOriginals = false,\n    ) => globalSwOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),\n    unzip: (key: string, zipName: string, deleteZip = false,) =>\n      globalSwOpfsAPI.unzip(key, zipName, deleteZip, opts,),\n    addZip: (\n      key: string,\n      zipName: string,\n      file: File | Blob,\n      fileName: string,\n    ) => globalSwOpfsAPI.addZip(key, zipName, file, fileName, opts,),\n    delZip: (key: string, zipName: string, fileName: string) =>\n      globalSwOpfsAPI.delZip(key, zipName, fileName, opts),\n    init: (workerPath?: string | URL) => globalSwOpfsAPI.init(workerPath),\n    restart: () => globalSwOpfsAPI.restart(),\n    terminate: () => globalSwOpfsAPI.terminate(),\n    gerarId,\n    gerarIdComPrefixo: () =>\n      opts.prefix ? gerarIdComPrefixo(opts.prefix) : gerarId(),\n  };\n}\n\n/**\n * Access point for Database (IndexedDB).\n * Can be invoked as a function to create a scoped instance or used directly.\n *\n * @example\n * ```ts\n * const myDb = db(\"my-app\", \"users\", \"user_\");\n * await myDb.set(\"123\", { name: \"John\" });\n * ```\n */\nexport const db: (<TDefault = unknown>(\n  dbName?: string | DbStoreOptions,\n  storeName?: string,\n  prefix?: string,\n  extraOpts?: Partial<DbStoreOptions>,\n) => WorkerDbAPI<TDefault>) & WorkerDbAPI<unknown> = Object.assign(\n  <TDefault = unknown>(\n    dbName?: string | DbStoreOptions,\n    storeName?: string,\n    prefix?: string,\n    extraOpts?: Partial<DbStoreOptions>,\n  ): WorkerDbAPI<TDefault> =>\n    createScopedDb<TDefault>(dbName, storeName, prefix, extraOpts),\n  globalSwDbAPI,\n);\n\n/**\n * Access point for File System (OPFS).\n * Can be invoked as a function to create a scoped instance or used directly.\n *\n * @example\n * ```ts\n * const drive = opfs(\"my-app\", \"files\", \"docs_\");\n * await drive.addFile(\"doc1\", blob, \"manual.pdf\");\n * ```\n */\nexport const opfs: (<TDefault = unknown>(\n  dbName?: string | OpfsStoreOptions,\n  storeName?: string,\n  prefix?: string,\n  basePath?: string,\n  extraOpts?: Partial<OpfsStoreOptions>,\n) => WorkerOpfsAPI<TDefault>) & WorkerOpfsAPI<unknown> = Object.assign(\n  <TDefault = unknown>(\n    dbName?: string | OpfsStoreOptions,\n    storeName?: string,\n    prefix?: string,\n    basePath = \"\",\n    extraOpts?: Partial<OpfsStoreOptions>,\n  ): WorkerOpfsAPI<TDefault> =>\n    createScopedOpfs<TDefault>(dbName, storeName, prefix, basePath, extraOpts),\n  globalSwOpfsAPI,\n);\n", "// Automatically generated file during build\ndeclare const __APP_VERSION__: string;\n\n/** Current library/application version. */\nexport const APP_VERSION: string = typeof __APP_VERSION__ !== \"undefined\"\n  ? __APP_VERSION__\n  : \"\";\n", "/**\n * @module @vanaware/workerdb/worker\n * @description Dedicated Web Worker script and RPC request router for WorkerDB.\n * Handles background IndexedDB queries, validations, OPFS file storage, and data streaming.\n */\n\nimport { internalAPI } from \"./db.ts\";\nimport type { DbStoreOptions, OpfsStoreOptions } from \"./db.ts\";\n\nimport { APP_VERSION } from \"./utils/version.ts\";\n\nconsole.log(`[DB] 🌌 Worker-db loaded (v${APP_VERSION}).`);\n\n/**\n * Main RPC message handler for WorkerDB.\n * Can be integrated into an existing Web Worker or executed directly.\n */\nexport async function handleWorkerMessage(e: MessageEvent): Promise<void> {\n  if (\n    !e.data ||\n    typeof e.data !== \"object\" ||\n    !(\"requestId\" in e.data) ||\n    !(\"command\" in e.data)\n  ) {\n    return;\n  }\n\n  const { requestId, command, args = {}, } = e.data;\n\n  try {\n    const dbOpts: DbStoreOptions = {\n      dbName: args.dbName,\n      storeName: args.storeName,\n      prefix: args.prefix,\n      indexes: args.indexes,\n      dbVersion: args.dbVersion,\n      validatorStr: args.validatorStr,\n    };\n\n    const opfsOpts: OpfsStoreOptions = {\n      ...dbOpts,\n      basePath: args.basePath,\n    };\n\n    let result;\n\n    switch (command) {\n      case \"VERSION\":\n        result = { version: APP_VERSION, };\n        break;\n      case \"GET\":\n        result = await internalAPI.get(args.key, dbOpts,);\n        break;\n      case \"SET\":\n        if (args.key !== undefined) {\n          result = await internalAPI.set(args.key, args.val, dbOpts,);\n        } else {\n          result = await internalAPI.set(args.val, dbOpts,);\n        }\n        break;\n      case \"DELETE\":\n        result = await internalAPI.delete(args.key, dbOpts,);\n        break;\n      case \"GET_MANY\":\n        result = await internalAPI.getMany(args.keys, dbOpts,);\n        break;\n      case \"SET_MANY\":\n        result = await internalAPI.setMany(args.entries, dbOpts,);\n        break;\n      case \"DEL_MANY\":\n        result = await internalAPI.deleteMany(args.keys, dbOpts,);\n        break;\n      case \"KEYS\":\n        result = await internalAPI.keys(dbOpts,);\n        break;\n      case \"VALUES\":\n        result = await internalAPI.values(dbOpts,);\n        break;\n      case \"ENTRIES\":\n        result = await internalAPI.entries(dbOpts,);\n        break;\n      case \"CLEAR\":\n        result = await internalAPI.clear(dbOpts,);\n        break;\n      case \"PATCH\": {\n        let patchOrFn;\n        if (args.fnStr) {\n          patchOrFn = new Function(\n            \"prev\",\n            \"ctx\",\n            `return (${args.fnStr})(prev, ctx);`,\n          ) as unknown;\n        } else {\n          patchOrFn = args.patch;\n        }\n        result = await internalAPI.patch(\n          args.key,\n          patchOrFn,\n          args.context,\n          dbOpts,\n        );\n        break;\n      }\n      case \"QUERY\": {\n        const fn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.fnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        result = await internalAPI.query(fn, args.context, dbOpts,);\n        break;\n      }\n      case \"GET_SOME\": {\n        const fn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.fnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        result = await internalAPI.getSome(fn, args.context, dbOpts,);\n        break;\n      }\n      case \"DEL_SOME\": {\n        const fn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.fnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        result = await internalAPI.delSome(fn, args.context, dbOpts,);\n        break;\n      }\n      case \"SET_SOME\": {\n        const selectFn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.selectFnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        const updateFn = new Function(\n          \"item\",\n          \"ctx\",\n          `return (${args.updateFnStr})(item, ctx);`,\n        ) as (item: { _id: string }, ctx?: unknown,) => { _id: string };\n        result = await internalAPI.setSome(\n          selectFn,\n          updateFn,\n          args.context,\n          dbOpts,\n        );\n        break;\n      }\n      case \"EXPORT\":\n        result = await internalAPI.exportDB(dbOpts,);\n        break;\n      case \"IMPORT\":\n        result = await internalAPI.importDB(\n          args.data,\n          args.clearFirst,\n          dbOpts,\n        );\n        break;\n      case \"BACKUP_OPFS\":\n        result = await internalAPI.backupToOpfs(\n          args.key,\n          args.fileName,\n          dbOpts,\n        );\n        break;\n      case \"RESTORE_OPFS\":\n        result = await internalAPI.restoreFromOpfs(\n          args.key,\n          args.fileName,\n          args.clearFirst,\n          dbOpts,\n        );\n        break;\n\n      // ==== OPFS EXTENSION ====\n      case \"OPFS_LIST\":\n        result = await internalAPI.listFiles(args.key, opfsOpts,);\n        break;\n      case \"OPFS_GET\":\n        result = await internalAPI.getFile(args.key, args.fileName, opfsOpts,);\n        break;\n      case \"OPFS_ADD\":\n        result = await internalAPI.addFile(\n          args.key,\n          args.file,\n          args.fileName,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_DEL\":\n        result = await internalAPI.delFile(args.key, args.fileName, opfsOpts,);\n        break;\n      case \"OPFS_REN\":\n        result = await internalAPI.renFile(\n          args.key,\n          args.oldName,\n          args.newName,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_MV\":\n        result = await internalAPI.mvFile(\n          args.key,\n          args.fileName,\n          args.newKey,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_ZIP\":\n        result = await internalAPI.zip(\n          args.key,\n          args.zipName,\n          args.filesToZip,\n          args.deleteOriginals,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_UNZIP\":\n        result = await internalAPI.unzip(\n          args.key,\n          args.zipName,\n          args.deleteZip,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_ADDZIP\":\n        result = await internalAPI.addZip(\n          args.key,\n          args.zipName,\n          args.file,\n          args.fileName,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_DELZIP\":\n        result = await internalAPI.delZip(\n          args.key,\n          args.zipName,\n          args.fileName,\n          opfsOpts,\n        );\n        break;\n      case \"GET_BY_INDEX\":\n        result = await internalAPI.getByIndex(\n          args.indexName,\n          args.query,\n          dbOpts,\n        );\n        break;\n      case \"COUNT_BY_INDEX\":\n        result = await internalAPI.countByIndex(\n          args.indexName,\n          args.query,\n          dbOpts,\n        );\n        break;\n      case \"GET_ONE_BY_INDEX\":\n        result = await internalAPI.getOneByIndex(\n          args.indexName,\n          args.query,\n          dbOpts,\n        );\n        break;\n      case \"KEYS_BY_INDEX\":\n        result = await internalAPI.keysByIndex(\n          args.indexName,\n          args.query,\n          dbOpts,\n        );\n        break;\n      case \"PATCH_BY_INDEX\":\n        result = await internalAPI.patchByIndex(\n          args.indexName,\n          args.query,\n          args.patch,\n          dbOpts,\n        );\n        break;\n      case \"GET_BY_INDEX_PAGINATED\":\n        result = await internalAPI.getByIndexPaginated(\n          args.indexName,\n          args.query,\n          args.paginationOpts,\n          dbOpts,\n        );\n        break;\n      case \"GET_MANY_BY_INDEX\":\n        result = await internalAPI.getManyByIndex(\n          args.indexName,\n          args.queries,\n          dbOpts,\n        );\n        break;\n      case \"GET_SOME_BY_INDEX\": {\n        const fn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.fnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        result = await internalAPI.getSomeByIndex(\n          args.indexName,\n          args.query,\n          fn,\n          args.context,\n          dbOpts,\n        );\n        break;\n      }\n      case \"QUERY_BY_INDEX\": {\n        const fn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.fnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => unknown;\n        result = await internalAPI.queryByIndex(\n          args.indexName,\n          args.query,\n          fn,\n          args.context,\n          dbOpts,\n        );\n        break;\n      }\n      case \"DELETE_BY_INDEX\":\n        result = await internalAPI.deleteByIndex(\n          args.indexName,\n          args.query,\n          dbOpts,\n        );\n        break;\n      case \"DELETE_MANY_BY_INDEX\":\n        result = await internalAPI.deleteManyByIndex(\n          args.indexName,\n          args.queries,\n          dbOpts,\n        );\n        break;\n      case \"DEL_SOME_BY_INDEX\": {\n        const fn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.fnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        result = await internalAPI.delSomeByIndex(\n          args.indexName,\n          args.query,\n          fn,\n          args.context,\n          dbOpts,\n        );\n        break;\n      }\n      case \"SET_SOME_BY_INDEX\": {\n        const selectFn = new Function(\n          \"items\",\n          \"ctx\",\n          `return (${args.selectFnStr})(items, ctx);`,\n        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];\n        const updateFn = new Function(\n          \"item\",\n          \"ctx\",\n          `return (${args.updateFnStr})(item, ctx);`,\n        ) as (item: { _id: string }, ctx?: unknown,) => { _id: string };\n        result = await internalAPI.setSomeByIndex(\n          args.indexName,\n          args.query,\n          selectFn,\n          updateFn,\n          args.context,\n          dbOpts,\n        );\n        break;\n      }\n      case \"OPFS_ADD_STREAM\":\n        result = await internalAPI.addFileStream(\n          args.key,\n          args.stream,\n          args.fileName,\n          opfsOpts,\n        );\n        break;\n      case \"OPFS_GET_STREAM\": {\n        const stream = await internalAPI.getFileStream(\n          args.key,\n          args.fileName,\n          opfsOpts,\n        );\n        (self as unknown as {\n          postMessage: (message: unknown, transfer?: Transferable[],) => void;\n        }).postMessage(\n          { requestId, success: true, result: stream, },\n          [stream as unknown as Transferable,],\n        );\n        return;\n      }\n\n      default:\n        throw new Error(`Unknown command: ${command}`);\n    }\n\n    self.postMessage({ requestId, success: true, result });\n  } catch (error) {\n    self.postMessage({\n      requestId,\n      success: false,\n      error: (error as Error).message,\n    });\n  }\n}\n\n// Auto-register listener if running directly in a Web Worker context\nif (\n  typeof self !== \"undefined\" &&\n  typeof (self as unknown as { postMessage?: unknown }).postMessage === \"function\" &&\n  typeof (self as unknown as { document?: unknown }).document === \"undefined\"\n) {\n  self.addEventListener(\"message\", (e: Event) => {\n    handleWorkerMessage(e as MessageEvent);\n  });\n}\n\n"],
  "mappings": ";;;;;iFAWO,SAASA,EACdC,EAAuC,CAEvC,OAAO,IAAI,QAAW,CAACC,EAASC,IAAA,CAG7BF,EAAgB,WAAcA,EAAgB,UAAY,IACzDC,EAASD,EAA0B,MAAM,EAE1CA,EAAgB,QAAWA,EAAgB,QAAU,IACpDE,EAAOF,EAAQ,KAAK,CACxB,CAAA,CACF,CAZgBG,EAAAJ,EAAA,oBA6BT,SAASK,GAAYC,EAAgBC,EAAiB,CAC3D,IAAIC,EACEC,EAAQL,EAAA,IAAA,CACZ,GAAII,EAAK,OAAOA,EAChB,IAAMP,EAAU,UAAU,KAAKK,CAAA,EAC/B,OAAAL,EAAQ,gBAAkB,IAAMA,EAAQ,OAAO,kBAAkBM,CAAA,EACjEC,EAAMR,EAAiBC,CAAA,EACvBO,EAAI,KACDE,GAAA,CACCA,EAAG,QAAU,IAAA,CACXF,EAAM,MACR,CACF,EACA,IAAA,CACEA,EAAM,MACR,CAAA,EAEKA,CACT,EAhBc,SAiBd,MAAO,CAACG,EAAQC,IACdH,EAAA,EAAQ,KAAMC,GACZE,EAASF,EAAG,YAAYH,EAAWI,CAAA,EAAQ,YAAYJ,CAAA,CAAA,CAAA,CAE7D,CAvBgBH,EAAAC,GAAA,eAyBhB,IAAIQ,GAOG,SAASC,IAAA,CACd,OAAKD,KACHA,GAAsBR,GAAY,eAAgB,QAAA,GAE7CQ,EACT,CALgBT,EAAAU,GAAA,mBAcT,SAASC,GACdC,EACAC,EAAwBH,GAAA,EAAiB,CAEzC,OAAOG,EAAY,WAAaC,GAC9BlB,EAAoBkB,EAAM,IAAIF,CAAA,CAAA,CAAA,CAElC,CAPgBZ,EAAAW,GAAA,OAgBT,SAASI,GACdH,EACAI,EACAH,EAAwBH,GAAA,EAAiB,CAEzC,OAAOG,EAAY,YAAcC,IAC/BA,EAAM,IAAIE,EAAOJ,CAAA,EACVhB,EAAiBkB,EAAM,WAAW,EAC3C,CACF,CATgBd,EAAAe,GAAA,OAiBT,SAASE,GACdC,EACAL,EAAwBH,GAAA,EAAiB,CAEzC,OAAOG,EAAY,YAAcC,IAC/BI,EAAQ,QAASC,GAAUL,EAAM,IAAIK,EAAM,CAAA,EAAIA,EAAM,CAAA,CAAE,CAAA,EAChDvB,EAAiBkB,EAAM,WAAW,EAC3C,CACF,CARgBd,EAAAiB,GAAA,WAiBT,SAASG,GACdC,EACAR,EAAwBH,GAAA,EAAiB,CAEzC,OAAOG,EAAY,WAAaC,GAC9B,QAAQ,IACNO,EAAK,IAAKT,GAAQhB,EAAoBkB,EAAM,IAAIF,CAAA,CAAA,CAAA,CAAA,CAAA,CAGtD,CATgBZ,EAAAoB,GAAA,WA+CT,SAASE,GACdC,EACAC,EAAwBC,GAAA,EAAiB,CAEzC,OAAOD,EAAY,YAAcE,IAC/BA,EAAM,OAAOH,CAAA,EACNI,EAAiBD,EAAM,WAAW,EAC3C,CACF,CARgBE,EAAAN,GAAA,OAgBT,SAASO,GACdC,EACAN,EAAwBC,GAAA,EAAiB,CAEzC,OAAOD,EAAY,YAAcE,IAC/BI,EAAK,QAASP,GAAQG,EAAM,OAAOH,CAAA,CAAA,EAC5BI,EAAiBD,EAAM,WAAW,EAC3C,CACF,CARgBE,EAAAC,GAAA,WAeT,SAASE,GACdP,EAAwBC,GAAA,EAAiB,CAEzC,OAAOD,EAAY,YAAcE,IAC/BA,EAAM,MAAK,EACJC,EAAiBD,EAAM,WAAW,EAC3C,CACF,CAPgBE,EAAAG,GAAA,SAShB,SAASC,GACPN,EACAO,EAA8C,CAE9C,OAAAP,EAAM,WAAU,EAAG,UAAY,UAAA,CACxB,KAAK,SACVO,EAAS,KAAK,MAAM,EACpB,KAAK,OAAO,SAAQ,EACtB,EACON,EAAiBD,EAAM,WAAW,CAC3C,CAVSE,EAAAI,GAAA,cAkBF,SAASF,GACdN,EAAwBC,GAAA,EAAiB,CAEzC,OAAOD,EAAY,WAAaE,GAAA,CAC9B,GAAIA,EAAM,WACR,OAAOC,EACLD,EAAM,WAAU,CAAA,EAGpB,IAAMQ,EAAmB,CAAA,EACzB,OAAOF,GAAWN,EAAQS,GAAWD,EAAM,KAAKC,EAAO,GAAG,CAAA,EAAc,KACtE,IAAMD,CAAA,CAEV,CAAA,CACF,CAdgBN,EAAAE,GAAA,QA0CT,SAASM,GAIdC,EAAwBC,GAAA,EAAiB,CAEzC,OAAOD,EAAY,WAAaE,GAAA,CAC9B,GAAIA,EAAM,QAAUA,EAAM,WACxB,OAAO,QAAQ,IAAI,CACjBC,EACED,EAAM,WAAU,CAAA,EAElBC,EAAiBD,EAAM,OAAM,CAAA,EAC9B,EAAE,KAAK,CAAC,CAACE,EAAUC,CAAA,IAClBD,EAAS,IAAI,CAACE,EAAKC,IAAM,CAACD,EAAKD,EAAWE,CAAA,EAAG,CAAA,EAGjD,IAAMC,EAAgC,CAAA,EACtC,OAAOC,GAAWP,EAAQQ,GACxBF,EAAM,KAAK,CAACE,EAAO,IAAgBA,EAAO,MAAmB,CAAA,EAC7D,KAAK,IAAMF,CAAA,CACf,CAAA,CACF,CAtBgBG,EAAAZ,GAAA,WC7PhB,IAAIa,EAAK,WAAYC,EAAM,YAAaC,GAAM,WAE1CC,GAAO,IAAIH,EAAG,CAAC,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAgB,EAAG,EAAoB,CAAC,CAAC,EAE5II,GAAO,IAAIJ,EAAG,CAAC,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,EAAG,GAAI,GAAI,GAAI,GAAI,GAAI,GAAI,GAAI,GAAiB,EAAG,CAAC,CAAC,EAEnIK,GAAO,IAAIL,EAAG,CAAC,GAAI,GAAI,GAAI,EAAG,EAAG,EAAG,EAAG,EAAG,GAAI,EAAG,GAAI,EAAG,GAAI,EAAG,GAAI,EAAG,GAAI,EAAG,EAAE,CAAC,EAEhFM,GAAOC,EAAA,SAAUC,EAAIC,EAAO,CAE5B,QADIC,EAAI,IAAIT,EAAI,EAAE,EACTU,EAAI,EAAGA,EAAI,GAAI,EAAEA,EACtBD,EAAEC,CAAC,EAAIF,GAAS,GAAKD,EAAGG,EAAI,CAAC,EAIjC,QADIC,EAAI,IAAIV,GAAIQ,EAAE,EAAE,CAAC,EACZC,EAAI,EAAGA,EAAI,GAAI,EAAEA,EACtB,QAASE,EAAIH,EAAEC,CAAC,EAAGE,EAAIH,EAAEC,EAAI,CAAC,EAAG,EAAEE,EAC/BD,EAAEC,CAAC,EAAMA,EAAIH,EAAEC,CAAC,GAAM,EAAKA,EAGnC,MAAO,CAAE,EAAGD,EAAG,EAAGE,CAAE,CACxB,EAbW,QAcPE,GAAKR,GAAKH,GAAM,CAAC,EAAGY,GAAKD,GAAG,EAAGE,GAAQF,GAAG,EAE9CC,GAAG,EAAE,EAAI,IAAKC,GAAM,GAAG,EAAI,GAC3B,IAAIC,GAAKX,GAAKF,GAAM,CAAC,EAAGc,GAAKD,GAAG,EAAGE,GAAQF,GAAG,EAE1CG,GAAM,IAAInB,EAAI,KAAK,EACvB,IAASU,EAAI,EAAGA,EAAI,MAAO,EAAEA,EAErBU,IAAMV,EAAI,QAAW,GAAOA,EAAI,QAAW,EAC/CU,IAAMA,GAAI,QAAW,GAAOA,GAAI,QAAW,EAC3CA,IAAMA,GAAI,QAAW,GAAOA,GAAI,OAAW,EAC3CD,GAAIT,CAAC,IAAOU,GAAI,QAAW,GAAOA,GAAI,MAAW,IAAO,EAHpD,IAAAA,GAFCV,EAULW,GAAQf,GAAA,SAAUgB,EAAIC,EAAIZ,EAAG,CAO7B,QANIa,EAAIF,EAAG,OAEP,EAAI,EAEJG,EAAI,IAAIzB,EAAIuB,CAAE,EAEX,EAAIC,EAAG,EAAE,EACRF,EAAG,CAAC,GACJ,EAAEG,EAAEH,EAAG,CAAC,EAAI,CAAC,EAGrB,IAAII,EAAK,IAAI1B,EAAIuB,CAAE,EACnB,IAAK,EAAI,EAAG,EAAIA,EAAI,EAAE,EAClBG,EAAG,CAAC,EAAKA,EAAG,EAAI,CAAC,EAAID,EAAE,EAAI,CAAC,GAAM,EAEtC,IAAIE,EACJ,GAAIhB,EAAG,CAEHgB,EAAK,IAAI3B,EAAI,GAAKuB,CAAE,EAEpB,IAAIK,EAAM,GAAKL,EACf,IAAK,EAAI,EAAG,EAAIC,EAAG,EAAE,EAEjB,GAAIF,EAAG,CAAC,EAQJ,QANIO,EAAM,GAAK,EAAKP,EAAG,CAAC,EAEpBQ,EAAMP,EAAKD,EAAG,CAAC,EAEfS,EAAIL,EAAGJ,EAAG,CAAC,EAAI,CAAC,KAAOQ,EAElBE,EAAID,GAAM,GAAKD,GAAO,EAAIC,GAAKC,EAAG,EAAED,EAEzCJ,EAAGR,GAAIY,CAAC,GAAKH,CAAG,EAAIC,CAIpC,KAGI,KADAF,EAAK,IAAI3B,EAAIwB,CAAC,EACT,EAAI,EAAG,EAAIA,EAAG,EAAE,EACbF,EAAG,CAAC,IACJK,EAAG,CAAC,EAAIR,GAAIO,EAAGJ,EAAG,CAAC,EAAI,CAAC,GAAG,GAAM,GAAKA,EAAG,CAAC,GAItD,OAAOK,CACX,GAhDY,QAkDRM,GAAM,IAAIlC,EAAG,GAAG,EACpB,IAASW,EAAI,EAAGA,EAAI,IAAK,EAAEA,EACvBuB,GAAIvB,CAAC,EAAI,EADJ,IAAAA,EAET,IAASA,EAAI,IAAKA,EAAI,IAAK,EAAEA,EACzBuB,GAAIvB,CAAC,EAAI,EADJ,IAAAA,EAET,IAASA,EAAI,IAAKA,EAAI,IAAK,EAAEA,EACzBuB,GAAIvB,CAAC,EAAI,EADJ,IAAAA,EAET,IAASA,EAAI,IAAKA,EAAI,IAAK,EAAEA,EACzBuB,GAAIvB,CAAC,EAAI,EADJ,IAAAA,EAGLwB,GAAM,IAAInC,EAAG,EAAE,EACnB,IAASW,EAAI,EAAGA,EAAI,GAAI,EAAEA,EACtBwB,GAAIxB,CAAC,EAAI,EADJ,IAAAA,EAGLyB,GAAoBd,GAAKY,GAAK,EAAG,CAAC,EAAGG,GAAqBf,GAAKY,GAAK,EAAG,CAAC,EAExEI,GAAoBhB,GAAKa,GAAK,EAAG,CAAC,EAAGI,GAAqBjB,GAAKa,GAAK,EAAG,CAAC,EAExEK,GAAMjC,EAAA,SAAUkC,EAAG,CAEnB,QADIR,EAAIQ,EAAE,CAAC,EACF9B,EAAI,EAAGA,EAAI8B,EAAE,OAAQ,EAAE9B,EACxB8B,EAAE9B,CAAC,EAAIsB,IACPA,EAAIQ,EAAE9B,CAAC,GAEf,OAAOsB,CACX,EAPU,OASNS,EAAOnC,EAAA,SAAUoC,EAAGC,EAAGX,EAAG,CAC1B,IAAIY,EAAKD,EAAI,EAAK,EAClB,OAASD,EAAEE,CAAC,EAAKF,EAAEE,EAAI,CAAC,GAAK,KAAQD,EAAI,GAAMX,CACnD,EAHW,QAKPa,GAASvC,EAAA,SAAUoC,EAAGC,EAAG,CACzB,IAAIC,EAAKD,EAAI,EAAK,EAClB,OAASD,EAAEE,CAAC,EAAKF,EAAEE,EAAI,CAAC,GAAK,EAAMF,EAAEE,EAAI,CAAC,GAAK,MAASD,EAAI,EAChE,EAHa,UAKTG,GAAOxC,EAAA,SAAUqC,EAAG,CAAE,OAASA,EAAI,GAAK,EAAK,CAAG,EAAzC,QAGPI,GAAMzC,EAAA,SAAUyB,EAAGP,EAAGwB,EAAG,CACzB,OAAIxB,GAAK,MAAQA,EAAI,KACjBA,EAAI,IACJwB,GAAK,MAAQA,EAAIjB,EAAE,UACnBiB,EAAIjB,EAAE,QAEH,IAAIhC,EAAGgC,EAAE,SAASP,EAAGwB,CAAC,CAAC,CAClC,EAPU,OA6BV,IAAIC,GAAK,CACL,iBACA,qBACA,yBACA,mBACA,kBACA,oBACA,CACA,cACA,qBACA,uBACA,8BACA,oBACA,mBACA,kBAEJ,EAEIC,EAAMC,EAAA,SAAUC,EAAKC,EAAKC,EAAI,CAC9B,IAAIC,EAAI,IAAI,MAAMF,GAAOJ,GAAGG,CAAG,CAAC,EAIhC,GAHAG,EAAE,KAAOH,EACL,MAAM,mBACN,MAAM,kBAAkBG,EAAGL,CAAG,EAC9B,CAACI,EACD,MAAMC,EACV,OAAOA,CACX,EARU,OAUNC,GAAQL,EAAA,SAAUM,EAAKC,EAAIC,EAAKC,EAAM,CAEtC,IAAIC,EAAKJ,EAAI,OAAQK,EAAKF,EAAOA,EAAK,OAAS,EAC/C,GAAI,CAACC,GAAMH,EAAG,GAAK,CAACA,EAAG,EACnB,OAAOC,GAAO,IAAII,EAAG,CAAC,EAC1B,IAAIC,EAAQ,CAACL,EAETM,EAASD,GAASN,EAAG,GAAK,EAE1BQ,EAAOR,EAAG,EAEVM,IACAL,EAAM,IAAII,EAAGF,EAAK,CAAC,GAEvB,IAAIM,EAAOhB,EAAA,SAAUiB,GAAG,CACpB,IAAIC,GAAKV,EAAI,OAEb,GAAIS,GAAIC,GAAI,CAER,IAAIC,GAAO,IAAIP,EAAG,KAAK,IAAIM,GAAK,EAAGD,EAAC,CAAC,EACrCE,GAAK,IAAIX,CAAG,EACZA,EAAMW,EACV,CACJ,EATW,QAWPC,EAAQb,EAAG,GAAK,EAAGc,EAAMd,EAAG,GAAK,EAAGe,EAAKf,EAAG,GAAK,EAAGgB,EAAKhB,EAAG,EAAGiB,EAAKjB,EAAG,EAAGkB,EAAMlB,EAAG,EAAGmB,EAAMnB,EAAG,EAE/FoB,EAAOjB,EAAK,EAChB,EAAG,CACC,GAAI,CAACa,EAAI,CAELH,EAAQQ,EAAKtB,EAAKe,EAAK,CAAC,EAExB,IAAIQ,EAAOD,EAAKtB,EAAKe,EAAM,EAAG,CAAC,EAE/B,GADAA,GAAO,EACFQ,EAiBA,GAAIA,GAAQ,EACbN,EAAKO,GAAMN,EAAKO,GAAMN,EAAM,EAAGC,EAAM,UAChCG,GAAQ,EAAG,CAEhB,IAAIG,EAAOJ,EAAKtB,EAAKe,EAAK,EAAE,EAAI,IAAKY,EAAQL,EAAKtB,EAAKe,EAAM,GAAI,EAAE,EAAI,EACnEa,EAAKF,EAAOJ,EAAKtB,EAAKe,EAAM,EAAG,EAAE,EAAI,EACzCA,GAAO,GAKP,QAHIc,EAAM,IAAIvB,EAAGsB,CAAE,EAEfE,EAAM,IAAIxB,EAAG,EAAE,EACVyB,EAAI,EAAGA,EAAIJ,EAAO,EAAEI,EAEzBD,EAAIE,GAAKD,CAAC,CAAC,EAAIT,EAAKtB,EAAKe,EAAMgB,EAAI,EAAG,CAAC,EAE3ChB,GAAOY,EAAQ,EAKf,QAHIM,EAAMC,GAAIJ,CAAG,EAAGK,IAAU,GAAKF,GAAO,EAEtCG,EAAMC,GAAKP,EAAKG,EAAK,CAAC,EACjBF,EAAI,EAAGA,EAAIH,GAAK,CACrB,IAAIU,EAAIF,EAAId,EAAKtB,EAAKe,EAAKoB,EAAM,CAAC,EAElCpB,GAAOuB,EAAI,GAEX,IAAIC,EAAID,GAAK,EAEb,GAAIC,EAAI,GACJV,EAAIE,GAAG,EAAIQ,MAEV,CAED,IAAIC,EAAI,EAAGC,EAAI,EAOf,IANIF,GAAK,IACLE,EAAI,EAAInB,EAAKtB,EAAKe,EAAK,CAAC,EAAGA,GAAO,EAAGyB,EAAIX,EAAIE,EAAI,CAAC,GAC7CQ,GAAK,IACVE,EAAI,EAAInB,EAAKtB,EAAKe,EAAK,CAAC,EAAGA,GAAO,GAC7BwB,GAAK,KACVE,EAAI,GAAKnB,EAAKtB,EAAKe,EAAK,GAAG,EAAGA,GAAO,GAClC0B,KACHZ,EAAIE,GAAG,EAAIS,CACnB,CACJ,CAEA,IAAIE,EAAKb,EAAI,SAAS,EAAGH,CAAI,EAAGiB,EAAKd,EAAI,SAASH,CAAI,EAEtDP,EAAMe,GAAIQ,CAAE,EAEZtB,EAAMc,GAAIS,CAAE,EACZ1B,EAAKoB,GAAKK,EAAIvB,EAAK,CAAC,EACpBD,EAAKmB,GAAKM,EAAIvB,EAAK,CAAC,CACxB,MAEI3B,EAAI,CAAC,MAtEE,CAEP,IAAI8C,EAAIK,GAAK7B,CAAG,EAAI,EAAGJ,EAAIX,EAAIuC,EAAI,CAAC,EAAKvC,EAAIuC,EAAI,CAAC,GAAK,EAAIM,EAAIN,EAAI5B,EACnE,GAAIkC,EAAIzC,EAAI,CACJK,GACAhB,EAAI,CAAC,EACT,KACJ,CAEIe,GACAE,EAAKM,EAAKL,CAAC,EAEfT,EAAI,IAAIF,EAAI,SAASuC,EAAGM,CAAC,EAAG7B,CAAE,EAE9Bf,EAAG,EAAIe,GAAML,EAAGV,EAAG,EAAIc,EAAM8B,EAAI,EAAG5C,EAAG,EAAIa,EAC3C,QACJ,CAuDA,GAAIC,EAAMM,EAAM,CACRZ,GACAhB,EAAI,CAAC,EACT,KACJ,CACJ,CAGIe,GACAE,EAAKM,EAAK,MAAM,EAGpB,QAFI8B,IAAO,GAAK3B,GAAO,EAAG4B,GAAO,GAAK3B,GAAO,EACzC4B,GAAOjC,GACHiC,GAAOjC,EAAK,CAEhB,IAAIyB,EAAIvB,EAAGgC,GAAOjD,EAAKe,CAAG,EAAI+B,EAAG,EAAGI,EAAMV,GAAK,EAE/C,GADAzB,GAAOyB,EAAI,GACPzB,EAAMM,EAAM,CACRZ,GACAhB,EAAI,CAAC,EACT,KACJ,CAGA,GAFK+C,GACD/C,EAAI,CAAC,EACLyD,EAAM,IACNhD,EAAIc,GAAI,EAAIkC,UACPA,GAAO,IAAK,CACjBF,GAAOjC,EAAKE,EAAK,KACjB,KACJ,KACK,CACD,IAAIkC,EAAMD,EAAM,IAEhB,GAAIA,EAAM,IAAK,CAEX,IAAInB,EAAImB,EAAM,IAAKE,EAAIC,GAAKtB,CAAC,EAC7BoB,EAAM7B,EAAKtB,EAAKe,GAAM,GAAKqC,GAAK,CAAC,EAAIE,GAAGvB,CAAC,EACzChB,GAAOqC,CACX,CAEA,IAAIG,EAAIrC,EAAG+B,GAAOjD,EAAKe,CAAG,EAAIgC,CAAG,EAAGS,GAAOD,GAAK,EAC3CA,GACD9D,EAAI,CAAC,EACTsB,GAAOwC,EAAI,GACX,IAAIZ,EAAKc,GAAGD,EAAI,EAChB,GAAIA,GAAO,EAAG,CACV,IAAIJ,EAAIM,GAAKF,EAAI,EACjBb,GAAMM,GAAOjD,EAAKe,CAAG,GAAK,GAAKqC,GAAK,EAAGrC,GAAOqC,CAClD,CACA,GAAIrC,EAAMM,EAAM,CACRZ,GACAhB,EAAI,CAAC,EACT,KACJ,CACIe,GACAE,EAAKM,EAAK,MAAM,EACpB,IAAI2C,GAAM3C,EAAKmC,EACf,GAAInC,EAAK2B,EAAI,CACT,IAAIiB,GAAQvD,EAAKsC,EAAIkB,GAAO,KAAK,IAAIlB,EAAIgB,EAAG,EAG5C,IAFIC,GAAQ5C,EAAK,GACbvB,EAAI,CAAC,EACFuB,EAAK6C,GAAM,EAAE7C,EAChBd,EAAIc,CAAE,EAAIb,EAAKyD,GAAQ5C,CAAE,CACjC,CACA,KAAOA,EAAK2C,GAAK,EAAE3C,EACfd,EAAIc,CAAE,EAAId,EAAIc,EAAK2B,CAAE,CAC7B,CACJ,CACA1C,EAAG,EAAIgB,EAAIhB,EAAG,EAAI+C,GAAM/C,EAAG,EAAIe,EAAIf,EAAG,EAAIa,EACtCG,IACAH,EAAQ,EAAGb,EAAG,EAAIkB,EAAKlB,EAAG,EAAIiB,EAAIjB,EAAG,EAAImB,EACjD,OAAS,CAACN,GAEV,OAAOE,GAAMd,EAAI,QAAUK,EAAQuD,GAAI5D,EAAK,EAAGc,CAAE,EAAId,EAAI,SAAS,EAAGc,CAAE,CAC3E,EAnLY,SAqLR+C,GAAQrE,EAAA,SAAU6D,EAAGS,EAAGC,EAAG,CAC3BA,IAAMD,EAAI,EACV,IAAIE,EAAKF,EAAI,EAAK,EAClBT,EAAEW,CAAC,GAAKD,EACRV,EAAEW,EAAI,CAAC,GAAKD,GAAK,CACrB,EALY,SAORE,GAAUzE,EAAA,SAAU6D,EAAGS,EAAGC,EAAG,CAC7BA,IAAMD,EAAI,EACV,IAAIE,EAAKF,EAAI,EAAK,EAClBT,EAAEW,CAAC,GAAKD,EACRV,EAAEW,EAAI,CAAC,GAAKD,GAAK,EACjBV,EAAEW,EAAI,CAAC,GAAKD,GAAK,EACrB,EANc,WAQVG,GAAQ1E,EAAA,SAAU6D,EAAGc,EAAI,CAGzB,QADIxB,EAAI,CAAC,EACAd,EAAI,EAAGA,EAAIwB,EAAE,OAAQ,EAAExB,EACxBwB,EAAExB,CAAC,GACHc,EAAE,KAAK,CAAE,EAAGd,EAAG,EAAGwB,EAAExB,CAAC,CAAE,CAAC,EAEhC,IAAIQ,EAAIM,EAAE,OACNyB,EAAKzB,EAAE,MAAM,EACjB,GAAI,CAACN,EACD,MAAO,CAAE,EAAGgC,GAAI,EAAG,CAAE,EACzB,GAAIhC,GAAK,EAAG,CACR,IAAI0B,EAAI,IAAI3D,EAAGuC,EAAE,CAAC,EAAE,EAAI,CAAC,EACzB,OAAAoB,EAAEpB,EAAE,CAAC,EAAE,CAAC,EAAI,EACL,CAAE,EAAGoB,EAAG,EAAG,CAAE,CACxB,CACApB,EAAE,KAAK,SAAU2B,EAAGpB,EAAG,CAAE,OAAOoB,EAAE,EAAIpB,EAAE,CAAG,CAAC,EAG5CP,EAAE,KAAK,CAAE,EAAG,GAAI,EAAG,KAAM,CAAC,EAC1B,IAAIlC,EAAIkC,EAAE,CAAC,EAAGP,EAAIO,EAAE,CAAC,EAAG4B,EAAK,EAAGC,EAAK,EAAGC,EAAK,EAO7C,IANA9B,EAAE,CAAC,EAAI,CAAE,EAAG,GAAI,EAAGlC,EAAE,EAAI2B,EAAE,EAAG,EAAG3B,EAAG,EAAG2B,CAAE,EAMlCoC,GAAMnC,EAAI,GACb5B,EAAIkC,EAAEA,EAAE4B,CAAE,EAAE,EAAI5B,EAAE8B,CAAE,EAAE,EAAIF,IAAOE,GAAI,EACrCrC,EAAIO,EAAE4B,GAAMC,GAAM7B,EAAE4B,CAAE,EAAE,EAAI5B,EAAE8B,CAAE,EAAE,EAAIF,IAAOE,GAAI,EACjD9B,EAAE6B,GAAI,EAAI,CAAE,EAAG,GAAI,EAAG/D,EAAE,EAAI2B,EAAE,EAAG,EAAG3B,EAAG,EAAG2B,CAAE,EAGhD,QADIsC,EAASN,EAAG,CAAC,EAAE,EACVvC,EAAI,EAAGA,EAAIQ,EAAG,EAAER,EACjBuC,EAAGvC,CAAC,EAAE,EAAI6C,IACVA,EAASN,EAAGvC,CAAC,EAAE,GAGvB,IAAI8C,EAAK,IAAIC,EAAIF,EAAS,CAAC,EAEvBG,EAAMC,GAAGnC,EAAE6B,EAAK,CAAC,EAAGG,EAAI,CAAC,EAC7B,GAAIE,EAAMV,EAAI,CAIV,IAAItC,EAAI,EAAGY,EAAK,EAEZsC,EAAMF,EAAMV,EAAIa,EAAM,GAAKD,EAE/B,IADAX,EAAG,KAAK,SAAUE,EAAGpB,EAAG,CAAE,OAAOyB,EAAGzB,EAAE,CAAC,EAAIyB,EAAGL,EAAE,CAAC,GAAKA,EAAE,EAAIpB,EAAE,CAAG,CAAC,EAC3DrB,EAAIQ,EAAG,EAAER,EAAG,CACf,IAAIoD,EAAOb,EAAGvC,CAAC,EAAE,EACjB,GAAI8C,EAAGM,CAAI,EAAId,EACX1B,GAAMuC,GAAO,GAAMH,EAAMF,EAAGM,CAAI,GAChCN,EAAGM,CAAI,EAAId,MAGX,MACR,CAEA,IADA1B,IAAOsC,EACAtC,EAAK,GAAG,CACX,IAAIyC,EAAOd,EAAGvC,CAAC,EAAE,EACb8C,EAAGO,CAAI,EAAIf,EACX1B,GAAM,GAAM0B,EAAKQ,EAAGO,CAAI,IAAM,EAE9B,EAAErD,CACV,CACA,KAAOA,GAAK,GAAKY,EAAI,EAAEZ,EAAG,CACtB,IAAIsD,EAAOf,EAAGvC,CAAC,EAAE,EACb8C,EAAGQ,CAAI,GAAKhB,IACZ,EAAEQ,EAAGQ,CAAI,EACT,EAAE1C,EAEV,CACAoC,EAAMV,CACV,CACA,MAAO,CAAE,EAAG,IAAI/D,EAAGuE,CAAE,EAAG,EAAGE,CAAI,CACnC,EA5EY,SA8ERC,GAAKtF,EAAA,SAAU+C,EAAG9B,EAAG4C,EAAG,CACxB,OAAOd,EAAE,GAAK,GACR,KAAK,IAAIuC,GAAGvC,EAAE,EAAG9B,EAAG4C,EAAI,CAAC,EAAGyB,GAAGvC,EAAE,EAAG9B,EAAG4C,EAAI,CAAC,CAAC,EAC5C5C,EAAE8B,EAAE,CAAC,EAAIc,CACpB,EAJS,MAML+B,GAAK5F,EAAA,SAAU8C,EAAG,CAGlB,QAFID,EAAIC,EAAE,OAEHD,GAAK,CAACC,EAAE,EAAED,CAAC,GACd,CAKJ,QAJIgD,EAAK,IAAIT,EAAI,EAAEvC,CAAC,EAEhBiD,EAAM,EAAGC,EAAMjD,EAAE,CAAC,EAAGkD,EAAM,EAC3BC,EAAIjG,EAAA,SAAUuE,EAAG,CAAEsB,EAAGC,GAAK,EAAIvB,CAAG,EAA9B,KACClC,EAAI,EAAGA,GAAKQ,EAAG,EAAER,EACtB,GAAIS,EAAET,CAAC,GAAK0D,GAAO1D,GAAKQ,EACpB,EAAEmD,MACD,CACD,GAAI,CAACD,GAAOC,EAAM,EAAG,CACjB,KAAOA,EAAM,IAAKA,GAAO,IACrBC,EAAE,KAAK,EACPD,EAAM,IACNC,EAAED,EAAM,GAAOA,EAAM,IAAO,EAAK,MAAUA,EAAM,GAAM,EAAK,KAAK,EACjEA,EAAM,EAEd,SACSA,EAAM,EAAG,CAEd,IADAC,EAAEF,CAAG,EAAG,EAAEC,EACHA,EAAM,EAAGA,GAAO,EACnBC,EAAE,IAAI,EACND,EAAM,IACNC,EAAID,EAAM,GAAM,EAAK,IAAI,EAAGA,EAAM,EAC1C,CACA,KAAOA,KACHC,EAAEF,CAAG,EACTC,EAAM,EACND,EAAMjD,EAAET,CAAC,CACb,CAEJ,MAAO,CAAE,EAAGwD,EAAG,SAAS,EAAGC,CAAG,EAAG,EAAGjD,CAAE,CAC1C,EAnCS,MAqCLqD,GAAOlG,EAAA,SAAUmG,EAAIN,EAAI,CAEzB,QADI5E,EAAI,EACCoB,EAAI,EAAGA,EAAIwD,EAAG,OAAQ,EAAExD,EAC7BpB,GAAKkF,EAAG9D,CAAC,EAAIwD,EAAGxD,CAAC,EACrB,OAAOpB,CACX,EALW,QAQPmF,GAAQpG,EAAA,SAAUqG,EAAKhF,EAAKf,EAAK,CAEjC,IAAIuC,EAAIvC,EAAI,OACRkE,EAAItB,GAAK7B,EAAM,CAAC,EACpBgF,EAAI7B,CAAC,EAAI3B,EAAI,IACbwD,EAAI7B,EAAI,CAAC,EAAI3B,GAAK,EAClBwD,EAAI7B,EAAI,CAAC,EAAI6B,EAAI7B,CAAC,EAAI,IACtB6B,EAAI7B,EAAI,CAAC,EAAI6B,EAAI7B,EAAI,CAAC,EAAI,IAC1B,QAASnC,EAAI,EAAGA,EAAIQ,EAAG,EAAER,EACrBgE,EAAI7B,EAAInC,EAAI,CAAC,EAAI/B,EAAI+B,CAAC,EAC1B,OAAQmC,EAAI,EAAI3B,GAAK,CACzB,EAXY,SAaRyD,GAAOtG,EAAA,SAAUM,EAAK+F,EAAKjF,EAAOmF,EAAMC,EAAIC,EAAIC,EAAIC,EAAIC,EAAI1F,EAAIoD,EAAG,CACnED,GAAMgC,EAAK/B,IAAKlD,CAAK,EACrB,EAAEoF,EAAG,GAAG,EAMR,QALIK,EAAKnC,GAAM8B,EAAI,EAAE,EAAGM,EAAMD,EAAG,EAAGE,EAAMF,EAAG,EACzCG,EAAKtC,GAAM+B,EAAI,EAAE,EAAGQ,EAAMD,EAAG,EAAGE,EAAMF,EAAG,EACzCG,EAAKvB,GAAGkB,CAAG,EAAGM,EAAOD,EAAG,EAAGE,EAAMF,EAAG,EACpCG,EAAK1B,GAAGqB,CAAG,EAAGM,EAAOD,EAAG,EAAGE,EAAMF,EAAG,EACpCG,EAAS,IAAIrC,EAAI,EAAE,EACd/C,EAAI,EAAGA,EAAI+E,EAAK,OAAQ,EAAE/E,EAC/B,EAAEoF,EAAOL,EAAK/E,CAAC,EAAI,EAAE,EACzB,QAASA,EAAI,EAAGA,EAAIkF,EAAK,OAAQ,EAAElF,EAC/B,EAAEoF,EAAOF,EAAKlF,CAAC,EAAI,EAAE,EAGzB,QAFIqF,EAAKhD,GAAM+C,EAAQ,CAAC,EAAGE,EAAMD,EAAG,EAAGE,EAAOF,EAAG,EAC7CG,EAAO,GACJA,EAAO,GAAK,CAACF,EAAIrF,GAAKuF,EAAO,CAAC,CAAC,EAAG,EAAEA,EACvC,CACJ,IAAIC,GAAQ5G,EAAK,GAAM,EACnB6G,EAAQ7B,GAAKM,EAAIwB,EAAG,EAAI9B,GAAKO,EAAIwB,EAAG,EAAIvB,EACxCwB,EAAQhC,GAAKM,EAAIM,CAAG,EAAIZ,GAAKO,EAAIQ,CAAG,EAAIP,EAAK,GAAK,EAAImB,EAAO3B,GAAKuB,EAAQE,CAAG,EAAI,EAAIF,EAAO,EAAE,EAAI,EAAIA,EAAO,EAAE,EAAI,EAAIA,EAAO,EAAE,EACpI,GAAIb,GAAM,GAAKkB,IAAQC,GAASD,IAAQI,EACpC,OAAO9B,GAAMC,EAAK/B,EAAGhE,EAAI,SAASsG,EAAIA,EAAK1F,CAAE,CAAC,EAClD,IAAIK,EAAI4G,EAAI3G,EAAIb,EAEhB,GADA0D,GAAMgC,EAAK/B,EAAG,GAAK4D,EAAQH,EAAM,EAAGzD,GAAK,EACrC4D,EAAQH,EAAO,CACfxG,EAAKoB,GAAKmE,EAAKC,EAAK,CAAC,EAAGoB,EAAKrB,EAAKtF,EAAKmB,GAAKsE,EAAKC,EAAK,CAAC,EAAGvG,EAAKsG,EAC/D,IAAImB,GAAMzF,GAAKgF,EAAKC,EAAM,CAAC,EAC3BvD,GAAMgC,EAAK/B,EAAG+C,EAAM,GAAG,EACvBhD,GAAMgC,EAAK/B,EAAI,EAAGkD,EAAM,CAAC,EACzBnD,GAAMgC,EAAK/B,EAAI,GAAIuD,EAAO,CAAC,EAC3BvD,GAAK,GACL,QAASjC,EAAI,EAAGA,EAAIwF,EAAM,EAAExF,EACxBgC,GAAMgC,EAAK/B,EAAI,EAAIjC,EAAGsF,EAAIrF,GAAKD,CAAC,CAAC,CAAC,EACtCiC,GAAK,EAAIuD,EAET,QADIQ,EAAO,CAACjB,EAAMG,CAAI,EACbe,GAAK,EAAGA,GAAK,EAAG,EAAEA,GAEvB,QADIC,EAAOF,EAAKC,EAAE,EACTjG,EAAI,EAAGA,EAAIkG,EAAK,OAAQ,EAAElG,EAAG,CAClC,IAAImG,EAAMD,EAAKlG,CAAC,EAAI,GACpBgC,GAAMgC,EAAK/B,EAAG8D,GAAII,CAAG,CAAC,EAAGlE,GAAKqD,EAAIa,CAAG,EACjCA,EAAM,KACNnE,GAAMgC,EAAK/B,EAAIiE,EAAKlG,CAAC,GAAK,EAAK,GAAG,EAAGiC,GAAKiE,EAAKlG,CAAC,GAAK,GAC7D,CAER,MAEId,EAAKkH,GAAKN,EAAKH,GAAKxG,EAAKkH,GAAK/H,EAAKsH,GAEvC,QAAS5F,EAAI,EAAGA,EAAIsE,EAAI,EAAEtE,EAAG,CACzB,IAAImB,EAAM+C,EAAKlE,CAAC,EAChB,GAAImB,EAAM,IAAK,CACX,IAAIgF,EAAOhF,GAAO,GAAM,GACxBiB,GAAQ4B,EAAK/B,EAAG/C,EAAGiH,EAAM,GAAG,CAAC,EAAGlE,GAAK6D,EAAGK,EAAM,GAAG,EAC7CA,EAAM,IACNnE,GAAMgC,EAAK/B,EAAId,GAAO,GAAM,EAAE,EAAGc,GAAKX,GAAK6E,CAAG,GAClD,IAAIG,EAAMnF,EAAM,GAChBiB,GAAQ4B,EAAK/B,EAAG9C,EAAGmH,CAAG,CAAC,EAAGrE,GAAK3D,EAAGgI,CAAG,EACjCA,EAAM,IACNlE,GAAQ4B,EAAK/B,EAAId,GAAO,EAAK,IAAI,EAAGc,GAAKN,GAAK2E,CAAG,EACzD,MAEIlE,GAAQ4B,EAAK/B,EAAG/C,EAAGiC,CAAG,CAAC,EAAGc,GAAK6D,EAAG3E,CAAG,CAE7C,CACA,OAAAiB,GAAQ4B,EAAK/B,EAAG/C,EAAG,GAAG,CAAC,EAChB+C,EAAI6D,EAAG,GAAG,CACrB,EAjEW,QAmEPS,GAAoB,IAAIC,GAAI,CAAC,MAAO,OAAQ,OAAQ,OAAQ,OAAQ,QAAS,QAAS,QAAS,OAAO,CAAC,EAEvGhE,GAAmB,IAAIjE,EAAG,CAAC,EAE3BkI,GAAO9I,EAAA,SAAUM,EAAKyI,EAAKC,EAAMC,EAAKC,EAAM3I,EAAI,CAChD,IAAI,EAAIA,EAAG,GAAKD,EAAI,OAChB,EAAI,IAAIM,EAAGqI,EAAM,EAAI,GAAK,EAAI,KAAK,KAAK,EAAI,GAAI,GAAKC,CAAI,EAEzDjD,EAAI,EAAE,SAASgD,EAAK,EAAE,OAASC,CAAI,EACnCC,EAAM5I,EAAG,EACTc,GAAOd,EAAG,GAAK,GAAK,EACxB,GAAIwI,EAAK,CACD1H,IACA4E,EAAE,CAAC,EAAI1F,EAAG,GAAK,GAenB,QAdI6I,EAAMR,GAAIG,EAAM,CAAC,EACjBhG,EAAIqG,GAAO,GAAItG,EAAIsG,EAAM,KACzBC,GAAS,GAAKL,GAAQ,EAEtBM,EAAO/I,EAAG,GAAK,IAAI6E,EAAI,KAAK,EAAGmE,EAAOhJ,EAAG,GAAK,IAAI6E,EAAIiE,EAAQ,CAAC,EAC/DG,EAAQ,KAAK,KAAKR,EAAO,CAAC,EAAGS,EAAQ,EAAID,EACzCE,EAAM1J,EAAA,SAAUqC,GAAG,CAAE,OAAQ/B,EAAI+B,EAAC,EAAK/B,EAAI+B,GAAI,CAAC,GAAKmH,EAAUlJ,EAAI+B,GAAI,CAAC,GAAKoH,GAAUJ,CAAO,EAAxF,OAGN9C,EAAO,IAAIsC,GAAI,IAAK,EAEpBrC,EAAK,IAAIpB,EAAI,GAAG,EAAGqB,EAAK,IAAIrB,EAAI,EAAE,EAElCuE,EAAO,EAAGjD,EAAK,EAAGrE,EAAI9B,EAAG,GAAK,EAAGoG,EAAK,EAAGiD,EAAKrJ,EAAG,GAAK,EAAGqG,EAAK,EAC3DvE,EAAI,EAAI,EAAG,EAAEA,EAAG,CAEnB,IAAIwH,GAAKH,EAAIrH,CAAC,EAEVyH,EAAOzH,EAAI,MAAO0H,EAAQR,EAAKM,EAAE,EAKrC,GAJAP,EAAKQ,CAAI,EAAIC,EACbR,EAAKM,EAAE,EAAIC,EAGPF,GAAMvH,EAAG,CAET,IAAI2H,EAAM,EAAI3H,EACd,IAAKsH,EAAO,KAAQhD,EAAK,SAAWqD,EAAM,KAAO,CAACb,GAAM,CACpD9H,EAAMiF,GAAKhG,EAAK2F,EAAG,EAAGM,EAAMC,EAAIC,EAAIC,EAAIC,EAAIC,EAAIvE,EAAIuE,EAAIvF,CAAG,EAC3DsF,EAAKgD,EAAOjD,EAAK,EAAGE,EAAKvE,EACzB,QAAS4H,EAAI,EAAGA,EAAI,IAAK,EAAEA,EACvBzD,EAAGyD,CAAC,EAAI,EACZ,QAASA,EAAI,EAAGA,EAAI,GAAI,EAAEA,EACtBxD,EAAGwD,CAAC,EAAI,CAChB,CAEA,IAAIhJ,EAAI,EAAG4C,EAAI,EAAGqG,GAAOpH,EAAGqH,EAAML,EAAOC,EAAQ,MACjD,GAAIC,EAAM,GAAKH,IAAMH,EAAIrH,EAAI8H,CAAG,EAM5B,QALIC,GAAO,KAAK,IAAIrH,EAAGiH,CAAG,EAAI,EAC1BK,EAAO,KAAK,IAAI,MAAOhI,CAAC,EAGxBiI,EAAK,KAAK,IAAI,IAAKN,CAAG,EACnBG,GAAOE,GAAQ,EAAEH,IAAQJ,GAAQC,GAAO,CAC3C,GAAIzJ,EAAI+B,EAAIpB,CAAC,GAAKX,EAAI+B,EAAIpB,EAAIkJ,CAAG,EAAG,CAEhC,QADII,EAAK,EACFA,EAAKD,GAAMhK,EAAI+B,EAAIkI,CAAE,GAAKjK,EAAI+B,EAAIkI,EAAKJ,CAAG,EAAG,EAAEI,EAClD,CACJ,GAAIA,EAAKtJ,EAAG,CAGR,GAFAA,EAAIsJ,EAAI1G,EAAIsG,EAERI,EAAKH,GACL,MAMJ,QAFII,EAAM,KAAK,IAAIL,EAAKI,EAAK,CAAC,EAC1BE,GAAK,EACAR,EAAI,EAAGA,EAAIO,EAAK,EAAEP,EAAG,CAC1B,IAAIS,GAAKrI,EAAI8H,EAAMF,EAAI,MACnBU,GAAMrB,EAAKoB,EAAE,EACbE,GAAKF,GAAKC,GAAM,MAChBC,GAAKH,KACLA,GAAKG,GAAIb,EAAQW,GACzB,CACJ,CACJ,CAEAZ,EAAOC,EAAOA,EAAQT,EAAKQ,CAAI,EAC/BK,GAAOL,EAAOC,EAAQ,KAC1B,CAGJ,GAAIlG,EAAG,CAGH0C,EAAKI,GAAI,EAAI,UAAakE,GAAM5J,CAAC,GAAK,GAAM6J,GAAMjH,CAAC,EACnD,IAAIkH,GAAMF,GAAM5J,CAAC,EAAI,GAAI+J,GAAMF,GAAMjH,CAAC,EAAI,GAC1C6C,GAAM/C,GAAKoH,EAAG,EAAI/G,GAAKgH,EAAG,EAC1B,EAAExE,EAAG,IAAMuE,EAAG,EACd,EAAEtE,EAAGuE,EAAG,EACRpB,EAAKvH,EAAIpB,EACT,EAAE0I,CACN,MAEIpD,EAAKI,GAAI,EAAIrG,EAAI+B,CAAC,EAClB,EAAEmE,EAAGlG,EAAI+B,CAAC,CAAC,CAEnB,CACJ,CACA,IAAKA,EAAI,KAAK,IAAIA,EAAGuH,CAAE,EAAGvH,EAAI,EAAG,EAAEA,EAC/BkE,EAAKI,GAAI,EAAIrG,EAAI+B,CAAC,EAClB,EAAEmE,EAAGlG,EAAI+B,CAAC,CAAC,EAEfhB,EAAMiF,GAAKhG,EAAK2F,EAAGkD,EAAK5C,EAAMC,EAAIC,EAAIC,EAAIC,EAAIC,EAAIvE,EAAIuE,EAAIvF,CAAG,EACxD8H,IACD5I,EAAG,EAAKc,EAAM,EAAK4E,EAAG5E,EAAM,EAAK,CAAC,GAAK,EAEvCA,GAAO,EACPd,EAAG,EAAIgJ,EAAMhJ,EAAG,EAAI+I,EAAM/I,EAAG,EAAI8B,EAAG9B,EAAG,EAAIqJ,EAEnD,KACK,CACD,QAASvH,EAAI9B,EAAG,GAAK,EAAG8B,EAAI,EAAI8G,EAAK9G,GAAK,MAAO,CAE7C,IAAIjC,GAAIiC,EAAI,MACRjC,IAAK,IAEL6F,EAAG5E,EAAM,EAAK,CAAC,EAAI8H,EACnB/I,GAAI,GAERiB,EAAM+E,GAAMH,EAAG5E,EAAM,EAAGf,EAAI,SAAS+B,EAAGjC,EAAC,CAAC,CAC9C,CACAG,EAAG,EAAI,CACX,CACA,OAAO6D,GAAI,EAAG,EAAG6E,EAAM/F,GAAK7B,CAAG,EAAI6H,CAAI,CAC3C,EA7HW,QA+HP+B,IAAsB,UAAY,CAElC,QADI9H,EAAI,IAAI,WAAW,GAAG,EACjBd,EAAI,EAAGA,EAAI,IAAK,EAAEA,EAAG,CAE1B,QADIS,EAAIT,EAAG6I,EAAI,EACR,EAAEA,GACLpI,GAAMA,EAAI,GAAM,YAAeA,IAAM,EACzCK,EAAEd,CAAC,EAAIS,CACX,CACA,OAAOK,CACX,GAAG,EAECgI,GAAMnL,EAAA,UAAY,CAClB,IAAI8C,EAAI,GACR,MAAO,CACH,EAAG9C,EAAA,SAAU6D,EAAG,CAGZ,QADIuH,EAAKtI,EACAT,EAAI,EAAGA,EAAIwB,EAAE,OAAQ,EAAExB,EAC5B+I,EAAKH,GAAMG,EAAK,IAAOvH,EAAExB,CAAC,CAAC,EAAK+I,IAAO,EAC3CtI,EAAIsI,CACR,EANG,KAOH,EAAGpL,EAAA,UAAY,CAAE,MAAO,CAAC8C,CAAG,EAAzB,IACP,CACJ,EAZU,OAqCV,IAAIuI,GAAOC,EAAA,SAAUC,EAAKC,EAAKC,EAAKC,EAAMC,EAAI,CAC1C,GAAI,CAACA,IACDA,EAAK,CAAE,EAAG,CAAE,EACRH,EAAI,YAAY,CAChB,IAAII,EAAOJ,EAAI,WAAW,SAAS,MAAM,EACrCK,EAAS,IAAIC,EAAGF,EAAK,OAASL,EAAI,MAAM,EAC5CM,EAAO,IAAID,CAAI,EACfC,EAAO,IAAIN,EAAKK,EAAK,MAAM,EAC3BL,EAAMM,EACNF,EAAG,EAAIC,EAAK,MAChB,CAEJ,OAAOG,GAAKR,EAAKC,EAAI,OAAS,KAAO,EAAIA,EAAI,MAAOA,EAAI,KAAO,KAAQG,EAAG,EAAI,KAAK,KAAK,KAAK,IAAI,EAAG,KAAK,IAAI,GAAI,KAAK,IAAIJ,EAAI,MAAM,CAAC,CAAC,EAAI,GAAG,EAAI,GAAO,GAAKC,EAAI,IAAMC,EAAKC,EAAMC,CAAE,CACxL,EAbW,QAePK,GAAMV,EAAA,SAAUW,EAAGC,EAAG,CACtB,IAAIC,EAAI,CAAC,EACT,QAASC,KAAKH,EACVE,EAAEC,CAAC,EAAIH,EAAEG,CAAC,EACd,QAASA,KAAKF,EACVC,EAAEC,CAAC,EAAIF,EAAEE,CAAC,EACd,OAAOD,CACX,EAPU,OA6IV,IAAIE,GAAKC,EAAA,SAAUC,EAAGC,EAAG,CAAE,OAAOD,EAAEC,CAAC,EAAKD,EAAEC,EAAI,CAAC,GAAK,CAAI,EAAjD,MAELC,EAAKH,EAAA,SAAUC,EAAGC,EAAG,CAAE,OAAQD,EAAEC,CAAC,EAAKD,EAAEC,EAAI,CAAC,GAAK,EAAMD,EAAEC,EAAI,CAAC,GAAK,GAAOD,EAAEC,EAAI,CAAC,GAAK,MAAS,CAAG,EAA/F,MAELE,GAAKJ,EAAA,SAAUC,EAAGC,EAAG,CAAE,OAAOC,EAAGF,EAAGC,CAAC,EAAKC,EAAGF,EAAGC,EAAI,CAAC,EAAI,UAAa,EAAjE,MAELG,EAASL,EAAA,SAAUC,EAAGC,EAAGI,EAAG,CAC5B,KAAOA,EAAG,EAAEJ,EACRD,EAAEC,CAAC,EAAII,EAAGA,KAAO,CACzB,EAHa,UAwLN,SAASC,GAAYC,EAAMC,EAAM,CACpC,OAAOC,GAAKF,EAAMC,GAAQ,CAAC,EAAG,EAAG,CAAC,CACtC,CAFgBE,EAAAJ,GAAA,eA2ET,SAASK,GAAYC,EAAMC,EAAM,CACpC,OAAOC,GAAMF,EAAM,CAAE,EAAG,CAAE,EAAGC,GAAQA,EAAK,IAAKA,GAAQA,EAAK,UAAU,CAC1E,CAFgBE,EAAAJ,GAAA,eAyahB,IAAIK,GAAOC,EAAA,SAAUC,EAAGC,EAAGC,EAAGC,EAAG,CAC7B,QAASC,KAAKJ,EAAG,CACb,IAAIK,EAAML,EAAEI,CAAC,EAAGE,EAAIL,EAAIG,EAAGG,EAAKJ,EAC5B,MAAM,QAAQE,CAAG,IACjBE,EAAKC,GAAIL,EAAGE,EAAI,CAAC,CAAC,EAAGA,EAAMA,EAAI,CAAC,GAChC,YAAY,OAAOA,CAAG,EACtBH,EAAEI,CAAC,EAAI,CAACD,EAAKE,CAAE,GAEfL,EAAEI,GAAK,GAAG,EAAI,CAAC,IAAIG,EAAG,CAAC,EAAGF,CAAE,EAC5BT,GAAKO,EAAKC,EAAGJ,EAAGC,CAAC,EAEzB,CACJ,EAZW,QAcPO,GAAK,OAAO,YAAe,KAA6B,IAAI,YAE5DC,GAAK,OAAO,YAAe,KAA6B,IAAI,YAE5DC,GAAM,EACV,GAAI,CACAD,GAAG,OAAOE,GAAI,CAAE,OAAQ,EAAK,CAAC,EAC9BD,GAAM,CACV,MACU,CAAE,CAEZ,IAAIE,GAAQf,EAAA,SAAUC,EAAG,CACrB,QAASe,EAAI,GAAIC,EAAI,IAAK,CACtB,IAAIC,EAAIjB,EAAEgB,GAAG,EACTE,GAAMD,EAAI,MAAQA,EAAI,MAAQA,EAAI,KACtC,GAAID,EAAIE,EAAKlB,EAAE,OACX,MAAO,CAAE,EAAGe,EAAG,EAAGI,GAAInB,EAAGgB,EAAI,CAAC,CAAE,EAC/BE,EAEIA,GAAM,GACXD,IAAMA,EAAI,KAAO,IAAMjB,EAAEgB,GAAG,EAAI,KAAO,IAAMhB,EAAEgB,GAAG,EAAI,KAAO,EAAKhB,EAAEgB,GAAG,EAAI,IAAO,MAC9ED,GAAK,OAAO,aAAa,MAASE,GAAK,GAAK,MAASA,EAAI,IAAK,GAE7DC,EAAK,EACVH,GAAK,OAAO,cAAcE,EAAI,KAAO,EAAKjB,EAAEgB,GAAG,EAAI,EAAG,EAEtDD,GAAK,OAAO,cAAcE,EAAI,KAAO,IAAMjB,EAAEgB,GAAG,EAAI,KAAO,EAAKhB,EAAEgB,GAAG,EAAI,EAAG,EAR5ED,GAAK,OAAO,aAAaE,CAAC,CASlC,CACJ,EAjBY,SAsGL,SAASG,GAAQC,EAAKC,EAAQ,CACjC,GAAIA,EAAQ,CAER,QADIC,EAAO,IAAIC,EAAGH,EAAI,MAAM,EACnBI,EAAI,EAAGA,EAAIJ,EAAI,OAAQ,EAAEI,EAC9BF,EAAKE,CAAC,EAAIJ,EAAI,WAAWI,CAAC,EAC9B,OAAOF,CACX,CACA,GAAIG,GACA,OAAOA,GAAG,OAAOL,CAAG,EAKxB,QAJIM,EAAIN,EAAI,OACRO,EAAK,IAAIJ,EAAGH,EAAI,QAAUA,EAAI,QAAU,EAAE,EAC1CQ,EAAK,EACLC,EAAIC,EAAA,SAAUC,EAAG,CAAEJ,EAAGC,GAAI,EAAIG,CAAG,EAA7B,KACCP,EAAI,EAAGA,EAAIE,EAAG,EAAEF,EAAG,CACxB,GAAII,EAAK,EAAID,EAAG,OAAQ,CACpB,IAAIK,EAAI,IAAIT,EAAGK,EAAK,GAAMF,EAAIF,GAAM,EAAE,EACtCQ,EAAE,IAAIL,CAAE,EACRA,EAAKK,CACT,CACA,IAAI,EAAIZ,EAAI,WAAWI,CAAC,EACpB,EAAI,KAAOH,EACXQ,EAAE,CAAC,EACE,EAAI,MACTA,EAAE,IAAO,GAAK,CAAE,EAAGA,EAAE,IAAO,EAAI,EAAG,GAC9B,EAAI,OAAS,EAAI,OACtB,EAAI,OAAS,EAAI,SAAeT,EAAI,WAAW,EAAEI,CAAC,EAAI,KAClDK,EAAE,IAAO,GAAK,EAAG,EAAGA,EAAE,IAAQ,GAAK,GAAM,EAAG,EAAGA,EAAE,IAAQ,GAAK,EAAK,EAAG,EAAGA,EAAE,IAAO,EAAI,EAAG,IAE7FA,EAAE,IAAO,GAAK,EAAG,EAAGA,EAAE,IAAQ,GAAK,EAAK,EAAG,EAAGA,EAAE,IAAO,EAAI,EAAG,EACtE,CACA,OAAOI,GAAIN,EAAI,EAAGC,CAAE,CACxB,CA/BgBE,EAAAX,GAAA,WAuCT,SAASe,GAAUC,EAAKd,EAAQ,CACnC,GAAIA,EAAQ,CAER,QADIe,EAAI,GACCZ,EAAI,EAAGA,EAAIW,EAAI,OAAQX,GAAK,MACjCY,GAAK,OAAO,aAAa,MAAM,KAAMD,EAAI,SAASX,EAAGA,EAAI,KAAK,CAAC,EACnE,OAAOY,CACX,KACK,IAAIC,GACL,OAAOA,GAAG,OAAOF,CAAG,EAGpB,IAAIG,EAAKC,GAAMJ,CAAG,EAAGK,EAAIF,EAAG,EAAGF,EAAIE,EAAG,EACtC,OAAIF,EAAE,QACFK,EAAI,CAAC,EACFD,EAEf,CAhBgBV,EAAAI,GAAA,aAqBhB,IAAIQ,GAAOC,EAAA,SAAUC,EAAGC,EAAG,CAAE,OAAOA,EAAI,GAAKC,GAAGF,EAAGC,EAAI,EAAE,EAAIC,GAAGF,EAAGC,EAAI,EAAE,CAAG,EAAjE,QAEPE,GAAKJ,EAAA,SAAUC,EAAGC,EAAGG,EAAG,CACxB,IAAIC,EAAMH,GAAGF,EAAGC,EAAI,EAAE,EAAGK,EAAMJ,GAAGF,EAAGC,EAAI,EAAE,EAAGM,EAAKC,GAAUR,EAAE,SAASC,EAAI,GAAIA,EAAI,GAAKI,CAAG,EAAG,EAAEH,GAAGF,EAAGC,EAAI,CAAC,EAAI,KAAK,EAAGQ,EAAKR,EAAI,GAAKI,EAClIK,EAAKC,GAAMX,EAAGS,EAAIH,EAAKF,EAAGQ,EAAGZ,EAAGC,EAAI,EAAE,EAAGW,EAAGZ,EAAGC,EAAI,EAAE,EAAGW,EAAGZ,EAAGC,EAAI,EAAE,CAAC,EAAGY,EAAKH,EAAG,CAAC,EAAGI,EAAKJ,EAAG,CAAC,EAAGK,EAAML,EAAG,CAAC,EAC9G,MAAO,CAACR,GAAGF,EAAGC,EAAI,EAAE,EAAGY,EAAIC,EAAIP,EAAIE,EAAKH,EAAMJ,GAAGF,EAAGC,EAAI,EAAE,EAAGc,CAAG,CACpE,EAJS,MAMLJ,GAAQZ,EAAA,SAAUC,EAAGC,EAAGe,EAAGZ,EAAGS,EAAIC,EAAIC,EAAK,CAC3C,IAAIE,EAAMJ,GAAM,WAAYK,EAAMJ,GAAM,WAAYK,EAAOJ,GAAO,WAAYK,EAAInB,EAAIe,EAClFK,EAAKJ,EAAMC,EAAMC,EACrB,GAAIf,GAAKiB,EAAI,CACT,KAAOpB,EAAI,EAAImB,EAAGnB,GAAK,EAAIC,GAAGF,EAAGC,EAAI,CAAC,EAClC,GAAIC,GAAGF,EAAGC,CAAC,GAAK,EACZ,MAAO,CACHgB,EAAMK,GAAGtB,EAAGC,EAAI,EAAI,EAAIiB,CAAG,EAAIL,EAC/BK,EAAMI,GAAGtB,EAAGC,EAAI,CAAC,EAAIa,EACrBK,EAAOG,GAAGtB,EAAGC,EAAI,EAAI,GAAKiB,EAAMD,EAAI,EAAIF,EACxC,CACJ,EAIJX,EAAI,GACJmB,EAAI,EAAE,CACd,CACA,MAAO,CAACV,EAAIC,EAAIC,EAAK,CAAC,CAC1B,EAnBY,SAqBRS,GAAOzB,EAAA,SAAU0B,EAAI,CACrB,IAAIC,EAAK,EACT,GAAID,EACA,QAASE,KAAKF,EAAI,CACd,IAAIT,EAAIS,EAAGE,CAAC,EAAE,OACVX,EAAI,OACJO,EAAI,CAAC,EACTG,GAAMV,EAAI,CACd,CAEJ,OAAOU,CACX,EAXW,QAaPE,GAAM7B,EAAA,SAAUC,EAAGC,EAAG4B,EAAGtB,EAAIuB,EAAGC,EAAGC,EAAIC,EAAI,CAC3C,IAAIC,EAAK3B,EAAG,OAAQkB,EAAKI,EAAE,MAAOM,EAAMF,GAAMA,EAAG,OAC7CG,EAAMZ,GAAKC,CAAE,EACjBY,EAAOrC,EAAGC,EAAG+B,GAAM,KAAO,SAAY,QAAS,EAAG/B,GAAK,EACnD+B,GAAM,OACNhC,EAAEC,GAAG,EAAI,GAAID,EAAEC,GAAG,EAAI4B,EAAE,IAC5B7B,EAAEC,CAAC,EAAI,GAAIA,GAAK,EAChBD,EAAEC,GAAG,EAAK4B,EAAE,MAAQ,GAAME,EAAI,GAAK,GAAI/B,EAAEC,GAAG,EAAI6B,GAAK,EACrD9B,EAAEC,GAAG,EAAI4B,EAAE,YAAc,IAAK7B,EAAEC,GAAG,EAAI4B,EAAE,aAAe,EACxD,IAAIS,EAAK,IAAI,KAAKT,EAAE,OAAS,KAAO,KAAK,IAAI,EAAIA,EAAE,KAAK,EAAG,EAAIS,EAAG,YAAY,EAAI,KAkBlF,IAjBI,EAAI,GAAK,EAAI,MACbf,EAAI,EAAE,EACVc,EAAOrC,EAAGC,EAAI,GAAK,GAAQqC,EAAG,SAAS,EAAI,GAAM,GAAOA,EAAG,QAAQ,GAAK,GAAOA,EAAG,SAAS,GAAK,GAAOA,EAAG,WAAW,GAAK,EAAMA,EAAG,WAAW,GAAK,CAAE,EAAGrC,GAAK,EACzJ8B,GAAK,KACLM,EAAOrC,EAAGC,EAAG4B,EAAE,GAAG,EAClBQ,EAAOrC,EAAGC,EAAI,EAAG8B,EAAI,EAAI,CAACA,EAAI,EAAIA,CAAC,EACnCM,EAAOrC,EAAGC,EAAI,EAAG4B,EAAE,IAAI,GAE3BQ,EAAOrC,EAAGC,EAAI,GAAIiC,CAAE,EACpBG,EAAOrC,EAAGC,EAAI,GAAImC,CAAG,EAAGnC,GAAK,GACzB+B,GAAM,OACNK,EAAOrC,EAAGC,EAAGkC,CAAG,EAChBE,EAAOrC,EAAGC,EAAI,EAAG4B,EAAE,KAAK,EACxBQ,EAAOrC,EAAGC,EAAI,GAAI+B,CAAE,EAAG/B,GAAK,IAEhCD,EAAE,IAAIO,EAAIN,CAAC,EACXA,GAAKiC,EACDE,EACA,QAAST,KAAKF,EAAI,CACd,IAAIc,EAAMd,EAAGE,CAAC,EAAGX,EAAIuB,EAAI,OACzBF,EAAOrC,EAAGC,EAAG,CAAC0B,CAAC,EACfU,EAAOrC,EAAGC,EAAI,EAAGe,CAAC,EAClBhB,EAAE,IAAIuC,EAAKtC,EAAI,CAAC,EAAGA,GAAK,EAAIe,CAChC,CAEJ,OAAImB,IACAnC,EAAE,IAAIiC,EAAIhC,CAAC,EAAGA,GAAKkC,GAChBlC,CACX,EAtCU,OAwCNuC,GAAMzC,EAAA,SAAU0C,EAAGxC,EAAG8B,EAAG/B,EAAGoB,EAAG,CAC/BiB,EAAOI,EAAGxC,EAAG,SAAS,EACtBoC,EAAOI,EAAGxC,EAAI,EAAG8B,CAAC,EAClBM,EAAOI,EAAGxC,EAAI,GAAI8B,CAAC,EACnBM,EAAOI,EAAGxC,EAAI,GAAID,CAAC,EACnBqC,EAAOI,EAAGxC,EAAI,GAAImB,CAAC,CACvB,EANU,OA0XH,SAASsB,GAAQC,EAAMC,EAAM,CAC3BA,IACDA,EAAO,CAAC,GACZ,IAAIC,EAAI,CAAC,EACLC,EAAQ,CAAC,EACbC,GAAKJ,EAAM,GAAIE,EAAGD,CAAI,EACtB,IAAII,EAAI,EACJC,EAAM,EACV,QAASC,KAAML,EAAG,CACd,IAAIM,EAAKN,EAAEK,CAAE,EAAGE,EAAOD,EAAG,CAAC,EAAGE,EAAIF,EAAG,CAAC,EAClCG,EAAcD,EAAE,OAAS,EAAI,EAAI,EACjCE,EAAIC,GAAQN,CAAE,EAAGO,EAAIF,EAAE,OACvBG,EAAML,EAAE,QAASM,EAAID,GAAOF,GAAQE,CAAG,EAAGE,EAAKD,GAAKA,EAAE,OACtDE,EAAMC,GAAKT,EAAE,KAAK,EAClBI,EAAI,OACJM,EAAI,EAAE,EACV,IAAIC,EAAIV,EAAcW,GAAYb,EAAMC,CAAC,EAAID,EAAMc,EAAIF,EAAE,OACrDG,EAAIC,GAAI,EACZD,EAAE,EAAEf,CAAI,EACRN,EAAM,KAAKuB,GAAIhB,EAAG,CACd,KAAMD,EAAK,OACX,IAAKe,EAAE,EAAE,EACT,EAAGH,EACH,EAAGT,EACH,EAAGI,EACH,EAAGF,GAAKP,EAAG,QAAWS,GAAMD,EAAI,QAAUE,EAC1C,EAAGZ,EACH,YAAaM,CACjB,CAAC,CAAC,EACFN,GAAK,GAAKS,EAAII,EAAMK,EACpBjB,GAAO,GAAK,GAAKQ,EAAII,IAAQD,GAAM,GAAKM,CAC5C,CAEA,QADII,EAAM,IAAIC,EAAGtB,EAAM,EAAE,EAAGuB,EAAKxB,EAAGyB,EAAMxB,EAAMD,EACvC0B,EAAI,EAAGA,EAAI5B,EAAM,OAAQ,EAAE4B,EAAG,CACnC,IAAInB,EAAIT,EAAM4B,CAAC,EACfC,GAAIL,EAAKf,EAAE,EAAGA,EAAGA,EAAE,EAAGA,EAAE,EAAGA,EAAE,EAAE,MAAM,EACrC,IAAIqB,EAAO,GAAKrB,EAAE,EAAE,OAASO,GAAKP,EAAE,KAAK,EACzCe,EAAI,IAAIf,EAAE,EAAGA,EAAE,EAAIqB,CAAI,EACvBD,GAAIL,EAAKtB,EAAGO,EAAGA,EAAE,EAAGA,EAAE,EAAGA,EAAE,EAAE,OAAQA,EAAE,EAAGA,EAAE,CAAC,EAAGP,GAAK,GAAK4B,GAAQrB,EAAE,EAAIA,EAAE,EAAE,OAAS,EACzF,CACA,OAAAsB,GAAIP,EAAKtB,EAAGF,EAAM,OAAQ2B,EAAKD,CAAE,EAC1BF,CACX,CA1CgBQ,EAAApC,GAAA,WAuWT,SAASqC,GAAUC,EAAMC,EAAM,CAGlC,QAFIC,EAAQ,CAAC,EACTC,EAAIH,EAAK,OAAS,GACfI,EAAGJ,EAAMG,CAAC,GAAK,UAAW,EAAEA,GAC3B,CAACA,GAAKH,EAAK,OAASG,EAAI,QACxBE,EAAI,EAAE,EAGd,IAAIC,EAAIC,GAAGP,EAAMG,EAAI,CAAC,EACtB,GAAI,CAACG,EACD,MAAO,CAAC,EACZ,IAAIE,EAAIJ,EAAGJ,EAAMG,EAAI,EAAE,EACnBM,EAAIL,EAAGJ,EAAMG,EAAI,EAAE,GAAK,UAC5B,GAAIM,EAAG,CACH,IAAIC,EAAKN,EAAGJ,EAAMG,EAAI,EAAE,EACxBM,EAAIL,EAAGJ,EAAMU,CAAE,GAAK,UAChBD,IACAH,EAAIF,EAAGJ,EAAMU,EAAK,EAAE,EACpBF,EAAIJ,EAAGJ,EAAMU,EAAK,EAAE,EAE5B,CAEA,QADIC,EAAOV,GAAQA,EAAK,OACfW,EAAI,EAAGA,EAAIN,EAAG,EAAEM,EAAG,CACxB,IAAIC,EAAKC,GAAGd,EAAMQ,EAAGC,CAAC,EAAGM,EAAMF,EAAG,CAAC,EAAGG,EAAKH,EAAG,CAAC,EAAGI,EAAKJ,EAAG,CAAC,EAAGK,EAAKL,EAAG,CAAC,EAAGM,EAAKN,EAAG,CAAC,EAAGO,EAAMP,EAAG,CAAC,EAAGQ,EAAIC,GAAKtB,EAAMoB,CAAG,EACrHZ,EAAIW,GACA,CAACR,GAAQA,EAAK,CACd,KAAMO,EACN,KAAMF,EACN,aAAcC,EACd,YAAaF,CACjB,CAAC,KACQA,EAEIA,GAAO,EACZb,EAAMgB,CAAE,EAAIK,GAAYvB,EAAK,SAASqB,EAAGA,EAAIL,CAAE,EAAG,CAAE,IAAK,IAAIQ,EAAGP,CAAE,CAAE,CAAC,EAErEZ,EAAI,GAAI,4BAA8BU,CAAG,EAJzCb,EAAMgB,CAAE,EAAIO,GAAIzB,EAAMqB,EAAGA,EAAIL,CAAE,EAM3C,CACA,OAAOd,CACX,CAxCgBwB,EAAA3B,GAAA,aCvkFT,SAAS4B,IAAA,CACd,GAAI,OAAO,OAAW,KAAe,OAAO,gBAAiB,CAC3D,IAAMC,EAAQ,IAAI,WAAW,EAAA,EAC7B,cAAO,gBAAgBA,CAAA,EAChB,MAAM,KAAKA,EAAQC,GAASA,EAAK,SAAS,EAAA,EAAI,SAAS,EAAG,GAAA,CAAA,EAC9D,KAAK,EAAA,EAAI,UACR,EACA,EAAA,CAEN,CACA,OAAOC,GAAA,CACT,CAXgBC,EAAAJ,GAAA,WAmBT,SAASG,IAAA,CACd,OAAO,KAAK,IAAG,EAAG,SAAS,EAAA,EACzB,KAAK,OAAM,EAAG,SAAS,EAAA,EAAI,UAAU,EAAG,CAAA,CAC5C,CAHgBC,EAAAD,GAAA,mBAqBT,SAASE,GAAkBC,EAAc,CAC9C,MAAO,GAAGA,CAAA,GAASC,GAAA,CAAA,EACrB,CAFgBC,EAAAH,GAAA,qBAcT,SAASI,GACdC,EACAC,EACAL,EAAS,GAAE,CAEX,GAAI,CAACK,GAAO,OAAOA,GAAQ,UAAY,MAAM,QAAQA,CAAA,EAAM,OAAOA,EAClE,IAAMC,EAAS,OAAOF,CAAA,EAItB,MAAO,CAAE,IAHGJ,GAAUM,EAAO,WAAWN,CAAA,EACpCM,EAAO,MAAMN,EAAO,MAAM,EAC1BM,EACU,GAAGD,CAAI,CACvB,CAXgBH,EAAAC,GAAA,gBAuBT,SAASI,GACdH,EACAC,EACAL,EAAS,GAAE,CAEX,IAAIQ,EAAQH,GAAO,OAAOA,GAAQ,UAAY,CAAC,MAAM,QAAQA,CAAA,EACxDA,EAAgC,IACjC,OAEAG,IAAU,SACZA,EAAQP,GAAA,GAIV,IAAMQ,EAAaL,IAAQ,OAASH,GAAA,EAAYG,EAE5CM,EAAWD,GAAc,GAgB7B,GAdID,EACER,GAAUQ,EAAM,WAAWR,CAAA,EAC7BU,EAAWF,EAEXE,EAAWV,EAAS,GAAGA,CAAA,GAASQ,CAAA,GAAUA,EAEnCC,IACLT,GAAUS,EAAW,WAAWT,CAAA,EAClCU,EAAWD,EAEXC,EAAWV,EAAS,GAAGA,CAAA,GAASS,CAAA,GAAeA,GAI/C,CAACC,EACH,MAAM,IAAI,MACR,6DAAA,EAIJ,GACEL,GAAO,OAAOA,GAAQ,UAAY,CAAC,MAAM,QAAQA,CAAA,GACjD,QAAUA,EACV,CACA,GAAM,CAAE,IAAKM,EAAG,GAAGC,CAAA,EAAaP,EAChC,MAAO,CAAE,IAAKK,EAAU,SAAAE,CAAS,CACnC,CAEA,MAAO,CAAE,IAAKF,EAAU,SAAUL,CAAI,CACxC,CA/CgBH,EAAAK,GAAA,kBC4HT,SAASM,GAAcC,EAAiB,CAC7C,GAAIA,GAAS,KAAM,MAAM,IAAI,MAAM,sBAAA,EAOnC,GALE,OAAOA,GAAU,UAAYA,aAAiB,MAC9C,MAAM,QAAQA,CAAA,GAAUA,aAAiB,aAIvC,UAAWA,GAAS,UAAWA,EACjC,OAAOA,EAGT,IAAMC,EAAID,EACV,GAAIC,EAAE,KAAO,OAAW,OAAO,YAAY,KAAKA,EAAE,EAAE,EACpD,IACGA,EAAE,KAAO,QAAaA,EAAE,MAAQ,UAChCA,EAAE,KAAO,QAAaA,EAAE,MAAQ,QACjC,CACA,IAAMC,EAAQD,EAAE,KAAO,OAAYA,EAAE,GAAKA,EAAE,IACtCE,EAAQF,EAAE,KAAO,OAAYA,EAAE,GAAKA,EAAE,IAC5C,OAAO,YAAY,MACjBC,EACAC,EACAF,EAAE,KAAO,OACTA,EAAE,KAAO,MAAA,CAEb,CACA,OAAIA,EAAE,KAAO,QAAaA,EAAE,MAAQ,OAC3B,YAAY,WACjBA,EAAE,KAAO,OAAYA,EAAE,GAAKA,EAAE,IAC9BA,EAAE,KAAO,MAAA,EAGTA,EAAE,KAAO,QAAaA,EAAE,MAAQ,OAC3B,YAAY,WACjBA,EAAE,KAAO,OAAYA,EAAE,GAAKA,EAAE,IAC9BA,EAAE,KAAO,MAAA,EAGND,CACT,CAxCgBI,EAAAL,GAAA,iBA4ChB,IAAMM,GAAa,IAAI,IAEvB,SAASC,GAAuBC,EAAgBC,EAAmBC,EAAoBC,EAAkB,CACvG,IAAMC,EAAU,UAAU,KAAKJ,EAAQG,CAAA,EACvCC,EAAQ,gBAAkB,IAAA,CACxB,IAAMC,EAAKD,EAAQ,OACnB,GAAKC,EAAG,iBAAiB,SAASJ,CAAA,GAO3B,GAAIC,EAAS,CAElB,IAAMI,EAAQF,EAAQ,YAAa,YAAYH,CAAA,EAC/C,QAAWM,KAASL,EACbI,EAAM,WAAW,SAASC,CAAA,GAC7BD,EAAM,YAAYC,EAAOA,CAAA,CAG/B,MAf8C,CAC5C,IAAMD,EAAQD,EAAG,kBAAkBJ,CAAA,EACnC,GAAIC,EACF,QAAWK,KAASL,EAClBI,EAAM,YAAYC,EAAOA,CAAA,CAG/B,CASF,EACA,IAAMC,EAAM,IAAI,QAAqB,CAACC,EAASC,IAAA,CAC7CN,EAAQ,UAAY,IAAMK,EAAQL,EAAQ,MAAM,EAChDA,EAAQ,QAAU,IAAMM,EAAON,EAAQ,KAAK,CAC9C,CAAA,EACA,MAAO,CAACO,EAAQC,IACdJ,EAAI,KAAMH,GACRO,EAASP,EAAG,YAAYJ,EAAWU,CAAA,EAAQ,YAAYV,CAAA,CAAA,CAAA,CAE7D,CA7BSJ,EAAAE,GAAA,0BA+BT,SAASc,EACPb,EACAC,EAAY,SACZC,EACAC,EAAkB,CAElB,GAAI,CAACH,EAAQ,OAEb,IAAMc,EAAW,GAAGd,CAAA,IAAUC,CAAA,IAAaE,GAAa,CAAA,GACxD,OAAKL,GAAW,IAAIgB,CAAA,GAClBhB,GAAW,IAAIgB,EAAUf,GAAuBC,EAAQC,EAAWC,EAASC,CAAA,CAAA,EAEvEL,GAAW,IAAIgB,CAAA,CACxB,CAbSjB,EAAAgB,EAAA,kBAeT,SAASE,GACPC,EACAC,EAAe,CAEf,IAAIC,EAAQF,EACZ,OAAIC,IACFC,EAAQA,EAAM,OAAO,CAAC,CAACC,CAAA,IACrB,OAAOA,GAAM,UAAYA,EAAE,WAAWF,CAAA,CAAA,GAGnCC,EAAM,IAAI,CAAC,CAACC,EAAGC,CAAA,IAASC,GAAaF,EAAGC,EAAGH,CAAA,CAAA,CACpD,CAXSpB,EAAAkB,GAAA,mBAaT,eAAeO,EACbC,EAAW,GACXC,EACAC,EAAS,GAAK,CAEd,IAAMC,EAAO,MAAM,UAAU,QAAQ,aAAY,EAE3CC,GADWJ,EAAW,GAAGA,CAAA,IAAYC,CAAA,GAAWA,GAC/B,MAAM,GAAA,EAAM,OAAO,OAAA,EACtCI,EAAOF,EACX,QAAWG,KAAKF,EAAOC,EAAO,MAAMA,EAAK,mBAAmBC,EAAG,CAAE,OAAAJ,CAAQ,CAAA,EACzE,OAAOG,CACT,CAXe/B,EAAAyB,EAAA,gBAaf,SAASQ,GACPC,EACAC,EACAC,EAAsC,CAEtC,GAAIF,IAAQ,OAAW,OACvB,GAAIE,EAAW,CACb,GAAI,CAACA,EAAUF,CAAA,EACb,MAAM,IAAI,MAAM,+BAA+B,KAAK,UAAUA,CAAA,CAAA,EAAO,EAEvE,MACF,CACA,GAAI,CAACC,EAAc,OAEnB,GAAI,CADgB,IAAI,SAAS,MAAO,WAAWA,CAAA,SAAqB,EACvDD,CAAA,EACf,MAAM,IAAI,MAAM,+BAA+B,KAAK,UAAUA,CAAA,CAAA,EAAO,CAEzE,CAjBSlC,EAAAiC,GAAA,kBAsBF,IAAMI,EAAsC,CACjD,IAAKrC,EAAA,MACHsC,EACAC,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEJ,EAAM,MAAMM,GAAIb,EAAQlB,CAAA,EAC9B,OAAOyB,IAAQ,OACXV,GAAaG,EAAQO,EAAKK,GAAM,MAAA,EAChC,MACN,EAZK,OAcL,IAAKvC,EAAA,MACHyC,EACAP,EACAK,IAAA,CAEA,IAAIG,EACAC,EACAC,EAA0BL,GAAQ,CAAC,EACnC,OAAOE,GAAa,UACtBC,EAAY,OACZC,EAAYF,EACRP,IAAKU,EAAUV,KAEnBQ,EAAYD,EACZE,EAAYT,GAEd,IAAMzB,EAAQO,EAAe4B,EAAQ,OAAQA,EAAQ,UAAWA,EAAQ,QAASA,EAAQ,SAAS,EAC5F,CAAE,IAAAN,EAAK,SAAAO,CAAQ,EAAMC,GACzBJ,EACAC,EACAC,EAAQ,MAAM,EAEhB,OAAAX,GAAeY,EAAUD,EAAQ,aAAcA,EAAQ,SAAS,EAChE,MAAMG,GAAIT,EAAKO,EAAUpC,CAAA,EAClB6B,CACT,EAzBK,OA2BL,OAAQtC,EAAA,MACNsC,EACAU,EACAT,IAAA,CAEA,IAAMU,EAAa,MAAMZ,EAAc,IAAOC,EAAKC,CAAA,EAC7CW,EAASF,EAAQC,CAAA,EACvB,MAAMZ,EAAc,IAAIC,EAAKY,EAAQX,CAAA,CACvC,EARQ,UAUR,MAAOvC,EAAA,MACLsC,EACAa,EACAC,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEe,EAAW,MAAMb,GAAIb,EAAQlB,CAAA,GAAY,CAAC,EAE5C6C,EACA,OAAOH,GAAc,WACvBG,EAAUH,EACR3B,GAAaG,EAAQ0B,EAASd,GAAM,MAAA,EACpCa,CAAA,EAGFE,EAAU,OAAO,OAAO,CAAC,EAAGD,EAASF,CAAA,EAEvC,GAAM,CAAE,IAAKI,EAAU,SAAAV,CAAQ,EAAMC,GACnCnB,EACA2B,EACAf,GAAM,MAAA,EAER,OAAAN,GAAeY,EAAUN,GAAM,aAAcA,GAAM,SAAA,EACnD,MAAMQ,GAAIQ,EAAUV,EAAUpC,CAAA,EACvBe,GAAa+B,EAAUV,EAAUN,GAAM,MAAA,CAChD,EA7BO,SA+BP,OAAQvC,EAAA,MAAOsC,EAAaC,IAAA,CAC1B,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACJ,MAAMkB,GAAI7B,EAAQlB,CAAA,CACpB,EANQ,UAQR,QAAST,EAAA,MACPyD,EACAlB,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EmB,EAAWD,EAAS,IAAKnC,GAC7BiB,GAAM,QAAU,CAACjB,EAAE,WAAWiB,EAAK,MAAM,EAAK,GAAGA,EAAK,MAAM,GAAGjB,CAAA,GAAMA,CAAA,EAGvE,OADkB,MAAMqC,GAAQD,EAAUjD,CAAA,GACzB,IAAI,CAACyB,EAAK0B,IACzB1B,IAAQ,OACJV,GAAakC,EAASE,CAAA,EAAO1B,EAAKK,GAAM,MAAA,EACxC,MAAA,CAER,EAdS,WAgBT,QAASvC,EAAA,MACP6D,EACAtB,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EuB,EAAqCD,EAAY,IAAI,CAAC,CAACvC,EAAGC,CAAA,IAAG,CACjE,GAAM,CAAE,IAAAe,EAAK,SAAAO,CAAQ,EAAMC,GAAexB,EAAGC,EAAGgB,GAAM,MAAA,EACtD,OAAAN,GAAeY,EAAUN,GAAM,aAAcA,GAAM,SAAA,EAC5C,CAACD,EAAKO,EACf,CAAA,EACA,MAAMkB,GAAQD,EAAcrD,CAAA,CAC9B,EAXS,WAaT,WAAYT,EAAA,MACVyD,EACAlB,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EmB,EAAWD,EAAS,IAAKnC,GAC7BiB,GAAM,QAAU,CAACjB,EAAE,WAAWiB,EAAK,MAAM,EAAK,GAAGA,EAAK,MAAM,GAAGjB,CAAA,GAAMA,CAAA,EAEvE,MAAM0C,GAAQN,EAAUjD,CAAA,CAC1B,EATY,cAWZ,KAAMT,EAAA,MAAOuC,GAAA,CACX,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3E0B,EAAU,MAAMC,GAAKzD,CAAA,EAC3B,OAAO8B,GAAM,OACT0B,EAAQ,OAAQ3C,GAChB,OAAOA,GAAM,UAAYA,EAAE,WAAWiB,EAAK,MAAM,CAAA,EAEjD0B,CACN,EARM,QAUN,OAAQjE,EAAA,MAAWuC,GAAA,CACjB,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3E4B,EAAa,MAAMC,GAAQ3D,CAAA,EACjC,OAAOS,GAAgBiD,EAAY5B,GAAM,MAAA,CAC3C,EAJQ,UAMR,QAASvC,EAAA,MAAWuC,GAAA,CAClB,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3E4B,EAAa,MAAMC,GAAQ3D,CAAA,EACjC,OAAO8B,GAAM,OACT4B,EAAW,OAAO,CAAC,CAAC7C,CAAA,IACpB,OAAOA,GAAM,UAAYA,EAAE,WAAWiB,EAAK,MAAM,CAAA,EAKjD4B,CACN,EAXS,WAaT,MAAOnE,EAAA,MAAOuC,GAAA,CACZ,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EACjF,GAAIA,GAAM,OAAQ,CAEhB,IAAM8B,GADU,MAAMH,GAAKzD,CAAA,GACE,OAAQa,GACnC,OAAOA,GAAM,UAAYA,EAAE,WAAWiB,EAAK,MAAM,CAAA,EAEnD,MAAMyB,GAAQK,EAAc5D,CAAA,CAC9B,MACE,MAAM6D,GAAM7D,CAAA,CAEhB,EAXO,SAaP,aAAcT,EAAA,MACZuE,EACA3E,EACA2C,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,OAAO,MAAMA,EAAM,WAAa+D,GACvB,IAAI,QAAgB,CAAC5D,EAASC,IAAA,CACnC,GAAI,CACF,IAAMH,EAAQ8D,EAAS,MAAMD,CAAA,EACvBE,EAAM7E,IAAU,OAAYc,EAAM,MAAMf,GAAcC,CAAA,CAAA,EAAUc,EAAM,MAAK,EACjF+D,EAAI,UAAY,IAAM7D,EAAQ6D,EAAI,MAAM,EACxCA,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,CACtC,OAASC,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,CACF,EA1Bc,gBA4Bd,cAAe1E,EAAA,MACbuE,EACA3E,EACA2C,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,OAAO,MAAMA,EAAM,WAAa+D,GACvB,IAAI,QAA+B,CAAC5D,EAASC,IAAA,CAClD,GAAI,CACF,IAAMH,EAAQ8D,EAAS,MAAMD,CAAA,EACvBI,EAAWhF,GAAcC,CAAA,EACzB6E,EAAM/D,EAAM,IAAIiE,CAAA,EAChBC,EAASlE,EAAM,OAAOiE,CAAA,EAExBzC,EACAI,EACAuC,EAAU,GACVC,EAAU,GAERC,EAAY/E,EAAA,IAAA,CACX6E,GAAWC,GAETlE,EADCsB,IAAQ,QAAaI,IAAQ,OACtBd,GAAa,OAAOc,CAAA,EAAMJ,EAAKK,GAAM,MAAA,EAErC,MAFqC,CAKtD,EARkB,aAUlBkC,EAAI,UAAY,IAAA,CACdvC,EAAMuC,EAAI,OACVI,EAAU,GACVE,EAAA,CACF,EACAN,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,EAEpCG,EAAO,UAAY,IAAA,CACjBtC,EAAMsC,EAAO,OACbE,EAAU,GACVC,EAAA,CACF,EACAH,EAAO,QAAU,IAAM/D,EAAO+D,EAAO,KAAK,CAC5C,OAASF,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,CACF,EAvDe,iBAyDf,YAAa1E,EAAA,MACXuE,EACA3E,EACA2C,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,OAAO,MAAMA,EAAM,WAAa+D,GACtB,IAAI,QAAkB,CAAC5D,EAASC,IAAA,CACpC,GAAI,CAED,IAAM4D,EADQD,EAAS,MAAMD,CAAA,EACX,WAAW5E,GAAcC,CAAA,CAAA,EAC3C6E,EAAI,UAAY,IAAA,CACb,IAAMP,EAAOO,EAAI,OAAO,IAAInD,GAAK,OAAOA,CAAA,CAAA,EACxCV,EAAQsD,CAAA,CACX,EACAO,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,CACvC,OAAQC,EAAK,CACV7D,EAAO6D,CAAA,CACV,CACH,CAAA,CACH,CACF,EA7Ba,eA+Bb,aAAc1E,EAAA,MACZuE,EACA3E,EACAoF,EACAzC,IAAA,CAEC,MAAMF,EAAc,eACjBkC,EACA3E,EACCyB,GAAUA,EACX,CAAC4D,EAAMC,IAAa,OAAO,OAAO,CAAC,EAAGD,EAAMC,CAAA,EAC5CF,EACAzC,CAAA,CAEN,EAdc,gBAgBd,oBAAqBvC,EAAA,MACnBuE,EACA3E,EACAuF,EACA5C,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,OAAO,MAAMA,EAAM,WAAa+D,GACvB,IAAI,QAAqD,CAAC5D,EAASC,IAAA,CACxE,GAAI,CACF,IAAMH,EAAQ8D,EAAS,MAAMD,CAAA,EACvBI,EAAWhF,GAAcC,CAAA,EACzBwF,EAAYD,EAAe,WAAa,OACxCE,EAAQF,EAAe,OAAS,GAEhC9D,EAAqB,CAAA,EACrBoD,EAAM/D,EAAM,WAAWiE,EAAUS,CAAA,EACnCE,EAAW,GACXC,EACAC,EAEJ,GAAIL,EAAe,OAChB,GAAI,CACD,IAAMM,EAAS,KAAK,MAAMN,EAAe,MAAM,EAC/CI,EAAiBE,EAAO,CAAA,EACxBD,EAAmBC,EAAO,CAAA,CAC7B,MAAY,CAEZ,CAGH,IAAIC,EACAC,EAEJlB,EAAI,UAAamB,GAAA,CACd,IAAMC,EAAUD,EAAM,OAA0C,OAEhE,GAAI,CAACC,EAAQ,CACVjF,EAAQ,CACN,MAAAS,EACA,WAAYA,EAAM,OAAS,GAAKqE,IAAiB,QAAaC,IAAmB,OAC7E,KAAK,UAAU,CAACD,EAAcC,EAAe,EAC7C,MACN,CAAA,EACA,MACH,CAEA,GAAI,CAACL,GAAYC,IAAmB,QAAaC,IAAqB,SACnEF,EAAW,GACPO,EAAO,oBAAoB,CAC5BA,EAAO,mBAAmBN,EAA+BC,CAAA,EACzD,MACH,CAGH,GAAIF,GAAYE,IAAqB,QAAaK,EAAO,aAAeL,GAAoBK,EAAO,MAAQN,EAAgB,CACvHC,EAAmB,OACnBK,EAAO,SAAQ,EACf,MACJ,CAEA,GAAI,CAACP,GAAYE,IAAqB,OAAW,CAC1CK,EAAO,aAAeL,GAAoBK,EAAO,MAAQN,IAC1DD,EAAW,GACXE,EAAmB,QAEtBK,EAAO,SAAQ,EACf,MACH,CAEAxE,EAAM,KAAKG,GAAa,OAAOqE,EAAO,UAAU,EAAGA,EAAO,MAAOtD,GAAM,MAAA,CAAA,EACvEmD,EAAeG,EAAO,IACtBF,EAAiBE,EAAO,WAEpBxE,EAAM,QAAUgE,EACjBzE,EAAQ,CACL,MAAAS,EACA,WAAY,KAAK,UAAU,CAACqE,EAAcC,EAAe,CAC5D,CAAA,EAEAE,EAAO,SAAQ,CAErB,EACApB,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,CACtC,OAASC,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,CACF,EAjGqB,uBAmGrB,WAAY1E,EAAA,MACVuE,EACA3E,EACA2C,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,OAAO,MAAMA,EAAM,WAAa+D,GACvB,IAAI,QAAqB,CAAC5D,EAASC,IAAA,CACxC,GAAI,CACF,IAAMH,EAAQ8D,EAAS,MAAMD,CAAA,EACvBI,EAAWhF,GAAcC,CAAA,EACzB6E,EAAM/D,EAAM,OAAOiE,CAAA,EACnBmB,EAAUpF,EAAM,WAAWiE,CAAA,EAC7BoB,EAA2B,KAC3B7B,EAA6B,KAE3Ba,EAAY/E,EAAA,IAAA,CAChB,GAAI+F,IAAW,MAAQ7B,IAAS,KAAM,CACpC,IAAM8B,EAAYD,EAAO,IAAI,CAAC7D,EAAK+D,IACjCzE,GAAa,OAAO0C,EAAM+B,CAAA,CAAE,EAAI/D,EAAKK,GAAM,MAAA,CAAA,EAE7C3B,EAAQoF,CAAA,CACV,CACF,EAPkB,aASlBvB,EAAI,UAAY,IAAA,CACdsB,EAAStB,EAAI,OACbM,EAAA,CACF,EACAN,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,EAEpCqB,EAAQ,UAAY,IAAA,CAClB5B,EAAO4B,EAAQ,OACff,EAAA,CACF,EACAe,EAAQ,QAAU,IAAMjF,EAAOiF,EAAQ,KAAK,CAC9C,OAASpB,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,CACF,EAjDY,cAmDZ,eAAgB1E,EAAA,MACduE,EACA2B,EACA3D,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,OAAO,MAAMA,EAAM,WAAa+D,GACvB,IAAI,QAAqB,CAAC5D,EAASC,IAAA,CACxC,GAAI,CACF,IAAMH,EAAQ8D,EAAS,MAAMD,CAAA,EACvB4B,EAAa,IAAI,IACvB,GAAID,EAAQ,SAAW,EACrB,OAAOtF,EAAQ,CAAA,CAAE,EAEnB,IAAIwF,EAAY,EAChB,QAAWvG,KAAKqG,EAAS,CACvB,IAAMvB,EAAWhF,GAAcE,CAAA,EACzB4E,EAAM/D,EAAM,OAAOiE,CAAA,EACnBmB,EAAUpF,EAAM,WAAWiE,CAAA,EAC7B0B,EAAyB,KACzBnC,EAA6B,KAE3BoC,EAAQtG,EAAA,IAAA,CACRqG,IAAS,MAAQnC,IAAS,OAC5BmC,EAAK,QAAQ,CAACnE,EAAK+D,IAAA,CACjB,IAAMM,EAAS,OAAOrC,EAAM+B,CAAA,CAAE,EACzBE,EAAW,IAAII,CAAA,GAClBJ,EAAW,IACTI,EACA/E,GAAa+E,EAAQrE,EAAKK,GAAM,MAAA,CAAA,CAGtC,CAAA,EACA6D,IACIA,IAAcF,EAAQ,QACxBtF,EAAQ,MAAM,KAAKuF,EAAW,OAAM,CAAA,CAAA,EAG1C,EAhBc,SAkBd1B,EAAI,UAAY,IAAA,CACd4B,EAAO5B,EAAI,OACX6B,EAAA,CACF,EACA7B,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,EAEpCqB,EAAQ,UAAY,IAAA,CAClB5B,EAAO4B,EAAQ,OACfQ,EAAA,CACF,EACAR,EAAQ,QAAU,IAAMjF,EAAOiF,EAAQ,KAAK,CAC9C,CACF,OAASpB,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,CACF,EAjEgB,kBAmEhB,eAAgB1E,EAAA,MACduE,EACA3E,EACA4G,EACApD,EACAb,IAAA,CAEA,IAAMkE,EAAU,MAAMpE,EAAc,WAAckC,EAAW3E,EAAO2C,CAAA,EAC9DmE,EAAgBF,EAAGC,EAASrD,CAAA,EAClC,GAAI,CAAC,MAAM,QAAQsD,CAAA,EACjB,MAAM,IAAI,MACR,kEAAA,EAGJ,OAAOA,CACT,EAfgB,kBAiBhB,aAAc1G,EAAA,MACZuE,EACA3E,EACA4G,EACApD,EACAb,IAAA,CAEA,IAAMkE,EAAU,MAAMpE,EAAc,WAAckC,EAAW3E,EAAO2C,CAAA,EACpE,OAAOiE,EAAGC,EAASrD,CAAA,CACrB,EATc,gBAWd,cAAepD,EAAA,MACbuE,EACA3E,EACA2C,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,IAAM4D,EAAe,MAAM5D,EAAM,WAAa+D,GACrC,IAAI,QAAkB,CAAC5D,EAASC,IAAA,CACrC,GAAI,CAEF,IAAMiF,EADQtB,EAAS,MAAMD,CAAA,EACP,WAAW5E,GAAcC,CAAA,CAAA,EAC/CkG,EAAQ,UAAY,IAAA,CAClBlF,EAAQkF,EAAQ,OAAO,IAAKxE,GAAO,OAAOA,CAAA,CAAA,CAAA,CAC5C,EACAwE,EAAQ,QAAU,IAAMjF,EAAOiF,EAAQ,KAAK,CAC9C,OAASpB,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,EACIL,EAAa,OAAS,GACxB,MAAML,GAAQK,EAAc5D,CAAA,CAEhC,EA/Be,iBAiCf,kBAAmBT,EAAA,MACjBuE,EACA2B,EACA3D,IAAA,CAEA,GAAI2D,EAAQ,SAAW,EAAG,OAC1B,IAAMzF,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAER,GAAI,CAAC9B,EACH,MAAM,IAAI,MAAM,kDAAA,EAElB,IAAMkG,EAAkB,MAAMlG,EAAM,WAAa+D,GACxC,IAAI,QAAkB,CAAC5D,EAASC,IAAA,CACrC,GAAI,CACF,IAAMH,EAAQ8D,EAAS,MAAMD,CAAA,EACvBqC,EAAS,IAAI,IACfR,EAAY,EAChB,QAAWvG,KAAKqG,EAAS,CACvB,IAAMzB,EAAM/D,EAAM,WAAWf,GAAcE,CAAA,CAAA,EAC3C4E,EAAI,UAAY,IAAA,CACd,QAAWnD,KAAKmD,EAAI,OAClBmC,EAAO,IAAI,OAAOtF,CAAA,CAAA,EAEpB8E,IACIA,IAAcF,EAAQ,QACxBtF,EAAQ,MAAM,KAAKgG,CAAA,CAAA,CAEvB,EACAnC,EAAI,QAAU,IAAM5D,EAAO4D,EAAI,KAAK,CACtC,CACF,OAASC,EAAK,CACZ7D,EAAO6D,CAAA,CACT,CACF,CAAA,CACF,EACIiC,EAAgB,OAAS,GAC3B,MAAM3C,GAAQ2C,EAAiBlG,CAAA,CAEnC,EA1CmB,qBA4CnB,eAAgBT,EAAA,MACduE,EACA3E,EACA4G,EACApD,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAEFkE,EAAU,MAAMpE,EAAc,WAAckC,EAAW3E,EAAO2C,CAAA,EAC9DmE,EAAgBF,EAAGC,EAASrD,CAAA,EAClC,GAAI,CAAC,MAAM,QAAQsD,CAAA,EACjB,MAAM,IAAI,MACR,kEAAA,EAGJ,IAAMrC,EAAyBqC,EAAc,IAAKzB,GAAA,CAChD,GAAI,CAACA,GAAQA,EAAK,MAAQ,OACxB,MAAM,IAAI,MACR,qEAAA,EAGJ,OAAO1C,GAAM,QAAU,CAAC0C,EAAK,IAAI,WAAW1C,EAAK,MAAM,EACnD,GAAGA,EAAK,MAAM,GAAG0C,EAAK,GAAG,GACzBA,EAAK,GACX,CAAA,EACIZ,EAAa,OAAS,GACxB,MAAML,GAAQK,EAAc5D,CAAA,CAEhC,EAjCgB,kBAmChB,eAAgBT,EAAA,MACduE,EACA3E,EACAiH,EACAC,EACA1D,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EACZuB,GAAM,OACNA,GAAM,UACNA,GAAM,QACNA,GAAM,SAAA,EAEFkE,EAAU,MAAMpE,EAAc,WAAckC,EAAW3E,EAAO2C,CAAA,EAC9DmE,EAAgBG,EAASJ,EAASrD,CAAA,EACxC,GAAI,CAAC,MAAM,QAAQsD,CAAA,EACjB,MAAM,IAAI,MACR,kEAAA,EAGJ,IAAM5C,EAAoC4C,EAAc,IACrDzB,GAAA,CACC,GAAI,CAACA,GAAQA,EAAK,MAAQ,OACxB,MAAM,IAAI,MACR,qEAAA,EAGJ,IAAM8B,EAAcD,EAAS7B,EAAM7B,CAAA,EAC7B,CAAE,IAAAd,EAAK,SAAAO,CAAQ,EAAKC,GACxB,OACAiE,EACAxE,GAAM,MAAA,EAER,OAAAN,GAAeY,EAAUN,GAAM,aAAcA,GAAM,SAAA,EAC5C,CAACD,EAAKO,EACf,CAAA,EAEEiB,EAAa,OAAS,GACxB,MAAMC,GAAQD,EAAcrD,CAAA,CAEhC,EAzCgB,kBA2ChB,MAAOT,EAAA,MACLwG,EACApD,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EpB,EAAa,MAAMiD,GAAQ3D,CAAA,EAC3BuG,EAAiB9F,GAAgBC,EAAYoB,GAAM,MAAA,EACzD,OAAOiE,EAAGQ,EAA+B5D,CAAA,CAC3C,EATO,SAWP,QAASpD,EAAA,MACPwG,EACApD,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EpB,EAAa,MAAMiD,GAAQ3D,CAAA,EAC3BuG,EAAiB9F,GAAgBC,EAAYoB,GAAM,MAAA,EACnDmE,EAAgBF,EAAGQ,EAA+B5D,CAAA,EACxD,GAAI,CAAC,MAAM,QAAQsD,CAAA,EACjB,MAAM,IAAI,MAAM,yDAAA,EAElB,OAAOA,CACT,EAbS,WAeT,QAAS1G,EAAA,MACPwG,EACApD,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EpB,EAAa,MAAMiD,GAAQ3D,CAAA,EAC3BuG,EAAiB9F,GAAgBC,EAAYoB,GAAM,MAAA,EACnDmE,EAAgBF,EAAGQ,EAA+B5D,CAAA,EAExD,GAAI,CAAC,MAAM,QAAQsD,CAAA,EACjB,MAAM,IAAI,MAAM,yDAAA,EAGlB,IAAMrC,EAAyBqC,EAAc,IAAKzB,GAAA,CAChD,GAAI,CAACA,GAAQA,EAAK,MAAQ,OACxB,MAAM,IAAI,MACR,4DAAA,EAGJ,OAAO1C,GAAM,QAAU,CAAC0C,EAAK,IAAI,WAAW1C,EAAK,MAAM,EACnD,GAAGA,EAAK,MAAM,GAAG0C,EAAK,GAAG,GACzBA,EAAK,GACX,CAAA,EACA,MAAMjB,GAAQK,EAAc5D,CAAA,CAC9B,EAzBS,WA2BT,QAAST,EAAA,MACP6G,EACAC,EACA1D,EACAb,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3EpB,EAAa,MAAMiD,GAAQ3D,CAAA,EAC3BuG,EAAiB9F,GAAgBC,EAAYoB,GAAM,MAAA,EAEnDmE,EAAgBG,EAASG,EAA+B5D,CAAA,EAC9D,GAAI,CAAC,MAAM,QAAQsD,CAAA,EACjB,MAAM,IAAI,MACR,yDAAA,EAIJ,IAAM5C,EAAoC4C,EAAc,IACrDzB,GAAA,CACC,GAAI,CAACA,GAAQA,EAAK,MAAQ,OACxB,MAAM,IAAI,MACR,4DAAA,EAGJ,IAAM8B,EAAcD,EAAS7B,EAAM7B,CAAA,EAC7B,CAAE,IAAAd,EAAK,SAAAO,CAAQ,EAAKC,GACxB,OACAiE,EACAxE,GAAM,MAAA,EAER,OAAAN,GAAeY,EAAUN,GAAM,aAAcA,GAAM,SAAA,EAC5C,CAACD,EAAKO,EACf,CAAA,EAEF,MAAMkB,GAAQD,EAAcrD,CAAA,CAC9B,EAnCS,WAqCT,SAAUT,EAAA,MACRuC,GAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3E4B,EAAa,MAAMC,GAAQ3D,CAAA,EAC3BwG,EAAW1E,GAAM,OACnB4B,EAAW,OAAO,CAAC,CAAC7C,CAAA,IACpB,OAAOA,GAAM,UAAYA,EAAE,WAAWiB,EAAK,MAAM,CAAA,EAEjD4B,EACJ,OAAO,OAAO,YAAY8C,CAAA,CAC5B,EAXU,YAaV,SAAUjH,EAAA,MACRkH,EACAC,EAAa,GACb5E,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC7E4E,GAAY,MAAM9E,EAAc,MAAME,CAAA,EAE1C,IAAM6E,EAAwC,OAAO,QAAQF,CAAA,EAAO,IAClE,CAAC,CAAC5F,EAAGC,CAAA,IAAG,CACN,GAAM,CAAE,IAAAe,EAAK,SAAAO,CAAQ,EAAMC,GAAexB,EAAGC,EAAGgB,GAAM,MAAA,EACtD,OAAAN,GAAeY,EAAUN,GAAM,aAAcA,GAAM,SAAA,EAC5C,CAACD,EAAKO,EACf,CAAA,EAEF,MAAMkB,GAAQqD,EAAiB3G,CAAA,CACjC,EAhBU,YAkBV,aAAcT,EAAA,MACZsC,EACA+E,EACA9E,IAAA,CAEA,IAAM9B,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC3E4B,EAAa,MAAMC,GAAQ3D,CAAA,EAC3BwG,EAAW1E,GAAM,OACnB4B,EAAW,OAAO,CAAC,CAAC7C,CAAA,IACpB,OAAOA,GAAM,UAAYA,EAAE,WAAWiB,EAAK,MAAM,CAAA,EAEjD4B,EACE+C,EAAO,OAAO,YAAYD,CAAA,EAE1BK,EAAYD,GAAY,cACxB1F,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAIEiF,EAAI,MADS,MADP,MAAM9F,EAAa,SAAUE,EAAQ,EAAA,GACpB,cAAc2F,EAAW,CAAE,OAAQ,EAAM,CAAA,GAC3C,eAAc,EACzC,aAAMC,EAAE,MACN,IAAI,KAAK,CAAC,KAAK,UAAUL,CAAA,GAAU,CAAE,KAAM,kBAAoB,CAAA,CAAA,EAEjE,MAAMK,EAAE,MAAK,EAEN,GAAG5F,CAAA,IAAU2F,CAAA,EACtB,EA5Bc,gBA8Bd,gBAAiBtH,EAAA,MACfsC,EACA+E,EACAF,EAAa,GACb5E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEkF,EAAM,MAAM/F,EAAa,SAAUE,EAAQ,EAAA,EAE3C2F,EAAYD,EAAS,SAAS,GAAA,EAChCA,EAAS,MAAM,GAAA,EAAM,IAAG,EACxBA,EAGEI,EAAO,MADM,MAAMD,EAAI,cAAcF,CAAA,GACb,QAAO,EAC/BJ,EAAO,KAAK,MAAM,MAAMO,EAAK,KAAI,CAAA,EAEjChH,EAAQO,EAAeuB,GAAM,OAAQA,GAAM,UAAWA,GAAM,QAASA,GAAM,SAAA,EAC7E4E,GAAY,MAAM9E,EAAc,MAAME,CAAA,EAE1C,IAAM6E,EAAwC,OAAO,QAAQF,CAAA,EAAO,IAClE,CAAC,CAAC5F,EAAGC,CAAA,IAAG,CACN,GAAM,CAAE,IAAAe,EAAK,SAAAO,CAAQ,EAAMC,GAAexB,EAAGC,EAAGgB,GAAM,MAAA,EACtD,MAAO,CAACD,EAAKO,EACf,CAAA,EAEF,MAAMkB,GAAQqD,EAAiB3G,CAAA,CACjC,EA7BiB,mBA+BjB,KAAMT,EAAC0H,GAAA,CAEP,EAFM,QAGN,QAAS1H,EAAA,IAAA,CAET,EAFS,WAGT,UAAWA,EAAA,IAAA,CAEX,EAFW,aAGX,QAAA2H,GACA,kBAAmB3H,EAACoB,GAClBwG,GAAkBxG,GAAU,EAAA,EADX,oBAErB,EAKayG,EAA0C,CACrD,GAAGxF,EAEH,UAAWrC,EAAA,MACTsC,EACAC,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEkF,EAAM,MAAM/F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,EACjDmG,EAAY,CAAA,EAElB,aAAiB,CAACC,EAAMC,CAAA,IAAYR,EAAI,QAAO,EAC7C,GAAIQ,EAAO,OAAS,OAAQ,CAC1B,IAAMP,EAAO,MAAMO,EAAO,QAAO,EACjCF,EAAU,KAAK,CACb,KAAAC,EACA,KAAMN,EAAK,KACX,KAAMA,EAAK,KACX,aAAcA,EAAK,YACrB,CAAA,CACF,CAEF,OAAOK,CACT,EAtBW,aAwBX,QAAS9H,EAAA,MACPsC,EACA+E,EACA9E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAGJ,OAAO,MADY,MADP,MAAMb,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GAC1B,cAAc0F,CAAA,GACnB,QAAO,CACjC,EAXS,WAaT,cAAerH,EAAA,MACbsC,EACA+E,EACA9E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAIJ,OADa,MADM,MADP,MAAMb,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GAC1B,cAAc0F,CAAA,GACb,QAAO,GACzB,OAAM,CACpB,EAZe,iBAcf,QAASrH,EAAA,MACPsC,EACAmF,EACAJ,EACA9E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAGEiF,EAAI,MADC,MADC,MAAM9F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GAClC,cAAc0F,EAAU,CAAE,OAAQ,EAAM,CAAA,GAC1C,eAAc,EACjC,MAAME,EAAE,MAAM,IAAI,KAAK,CAAC,MAAME,EAAK,YAAW,EAAI,CAAA,EAClD,MAAMF,EAAE,MAAK,CACf,EAdS,WAgBT,cAAevH,EAAA,MACbsC,EACA2F,EACAC,EACA3F,IAAA,CAEA,IAAI4F,EACAd,EACA,OAAOY,GAAqB,UAC9BZ,EAAWY,EACXE,EAASD,IAETC,EAASF,EACTZ,EAAWa,GAEb,IAAMvG,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAGEiF,EAAI,MADC,MADC,MAAM9F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GAClC,cAAc0F,EAAU,CAAE,OAAQ,EAAM,CAAA,GAC1C,eAAc,EAC3Be,EAASD,EAAO,UAAS,EAC/B,GAAI,CACF,OAAa,CACX,GAAM,CAAE,KAAAE,EAAM,MAAAC,CAAK,EAAM,MAAMF,EAAO,KAAI,EAC1C,GAAIC,EAAM,MACNC,GACF,MAAMf,EAAE,MAAMe,CAAA,CAElB,CACF,QAAA,CACEF,EAAO,YAAW,CACpB,CACA,MAAMb,EAAE,MAAK,CACf,EAlCe,iBAoCf,QAASvH,EAAA,MACPsC,EACA+E,EACA9E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAEJ,MADY,MAAMb,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GAC7C,YAAY0F,CAAA,CACxB,EAVS,WAYT,QAASrH,EAAA,MACPsC,EACAiG,EACAC,EACAjG,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEkF,EAAM,MAAM/F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,EAEjD8G,EAAW,MADD,MAAMjB,EAAI,cAAce,CAAA,GACT,QAAO,EAEhChB,EAAI,MADM,MAAMC,EAAI,cAAcgB,EAAS,CAAE,OAAQ,EAAM,CAAA,GACzC,eAAc,EACtC,MAAMjB,EAAE,MAAM,IAAI,KAAK,CAAC,MAAMkB,EAAS,YAAW,EAAI,CAAA,EACtD,MAAMlB,EAAE,MAAK,EACb,MAAMC,EAAI,YAAYe,CAAA,CACxB,EAjBS,WAmBT,OAAQvI,EAAA,MACNsC,EACA+E,EACAqB,EACAnG,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEkF,EAAM,MAAM/F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,EAEjD8G,EAAW,MADE,MAAMjB,EAAI,cAAcH,CAAA,GACT,QAAO,EAEnCsB,EAAYpG,GAAM,QAAU,CAACmG,EAAO,WAAWnG,EAAK,MAAM,EAC5D,GAAGA,EAAK,MAAM,GAAGmG,CAAA,GACjBA,EAIEnB,EAAI,MADM,MAFE,MAAM9F,EAAac,GAAM,SAAUoG,EAAW,EAAA,GAEhC,cAActB,EAAU,CAAE,OAAQ,EAAM,CAAA,GAChD,eAAc,EACtC,MAAME,EAAE,MAAM,IAAI,KAAK,CAAC,MAAMkB,EAAS,YAAW,EAAI,CAAA,EACtD,MAAMlB,EAAE,MAAK,EACb,MAAMC,EAAI,YAAYH,CAAA,CACxB,EAvBQ,UAyBR,IAAKrH,EAAA,MACHsC,EACAsG,EACAC,EACAC,EAAkB,GAClBvG,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEkF,EAAM,MAAM/F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,EACjDoH,EAA0C,CAAC,EAGjD,aAAiB,CAAChB,EAAMC,CAAA,IAAYR,EAAI,QAAO,EAC7C,GACEQ,EAAO,OAAS,SAAW,CAACa,GAAcA,EAAW,SAASd,CAAA,GAC9D,CACA,IAAMiB,EAAI,MAAMhB,EAAO,QAAO,EAC9Be,EAAYhB,CAAA,EAAQ,IAAI,WAAW,MAAMiB,EAAE,YAAW,CAAA,CACxD,CAGF,IAAMC,EAAaC,GAAQH,CAAA,EAErBxB,EAAI,MADY,MAAMC,EAAI,cAAcoB,EAAS,CAAE,OAAQ,EAAM,CAAA,GACzC,eAAc,EAI5C,GAHA,MAAMrB,EAAE,MAAM,IAAI,KAAK,CAAC0B,EAAwB,CAAA,EAChD,MAAM1B,EAAE,MAAK,EAETuB,EACF,QAAWf,KAAQ,OAAO,KAAKgB,CAAA,EAC7B,MAAMvB,EAAI,YAAYO,CAAA,CAG5B,EAlCK,OAoCL,MAAO/H,EAAA,MACLsC,EACAsG,EACAO,EAAY,GACZ5G,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EACEkF,EAAM,MAAM/F,EAAac,GAAM,SAAUZ,EAAQ,EAAA,EACjDyH,EAAgB,MAAM5B,EAAI,cAAcoB,CAAA,EACxCS,EAAY,IAAI,WACpB,MAAO,MAAMD,EAAc,QAAO,GAAI,YAAW,CAAA,EAG7CE,EAAWC,GAAUF,CAAA,EAC3B,OAAW,CAACtB,EAAMb,CAAA,IAAU,OAAO,QAAQoC,CAAA,EACzC,GAAI,CAACvB,EAAK,SAAS,GAAA,EAAO,CAExB,IAAMR,EAAI,MADC,MAAMC,EAAI,cAAcO,EAAM,CAAE,OAAQ,EAAM,CAAA,GACtC,eAAc,EACjC,MAAMR,EAAE,MAAM,IAAI,KAAK,CAACL,EAAkB,CAAA,EAC1C,MAAMK,EAAE,MAAK,CACf,CAGE4B,GAAW,MAAM3B,EAAI,YAAYoB,CAAA,CACvC,EA1BO,SA4BP,OAAQ5I,EAAA,MACNsC,EACAsG,EACAnB,EACAJ,EACA9E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAEE8G,EAAgB,MADV,MAAM3H,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GACvB,cAAciH,CAAA,EACxCS,EAAY,IAAI,WACpB,MAAO,MAAMD,EAAc,QAAO,GAAI,YAAW,CAAA,EAE7CI,EAAiBD,GAAUF,CAAA,EAEjCG,EAAenC,CAAA,EAAY,IAAI,WAAW,MAAMI,EAAK,YAAW,CAAA,EAEhE,IAAMgC,EAAgBP,GAAQM,CAAA,EACxBjC,EAAI,MAAM6B,EAAc,eAAc,EAC5C,MAAM7B,EAAE,MAAM,IAAI,KAAK,CAACkC,EAA2B,CAAA,EACnD,MAAMlC,EAAE,MAAK,CACf,EAvBQ,UAyBR,OAAQvH,EAAA,MACNsC,EACAsG,EACAvB,EACA9E,IAAA,CAEA,IAAMZ,EAASY,GAAM,QAAU,CAACD,EAAI,WAAWC,EAAK,MAAM,EACtD,GAAGA,EAAK,MAAM,GAAGD,CAAA,GACjBA,EAEE8G,EAAgB,MADV,MAAM3H,EAAac,GAAM,SAAUZ,EAAQ,EAAA,GACvB,cAAciH,CAAA,EACxCS,EAAY,IAAI,WACpB,MAAO,MAAMD,EAAc,QAAO,GAAI,YAAW,CAAA,EAE7CI,EAAiBD,GAAUF,CAAA,EAEjC,OAAOG,EAAenC,CAAA,EAEtB,IAAMoC,EAAgBP,GAAQM,CAAA,EACxBjC,EAAI,MAAM6B,EAAc,eAAc,EAC5C,MAAM7B,EAAE,MAAM,IAAI,KAAK,CAACkC,EAA2B,CAAA,EACnD,MAAMlC,EAAE,MAAK,CACf,EAtBQ,SAuBV,EAGamC,EAAsC7B,EAE5C,SAAS8B,GACdxJ,EACAC,EAAY,SACZgB,EAAS,GACTwI,EAAmC,CAEnC,IAAIrH,EACJ,OAAI,OAAOpC,GAAW,UAAYA,IAAW,KAC3CoC,EAAO,CAAE,GAAGpC,CAAQ,EAEpBoC,EAAO,CAAE,OAAApC,EAAQ,UAAAC,EAAW,OAAAgB,EAAQ,GAAGwI,CAAW,EAE7C,CACL,IAAK5J,EAAgBsC,GAAiBD,EAAc,IAAOC,EAAKC,CAAA,EAA3D,OACL,IAAKvC,EAAA,CAAgByC,EAAsBP,IACzCG,EAAc,IAAOI,EAAUP,EAAKK,CAAA,EADjC,OAEL,OAAQvC,EAAA,CACNsC,EACAU,IACGX,EAAc,OAAUC,EAAKU,EAAST,CAAA,EAHnC,UAIR,MAAOvC,EAAA,CACLsC,EACAa,EACAC,IACGf,EAAc,MAAYC,EAAKa,EAAWC,EAASb,CAAA,EAJjD,SAKP,OAAQvC,EAACsC,GAAiBD,EAAc,OAAOC,EAAKC,CAAA,EAA5C,UACR,QAASvC,EAAgBkE,GACvB7B,EAAc,QAAW6B,EAAM3B,CAAA,EADxB,WAET,QAASvC,EAACoE,GACR/B,EAAc,QAAQ+B,EAAS7B,CAAA,EADxB,WAET,WAAYvC,EAACkE,GAAoB7B,EAAc,WAAW6B,EAAM3B,CAAA,EAApD,cACZ,KAAMvC,EAAA,IAAMqC,EAAc,KAAKE,CAAA,EAAzB,QACN,OAAQvC,EAAA,IAAqBqC,EAAc,OAAUE,CAAA,EAA7C,UACR,QAASvC,EAAA,IAAqBqC,EAAc,QAAWE,CAAA,EAA9C,WACT,MAAOvC,EAAA,IAAMqC,EAAc,MAAME,CAAA,EAA1B,SACP,aAAcvC,EAAA,CAACuE,EAAmB3E,IAChCyC,EAAc,aAAakC,EAAW3E,EAAO2C,CAAA,EADjC,gBAEd,cAAevC,EAAA,CAAeuE,EAAmB3E,IAC/CyC,EAAc,cAAiBkC,EAAW3E,EAAO2C,CAAA,EADpC,iBAEf,YAAavC,EAAA,CAACuE,EAAmB3E,IAC/ByC,EAAc,YAAYkC,EAAW3E,EAAO2C,CAAA,EADjC,eAEb,aAAcvC,EAAA,CACZuE,EACA3E,EACAoF,IACG3C,EAAc,aAAgBkC,EAAW3E,EAAOoF,EAAOzC,CAAA,EAJ9C,gBAKd,oBAAqBvC,EAAA,CACnBuE,EACA3E,EACAuF,IAMA9C,EAAc,oBACZkC,EACA3E,EACAuF,EACA5C,CAAA,EAbiB,uBAerB,WAAYvC,EAAA,CAAeuE,EAAmB3E,IAC5CyC,EAAc,WAAckC,EAAW3E,EAAO2C,CAAA,EADpC,cAEZ,eAAgBvC,EAAA,CACduE,EACA2B,IACG7D,EAAc,eAAkBkC,EAAW2B,EAAS3D,CAAA,EAHzC,kBAIhB,eAAgBvC,EAAA,CACduE,EACA3E,EACA4G,EACApD,IAEAf,EAAc,eACZkC,EACA3E,EACA4G,EACApD,EACAb,CAAA,EAXY,kBAahB,aAAcvC,EAAA,CACZuE,EACA3E,EACA4G,EACApD,IAEAf,EAAc,aACZkC,EACA3E,EACA4G,EACApD,EACAb,CAAA,EAXU,gBAad,cAAevC,EAAA,CAACuE,EAAmB3E,IACjCyC,EAAc,cAAckC,EAAW3E,EAAO2C,CAAA,EADjC,iBAEf,kBAAmBvC,EAAA,CAACuE,EAAmB2B,IACrC7D,EAAc,kBAAkBkC,EAAW2B,EAAS3D,CAAA,EADnC,qBAEnB,eAAgBvC,EAAA,CACduE,EACA3E,EACA4G,EACApD,IACGf,EAAc,eACjBkC,EACA3E,EACA4G,EACApD,EACAb,CAAA,EAVc,kBAYhB,eAAgBvC,EAAA,CACduE,EACA3E,EACAiH,EACAC,EACA1D,IACGf,EAAc,eACjBkC,EACA3E,EACAiH,EACAC,EACA1D,EACAb,CAAA,EAZc,kBAchB,MAAOvC,EAAA,CACLwG,EACApD,IACGf,EAAc,MAAemE,EAAIpD,EAASb,CAAA,EAHxC,SAIP,QAASvC,EAAA,CACPwG,EACApD,IACGf,EAAc,QAAcmE,EAAIpD,EAASb,CAAA,EAHrC,WAIT,QAASvC,EAAA,CACPwG,EACApD,IACGf,EAAc,QAAcmE,EAAIpD,EAASb,CAAA,EAHrC,WAIT,QAASvC,EAAA,CACP6G,EACAC,EACA1D,IACGf,EAAc,QAAcwE,EAAUC,EAAU1D,EAASb,CAAA,EAJrD,WAKT,SAAUvC,EAAA,IAAMqC,EAAc,SAASE,CAAA,EAA7B,YACV,SAAUvC,EAAA,CAACkH,EAA+BC,EAAa,KACrD9E,EAAc,SAAS6E,EAAMC,EAAY5E,CAAA,EADjC,YAEV,aAAcvC,EAAA,CAACsC,EAAa+E,IAC1BhF,EAAc,aAAaC,EAAK+E,EAAU9E,CAAA,EAD9B,gBAEd,gBAAiBvC,EAAA,CAACsC,EAAa+E,EAAkBF,EAAa,KAC5D9E,EAAc,gBAAgBC,EAAK+E,EAAUF,EAAY5E,CAAA,EAD1C,mBAEjB,KAAMvC,EAAC6J,GAA8BxH,EAAc,KAAKwH,CAAA,EAAlD,QACN,QAAS7J,EAAA,IAAMqC,EAAc,QAAO,EAA3B,WACT,UAAWrC,EAAA,IAAMqC,EAAc,UAAS,EAA7B,aACX,QAAAsF,GACA,kBAAmB3H,EAAA,IACjBuC,EAAK,OAASqF,GAAkBrF,EAAK,MAAM,EAAIoF,GAAA,EAD9B,oBAErB,CACF,CA1JgB3H,EAAA2J,GAAA,kBA4JT,SAASG,GACd3J,EACAC,EAAY,SACZgB,EAAS,GACTM,EAAW,GACXkI,EAAqC,CAErC,IAAIrH,EACJ,OAAI,OAAOpC,GAAW,UAAYA,IAAW,KAC3CoC,EAAO,CAAE,GAAGpC,CAAQ,EAEpBoC,EAAO,CAAE,OAAApC,EAAQ,UAAAC,EAAW,OAAAgB,EAAQ,SAAAM,EAAU,GAAGkI,CAAW,EAEvD,CACL,GAAGD,GAAyBpH,CAAA,EAC5B,UAAWvC,EAACsC,GAAiBuF,EAAgB,UAAUvF,EAAKC,CAAA,EAAjD,aACX,QAASvC,EAAA,CAACsC,EAAa+E,IACrBQ,EAAgB,QAAQvF,EAAK+E,EAAU9E,CAAA,EADhC,WAET,cAAevC,EAAA,CAACsC,EAAa+E,IAC3BQ,EAAgB,cAAcvF,EAAK+E,EAAU9E,CAAA,EADhC,iBAEf,QAASvC,EAAA,CAACsC,EAAamF,EAAmBJ,IACxCQ,EAAgB,QAAQvF,EAAKmF,EAAMJ,EAAU9E,CAAA,EADtC,WAET,cAAevC,EAAA,CACbsC,EACA2F,EACAC,IAEAL,EAAgB,cACdvF,EACA2F,EACAC,EACA3F,CAAA,EATW,iBAWf,QAASvC,EAAA,CAACsC,EAAa+E,IACrBQ,EAAgB,QAAQvF,EAAK+E,EAAU9E,CAAA,EADhC,WAET,QAASvC,EAAA,CAACsC,EAAaiG,EAAiBC,IACtCX,EAAgB,QAAQvF,EAAKiG,EAASC,EAASjG,CAAA,EADxC,WAET,OAAQvC,EAAA,CAACsC,EAAa+E,EAAkBqB,IACtCb,EAAgB,OAAOvF,EAAK+E,EAAUqB,EAAQnG,CAAA,EADxC,UAER,IAAKvC,EAAA,CACHsC,EACAsG,EACAC,EACAC,EAAkB,KACfjB,EAAgB,IAAIvF,EAAKsG,EAASC,EAAYC,EAAiBvG,CAAA,EAL/D,OAML,MAAOvC,EAAA,CAACsC,EAAasG,EAAiBO,EAAY,KAChDtB,EAAgB,MAAMvF,EAAKsG,EAASO,EAAW5G,CAAA,EAD1C,SAEP,OAAQvC,EAAA,CACNsC,EACAsG,EACAnB,EACAJ,IACGQ,EAAgB,OAAOvF,EAAKsG,EAASnB,EAAMJ,EAAU9E,CAAA,EALlD,UAMR,OAAQvC,EAAA,CAACsC,EAAasG,EAAiBvB,IACrCQ,EAAgB,OAAOvF,EAAKsG,EAASvB,EAAU9E,CAAA,EADzC,UAER,KAAMvC,EAAC6J,GAA8BhC,EAAgB,KAAKgC,CAAA,EAApD,QACN,QAAS7J,EAAA,IAAM6H,EAAgB,QAAO,EAA7B,WACT,UAAW7H,EAAA,IAAM6H,EAAgB,UAAS,EAA/B,aACX,QAAAF,GACA,kBAAmB3H,EAAA,IACjBuC,EAAK,OAASqF,GAAkBrF,EAAK,MAAM,EAAIoF,GAAA,EAD9B,oBAErB,CACF,CA9DgB3H,EAAA8J,GAAA,oBA0ET,IAAMtJ,GAKwC,OAAO,OAC1D,CACEL,EACAC,EACAgB,EACAwI,IAEAD,GAAyBxJ,EAAQC,EAAWgB,EAAQwI,CAAA,EACtDvH,CAAA,EAaW0H,GAM4C,OAAO,OAC9D,CACE5J,EACAC,EACAgB,EACAM,EAAW,GACXkI,IAEAE,GAA2B3J,EAAQC,EAAWgB,EAAQM,EAAUkI,CAAA,EAClE/B,CAAA,ECnxDK,IAAMmC,GACT,kBCMJ,QAAQ,IAAI,qCAA8BC,EAAA,IAAe,EAMzD,eAAsBC,GAAoB,EAAe,CACvD,GACE,CAAC,EAAE,MACH,OAAO,EAAE,MAAS,UAClB,EAAE,cAAe,EAAE,OACnB,EAAE,YAAa,EAAE,MAEjB,OAGF,GAAM,CAAE,UAAAC,EAAW,QAAAC,EAAS,KAAAC,EAAO,CAAC,CAAC,EAAM,EAAE,KAE7C,GAAI,CACF,IAAMC,EAAyB,CAC7B,OAAQD,EAAK,OACb,UAAWA,EAAK,UAChB,OAAQA,EAAK,OACb,QAASA,EAAK,QACd,UAAWA,EAAK,UAChB,aAAcA,EAAK,YACrB,EAEME,EAA6B,CACjC,GAAGD,EACH,SAAUD,EAAK,QACjB,EAEIG,EAEJ,OAAQJ,EAAA,CACN,IAAK,UACHI,EAAS,CAAE,QAASP,EAAa,EACjC,MACF,IAAK,MACHO,EAAS,MAAMC,EAAY,IAAIJ,EAAK,IAAKC,CAAA,EACzC,MACF,IAAK,MACCD,EAAK,MAAQ,OACfG,EAAS,MAAMC,EAAY,IAAIJ,EAAK,IAAKA,EAAK,IAAKC,CAAA,EAEnDE,EAAS,MAAMC,EAAY,IAAIJ,EAAK,IAAKC,CAAA,EAE3C,MACF,IAAK,SACHE,EAAS,MAAMC,EAAY,OAAOJ,EAAK,IAAKC,CAAA,EAC5C,MACF,IAAK,WACHE,EAAS,MAAMC,EAAY,QAAQJ,EAAK,KAAMC,CAAA,EAC9C,MACF,IAAK,WACHE,EAAS,MAAMC,EAAY,QAAQJ,EAAK,QAASC,CAAA,EACjD,MACF,IAAK,WACHE,EAAS,MAAMC,EAAY,WAAWJ,EAAK,KAAMC,CAAA,EACjD,MACF,IAAK,OACHE,EAAS,MAAMC,EAAY,KAAKH,CAAA,EAChC,MACF,IAAK,SACHE,EAAS,MAAMC,EAAY,OAAOH,CAAA,EAClC,MACF,IAAK,UACHE,EAAS,MAAMC,EAAY,QAAQH,CAAA,EACnC,MACF,IAAK,QACHE,EAAS,MAAMC,EAAY,MAAMH,CAAA,EACjC,MACF,IAAK,QAAS,CACZ,IAAII,EACAL,EAAK,MACPK,EAAY,IAAI,SACd,OACA,MACA,WAAWL,EAAK,KAAK,eAAe,EAGtCK,EAAYL,EAAK,MAEnBG,EAAS,MAAMC,EAAY,MACzBJ,EAAK,IACLK,EACAL,EAAK,QACLC,CAAA,EAEF,KACF,CACA,IAAK,QAAS,CACZ,IAAMK,EAAK,IAAI,SACb,QACA,MACA,WAAWN,EAAK,KAAK,gBAAgB,EAEvCG,EAAS,MAAMC,EAAY,MAAME,EAAIN,EAAK,QAASC,CAAA,EACnD,KACF,CACA,IAAK,WAAY,CACf,IAAMK,EAAK,IAAI,SACb,QACA,MACA,WAAWN,EAAK,KAAK,gBAAgB,EAEvCG,EAAS,MAAMC,EAAY,QAAQE,EAAIN,EAAK,QAASC,CAAA,EACrD,KACF,CACA,IAAK,WAAY,CACf,IAAMK,EAAK,IAAI,SACb,QACA,MACA,WAAWN,EAAK,KAAK,gBAAgB,EAEvCG,EAAS,MAAMC,EAAY,QAAQE,EAAIN,EAAK,QAASC,CAAA,EACrD,KACF,CACA,IAAK,WAAY,CACf,IAAMM,EAAW,IAAI,SACnB,QACA,MACA,WAAWP,EAAK,WAAW,gBAAgB,EAEvCQ,EAAW,IAAI,SACnB,OACA,MACA,WAAWR,EAAK,WAAW,eAAe,EAE5CG,EAAS,MAAMC,EAAY,QACzBG,EACAC,EACAR,EAAK,QACLC,CAAA,EAEF,KACF,CACA,IAAK,SACHE,EAAS,MAAMC,EAAY,SAASH,CAAA,EACpC,MACF,IAAK,SACHE,EAAS,MAAMC,EAAY,SACzBJ,EAAK,KACLA,EAAK,WACLC,CAAA,EAEF,MACF,IAAK,cACHE,EAAS,MAAMC,EAAY,aACzBJ,EAAK,IACLA,EAAK,SACLC,CAAA,EAEF,MACF,IAAK,eACHE,EAAS,MAAMC,EAAY,gBACzBJ,EAAK,IACLA,EAAK,SACLA,EAAK,WACLC,CAAA,EAEF,MAGF,IAAK,YACHE,EAAS,MAAMC,EAAY,UAAUJ,EAAK,IAAKE,CAAA,EAC/C,MACF,IAAK,WACHC,EAAS,MAAMC,EAAY,QAAQJ,EAAK,IAAKA,EAAK,SAAUE,CAAA,EAC5D,MACF,IAAK,WACHC,EAAS,MAAMC,EAAY,QACzBJ,EAAK,IACLA,EAAK,KACLA,EAAK,SACLE,CAAA,EAEF,MACF,IAAK,WACHC,EAAS,MAAMC,EAAY,QAAQJ,EAAK,IAAKA,EAAK,SAAUE,CAAA,EAC5D,MACF,IAAK,WACHC,EAAS,MAAMC,EAAY,QACzBJ,EAAK,IACLA,EAAK,QACLA,EAAK,QACLE,CAAA,EAEF,MACF,IAAK,UACHC,EAAS,MAAMC,EAAY,OACzBJ,EAAK,IACLA,EAAK,SACLA,EAAK,OACLE,CAAA,EAEF,MACF,IAAK,WACHC,EAAS,MAAMC,EAAY,IACzBJ,EAAK,IACLA,EAAK,QACLA,EAAK,WACLA,EAAK,gBACLE,CAAA,EAEF,MACF,IAAK,aACHC,EAAS,MAAMC,EAAY,MACzBJ,EAAK,IACLA,EAAK,QACLA,EAAK,UACLE,CAAA,EAEF,MACF,IAAK,cACHC,EAAS,MAAMC,EAAY,OACzBJ,EAAK,IACLA,EAAK,QACLA,EAAK,KACLA,EAAK,SACLE,CAAA,EAEF,MACF,IAAK,cACHC,EAAS,MAAMC,EAAY,OACzBJ,EAAK,IACLA,EAAK,QACLA,EAAK,SACLE,CAAA,EAEF,MACF,IAAK,eACHC,EAAS,MAAMC,EAAY,WACzBJ,EAAK,UACLA,EAAK,MACLC,CAAA,EAEF,MACF,IAAK,iBACHE,EAAS,MAAMC,EAAY,aACzBJ,EAAK,UACLA,EAAK,MACLC,CAAA,EAEF,MACF,IAAK,mBACHE,EAAS,MAAMC,EAAY,cACzBJ,EAAK,UACLA,EAAK,MACLC,CAAA,EAEF,MACF,IAAK,gBACHE,EAAS,MAAMC,EAAY,YACzBJ,EAAK,UACLA,EAAK,MACLC,CAAA,EAEF,MACF,IAAK,iBACHE,EAAS,MAAMC,EAAY,aACzBJ,EAAK,UACLA,EAAK,MACLA,EAAK,MACLC,CAAA,EAEF,MACF,IAAK,yBACHE,EAAS,MAAMC,EAAY,oBACzBJ,EAAK,UACLA,EAAK,MACLA,EAAK,eACLC,CAAA,EAEF,MACF,IAAK,oBACHE,EAAS,MAAMC,EAAY,eACzBJ,EAAK,UACLA,EAAK,QACLC,CAAA,EAEF,MACF,IAAK,oBAAqB,CACxB,IAAMK,EAAK,IAAI,SACb,QACA,MACA,WAAWN,EAAK,KAAK,gBAAgB,EAEvCG,EAAS,MAAMC,EAAY,eACzBJ,EAAK,UACLA,EAAK,MACLM,EACAN,EAAK,QACLC,CAAA,EAEF,KACF,CACA,IAAK,iBAAkB,CACrB,IAAMK,EAAK,IAAI,SACb,QACA,MACA,WAAWN,EAAK,KAAK,gBAAgB,EAEvCG,EAAS,MAAMC,EAAY,aACzBJ,EAAK,UACLA,EAAK,MACLM,EACAN,EAAK,QACLC,CAAA,EAEF,KACF,CACA,IAAK,kBACHE,EAAS,MAAMC,EAAY,cACzBJ,EAAK,UACLA,EAAK,MACLC,CAAA,EAEF,MACF,IAAK,uBACHE,EAAS,MAAMC,EAAY,kBACzBJ,EAAK,UACLA,EAAK,QACLC,CAAA,EAEF,MACF,IAAK,oBAAqB,CACxB,IAAMK,EAAK,IAAI,SACb,QACA,MACA,WAAWN,EAAK,KAAK,gBAAgB,EAEvCG,EAAS,MAAMC,EAAY,eACzBJ,EAAK,UACLA,EAAK,MACLM,EACAN,EAAK,QACLC,CAAA,EAEF,KACF,CACA,IAAK,oBAAqB,CACxB,IAAMM,EAAW,IAAI,SACnB,QACA,MACA,WAAWP,EAAK,WAAW,gBAAgB,EAEvCQ,EAAW,IAAI,SACnB,OACA,MACA,WAAWR,EAAK,WAAW,eAAe,EAE5CG,EAAS,MAAMC,EAAY,eACzBJ,EAAK,UACLA,EAAK,MACLO,EACAC,EACAR,EAAK,QACLC,CAAA,EAEF,KACF,CACA,IAAK,kBACHE,EAAS,MAAMC,EAAY,cACzBJ,EAAK,IACLA,EAAK,OACLA,EAAK,SACLE,CAAA,EAEF,MACF,IAAK,kBAAmB,CACtB,IAAMO,EAAS,MAAML,EAAY,cAC/BJ,EAAK,IACLA,EAAK,SACLE,CAAA,EAED,KAEE,YACD,CAAE,UAAAJ,EAAW,QAAS,GAAM,OAAQW,CAAQ,EAC5C,CAACA,EAAmC,EAEtC,MACF,CAEA,QACE,MAAM,IAAI,MAAM,oBAAoBV,CAAA,EAAS,CACjD,CAEA,KAAK,YAAY,CAAE,UAAAD,EAAW,QAAS,GAAM,OAAAK,CAAO,CAAA,CACtD,OAASO,EAAO,CACd,KAAK,YAAY,CACf,UAAAZ,EACA,QAAS,GACT,MAAQY,EAAgB,OAC1B,CAAA,CACF,CACF,CAxYsBC,EAAAd,GAAA,uBA4YpB,OAAO,KAAS,KAChB,OAAQ,KAA8C,aAAgB,YACtE,OAAQ,KAA2C,SAAa,KAEhE,KAAK,iBAAiB,UAAY,GAAA,CAChCA,GAAoB,CAAA,CACtB,CAAA",
  "names": ["promisifyRequest", "request", "resolve", "reject", "__name", "createStore", "dbName", "storeName", "dbp", "getDB", "db", "txMode", "callback", "defaultGetStoreFunc", "defaultGetStore", "get", "key", "customStore", "store", "set", "value", "setMany", "entries", "entry", "getMany", "keys", "del", "key", "customStore", "defaultGetStore", "store", "promisifyRequest", "__name", "delMany", "keys", "clear", "eachCursor", "callback", "items", "cursor", "entries", "customStore", "defaultGetStore", "store", "promisifyRequest", "keysList", "valuesList", "key", "i", "items", "eachCursor", "cursor", "__name", "u8", "u16", "i32", "fleb", "fdeb", "clim", "freb", "__name", "eb", "start", "b", "i", "r", "j", "_a", "fl", "revfl", "_b", "fd", "revfd", "rev", "x", "hMap", "cd", "mb", "s", "l", "le", "co", "rvb", "sv", "r_1", "v", "m", "flt", "fdt", "flm", "flrm", "fdm", "fdrm", "max", "a", "bits", "d", "p", "o", "bits16", "shft", "slc", "e", "ec", "err", "__name", "ind", "msg", "nt", "e", "inflt", "dat", "st", "buf", "dict", "sl", "dl", "u8", "noBuf", "resize", "noSt", "cbuf", "l", "bl", "nbuf", "final", "pos", "bt", "lm", "dm", "lbt", "dbt", "tbts", "bits", "type", "flrm", "fdrm", "hLit", "hcLen", "tl", "ldt", "clt", "i", "clim", "clb", "max", "clbmsk", "clm", "hMap", "r", "s", "c", "n", "lt", "dt", "shft", "t", "lms", "dms", "lpos", "bits16", "sym", "add", "b", "fleb", "fl", "d", "dsym", "fd", "fdeb", "end", "shift", "dend", "slc", "wbits", "p", "v", "o", "wbits16", "hTree", "mb", "t2", "et", "a", "i0", "i1", "i2", "maxSym", "tr", "u16", "mbt", "ln", "lft", "cst", "i2_1", "i2_2", "i2_3", "lc", "cl", "cli", "cln", "cls", "w", "clen", "cf", "wfblk", "out", "wblk", "syms", "lf", "df", "eb", "li", "bs", "_a", "dlt", "mlb", "_b", "ddt", "mdb", "_c", "lclt", "nlc", "_d", "lcdt", "ndc", "lcfreq", "_e", "lct", "mlcb", "nlcc", "flen", "ftlen", "flt", "fdt", "dtlen", "ll", "llm", "lcts", "it", "clct", "len", "flm", "fdm", "dst", "deo", "i32", "dflt", "lvl", "plvl", "pre", "post", "lst", "opt", "msk_1", "prev", "head", "bs1_1", "bs2_1", "hsh", "lc_1", "wi", "hv", "imod", "pimod", "rem", "j", "ch_1", "dif", "maxn", "maxd", "ml", "nl", "mmd", "md", "ti", "pti", "cd", "revfl", "revfd", "lin", "din", "crct", "k", "crc", "cr", "dopt", "__name", "dat", "opt", "pre", "post", "st", "dict", "newDat", "u8", "dflt", "mrg", "a", "b", "o", "k", "b2", "__name", "d", "b", "b4", "b8", "wbytes", "v", "deflateSync", "data", "opts", "dopt", "__name", "inflateSync", "data", "opts", "inflt", "__name", "fltn", "__name", "d", "p", "t", "o", "k", "val", "n", "op", "mrg", "u8", "te", "td", "tds", "et", "dutf8", "r", "i", "c", "eb", "slc", "strToU8", "str", "latin1", "ar_1", "u8", "i", "te", "l", "ar", "ai", "w", "__name", "v", "n", "slc", "strFromU8", "dat", "r", "td", "_a", "dutf8", "s", "err", "slzh", "__name", "d", "b", "b2", "zh", "z", "fnl", "efl", "fn", "strFromU8", "es", "_a", "z64hs", "b4", "sc", "su", "off", "l", "nsc", "nsu", "noff", "e", "nf", "b8", "err", "exfl", "ex", "le", "k", "wzh", "f", "u", "c", "ce", "co", "fl", "col", "exl", "wbytes", "dt", "exf", "wzf", "o", "zipSync", "data", "opts", "r", "files", "fltn", "o", "tot", "fn", "_a", "file", "p", "compression", "f", "strToU8", "s", "com", "m", "ms", "exl", "exfl", "err", "d", "deflateSync", "l", "c", "crc", "mrg", "out", "u8", "oe", "cdl", "i", "wzh", "badd", "wzf", "__name", "unzipSync", "data", "opts", "files", "e", "b4", "err", "c", "b2", "o", "z", "ze", "fltr", "i", "_a", "zh", "c_2", "sc", "su", "fn", "no", "off", "b", "slzh", "inflateSync", "u8", "slc", "__name", "gerarId", "array", "byte", "gerarIdFallback", "__name", "gerarIdComPrefixo", "prefix", "gerarId", "__name", "formatDbItem", "key", "val", "keyStr", "prepareForSave", "rawId", "processKey", "finalKey", "_", "cleanVal", "buildIDBQuery", "query", "q", "lower", "upper", "__name", "storeCache", "createStoreWithIndexes", "dbName", "storeName", "indexes", "dbVersion", "request", "db", "store", "index", "dbp", "resolve", "reject", "txMode", "callback", "getCustomStore", "cacheKey", "formatDbEntries", "rawEntries", "prefix", "items", "k", "v", "formatDbItem", "getRecordDir", "basePath", "rawKey", "create", "root", "parts", "curr", "p", "validateDbItem", "val", "validatorStr", "validator", "globalSwDbAPI", "key", "opts", "get", "keyOrVal", "keyToSave", "valToSave", "options", "cleanVal", "prepareForSave", "set", "updater", "currentVal", "newVal", "patchOrFn", "context", "current", "updated", "finalKey", "del", "keysList", "fullKeys", "getMany", "idx", "entriesList", "entriesToSet", "setMany", "delMany", "allKeys", "keys", "allEntries", "entries", "keysToDelete", "clear", "indexName", "idbStore", "req", "err", "idbQuery", "keyReq", "valDone", "keyDone", "checkDone", "patch", "item", "patchObj", "paginationOpts", "direction", "limit", "advanced", "targetIndexKey", "targetPrimaryKey", "parsed", "lastIndexKey", "lastPrimaryKey", "event", "cursor", "keysReq", "values", "formatted", "i", "queries", "resultsMap", "completed", "vals", "check", "keyStr", "fn", "matched", "selectedItems", "allKeysToDelete", "keySet", "selectFn", "updateFn", "updatedItem", "formattedItems", "filtered", "data", "clearFirst", "entriesToImport", "fileName", "finalName", "w", "dir", "file", "_workerPath", "gerarId", "gerarIdComPrefixo", "globalSwOpfsAPI", "filesList", "name", "handle", "streamOrFileName", "fileNameOrStream", "stream", "reader", "done", "value", "oldName", "newName", "fileData", "newKey", "rawNewKey", "zipName", "filesToZip", "deleteOriginals", "filesRecord", "f", "zippedData", "zipSync", "deleteZip", "zipFileHandle", "zipBuffer", "unzipped", "unzipSync", "currentZipData", "newZippedData", "internalAPI", "createScopedDb", "extraOpts", "workerPath", "createScopedOpfs", "opfs", "APP_VERSION", "APP_VERSION", "handleWorkerMessage", "requestId", "command", "args", "dbOpts", "opfsOpts", "result", "internalAPI", "patchOrFn", "fn", "selectFn", "updateFn", "stream", "error", "__name"]
}

````

---

## Arquivo: `packages/worker-db/example/demo.ts`

```ts
import { db, ls, } from "../src/fake/fake-mod.ts";

interface WorkerDBMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: "pending" | "sent" | "delivered";
  timestamp: number;
}

interface UserPreferences {
  _id?: string; // Corrigindo a tipagem aqui também
  theme: "dark" | "light";
  notificationsEnabled: boolean;
  activeChatId: string | null;
}

async function runWorkerDBDbDemo() {
  console.log("🚀 [WorkerDB PWA] Iniciando demonstração do WORKER-DB...\n",);
  ls().clear();

  console.log("📦 1. LocalStorage - Criando itens com _id 'auto'...",);
  const prefStore = ls("WORKERDB_PREF_",);

  const autoKey1 = prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "dark",
    notificationsEnabled: true,
    activeChatId: "chat_1",
  },);
  const autoKey2 = prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "light",
    notificationsEnabled: false,
    activeChatId: null,
  },);

  console.log(`   --> Item 1 gerado: Chave = ${autoKey1}`,);
  console.log(
    `   --> Recuperando Item 1 (notem que '_id' volta limpo):`,
    prefStore.get(autoKey1,),
  );
  console.log(`   --> Recuperando Item 2:`, prefStore.get(autoKey2,),);

  console.log("\n🔒 2. LocalStorage - Testando Isolamento de Prefixos...",);
  const authStore = ls("WORKERDB_AUTH_",);
  authStore.set("session_token", { token: "abc-123", active: true, },);
  console.log(
    `   --> Total de itens em WORKERDB_PREF_ (Preferências): ${prefStore.keys().length}`,
  );
  console.log(
    `   --> Total de itens em WORKERDB_AUTH_ (Autenticação): ${authStore.keys().length}`,
  );

  console.log("\n🌍 3. LocalStorage - Visão Global (Sem prefixo)...",);
  const globalStore = ls();
  const allKeys = globalStore.keys();
  console.log(
    `   --> Total de itens armazenados em TODA a aplicação: ${allKeys.length}`,
  );
  console.log(
    `   --> Realizando leitura global do token:`,
    globalStore.get("WORKERDB_AUTH_session_token",),
  );

  console.log("\n💬 4. IndexedDB Worker - Enfileirando Mensagens Offline...",);
  const msgStore = db("WORKERDB_DATA", "messages", "MSG_",);
  await msgStore.clear();

  const msgId1 = await msgStore.set<WorkerDBMessage>({
    _id: "auto",
    senderId: "user_alice",
    recipientId: "user_bob",
    content: "Olá! Esta mensagem foi enfileirada offline.",
    status: "pending",
    timestamp: Date.now(),
  },);

  console.log(
    `   --> Mensagens injetadas no IndexedDB. Keys geradas: ${msgId1}`,
  );

  console.log("\n⚙️ 5. IndexedDB Worker - Mutações Assíncronas...",);
  const pendingCount = await msgStore.query<WorkerDBMessage, number>(
    (items,) => {
      return items.filter((m,) => m.status === "pending").length;
    },
  );
  console.log(
    `   --> Total pendente (calculado remotamente): ${pendingCount}`,
  );

  await msgStore.setSome<WorkerDBMessage>(
    (items,) => items.filter((m,) => m.status === "pending"),
    (item,) => ({ ...item, status: "sent", }),
  );

  const updatedMessages = await msgStore.values<WorkerDBMessage>();
  console.log(
    "   --> Estado das mensagens após envio simulado:",
    updatedMessages,
  );

  db.terminate();
  console.log("\n✅ Demonstração finalizada. Worker encerrado.",);
}

runWorkerDBDbDemo();

```

---

## Arquivo: `packages/worker-db/src/db.ts`

````ts
// src/db.ts
// Central database module: Single source of truth for IDB and OPFS manipulation.
import {
  clear,
  createStore,
  del,
  delMany,
  entries,
  get,
  getMany,
  keys,
  set,
  setMany,
  type UseStore,
  values,
} from "./utils/idb-keyval.ts";
import { unzipSync, zipSync } from "fflate";

import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from "./utils/id.ts";

// ============================================================================
// TYPE DEFINITIONS (Single Source of Truth)
// ============================================================================
/**
 * Configuration options for IndexedDB Object Stores.
 */
export interface DbStoreOptions {
  /** Name of the IndexedDB database. */
  dbName?: string;
  /** Name of the object store within the database. */
  storeName?: string;
  /** Optional prefix for key isolation in this instance. */
  prefix?: string;
  /** List of field names to index. */
  indexes?: string[];
  /** Database version (incremental). */
  dbVersion?: number;
  /** String representation of validation function (used across RPC). */
  validatorStr?: string;
  /** Optional validation function for saved records. */
  validator?: (val: unknown) => boolean;
}

/**
 * Extended options for OPFS storage.
 */
export interface OpfsStoreOptions extends DbStoreOptions {
  /** Base path (root directory) in OPFS. */
  basePath?: string;
}

/**
 * File metadata in OPFS.
 */
export interface OpfsFileInfo {
  /** Name of the file. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type of the file. */
  type: string;
  /** Timestamp of last modification. */
  lastModified: number;
}

/**
 * Query range for index operations.
 */
export interface IndexRange {
  /** Exact match value. */
  eq?: IDBValidKey;
  /** Greater than. */
  gt?: IDBValidKey;
  /** Greater than or equal to. */
  gte?: IDBValidKey;
  /** Less than. */
  lt?: IDBValidKey;
  /** Less than or equal to. */
  lte?: IDBValidKey;
}

/** Query type for index operations (IDBValidKey, IDBKeyRange, or IndexRange). */
export type IndexQuery = IDBValidKey | IDBKeyRange | IndexRange;

/**
 * Main interface for database operations (IndexedDB).
 * @template TDefault Default record type.
 */
export interface WorkerDbAPI<TDefault = unknown> {
  /** Retrieves a record by key. */
  get: <T = TDefault>(key: string, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;
  /** Sets a record (key/value or value with auto-generated ID). */
  set: <T = TDefault>(keyOrVal: string | T, val?: T | DbStoreOptions, opts?: DbStoreOptions) => Promise<string>;
  /** Updates a record via an updater callback function. */
  update: <T = TDefault>(key: string, updater: (val: WithId<T> | undefined) => T, opts?: DbStoreOptions) => Promise<void>;
  /** Applies a partial patch to a record. */
  patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions
  ) => Promise<WithId<T>>;
  /** Deletes a record by key. */
  delete: (key: string, opts?: DbStoreOptions) => Promise<void>;
  /** Retrieves multiple records by keys. */
  getMany: <T = TDefault>(keysList: string[], opts?: DbStoreOptions) => Promise<(WithId<T> | undefined)[]>;
  /** Sets multiple key-value pairs in batch. */
  setMany: (entriesList: [string, unknown][], opts?: DbStoreOptions) => Promise<void>;
  /** Deletes multiple records by keys in batch. */
  deleteMany: (keysList: string[], opts?: DbStoreOptions) => Promise<void>;
  /** Retrieves all keys in the store. */
  keys: (opts?: DbStoreOptions) => Promise<string[]>;
  /** Retrieves all values in the store. */
  values: <T = TDefault>(opts?: DbStoreOptions) => Promise<T[]>;
  /** Retrieves all [key, value] pairs in the store. */
  entries: <T = TDefault>(opts?: DbStoreOptions) => Promise<[string, T][]>;
  /** Clears all records in the store. */
  clear: (opts?: DbStoreOptions) => Promise<void>;
  /** Counts records matching an index query. */
  countByIndex: (indexName: string, query?: IndexQuery, opts?: DbStoreOptions) => Promise<number>;
  /** Retrieves a single record by index query. */
  getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T> | undefined>;
  /** Retrieves all keys matching an index query. */
  keysByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<string[]>;
  /** Applies a partial patch to records matching an index query. */
  patchByIndex: <T = TDefault>(indexName: string, query: IndexQuery, patch: Partial<T>, opts?: DbStoreOptions) => Promise<void>;
  /** Retrieves indexed records with cursor-based pagination. */
  getByIndexPaginated: <T = TDefault>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions
  ) => Promise<{ items: WithId<T>[]; nextCursor?: string }>;
  /** Retrieves records matching an index query. */
  getByIndex: <T = TDefault>(indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Retrieves records matching multiple index queries. */
  getManyByIndex: <T = TDefault>(indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Filters indexed records in the Worker using a selector function. */
  getSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Executes an aggregation query over indexed records in the Worker. */
  queryByIndex: <T = TDefault, R = unknown, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;
  /** Deletes records matching an index query. */
  deleteByIndex: (indexName: string, query: IndexQuery, opts?: DbStoreOptions) => Promise<void>;
  /** Deletes records matching multiple index queries. */
  deleteManyByIndex: (indexName: string, queries: IndexQuery[], opts?: DbStoreOptions) => Promise<void>;
  /** Deletes a subset of indexed records selected by a function in the Worker. */
  delSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Updates a subset of indexed records selected by a function in the Worker. */
  setSomeByIndex: <T = TDefault, C = unknown>(indexName: string, query: IndexQuery, selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Executes a query function over stored items in the Worker. */
  query: <T = TDefault, R = unknown, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => R, context?: C, opts?: DbStoreOptions) => Promise<R>;
  /** Filters records in the Worker using a selector function. */
  getSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<WithId<T>[]>;
  /** Deletes filtered records in the Worker using a selector function. */
  delSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Updates filtered records in the Worker using a selector and updater function. */
  setSome: <T = TDefault, C = unknown>(selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C, opts?: DbStoreOptions) => Promise<void>;
  /** Exports database records to a JSON object. */
  exportDB: (opts?: DbStoreOptions) => Promise<Record<string, unknown>>;
  /** Imports records from a JSON object into the database. */
  importDB: (data: Record<string, unknown>, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;
  /** Backs up database records to OPFS. */
  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions) => Promise<string>;
  /** Restores database records from an OPFS backup file. */
  restoreFromOpfs: (key: string, fileName: string, clearFirst?: boolean, opts?: DbStoreOptions) => Promise<void>;
  /** Initializes the Worker. */
  init: (workerPath?: string | URL) => void;
  /** Restarts the Worker. */
  restart: () => void;
  /** Terminates the Worker. */
  terminate: () => void;
  /** Generates a random unique ID. */
  gerarId: () => string;
  /** Generates a random unique ID with prefix. */
  gerarIdComPrefixo: (prefix?: string) => string;
}

/**
 * Extended interface for file system operations (OPFS).
 * @template TDefault Default record type.
 */
export interface WorkerOpfsAPI<TDefault = unknown> extends WorkerDbAPI<TDefault> {
  /** Lists files with lightweight metadata. */
  listFiles: (key: string, opts?: OpfsStoreOptions) => Promise<OpfsFileInfo[]>;
  /** Retrieves a file. */
  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<File>;
  /** Retrieves a byte stream of a file. */
  getFileStream: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<ReadableStream<Uint8Array>>;
  /** Adds a file. */
  addFile: (key: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Adds a file via a byte stream. */
  addFileStream: (key: string, streamOrFileName: ReadableStream<Uint8Array> | string, fileNameOrStream: string | ReadableStream<Uint8Array>, opts?: OpfsStoreOptions) => Promise<void>;
  /** Deletes a file. */
  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Renames a file. */
  renFile: (key: string, oldName: string, newName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Moves a file to another record key. */
  mvFile: (key: string, fileName: string, newKey: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Compresses files into a ZIP archive. */
  zip: (key: string, zipName: string, filesToZip?: string[], deleteOriginals?: boolean, opts?: OpfsStoreOptions) => Promise<void>;
  /** Extracts files from a ZIP archive. */
  unzip: (key: string, zipName: string, deleteZip?: boolean, opts?: OpfsStoreOptions) => Promise<void>;
  /** Adds a file into an existing ZIP archive. */
  addZip: (key: string, zipName: string, file: File | Blob, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
  /** Removes a file from an existing ZIP archive. */
  delZip: (key: string, zipName: string, fileName: string, opts?: OpfsStoreOptions) => Promise<void>;
}

/**
 * Converts an IndexQuery (value, key range, or boundary object) into an IDBValidKey or IDBKeyRange.
 *
 * @param query The index query specification.
 * @returns The converted IDBValidKey or native IDBKeyRange.
 * @throws {Error} If query is null or undefined.
 */
export function buildIDBQuery(query: IndexQuery): IDBValidKey | IDBKeyRange {
  if (query == null) throw new Error("Query cannot be null");
  if (
    typeof query !== "object" || query instanceof Date ||
    Array.isArray(query) || query instanceof ArrayBuffer
  ) {
    return query as IDBValidKey;
  }
  if ("lower" in query || "upper" in query) {
    return query as IDBKeyRange;
  }

  const q = query as IndexRange;
  if (q.eq !== undefined) return IDBKeyRange.only(q.eq);
  if (
    (q.gt !== undefined || q.gte !== undefined) &&
    (q.lt !== undefined || q.lte !== undefined)
  ) {
    const lower = q.gt !== undefined ? q.gt : q.gte!;
    const upper = q.lt !== undefined ? q.lt : q.lte!;
    return IDBKeyRange.bound(
      lower,
      upper,
      q.gt !== undefined,
      q.lt !== undefined,
    );
  }
  if (q.gt !== undefined || q.gte !== undefined) {
    return IDBKeyRange.lowerBound(
      q.gt !== undefined ? q.gt : q.gte!,
      q.gt !== undefined,
    );
  }
  if (q.lt !== undefined || q.lte !== undefined) {
    return IDBKeyRange.upperBound(
      q.lt !== undefined ? q.lt : q.lte!,
      q.lt !== undefined,
    );
  }
  return query as unknown as IDBValidKey;
}

// ============================================================================

const storeCache = new Map<string, UseStore>();

function createStoreWithIndexes(dbName: string, storeName: string, indexes?: string[], dbVersion?: number): UseStore {
  const request = indexedDB.open(dbName, dbVersion);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName);
      if (indexes) {
        for (const index of indexes) {
          store.createIndex(index, index);
        }
      }
    } else if (indexes) {
      // If store exists but we requested indexes, try to add them
      const store = request.transaction!.objectStore(storeName);
      for (const index of indexes) {
        if (!store.indexNames.contains(index)) {
          store.createIndex(index, index);
        }
      }
    }
  };
  const dbp = new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return (txMode, callback) =>
    dbp.then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName))
    );
}

function getCustomStore(
  dbName?: string,
  storeName = "keyval",
  indexes?: string[],
  dbVersion?: number
): UseStore | undefined {
  if (!dbName) return undefined;
  // Incorporate version into cache key if provided so it recreates if version changes
  const cacheKey = `${dbName}:${storeName}:${dbVersion || 1}`;
  if (!storeCache.has(cacheKey)) {
    storeCache.set(cacheKey, createStoreWithIndexes(dbName, storeName, indexes, dbVersion));
  }
  return storeCache.get(cacheKey);
}

function formatDbEntries(
  rawEntries: [IDBValidKey, unknown,][],
  prefix?: string,
) {
  let items = rawEntries;
  if (prefix) {
    items = items.filter(([k,],) =>
      typeof k === "string" && k.startsWith(prefix,)
    );
  }
  return items.map(([k, v,],) => formatDbItem(k, v, prefix,));
}

async function getRecordDir(
  basePath = "",
  rawKey: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const fullPath = basePath ? `${basePath}/${rawKey}` : rawKey;
  const parts = fullPath.split("/",).filter(Boolean,);
  let curr = root;
  for (const p of parts) curr = await curr.getDirectoryHandle(p, { create, },);
  return curr;
}

function validateDbItem(
  val: unknown,
  validatorStr?: string,
  validator?: (val: unknown,) => boolean,
) {
  if (val === undefined) return;
  if (validator) {
    if (!validator(val,)) {
      throw new Error(`Validation failed for item: ${JSON.stringify(val,)}`,);
    }
    return;
  }
  if (!validatorStr) return;
  const validatorFn = new Function("val", `return (${validatorStr})(val);`,);
  if (!validatorFn(val,)) {
    throw new Error(`Validation failed for item: ${JSON.stringify(val,)}`,);
  }
}

/**
 * Global API for direct IndexedDB access in the Worker.
 */
export const globalSwDbAPI: WorkerDbAPI<unknown> = {
  get: async <T,>(
    key: string,
    opts?: DbStoreOptions,
  ): Promise<WithId<T> | undefined> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const val = await get(rawKey, store,);
    return val !== undefined
      ? formatDbItem(rawKey, val, opts?.prefix,) as WithId<T>
      : undefined;
  },

  set: async <T,>(
    keyOrVal: string | T,
    val?: T | DbStoreOptions,
    opts?: DbStoreOptions,
  ): Promise<string> => {
    let keyToSave: string | undefined;
    let valToSave: unknown;
    let options: DbStoreOptions = opts || {};
    if (typeof keyOrVal !== "string") {
      keyToSave = undefined;
      valToSave = keyOrVal;
      if (val) options = val as DbStoreOptions;
    } else {
      keyToSave = keyOrVal;
      valToSave = val;
    }
    const store = getCustomStore(options.dbName, options.storeName, options.indexes, options.dbVersion);
    const { key, cleanVal, } = prepareForSave(
      keyToSave,
      valToSave,
      options.prefix,
    );
    validateDbItem(cleanVal, options.validatorStr, options.validator,);
    await set(key, cleanVal, store,);
    return key;
  },

  update: async <T,>(
    key: string,
    updater: (val: WithId<T> | undefined,) => T,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const currentVal = await globalSwDbAPI.get<T>(key, opts,);
    const newVal = updater(currentVal,);
    await globalSwDbAPI.set(key, newVal, opts,);
  },

  patch: async <T extends Record<string, unknown>, C = unknown,>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const current = (await get(rawKey, store,)) || {};

    let updated: unknown;
    if (typeof patchOrFn === "function") {
      updated = patchOrFn(
        formatDbItem(rawKey, current, opts?.prefix,) as WithId<T>,
        context,
      );
    } else {
      updated = Object.assign({}, current, patchOrFn,);
    }
    const { key: finalKey, cleanVal, } = prepareForSave(
      rawKey,
      updated,
      opts?.prefix,
    );
    validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
    await set(finalKey, cleanVal, store,);
    return formatDbItem(finalKey, cleanVal, opts?.prefix,) as WithId<T>;
  },

  delete: async (key: string, opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    await del(rawKey, store,);
  },

  getMany: async <T,>(
    keysList: string[],
    opts?: DbStoreOptions,
  ): Promise<(WithId<T> | undefined)[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const fullKeys = keysList.map((k,) =>
      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k
    );
    const rawValues = await getMany(fullKeys, store,);
    return rawValues.map((val, idx,) =>
      val !== undefined
        ? formatDbItem(fullKeys[idx]!, val, opts?.prefix,) as WithId<T>
        : undefined
    );
  },

  setMany: async (
    entriesList: [string, unknown,][],
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const entriesToSet: [string, unknown,][] = entriesList.map(([k, v,],) => {
      const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
      validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
      return [key, cleanVal,];
    },);
    await setMany(entriesToSet, store,);
  },

  deleteMany: async (
    keysList: string[],
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const fullKeys = keysList.map((k,) =>
      opts?.prefix && !k.startsWith(opts.prefix,) ? `${opts.prefix}${k}` : k
    );
    await delMany(fullKeys, store,);
  },

  keys: async (opts?: DbStoreOptions,): Promise<string[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allKeys = await keys(store,);
    return opts?.prefix
      ? allKeys.filter((k,) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      ) as string[]
      : allKeys as string[];
  },

  values: async <T,>(opts?: DbStoreOptions,): Promise<T[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    return formatDbEntries(allEntries, opts?.prefix,) as unknown as T[];
  },

  entries: async <T,>(opts?: DbStoreOptions,): Promise<[string, T,][]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    return opts?.prefix
      ? allEntries.filter(([k,],) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      ) as [
        string,
        T,
      ][]
      : allEntries as [string, T,][];
  },

  clear: async (opts?: DbStoreOptions,): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    if (opts?.prefix) {
      const allKeys = await keys(store,);
      const keysToDelete = allKeys.filter((k,) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      );
      await delMany(keysToDelete, store,);
    } else {
      await clear(store,);
    }
  },

  countByIndex: async (
    indexName: string,
    query?: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<number> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
      return new Promise<number>((resolve, reject) => {
        try {
          const index = idbStore.index(indexName);
          const req = query !== undefined ? index.count(buildIDBQuery(query)) : index.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  getOneByIndex: async <T>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<WithId<T> | undefined> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
      return new Promise<WithId<T> | undefined>((resolve, reject) => {
        try {
          const index = idbStore.index(indexName);
          const idbQuery = buildIDBQuery(query);
          const req = index.get(idbQuery);
          const keyReq = index.getKey(idbQuery);
          
          let val: unknown | undefined = undefined;
          let key: IDBValidKey | undefined = undefined;
          let valDone = false;
          let keyDone = false;

          const checkDone = () => {
             if (valDone && keyDone) {
                if (val !== undefined && key !== undefined) {
                   resolve(formatDbItem(String(key), val, opts?.prefix) as WithId<T>);
                } else {
                   resolve(undefined);
                }
             }
          };

          req.onsuccess = () => {
            val = req.result;
            valDone = true;
            checkDone();
          };
          req.onerror = () => reject(req.error);

          keyReq.onsuccess = () => {
            key = keyReq.result;
            keyDone = true;
            checkDone();
          };
          keyReq.onerror = () => reject(keyReq.error);
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  keysByIndex: async (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<string[]> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
       return new Promise<string[]>((resolve, reject) => {
          try {
             const index = idbStore.index(indexName);
             const req = index.getAllKeys(buildIDBQuery(query));
             req.onsuccess = () => {
                const keys = req.result.map(k => String(k));
                resolve(keys);
             };
             req.onerror = () => reject(req.error);
          } catch(err) {
             reject(err);
          }
       });
    });
  },

  patchByIndex: async <T>(
    indexName: string,
    query: IndexQuery,
    patch: Partial<T>,
    opts?: DbStoreOptions,
  ): Promise<void> => {
     await globalSwDbAPI.setSomeByIndex<T, Partial<T>>(
        indexName,
        query,
        (items) => items, // select all matched
        (item, patchObj) => Object.assign({}, item, patchObj) as WithId<T>,
        patch,
        opts
     );
  },

  getByIndexPaginated: async <T>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions,
  ): Promise<{ items: WithId<T>[]; nextCursor?: string }> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes");
    }
    return await store("readonly", (idbStore) => {
      return new Promise<{ items: WithId<T>[]; nextCursor?: string }>((resolve, reject) => {
        try {
          const index = idbStore.index(indexName);
          const idbQuery = buildIDBQuery(query);
          const direction = paginationOpts.direction || "next";
          const limit = paginationOpts.limit || 50;
          
          const items: WithId<T>[] = [];
          const req = index.openCursor(idbQuery, direction);
          let advanced = false;
          let targetIndexKey: unknown;
          let targetPrimaryKey: unknown;

          if (paginationOpts.cursor) {
             try {
                const parsed = JSON.parse(paginationOpts.cursor);
                targetIndexKey = parsed[0];
                targetPrimaryKey = parsed[1];
             } catch (e) {
                // invalid cursor, ignore
             }
          }

          let lastIndexKey: IDBValidKey | undefined;
          let lastPrimaryKey: IDBValidKey | undefined;

          req.onsuccess = (event) => {
             const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
             
             if (!cursor) {
                resolve({ 
                  items, 
                  nextCursor: items.length > 0 && lastIndexKey !== undefined && lastPrimaryKey !== undefined 
                    ? JSON.stringify([lastIndexKey, lastPrimaryKey]) 
                    : undefined 
                });
                return;
             }

             if (!advanced && targetIndexKey !== undefined && targetPrimaryKey !== undefined) {
                advanced = true;
                if (cursor.continuePrimaryKey) {
                   cursor.continuePrimaryKey(targetIndexKey as IDBValidKey, targetPrimaryKey as IDBValidKey);
                   return;
                }
             }

             if (advanced && targetPrimaryKey !== undefined && cursor.primaryKey === targetPrimaryKey && cursor.key === targetIndexKey) {
                 targetPrimaryKey = undefined; 
                 cursor.continue();
                 return;
             }
             
             if (!advanced && targetPrimaryKey !== undefined) {
                if (cursor.primaryKey === targetPrimaryKey && cursor.key === targetIndexKey) {
                   advanced = true;
                   targetPrimaryKey = undefined;
                }
                cursor.continue();
                return;
             }

             items.push(formatDbItem(String(cursor.primaryKey), cursor.value, opts?.prefix) as WithId<T>);
             lastIndexKey = cursor.key;
             lastPrimaryKey = cursor.primaryKey;

             if (items.length >= limit) {
                resolve({ 
                   items, 
                   nextCursor: JSON.stringify([lastIndexKey, lastPrimaryKey]) 
                });
             } else {
                cursor.continue();
             }
          };
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    });
  },

  getByIndex: async <T,>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    return await store("readonly", (idbStore,) => {
      return new Promise<WithId<T>[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const idbQuery = buildIDBQuery(query,);
          const req = index.getAll(idbQuery,);
          const keysReq = index.getAllKeys(idbQuery,);
          let values: unknown[] | null = null;
          let keys: IDBValidKey[] | null = null;

          const checkDone = () => {
            if (values !== null && keys !== null) {
              const formatted = values.map((val, i,) =>
                formatDbItem(String(keys![i],), val, opts?.prefix,) as WithId<T>
              );
              resolve(formatted,);
            }
          };

          req.onsuccess = () => {
            values = req.result;
            checkDone();
          };
          req.onerror = () => reject(req.error,);

          keysReq.onsuccess = () => {
            keys = keysReq.result;
            checkDone();
          };
          keysReq.onerror = () => reject(keysReq.error,);
        } catch (err) {
          reject(err,);
        }
      },);
    },);
  },

  getManyByIndex: async <T,>(
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    return await store("readonly", (idbStore,) => {
      return new Promise<WithId<T>[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const resultsMap = new Map<string, WithId<T>>();
          if (queries.length === 0) {
            return resolve([],);
          }
          let completed = 0;
          for (const q of queries) {
            const idbQuery = buildIDBQuery(q,);
            const req = index.getAll(idbQuery,);
            const keysReq = index.getAllKeys(idbQuery,);
            let vals: unknown[] | null = null;
            let keys: IDBValidKey[] | null = null;

            const check = () => {
              if (vals !== null && keys !== null) {
                vals.forEach((val, i,) => {
                  const keyStr = String(keys![i],);
                  if (!resultsMap.has(keyStr,)) {
                    resultsMap.set(
                      keyStr,
                      formatDbItem(keyStr, val, opts?.prefix,) as WithId<T>,
                    );
                  }
                },);
                completed++;
                if (completed === queries.length) {
                  resolve(Array.from(resultsMap.values(),),);
                }
              }
            };

            req.onsuccess = () => {
              vals = req.result;
              check();
            };
            req.onerror = () => reject(req.error,);

            keysReq.onsuccess = () => {
              keys = keysReq.result;
              check();
            };
            keysReq.onerror = () => reject(keysReq.error,);
          }
        } catch (err) {
          reject(err,);
        }
      },);
    },);
  },

  getSomeByIndex: async <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);
    const selectedItems = fn(matched, context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The injected function in GET_SOME_BY_INDEX must return an Array.",
      );
    }
    return selectedItems;
  },

  queryByIndex: async <T, R, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> => {
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts,);
    return fn(matched, context,);
  },

  deleteByIndex: async (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    const keysToDelete = await store("readonly", (idbStore,) => {
      return new Promise<string[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const keysReq = index.getAllKeys(buildIDBQuery(query,),);
          keysReq.onsuccess = () => {
            resolve(keysReq.result.map((k,) => String(k,)),);
          };
          keysReq.onerror = () => reject(keysReq.error,);
        } catch (err) {
          reject(err,);
        }
      },);
    },);
    if (keysToDelete.length > 0) {
      await delMany(keysToDelete, store,);
    }
  },

  deleteManyByIndex: async (
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ): Promise<void> => {
    if (queries.length === 0) return;
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    if (!store) {
      throw new Error("dbName or storeName is required to query indexes",);
    }
    const allKeysToDelete = await store("readonly", (idbStore,) => {
      return new Promise<string[]>((resolve, reject,) => {
        try {
          const index = idbStore.index(indexName,);
          const keySet = new Set<string>();
          let completed = 0;
          for (const q of queries) {
            const req = index.getAllKeys(buildIDBQuery(q,),);
            req.onsuccess = () => {
              for (const k of req.result) {
                keySet.add(String(k,));
              }
              completed++;
              if (completed === queries.length) {
                resolve(Array.from(keySet,),);
              }
            };
            req.onerror = () => reject(req.error,);
          }
        } catch (err) {
          reject(err,);
        }
      },);
    },);
    if (allKeysToDelete.length > 0) {
      await delMany(allKeysToDelete, store,);
    }
  },

  delSomeByIndex: async <T, C = unknown,>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C,) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);
    const selectedItems = fn(matched, context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The injected function in DEL_SOME_BY_INDEX must return an Array.",
      );
    }
    const keysToDelete: string[] = selectedItems.map((item: WithId<T>) => {
      if (!item || item._id === undefined) {
        throw new Error(
          "Items returned in DEL_SOME_BY_INDEX must contain an '_id' property.",
        );
      }
      return opts?.prefix && !item._id.startsWith(opts.prefix)
        ? `${opts.prefix}${item._id}`
        : item._id;
    });
    if (keysToDelete.length > 0) {
      await delMany(keysToDelete, store);
    }
  },

  setSomeByIndex: async <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(
      opts?.dbName,
      opts?.storeName,
      opts?.indexes,
      opts?.dbVersion,
    );
    const matched = await globalSwDbAPI.getByIndex<T>(indexName, query, opts);
    const selectedItems = selectFn(matched, context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The selector function in SET_SOME_BY_INDEX must return an Array.",
      );
    }
    const entriesToSet: [string, unknown][] = selectedItems.map(
      (item: WithId<T>) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items selected in SET_SOME_BY_INDEX must contain an '_id' property.",
          );
        }
        const updatedItem = updateFn(item, context);
        const { key, cleanVal } = prepareForSave(
          undefined,
          updatedItem,
          opts?.prefix,
        );
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator);
        return [key, cleanVal];
      },
    );
    if (entriesToSet.length > 0) {
      await setMany(entriesToSet, store,);
    }
  },

  query: async <T, R, C = unknown,>(
    fn: (items: WithId<T>[], ctx?: C,) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store,);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix,);
    return fn(formattedItems as WithId<T>[], context,);
  },

  getSome: async <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = fn(formattedItems as WithId<T>[], context);
    if (!Array.isArray(selectedItems)) {
      throw new Error("The injected function in GET_SOME must return an Array.");
    }
    return selectedItems;
  },

  delSome: async <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);
    const selectedItems = fn(formattedItems as WithId<T>[], context);

    if (!Array.isArray(selectedItems)) {
      throw new Error("The injected function in DEL_SOME must return an Array.");
    }

    const keysToDelete: string[] = selectedItems.map((item: WithId<T>) => {
      if (!item || item._id === undefined) {
        throw new Error(
          "Items returned in DEL_SOME must contain an '_id' property.",
        );
      }
      return opts?.prefix && !item._id.startsWith(opts.prefix)
        ? `${opts.prefix}${item._id}`
        : item._id;
    });
    await delMany(keysToDelete, store);
  },

  setSome: async <T, C = unknown>(
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const rawEntries = await entries(store);
    const formattedItems = formatDbEntries(rawEntries, opts?.prefix);

    const selectedItems = selectFn(formattedItems as WithId<T>[], context);
    if (!Array.isArray(selectedItems)) {
      throw new Error(
        "The selector function in SET_SOME must return an Array.",
      );
    }

    const entriesToSet: [string, unknown][] = selectedItems.map(
      (item: WithId<T>) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items selected in SET_SOME must contain an '_id' property.",
          );
        }
        const updatedItem = updateFn(item, context);
        const { key, cleanVal } = prepareForSave(
          undefined,
          updatedItem,
          opts?.prefix,
        );
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator);
        return [key, cleanVal];
      },
    );
    await setMany(entriesToSet, store);
  },

  exportDB: async (
    opts?: DbStoreOptions,
  ): Promise<Record<string, unknown>> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    const filtered = opts?.prefix
      ? allEntries.filter(([k,],) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      )
      : allEntries;
    return Object.fromEntries(filtered,);
  },

  importDB: async (
    data: Record<string, unknown>,
    clearFirst = false,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    if (clearFirst) await globalSwDbAPI.clear(opts,);

    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(
      ([k, v,],) => {
        const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
        validateDbItem(cleanVal, opts?.validatorStr, opts?.validator,);
        return [key, cleanVal,];
      },
    );
    await setMany(entriesToImport, store,);
  },

  backupToOpfs: async (
    key: string,
    fileName?: string,
    opts?: DbStoreOptions,
  ): Promise<string> => {
    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    const allEntries = await entries(store,);
    const filtered = opts?.prefix
      ? allEntries.filter(([k,],) =>
        typeof k === "string" && k.startsWith(opts.prefix!,)
      )
      : allEntries;
    const data = Object.fromEntries(filtered,);

    const finalName = fileName || "backup.json";
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;

    const dir = await getRecordDir("backup", rawKey, true,);
    const fileHandle = await dir.getFileHandle(finalName, { create: true, },);
    const w = await fileHandle.createWritable();
    await w.write(
      new Blob([JSON.stringify(data,),], { type: "application/json", },),
    );
    await w.close();

    return `${rawKey}/${finalName}`;
  },

  restoreFromOpfs: async (
    key: string,
    fileName: string,
    clearFirst = false,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir("backup", rawKey, false,);

    const finalName = fileName.includes("/",)
      ? fileName.split("/",).pop()!
      : fileName;

    const fileHandle = await dir.getFileHandle(finalName,);
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text(),);

    const store = getCustomStore(opts?.dbName, opts?.storeName, opts?.indexes, opts?.dbVersion);
    if (clearFirst) await globalSwDbAPI.clear(opts,);

    const entriesToImport: [string, unknown,][] = Object.entries(data,).map(
      ([k, v,],) => {
        const { key, cleanVal, } = prepareForSave(k, v, opts?.prefix,);
        return [key, cleanVal,];
      },
    );
    await setMany(entriesToImport, store,);
  },

  init: (_workerPath?: string | URL): void => {
    // No-op no Worker
  },
  restart: (): void => {
    // No-op no Worker
  },
  terminate: (): void => {
    // No-op no Worker
  },
  gerarId,
  gerarIdComPrefixo: (prefix?: string): string =>
    gerarIdComPrefixo(prefix || ""),
};

/**
 * Global API for direct File System (OPFS) access in the Worker.
 */
export const globalSwOpfsAPI: WorkerOpfsAPI<unknown> = {
  ...globalSwDbAPI,

  listFiles: async (
    key: string,
    opts?: OpfsStoreOptions,
  ): Promise<OpfsFileInfo[]> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const filesList = [];
    // @ts-ignore: Deno API for directory entries
    for await (const [name, handle,] of dir.entries()) {
      if (handle.kind === "file") {
        const file = await handle.getFile();
        filesList.push({
          name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },);
      }
    }
    return filesList;
  },

  getFile: async (
    key: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<File> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    return await fileHandle.getFile();
  },

  getFileStream: async (
    key: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<ReadableStream<Uint8Array>> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    const file = await fileHandle.getFile();
    return file.stream();
  },

  addFile: async (
    key: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const fh = await dir.getFileHandle(fileName, { create: true, },);
    const w = await fh.createWritable();
    await w.write(new Blob([await file.arrayBuffer(),],),);
    await w.close();
  },

  addFileStream: async (
    key: string,
    streamOrFileName: ReadableStream<Uint8Array> | string,
    fileNameOrStream: string | ReadableStream<Uint8Array>,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    let stream: ReadableStream<Uint8Array>;
    let fileName: string;
    if (typeof streamOrFileName === "string") {
      fileName = streamOrFileName;
      stream = fileNameOrStream as ReadableStream<Uint8Array>;
    } else {
      stream = streamOrFileName;
      fileName = fileNameOrStream as string;
    }
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, true,);
    const fh = await dir.getFileHandle(fileName, { create: true, },);
    const w = await fh.createWritable();
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value, } = await reader.read();
        if (done) break;
        if (value) {
          await w.write(value as unknown as BufferSource,);
        }
      }
    } finally {
      reader.releaseLock();
    }
    await w.close();
  },

  delFile: async (
    key: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    await dir.removeEntry(fileName,);
  },

  renFile: async (
    key: string,
    oldName: string,
    newName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const oldFile = await dir.getFileHandle(oldName,);
    const fileData = await oldFile.getFile();
    const newFile = await dir.getFileHandle(newName, { create: true, },);
    const w = await newFile.createWritable();
    await w.write(new Blob([await fileData.arrayBuffer(),],),);
    await w.close();
    await dir.removeEntry(oldName,);
  },

  mvFile: async (
    key: string,
    fileName: string,
    newKey: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const fileHandle = await dir.getFileHandle(fileName,);
    const fileData = await fileHandle.getFile();

    const rawNewKey = opts?.prefix && !newKey.startsWith(opts.prefix,)
      ? `${opts.prefix}${newKey}`
      : newKey;
    const targetDir = await getRecordDir(opts?.basePath, rawNewKey, true,);

    const newFile = await targetDir.getFileHandle(fileName, { create: true, },);
    const w = await newFile.createWritable();
    await w.write(new Blob([await fileData.arrayBuffer(),],),);
    await w.close();
    await dir.removeEntry(fileName,);
  },

  zip: async (
    key: string,
    zipName: string,
    filesToZip?: string[],
    deleteOriginals = false,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const filesRecord: Record<string, Uint8Array> = {};

    // @ts-ignore: Deno API for directory entries
    for await (const [name, handle,] of dir.entries()) {
      if (
        handle.kind === "file" && (!filesToZip || filesToZip.includes(name,))
      ) {
        const f = await handle.getFile();
        filesRecord[name] = new Uint8Array(await f.arrayBuffer(),);
      }
    }

    const zippedData = zipSync(filesRecord,);
    const zipFileHandle = await dir.getFileHandle(zipName, { create: true, },);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([zippedData as BlobPart,],),);
    await w.close();

    if (deleteOriginals) {
      for (const name of Object.keys(filesRecord,)) {
        await dir.removeEntry(name,);
      }
    }
  },

  unzip: async (
    key: string,
    zipName: string,
    deleteZip = false,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(
      await (await zipFileHandle.getFile()).arrayBuffer(),
    );

    const unzipped = unzipSync(zipBuffer,);
    for (const [name, data,] of Object.entries(unzipped,)) {
      if (!name.includes("/",)) {
        const fh = await dir.getFileHandle(name, { create: true, },);
        const w = await fh.createWritable();
        await w.write(new Blob([data as BlobPart,],),);
        await w.close();
      }
    }

    if (deleteZip) await dir.removeEntry(zipName,);
  },

  addZip: async (
    key: string,
    zipName: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(
      await (await zipFileHandle.getFile()).arrayBuffer(),
    );
    const currentZipData = unzipSync(zipBuffer,);

    currentZipData[fileName] = new Uint8Array(await file.arrayBuffer(),);

    const newZippedData = zipSync(currentZipData,);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([newZippedData as BlobPart,],),);
    await w.close();
  },

  delZip: async (
    key: string,
    zipName: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ): Promise<void> => {
    const rawKey = opts?.prefix && !key.startsWith(opts.prefix,)
      ? `${opts.prefix}${key}`
      : key;
    const dir = await getRecordDir(opts?.basePath, rawKey, false,);
    const zipFileHandle = await dir.getFileHandle(zipName,);
    const zipBuffer = new Uint8Array(
      await (await zipFileHandle.getFile()).arrayBuffer(),
    );
    const currentZipData = unzipSync(zipBuffer,);

    delete currentZipData[fileName];

    const newZippedData = zipSync(currentZipData,);
    const w = await zipFileHandle.createWritable();
    await w.write(new Blob([newZippedData as BlobPart,],),);
    await w.close();
  },
};

// Internal API export consumed by RPC proxy (rpc.ts)
export const internalAPI: WorkerOpfsAPI<unknown> = globalSwOpfsAPI;

export function createScopedDb<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName = "keyval",
  prefix = "",
  extraOpts?: Partial<DbStoreOptions>,
): WorkerDbAPI<TDefault> {
  let opts: DbStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, ...extraOpts, };
  }
  return {
    get: <T = TDefault,>(key: string,) => globalSwDbAPI.get<T>(key, opts,),
    set: <T = TDefault,>(keyOrVal: string | T, val?: T,) =>
      globalSwDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T = TDefault,>(
      key: string,
      updater: (val: WithId<T> | undefined,) => T,
    ) => globalSwDbAPI.update<T>(key, updater, opts,),
    patch: <T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>, C = unknown,>(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C,) => T | Partial<T>),
      context?: C,
    ) => globalSwDbAPI.patch<T, C>(key, patchOrFn, context, opts,),
    delete: (key: string,) => globalSwDbAPI.delete(key, opts,),
    getMany: <T = TDefault,>(keys: string[],) =>
      globalSwDbAPI.getMany<T>(keys, opts,),
    setMany: (entries: [string, unknown,][],) =>
      globalSwDbAPI.setMany(entries, opts,),
    deleteMany: (keys: string[],) => globalSwDbAPI.deleteMany(keys, opts,),
    keys: () => globalSwDbAPI.keys(opts,),
    values: <T = TDefault,>() => globalSwDbAPI.values<T>(opts,),
    entries: <T = TDefault,>() => globalSwDbAPI.entries<T>(opts,),
    clear: () => globalSwDbAPI.clear(opts,),
    countByIndex: (indexName: string, query?: IndexQuery) =>
      globalSwDbAPI.countByIndex(indexName, query, opts),
    getOneByIndex: <T = TDefault>(indexName: string, query: IndexQuery) =>
      globalSwDbAPI.getOneByIndex<T>(indexName, query, opts),
    keysByIndex: (indexName: string, query: IndexQuery) =>
      globalSwDbAPI.keysByIndex(indexName, query, opts),
    patchByIndex: <T = TDefault>(
      indexName: string,
      query: IndexQuery,
      patch: Partial<T>,
    ) => globalSwDbAPI.patchByIndex<T>(indexName, query, patch, opts),
    getByIndexPaginated: <T = TDefault>(
      indexName: string,
      query: IndexQuery,
      paginationOpts: {
        limit?: number;
        cursor?: string;
        direction?: "next" | "prev" | "nextunique" | "prevunique";
      },
    ) =>
      globalSwDbAPI.getByIndexPaginated<T>(
        indexName,
        query,
        paginationOpts,
        opts,
      ),
    getByIndex: <T = TDefault>(indexName: string, query: IndexQuery) =>
      globalSwDbAPI.getByIndex<T>(indexName, query, opts),
    getManyByIndex: <T = TDefault>(
      indexName: string,
      queries: IndexQuery[],
    ) => globalSwDbAPI.getManyByIndex<T>(indexName, queries, opts),
    getSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) =>
      globalSwDbAPI.getSomeByIndex<T, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    queryByIndex: <T = TDefault, R = unknown, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ) =>
      globalSwDbAPI.queryByIndex<T, R, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    deleteByIndex: (indexName: string, query: IndexQuery) =>
      globalSwDbAPI.deleteByIndex(indexName, query, opts),
    deleteManyByIndex: (indexName: string, queries: IndexQuery[]) =>
      globalSwDbAPI.deleteManyByIndex(indexName, queries, opts),
    delSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalSwDbAPI.delSomeByIndex<T, C>(
      indexName,
      query,
      fn,
      context,
      opts,
    ),
    setSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) => globalSwDbAPI.setSomeByIndex<T, C>(
      indexName,
      query,
      selectFn,
      updateFn,
      context,
      opts,
    ),
    query: <T = TDefault, R = unknown, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ) => globalSwDbAPI.query<T, R, C>(fn, context, opts),
    getSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalSwDbAPI.getSome<T, C>(fn, context, opts),
    delSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalSwDbAPI.delSome<T, C>(fn, context, opts),
    setSome: <T = TDefault, C = unknown>(
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) => globalSwDbAPI.setSome<T, C>(selectFn, updateFn, context, opts),
    exportDB: () => globalSwDbAPI.exportDB(opts),
    importDB: (data: Record<string, unknown>, clearFirst = false) =>
      globalSwDbAPI.importDB(data, clearFirst, opts),
    backupToOpfs: (key: string, fileName?: string) =>
      globalSwDbAPI.backupToOpfs(key, fileName, opts),
    restoreFromOpfs: (key: string, fileName: string, clearFirst = false) =>
      globalSwDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),
    init: (workerPath?: string | URL) => globalSwDbAPI.init(workerPath),
    restart: () => globalSwDbAPI.restart(),
    terminate: () => globalSwDbAPI.terminate(),
    gerarId,
    gerarIdComPrefixo: () =>
      opts.prefix ? gerarIdComPrefixo(opts.prefix) : gerarId(),
  };
}

export function createScopedOpfs<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName = "keyval",
  prefix = "",
  basePath = "",
  extraOpts?: Partial<OpfsStoreOptions>,
): WorkerOpfsAPI<TDefault> {
  let opts: OpfsStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, basePath, ...extraOpts, };
  }
  return {
    ...createScopedDb<TDefault>(opts,),
    listFiles: (key: string,) => globalSwOpfsAPI.listFiles(key, opts,),
    getFile: (key: string, fileName: string,) =>
      globalSwOpfsAPI.getFile(key, fileName, opts,),
    getFileStream: (key: string, fileName: string,) =>
      globalSwOpfsAPI.getFileStream(key, fileName, opts,),
    addFile: (key: string, file: File | Blob, fileName: string,) =>
      globalSwOpfsAPI.addFile(key, file, fileName, opts,),
    addFileStream: (
      key: string,
      streamOrFileName: ReadableStream<Uint8Array> | string,
      fileNameOrStream: string | ReadableStream<Uint8Array>,
    ) =>
      globalSwOpfsAPI.addFileStream(
        key,
        streamOrFileName as unknown as string,
        fileNameOrStream as unknown as ReadableStream<Uint8Array>,
        opts,
      ),
    delFile: (key: string, fileName: string,) =>
      globalSwOpfsAPI.delFile(key, fileName, opts,),
    renFile: (key: string, oldName: string, newName: string,) =>
      globalSwOpfsAPI.renFile(key, oldName, newName, opts,),
    mvFile: (key: string, fileName: string, newKey: string,) =>
      globalSwOpfsAPI.mvFile(key, fileName, newKey, opts,),
    zip: (
      key: string,
      zipName: string,
      filesToZip?: string[],
      deleteOriginals = false,
    ) => globalSwOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),
    unzip: (key: string, zipName: string, deleteZip = false,) =>
      globalSwOpfsAPI.unzip(key, zipName, deleteZip, opts,),
    addZip: (
      key: string,
      zipName: string,
      file: File | Blob,
      fileName: string,
    ) => globalSwOpfsAPI.addZip(key, zipName, file, fileName, opts,),
    delZip: (key: string, zipName: string, fileName: string) =>
      globalSwOpfsAPI.delZip(key, zipName, fileName, opts),
    init: (workerPath?: string | URL) => globalSwOpfsAPI.init(workerPath),
    restart: () => globalSwOpfsAPI.restart(),
    terminate: () => globalSwOpfsAPI.terminate(),
    gerarId,
    gerarIdComPrefixo: () =>
      opts.prefix ? gerarIdComPrefixo(opts.prefix) : gerarId(),
  };
}

/**
 * Access point for Database (IndexedDB).
 * Can be invoked as a function to create a scoped instance or used directly.
 *
 * @example
 * ```ts
 * const myDb = db("my-app", "users", "user_");
 * await myDb.set("123", { name: "John" });
 * ```
 */
export const db: (<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName?: string,
  prefix?: string,
  extraOpts?: Partial<DbStoreOptions>,
) => WorkerDbAPI<TDefault>) & WorkerDbAPI<unknown> = Object.assign(
  <TDefault = unknown>(
    dbName?: string | DbStoreOptions,
    storeName?: string,
    prefix?: string,
    extraOpts?: Partial<DbStoreOptions>,
  ): WorkerDbAPI<TDefault> =>
    createScopedDb<TDefault>(dbName, storeName, prefix, extraOpts),
  globalSwDbAPI,
);

/**
 * Access point for File System (OPFS).
 * Can be invoked as a function to create a scoped instance or used directly.
 *
 * @example
 * ```ts
 * const drive = opfs("my-app", "files", "docs_");
 * await drive.addFile("doc1", blob, "manual.pdf");
 * ```
 */
export const opfs: (<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName?: string,
  prefix?: string,
  basePath?: string,
  extraOpts?: Partial<OpfsStoreOptions>,
) => WorkerOpfsAPI<TDefault>) & WorkerOpfsAPI<unknown> = Object.assign(
  <TDefault = unknown>(
    dbName?: string | OpfsStoreOptions,
    storeName?: string,
    prefix?: string,
    basePath = "",
    extraOpts?: Partial<OpfsStoreOptions>,
  ): WorkerOpfsAPI<TDefault> =>
    createScopedOpfs<TDefault>(dbName, storeName, prefix, basePath, extraOpts),
  globalSwOpfsAPI,
);

````

---

## Arquivo: `packages/worker-db/src/fake/fake-db.ts`

```ts
/**
 * @module @vanaware/workerdb/swfake
 * @description Testing and simulation environment for Service Worker and Web Worker environments.
 * Injects in-memory IndexedDB and simulated OPFS into the ServiceWorkerGlobalScope (`self`)
 * for isolated testing of background sync, worker caches, and offline logic.
 */

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

```

---

## Arquivo: `packages/worker-db/src/fake/fake-local-storage.ts`

```ts
export class FakeLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string,): string | null {
    return this.store.get(key,) ?? null;
  }

  setItem(key: string, value: string,): void {
    this.store.set(key, String(value,),);
  }

  removeItem(key: string,): void {
    this.store.delete(key,);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number,): string | null {
    return Array.from(this.store.keys(),)[index] ?? null;
  }
}

```

---

## Arquivo: `packages/worker-db/src/fake/fake-mod.ts`

```ts
/**
 * @module @vanaware/workerdb/fake
 * @description Testing and simulation environment for Main Thread applications.
 * Automatically injects in-memory IndexedDB (via fake-indexeddb), simulated OPFS,
 * and a Mock Web Worker for end-to-end testing in Node.js or Deno without headless browsers.
 */

// 1. Inject Fake IndexedDB globally (Main Thread)
import "fake-indexeddb/auto";
import { FakeOPFSDirectory } from "./fake-opfs.ts";
import { FakeLocalStorage } from "./fake-local-storage.ts";

const _global = globalThis as Record<string, unknown>;

// 2. Inject Fake OPFS (Main Thread)
if (!_global.navigator) _global.navigator = {};
const navigator = _global.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Inject Fake LocalStorage (Main Thread)
if (
  !_global.localStorage ||
  _global.localStorage.constructor.name !== "FakeLocalStorage"
) {
  try {
    Object.defineProperty(_global, "localStorage", {
      value: new FakeLocalStorage(),
      writable: true,
      configurable: true,
    });
  } catch {
    _global.localStorage = new FakeLocalStorage();
  }
}

// 4. Export everything from main module
export * from "../mod-main.ts";

// 5. Initialize the module to use the Fake Worker.
// Deno resolves .ts files natively in Workers using import.meta.url
import { db } from "../mod-main.ts";
const fakeWorkerUrl = new URL("./fake-worker.ts", import.meta.url);
db.init(fakeWorkerUrl);

```

---

## Arquivo: `packages/worker-db/src/fake/fake-opfs.ts`

```ts
export class FakeOPFSFileHandle {
  public kind: "file" | "directory" = "file";

  constructor(
    private fullPath: string,
    private storage: Map<string, Uint8Array>,
  ) {}

  createWritable() {
    const chunks: Uint8Array[] = [];
    const storage = this.storage;
    const fullPath = this.fullPath;
    return {
      async write(data: Uint8Array | string | Blob | ArrayBuffer,) {
        let chunk: Uint8Array;
        if (data instanceof Uint8Array) {
          chunk = data;
        } else if (data instanceof ArrayBuffer) {
          chunk = new Uint8Array(data,);
        } else if (data instanceof Blob) {
          chunk = new Uint8Array(await data.arrayBuffer(),);
        } else {
          chunk = new TextEncoder().encode(String(data,),);
        }
        chunks.push(chunk,);
      },
      close() {
        const totalLen = chunks.reduce((acc, c,) => acc + c.length, 0,);
        const merged = new Uint8Array(totalLen,);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset,);
          offset += c.length;
        }
        storage.set(fullPath, merged,);
      },
    };
  }

  getFile(): Promise<File> {
    const content = this.storage.get(this.fullPath,);
    if (content === undefined) {
      throw new Error(`File ${this.fullPath} not found in Fake OPFS`,);
    }
    const fileName = this.fullPath.split("/",).pop() || "file";
    return Promise.resolve(
      new File([content as BlobPart,], fileName, {
        type: "application/octet-stream",
        lastModified: Date.now(),
      },),
    );
  }
}

export class FakeOPFSDirectory {
  public kind: "file" | "directory" = "directory";
  private static sharedStorage = new Map<string, Uint8Array>();

  constructor(private path: string = "",) {}

  getDirectoryHandle(name: string, options?: { create?: boolean },) {
    return new FakeOPFSDirectory(this.path ? `${this.path}/${name}` : name,);
  }

  getFileHandle(name: string, options?: { create?: boolean },) {
    const fullPath = this.path ? `${this.path}/${name}` : name;
    if (!options?.create && !FakeOPFSDirectory.sharedStorage.has(fullPath,)) {
      throw new Error(`File ${fullPath} not found in Fake OPFS`,);
    }
    return new FakeOPFSFileHandle(fullPath, FakeOPFSDirectory.sharedStorage,);
  }

  removeEntry(name: string,) {
    const fullPath = this.path ? `${this.path}/${name}` : name;
    FakeOPFSDirectory.sharedStorage.delete(fullPath,);
    for (const key of Array.from(FakeOPFSDirectory.sharedStorage.keys())) {
      if (key === fullPath || key.startsWith(`${fullPath}/`,)) {
        FakeOPFSDirectory.sharedStorage.delete(key,);
      }
    }
  }

  async *keys() {
    const yieldedDirs = new Set<string>();
    for (const key of FakeOPFSDirectory.sharedStorage.keys()) {
      if (this.path && key.startsWith(`${this.path}/`,)) {
        const localPath = key.slice(this.path.length + 1,);
        const slashIdx = localPath.indexOf("/",);
        if (slashIdx === -1) {
          yield localPath;
        } else {
          const dirName = localPath.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield dirName;
          }
        }
      } else if (!this.path) {
        const slashIdx = key.indexOf("/",);
        if (slashIdx === -1) {
          yield key;
        } else {
          const dirName = key.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield dirName;
          }
        }
      }
    }
  }

  async *entries() {
    const yieldedDirs = new Set<string>();
    for (const key of FakeOPFSDirectory.sharedStorage.keys()) {
      if (this.path && key.startsWith(`${this.path}/`,)) {
        const localPath = key.slice(this.path.length + 1,);
        const slashIdx = localPath.indexOf("/",);
        if (slashIdx === -1) {
          yield [
            localPath,
            new FakeOPFSFileHandle(key, FakeOPFSDirectory.sharedStorage,),
          ] as const;
        } else {
          const dirName = localPath.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield [
              dirName,
              new FakeOPFSDirectory(
                this.path ? `${this.path}/${dirName}` : dirName,
              ),
            ] as const;
          }
        }
      } else if (!this.path) {
        const slashIdx = key.indexOf("/",);
        if (slashIdx === -1) {
          yield [
            key,
            new FakeOPFSFileHandle(key, FakeOPFSDirectory.sharedStorage,),
          ] as const;
        } else {
          const dirName = key.slice(0, slashIdx,);
          if (!yieldedDirs.has(dirName,)) {
            yieldedDirs.add(dirName,);
            yield [
              dirName,
              new FakeOPFSDirectory(dirName,),
            ] as const;
          }
        }
      }
    }
  }

  async *values() {
    for await (const [, handle,] of this.entries()) {
      yield handle;
    }
  }

  static clear() {
    FakeOPFSDirectory.sharedStorage.clear();
  }
}

```

---

## Arquivo: `packages/worker-db/src/fake/fake-worker.ts`

```ts
// src/fake/fake-worker.ts

// 1. Inject Fake IndexedDB into the global scope (self) of the Worker
import "fake-indexeddb/auto";

import { FakeOPFSDirectory } from "./fake-opfs.ts";

const _self = globalThis as unknown as Record<string, unknown>;

// 2. Inject Fake OPFS into the Worker scope
if (!_self.navigator) _self.navigator = {};
const navigator = _self.navigator as Record<string, unknown>;
if (!navigator.storage) navigator.storage = {};
const storage = navigator.storage as Record<string, unknown>;
if (!storage.getDirectory) {
  storage.getDirectory = () => Promise.resolve(new FakeOPFSDirectory());
}

// 3. Import real worker logic with simulated environment
import "../worker.ts";

```

---

## Arquivo: `packages/worker-db/src/ls.ts`

````ts
// src/ls.ts
import {
  formatDbItem,
  gerarId,
  gerarIdComPrefixo,
  prepareForSave,
  type WithId,
} from "./utils/id.ts";
import { opfs } from "./mod-main.ts";

/** Configuration options for the LocalStorage Store. */
export interface LsStoreOptions {
  /** Optional prefix for LocalStorage keys. */
  prefix?: string;
}

/**
 * Interface for synchronous operations on LocalStorage.
 * @template TDefault Default type for stored records.
 */
export interface WorkerLsAPI<TDefault = unknown> {
  /** Synchronously retrieves a record by key. */
  get: <T = TDefault>(key: string) => WithId<T> | undefined;
  /** Synchronously sets a record (key/value or value with auto-generated ID). */
  set: <T = TDefault>(keyOrVal: string | T, val?: T) => string;
  /** Synchronously applies a partial patch to a record. */
  patch: <
    T extends Record<string, unknown> = TDefault extends Record<string, unknown> ? TDefault : Record<string, unknown>,
    C = unknown
  >(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
    context?: C
  ) => WithId<T>;
  /** Synchronously removes a record by key. */
  delete: (key: string) => void;
  /** Synchronously retrieves multiple records by keys. */
  getMany: <T = TDefault>(keys: string[]) => (WithId<T> | undefined)[];
  /** Synchronously sets multiple key-value pairs. */
  setMany: (entries: [string, unknown][]) => void;
  /** Synchronously removes multiple records by keys. */
  deleteMany: (keys: string[]) => void;
  /** Retrieves all keys filtered by prefix. */
  keys: () => string[];
  /** Retrieves all values filtered by prefix. */
  values: <T = TDefault>() => T[];
  /** Retrieves all [key, value] pairs filtered by prefix. */
  entries: <T = TDefault>() => [string, T][];
  /** Clears all records belonging to this prefix. */
  clear: () => void;
  /** Executes a synchronous query function over stored items. */
  query: <T = TDefault, R = unknown, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => R, context?: C) => R;
  /** Synchronously filters records using a predicate/selector function. */
  getSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C) => WithId<T>[];
  /** Synchronously deletes records selected by a function. */
  delSome: <T = TDefault, C = unknown>(fn: (items: WithId<T>[], ctx?: C) => WithId<T>[], context?: C) => void;
  /** Synchronously updates records selected by a function. */
  setSome: <T = TDefault, C = unknown>(selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[], updateFn: (item: WithId<T>, ctx?: C) => WithId<T>, context?: C) => void;
  /** Exports LocalStorage records to a JSON object. */
  exportLS: () => Record<string, unknown>;
  /** Imports records from a JSON object into LocalStorage. */
  importLS: (data: Record<string, unknown>, clearFirst?: boolean) => void;
  /** Asynchronously backs up LocalStorage records to OPFS. */
  backupToOpfs: (recordKey: string, fileName?: string) => Promise<string>;
  /** Asynchronously restores LocalStorage records from OPFS. */
  restoreFromOpfs: (recordKey: string, fileName: string, clearFirst?: boolean) => Promise<void>;
  /** Generates a random unique ID. */
  gerarId: () => string;
  /** Generates a random unique ID with the store prefix. */
  gerarIdComPrefixo: () => string;
}

function getAllPrefixedEntries(prefix = ""): [string, unknown][] {
  const entries: [string, unknown][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (!prefix || key.startsWith(prefix))) {
      const rawVal = localStorage.getItem(key);
      if (rawVal !== null) {
        try {
          entries.push([key, JSON.parse(rawVal)]);
        } catch {
          // Ignore items that are not valid JSON
        }
      }
    }
  }
  return entries;
}

function getFormattedItems<T>(prefix = ""): WithId<T>[] {
  const rawEntries = getAllPrefixedEntries(prefix);
  return rawEntries.map(([k, v]) => formatDbItem(k, v, prefix) as WithId<T>);
}

function resolveKey(key: string, prefix = ""): string {
  return prefix && !key.startsWith(prefix) ? `${prefix}${key}` : key;
}

function createScopedLs<TDefault = unknown>(prefix = ""): WorkerLsAPI<TDefault> {
  return {
    get: <T = TDefault>(key: string): WithId<T> | undefined => {
      const fullKey = resolveKey(key, prefix);
      const raw = localStorage.getItem(fullKey);
      if (raw === null) return undefined;
      try {
        return formatDbItem(fullKey, JSON.parse(raw), prefix) as WithId<T>;
      } catch {
        return undefined;
      }
    },

    set: <T = TDefault>(keyOrVal: string | T, val?: T): string => {
      let key: string | undefined;
      let targetVal: unknown;

      if (typeof keyOrVal === "string") {
        key = keyOrVal;
        targetVal = val;
      } else {
        key = undefined;
        targetVal = keyOrVal;
      }

      const { key: finalKey, cleanVal } = prepareForSave(
        key,
        targetVal,
        prefix,
      );
      localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      return finalKey;
    },

    patch: <
      T extends Record<string, unknown> = TDefault extends Record<
        string,
        unknown
      > ? TDefault
        : Record<string, unknown>,
      C = unknown,
    >(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
      context?: C,
    ): WithId<T> => {
      const current = createScopedLs<T>(prefix).get(key) || ({} as WithId<T>);
      let updated: unknown;

      if (typeof patchOrFn === "function") {
        updated = patchOrFn(current, context);
      } else {
        updated = Object.assign({}, current, patchOrFn);
      }

      const { key: finalKey, cleanVal } = prepareForSave(
        key,
        updated,
        prefix,
      );
      localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      return formatDbItem(finalKey, cleanVal, prefix) as WithId<T>;
    },

    delete: (key: string): void => {
      localStorage.removeItem(resolveKey(key, prefix));
    },

    getMany: <T = TDefault>(keys: string[]): (WithId<T> | undefined)[] => {
      const api = createScopedLs<T>(prefix);
      return keys.map((k) => api.get(k));
    },

    setMany: (entries: [string, unknown][]): void => {
      const api = createScopedLs(prefix);
      entries.forEach(([k, v]) => api.set(k, v));
    },

    deleteMany: (keys: string[]): void => {
      const api = createScopedLs(prefix);
      keys.forEach((k) => api.delete(k));
    },

    keys: (): string[] => {
      const keysList: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) {
          keysList.push(k);
        }
      }
      return keysList;
    },

    values: <T = TDefault>(): T[] => {
      return getFormattedItems<T>(prefix) as unknown as T[];
    },

    entries: <T = TDefault>(): [string, T][] => {
      return getAllPrefixedEntries(prefix) as [string, T][];
    },

    clear: (): void => {
      if (!prefix) {
        localStorage.clear();
        return;
      }
      const keysToRemove = createScopedLs(prefix).keys();
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    },

    query: <T = TDefault, R = unknown, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ): R => {
      const items = getFormattedItems<T>(prefix);
      return fn(items, context);
    },

    getSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ): WithId<T>[] => {
      const items = getFormattedItems<T>(prefix);
      const selected = fn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("The function in getSome must return an Array.");
      }
      return selected;
    },

    delSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ): void => {
      const items = getFormattedItems<T>(prefix);
      const selected = fn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("The function in delSome must return an Array.");
      }
      selected.forEach((item) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items returned by delSome must contain an '_id' property.",
          );
        }
        const rawKey = prefix && !item._id.startsWith(prefix)
          ? `${prefix}${item._id}`
          : item._id;
        localStorage.removeItem(rawKey);
      });
    },

    setSome: <T = TDefault, C = unknown>(
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ): void => {
      const items = getFormattedItems<T>(prefix);
      const selected = selectFn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error(
          "The selector function in setSome must return an Array.",
        );
      }
      selected.forEach((item) => {
        if (!item || item._id === undefined) {
          throw new Error(
            "Items selected by setSome must contain an '_id' property.",
          );
        }
        const updatedItem = updateFn(item, context);
        const { key: finalKey, cleanVal } = prepareForSave(
          undefined,
          updatedItem,
          prefix,
        );
        localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      });
    },

    // --- EXPORT / IMPORT METHODS ---

    exportLS: (): Record<string, unknown> => {
      const allEntries = getAllPrefixedEntries(prefix);
      return Object.fromEntries(allEntries);
    },

    importLS: (data: Record<string, unknown>, clearFirst = false): void => {
      const api = createScopedLs(prefix);
      if (clearFirst) api.clear();
      Object.entries(data).forEach(([k, v]) => api.set(k, v));
    },

    backupToOpfs: async (
      recordKey: string,
      fileName = "backup.json",
    ): Promise<string> => {
      const data = Object.fromEntries(getAllPrefixedEntries(prefix));
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });

      // Instantiate OPFS drive via worker targeting the physical /backup directory
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup");
      await drive.addFile(recordKey, blob, fileName);

      return `${recordKey}/${fileName}`;
    },

    restoreFromOpfs: async (
      recordKey: string,
      fileName: string,
      clearFirst = false,
    ): Promise<void> => {
      // Instantiate OPFS drive via worker for reading from /backup directory
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup");

      const fileBlob = await drive.getFile(recordKey, fileName);
      const data = JSON.parse(await fileBlob.text());

      const api = createScopedLs(prefix);
      if (clearFirst) api.clear();
      Object.entries(data).forEach(([k, v]) => api.set(k, v));
    },

    gerarId,
    gerarIdComPrefixo: () => (prefix ? gerarIdComPrefixo(prefix) : gerarId()),
  };
}

/**
 * Access point for LocalStorage persistence.
 * Provides synchronous storage with complex object (JSON) support and automatic IDs.
 *
 * @example
 * ```ts
 * ls.set("settings", { theme: "dark" });
 * const settings = ls.get("settings");
 * ```
 */
export const ls: ((prefix?: string) => WorkerLsAPI<unknown>) &
  WorkerLsAPI<unknown> = Object.assign(
    (prefix = ""): WorkerLsAPI<unknown> => createScopedLs(prefix),
    createScopedLs(),
  );

````

---

## Arquivo: `packages/worker-db/src/mod-main.ts`

````ts
/**
 * @module @vanaware/workerdb
 * @description Main Thread entry point for WorkerDB.
 * Provides asynchronous IndexedDB and OPFS file system APIs with non-blocking Web Worker execution,
 * along with synchronous LocalStorage support and unique ID generation utilities.
 *
 * @example
 * ```ts
 * import { db, opfs, ls } from "@vanaware/workerdb";
 *
 * // Scoped IndexedDB store running in Web Worker
 * const users = db("my-app", "users", "usr_");
 * await users.set("1", { name: "Alice", email: "alice@example.com" });
 * const user = await users.get("1");
 * ```
 */

export { ls } from "./ls.ts";
export type { WorkerLsAPI } from "./ls.ts";
export { db as dbsw, opfs as opfssw } from "./db.ts";
export { db, opfs } from "./rpc.ts";
export { gerarId, gerarIdComPrefixo, validarId } from "./utils/id.ts";
export { APP_VERSION as version } from "./utils/version.ts";
export type {
  DbStoreOptions,
  IndexQuery,
  IndexRange,
  OpfsFileInfo,
  OpfsStoreOptions,
  WorkerDbAPI,
  WorkerOpfsAPI,
} from "./db.ts";
export type { WithId } from "./utils/id.ts";

````

---

## Arquivo: `packages/worker-db/src/mod-sw.ts`

````ts
/**
 * @module @vanaware/workerdb/sw
 * @description Service Worker and Web Worker direct entry point for WorkerDB.
 * Provides direct, in-process asynchronous IndexedDB and OPFS APIs without secondary worker spawning.
 *
 * @example
 * ```ts
 * import { db, opfs } from "@vanaware/workerdb/sw";
 *
 * const cacheDb = db("sw-cache", "offline-data");
 * await cacheDb.set("page-1", { html: "<h1>Cached</h1>" });
 * ```
 */

export { db, opfs } from "./db.ts";
export { gerarId, gerarIdComPrefixo, validarId } from "./utils/id.ts";
export { APP_VERSION as version } from "./utils/version.ts";
export type {
  DbStoreOptions,
  IndexQuery,
  IndexRange,
  OpfsFileInfo,
  OpfsStoreOptions,
  WorkerDbAPI,
  WorkerOpfsAPI,
} from "./db.ts";
export type { WithId } from "./utils/id.ts";

````

---

## Arquivo: `packages/worker-db/src/rpc.ts`

```ts
// ## Arquivo: monorepo/worker-db/src/rpc.ts
import { gerarId, gerarIdComPrefixo, type WithId, } from "./utils/id.ts";
import type {
  DbStoreOptions,
  IndexQuery,
  OpfsFileInfo,
  OpfsStoreOptions,
  WorkerDbAPI,
  WorkerOpfsAPI,
} from "./db.ts";

let workerInstance: Worker | null = null;
let currentWorkerPath: string | URL = "./worker.js";
const pendingRequests = new Map<
  string,
  { resolve: (value: unknown,) => void; reject: (reason?: unknown,) => void }
>();

function getWorker(workerPath?: string | URL,): Worker {
  if (workerPath) {
    currentWorkerPath = workerPath;
  }

  if (!workerInstance) {
    const workerUrl = typeof currentWorkerPath === "string"
      ? new URL(currentWorkerPath, import.meta.url,)
      : currentWorkerPath;
    workerInstance = new Worker(workerUrl, { type: "module", },);

    workerInstance.onmessage = (e: MessageEvent,) => {
      const { requestId, success, result, error, } = e.data;
      const promise = pendingRequests.get(requestId,);
      if (promise) {
        if (success) promise.resolve(result,);
        else promise.reject(new Error(error,),);
        pendingRequests.delete(requestId,);
      }
    };

    workerInstance.onerror = (event) => {
      console.error("⚠️ Critical failure in Web Worker:", event.message);
      pendingRequests.forEach(({ reject }) =>
        reject(new Error("Worker crashed"))
      );
      pendingRequests.clear();
      restartWorker();
    };
  }
  return workerInstance;
}

function restartWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  pendingRequests.forEach(({ reject }) =>
    reject(new Error("Worker was restarted"))
  );
  pendingRequests.clear();
  getWorker();
}

function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

function exec<T>(
  command: string,
  args: Record<string, unknown> = {},
  transfer: Transferable[] = [],
): Promise<T> {
  return new Promise<T>((resolve, reject,) => {
    const requestId = gerarId();
    pendingRequests.set(requestId, {
      resolve: resolve as (value: unknown,) => void,
      reject,
    },);
    try {
      if (transfer && transfer.length > 0) {
        getWorker().postMessage({ requestId, command, args, }, transfer,);
      } else {
        getWorker().postMessage({ requestId, command, args, },);
      }
    } catch (err) {
      pendingRequests.delete(requestId,);
      reject(err,);
    }
  },);
}

function serializeDbOpts<T extends DbStoreOptions>(
  opts?: T,
): (Omit<T, "validator"> & { validatorStr?: string }) | undefined {
  if (!opts) return undefined;
  const { validator, ...rest } = opts;
  const result: Omit<T, "validator"> & { validatorStr?: string } = { ...rest, };
  if (validator && !opts.validatorStr) {
    result.validatorStr = validator.toString();
  }
  return result;
}

const globalDbAPI: WorkerDbAPI<unknown> = {
  get: <T,>(key: string, opts?: DbStoreOptions,) =>
    exec<WithId<T>>("GET", { key, ...serializeDbOpts(opts), },),
  set: <T,>(
    keyOrVal: string | T,
    val?: T | DbStoreOptions,
    opts?: DbStoreOptions,
  ) => {
    if (typeof keyOrVal !== "string") {
      const options = opts || (val as DbStoreOptions) || {};
      return exec<string>("SET", {
        key: undefined,
        val: keyOrVal,
        ...serializeDbOpts(options),
      },);
    }
    return exec<string>("SET", {
      key: keyOrVal,
      val,
      ...serializeDbOpts(opts),
    },);
  },
  update: async <T,>(
    key: string,
    updater: (val: WithId<T> | undefined,) => T,
    opts?: DbStoreOptions,
  ): Promise<void> => {
    const currentVal = await exec<WithId<T> | undefined>("GET", {
      key,
      ...serializeDbOpts(opts),
    },);
    const newVal = updater(currentVal,);
    await exec<void>("SET", { key, val: newVal, ...serializeDbOpts(opts), },);
  },
  patch: <T extends Record<string, unknown>, C = unknown,>(
    key: string,
    patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>> => {
    const isFn = typeof patchOrFn === "function";
    return exec<WithId<T>>("PATCH", {
      key,
      patch: isFn ? undefined : patchOrFn,
      fnStr: isFn ? patchOrFn.toString() : undefined,
      context,
      ...serializeDbOpts(opts),
    },);
  },
  delete: (key: string, opts?: DbStoreOptions,) =>
    exec<void>("DELETE", { key, ...serializeDbOpts(opts), },),
  getMany: <T,>(keys: string[], opts?: DbStoreOptions,) =>
    exec<(WithId<T> | undefined)[]>("GET_MANY", {
      keys,
      ...serializeDbOpts(opts),
    },),
  setMany: (entries: [string, unknown,][], opts?: DbStoreOptions,) =>
    exec<void>("SET_MANY", { entries, ...serializeDbOpts(opts), },),
  deleteMany: (keys: string[], opts?: DbStoreOptions,) =>
    exec<void>("DEL_MANY", { keys, ...serializeDbOpts(opts), },),
  keys: (opts?: DbStoreOptions,) =>
    exec<string[]>("KEYS", { ...serializeDbOpts(opts), },),
  values: <T,>(opts?: DbStoreOptions,) =>
    exec<T[]>("VALUES", { ...serializeDbOpts(opts), },),
  entries: <T,>(opts?: DbStoreOptions,) =>
    exec<[string, T,][]>("ENTRIES", { ...serializeDbOpts(opts), },),
  clear: (opts?: DbStoreOptions,) =>
    exec<void>("CLEAR", { ...serializeDbOpts(opts), },),
  getByIndex: <T,>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<WithId<T>[]>("GET_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  countByIndex: (
    indexName: string,
    query?: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<number>("COUNT_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  getOneByIndex: <T,>(
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<WithId<T> | undefined>("GET_ONE_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  keysByIndex: (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ) =>
    exec<string[]>("KEYS_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  patchByIndex: <T,>(
    indexName: string,
    query: IndexQuery,
    patch: Partial<T>,
    opts?: DbStoreOptions,
  ) =>
    exec<void>("PATCH_BY_INDEX", {
      indexName,
      query,
      patch,
      ...serializeDbOpts(opts),
    },),
  getByIndexPaginated: <T,>(
    indexName: string,
    query: IndexQuery,
    paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    opts?: DbStoreOptions,
  ) =>
    exec<{ items: WithId<T>[]; nextCursor?: string }>("GET_BY_INDEX_PAGINATED", {
      indexName,
      query,
      paginationOpts,
      ...serializeDbOpts(opts),
    },),
  getManyByIndex: <T,>(
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ) =>
    exec<WithId<T>[]>("GET_MANY_BY_INDEX", {
      indexName,
      queries,
      ...serializeDbOpts(opts),
    },),
  getSomeByIndex: <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>("GET_SOME_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  queryByIndex: <T, R, C = unknown>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> =>
    exec<R>("QUERY_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  deleteByIndex: (
    indexName: string,
    query: IndexQuery,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DELETE_BY_INDEX", {
      indexName,
      query,
      ...serializeDbOpts(opts),
    },),
  deleteManyByIndex: (
    indexName: string,
    queries: IndexQuery[],
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DELETE_MANY_BY_INDEX", {
      indexName,
      queries,
      ...serializeDbOpts(opts),
    },),
  delSomeByIndex: <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DEL_SOME_BY_INDEX", {
      indexName,
      query,
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  setSomeByIndex: <T, C = unknown>(
    indexName: string,
    query: IndexQuery,
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("SET_SOME_BY_INDEX", {
      indexName,
      query,
      selectFnStr: selectFn.toString(),
      updateFnStr: updateFn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  query: <T, R, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => R,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<R> =>
    exec<R>("QUERY", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  getSome: <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<WithId<T>[]> =>
    exec<WithId<T>[]>("GET_SOME", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  delSome: <T, C = unknown>(
    fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("DEL_SOME", {
      fnStr: fn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  setSome: <T, C = unknown>(
    selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
    updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
    context?: C,
    opts?: DbStoreOptions,
  ): Promise<void> =>
    exec<void>("SET_SOME", {
      selectFnStr: selectFn.toString(),
      updateFnStr: updateFn.toString(),
      context,
      ...serializeDbOpts(opts),
    }),
  exportDB: (opts?: DbStoreOptions,) =>
    exec<Record<string, unknown>>("EXPORT", { ...serializeDbOpts(opts), },),
  importDB: (
    data: Record<string, unknown>,
    clearFirst = false,
    opts?: DbStoreOptions,
  ) =>
    exec<void>("IMPORT", {
      data,
      clearFirst,
      ...serializeDbOpts(opts),
    },),
  backupToOpfs: (key: string, fileName?: string, opts?: DbStoreOptions,) =>
    exec<string>("BACKUP_OPFS", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  restoreFromOpfs: (
    key: string,
    fileName: string,
    clearFirst = false,
    opts?: DbStoreOptions,
  ) =>
    exec<void>("RESTORE_OPFS", {
      key,
      fileName,
      clearFirst,
      ...serializeDbOpts(opts),
    },),

  init: (workerPath?: string | URL,) => {
    getWorker(workerPath,);
  },
  restart: () => restartWorker(),
  terminate: () => terminateWorker(),
  gerarId: (): string => gerarId(),
  gerarIdComPrefixo: (prefix?: string): string =>
    gerarIdComPrefixo(prefix || ""),
};

function createScopedDb<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName = "keyval",
  prefix = "",
  extraOpts?: Partial<DbStoreOptions>,
): WorkerDbAPI<TDefault> {
  let opts: DbStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, ...extraOpts, };
  }
  return {
    get: <T = TDefault,>(key: string,) => globalDbAPI.get<T>(key, opts,),
    set: <T = TDefault,>(keyOrVal: string | T, val?: T,) =>
      globalDbAPI.set<T>(keyOrVal, val, opts,),
    update: <T = TDefault,>(
      key: string,
      updater: (val: WithId<T> | undefined,) => T,
    ) => globalDbAPI.update<T>(key, updater, opts,),
    patch: <
      T extends Record<string, unknown> = TDefault extends Record<
        string,
        unknown
      > ? TDefault
        : Record<string, unknown>,
      C = unknown,
    >(
      key: string,
      patchOrFn: Partial<T> | ((prev: WithId<T>, ctx?: C) => T | Partial<T>),
      context?: C,
    ) => globalDbAPI.patch<T, C>(key, patchOrFn, context, opts),
    delete: (key: string,) => globalDbAPI.delete(key, opts,),
    getMany: <T = TDefault,>(keys: string[],) =>
      globalDbAPI.getMany<T>(keys, opts,),
    setMany: (entries: [string, unknown,][],) =>
      globalDbAPI.setMany(entries, opts,),
    deleteMany: (keys: string[],) => globalDbAPI.deleteMany(keys, opts,),
    keys: () => globalDbAPI.keys(opts,),
    values: <T = TDefault,>() => globalDbAPI.values<T>(opts,),
    entries: <T = TDefault,>() => globalDbAPI.entries<T>(opts,),
    clear: () => globalDbAPI.clear(opts,),
    getByIndex: <T = TDefault,>(indexName: string, query: IndexQuery,) =>
      globalDbAPI.getByIndex<T>(indexName, query, opts,),
    countByIndex: (indexName: string, query?: IndexQuery,) =>
      globalDbAPI.countByIndex(indexName, query, opts,),
    getOneByIndex: <T = TDefault,>(indexName: string, query: IndexQuery,) =>
      globalDbAPI.getOneByIndex<T>(indexName, query, opts,),
    keysByIndex: (indexName: string, query: IndexQuery,) =>
      globalDbAPI.keysByIndex(indexName, query, opts,),
    patchByIndex: <T = TDefault,>(indexName: string, query: IndexQuery, patch: Partial<T>) =>
      globalDbAPI.patchByIndex<T>(indexName, query, patch, opts,),
    getByIndexPaginated: <T = TDefault,>(
      indexName: string,
      query: IndexQuery,
      paginationOpts: { limit?: number; cursor?: string; direction?: "next" | "prev" | "nextunique" | "prevunique" },
    ) => globalDbAPI.getByIndexPaginated<T>(indexName, query, paginationOpts, opts,),
    getManyByIndex: <T = TDefault,>(
      indexName: string,
      queries: IndexQuery[],
    ) => globalDbAPI.getManyByIndex<T>(indexName, queries, opts,),
    getSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) =>
      globalDbAPI.getSomeByIndex<T, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    queryByIndex: <T = TDefault, R = unknown, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ) =>
      globalDbAPI.queryByIndex<T, R, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    deleteByIndex: (indexName: string, query: IndexQuery,) =>
      globalDbAPI.deleteByIndex(indexName, query, opts,),
    deleteManyByIndex: (indexName: string, queries: IndexQuery[],) =>
      globalDbAPI.deleteManyByIndex(indexName, queries, opts,),
    delSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) =>
      globalDbAPI.delSomeByIndex<T, C>(
        indexName,
        query,
        fn,
        context,
        opts,
      ),
    setSomeByIndex: <T = TDefault, C = unknown>(
      indexName: string,
      query: IndexQuery,
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) =>
      globalDbAPI.setSomeByIndex<T, C>(
        indexName,
        query,
        selectFn,
        updateFn,
        context,
        opts,
      ),
    query: <T = TDefault, R = unknown, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => R,
      context?: C,
    ) => globalDbAPI.query<T, R, C>(fn, context, opts),
    getSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.getSome<T, C>(fn, context, opts),
    delSome: <T = TDefault, C = unknown>(
      fn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      context?: C,
    ) => globalDbAPI.delSome<T, C>(fn, context, opts),
    setSome: <T = TDefault, C = unknown>(
      selectFn: (items: WithId<T>[], ctx?: C) => WithId<T>[],
      updateFn: (item: WithId<T>, ctx?: C) => WithId<T>,
      context?: C,
    ) => globalDbAPI.setSome<T, C>(selectFn, updateFn, context, opts),
    exportDB: () => globalDbAPI.exportDB(opts,),
    importDB: (data: Record<string, unknown>, clearFirst = false,) =>
      globalDbAPI.importDB(data, clearFirst, opts,),
    backupToOpfs: (key: string, fileName?: string,) =>
      globalDbAPI.backupToOpfs(key, fileName, opts,),
    restoreFromOpfs: (key: string, fileName: string, clearFirst = false) =>
      globalDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),
    init: (workerPath?: string | URL) => globalDbAPI.init(workerPath),
    restart: () => globalDbAPI.restart(),
    terminate: () => globalDbAPI.terminate(),
    gerarId: () => globalDbAPI.gerarId(),
    gerarIdComPrefixo: () =>
      opts.prefix ? globalDbAPI.gerarIdComPrefixo(opts.prefix) : globalDbAPI.gerarId(),
  };
}

const globalOpfsAPI: WorkerOpfsAPI<unknown> = {
  ...globalDbAPI,
  listFiles: (key: string, opts?: OpfsStoreOptions,) =>
    exec<OpfsFileInfo[]>("OPFS_LIST", {
      key,
      ...serializeDbOpts(opts),
    },),
  getFile: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<File>("OPFS_GET", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  getFileStream: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<ReadableStream<Uint8Array>>("OPFS_GET_STREAM", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  addFile: (
    key: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_ADD", {
      key,
      file,
      fileName,
      ...serializeDbOpts(opts),
    },),
  addFileStream: (
    key: string,
    streamOrFileName: ReadableStream<Uint8Array> | string,
    fileNameOrStream: string | ReadableStream<Uint8Array>,
    opts?: OpfsStoreOptions,
  ) => {
    let stream: ReadableStream<Uint8Array>;
    let fileName: string;
    if (typeof streamOrFileName === "string") {
      fileName = streamOrFileName;
      stream = fileNameOrStream as ReadableStream<Uint8Array>;
    } else {
      stream = streamOrFileName;
      fileName = fileNameOrStream as string;
    }
    return exec<void>(
      "OPFS_ADD_STREAM",
      {
        key,
        stream,
        fileName,
        ...serializeDbOpts(opts),
      },
      [stream as unknown as Transferable,],
    );
  },
  delFile: (key: string, fileName: string, opts?: OpfsStoreOptions,) =>
    exec<void>("OPFS_DEL", {
      key,
      fileName,
      ...serializeDbOpts(opts),
    },),
  renFile: (
    key: string,
    oldName: string,
    newName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_REN", {
      key,
      oldName,
      newName,
      ...serializeDbOpts(opts),
    },),
  mvFile: (
    key: string,
    fileName: string,
    newKey: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_MV", {
      key,
      fileName,
      newKey,
      ...serializeDbOpts(opts),
    },),
  zip: (
    key: string,
    zipName: string,
    filesToZip?: string[],
    deleteOriginals = false,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_ZIP", {
      key,
      zipName,
      filesToZip,
      deleteOriginals,
      ...serializeDbOpts(opts),
    },),
  unzip: (
    key: string,
    zipName: string,
    deleteZip = false,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_UNZIP", {
      key,
      zipName,
      deleteZip,
      ...serializeDbOpts(opts),
    },),
  addZip: (
    key: string,
    zipName: string,
    file: File | Blob,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_ADDZIP", {
      key,
      zipName,
      file,
      fileName,
      ...serializeDbOpts(opts),
    },),
  delZip: (
    key: string,
    zipName: string,
    fileName: string,
    opts?: OpfsStoreOptions,
  ) =>
    exec<void>("OPFS_DELZIP", {
      key,
      zipName,
      fileName,
      ...serializeDbOpts(opts),
    }),
  init: (workerPath?: string | URL) => globalDbAPI.init(workerPath),
  restart: () => globalDbAPI.restart(),
  terminate: () => globalDbAPI.terminate(),
  gerarId: (): string => gerarId(),
  gerarIdComPrefixo: (prefix?: string): string =>
    gerarIdComPrefixo(prefix || ""),
};

function createScopedOpfs<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName = "keyval",
  prefix = "",
  basePath = "",
  extraOpts?: Partial<OpfsStoreOptions>,
): WorkerOpfsAPI<TDefault> {
  let opts: OpfsStoreOptions;
  if (typeof dbName === "object" && dbName !== null) {
    opts = { ...dbName, };
  } else {
    opts = { dbName, storeName, prefix, basePath, ...extraOpts, };
  }
  return {
    ...createScopedDb<TDefault>(opts,),
    listFiles: (key: string,) => globalOpfsAPI.listFiles(key, opts,),
    getFile: (key: string, fileName: string,) =>
      globalOpfsAPI.getFile(key, fileName, opts,),
    getFileStream: (key: string, fileName: string,) =>
      globalOpfsAPI.getFileStream(key, fileName, opts,),
    addFile: (key: string, file: File | Blob, fileName: string,) =>
      globalOpfsAPI.addFile(key, file, fileName, opts,),
    addFileStream: (
      key: string,
      streamOrFileName: ReadableStream<Uint8Array> | string,
      fileNameOrStream: string | ReadableStream<Uint8Array>,
    ) =>
      globalOpfsAPI.addFileStream(
        key,
        streamOrFileName as unknown as string,
        fileNameOrStream as unknown as ReadableStream<Uint8Array>,
        opts,
      ),
    delFile: (key: string, fileName: string,) =>
      globalOpfsAPI.delFile(key, fileName, opts,),
    renFile: (key: string, oldName: string, newName: string,) =>
      globalOpfsAPI.renFile(key, oldName, newName, opts,),
    mvFile: (key: string, fileName: string, newKey: string,) =>
      globalOpfsAPI.mvFile(key, fileName, newKey, opts,),
    zip: (
      key: string,
      zipName: string,
      filesToZip?: string[],
      deleteOriginals = false,
    ) => globalOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts,),
    unzip: (key: string, zipName: string, deleteZip = false,) =>
      globalOpfsAPI.unzip(key, zipName, deleteZip, opts,),
    addZip: (
      key: string,
      zipName: string,
      file: File | Blob,
      fileName: string,
    ) => globalOpfsAPI.addZip(key, zipName, file, fileName, opts,),
    delZip: (key: string, zipName: string, fileName: string,) =>
      globalOpfsAPI.delZip(key, zipName, fileName, opts,),
  };
}

/**
 * Access point for Database (IndexedDB) via Web Worker Proxy.
 * Ideal for use on the browser Main Thread to prevent UI blocking.
 */
export const db: (<TDefault = unknown>(
  dbName?: string | DbStoreOptions,
  storeName?: string,
  prefix?: string,
  extraOpts?: Partial<DbStoreOptions>,
) => WorkerDbAPI<TDefault>) & WorkerDbAPI<unknown> = Object.assign(
  <TDefault = unknown>(
    dbName?: string | DbStoreOptions,
    storeName?: string,
    prefix?: string,
    extraOpts?: Partial<DbStoreOptions>,
  ): WorkerDbAPI<TDefault> =>
    createScopedDb<TDefault>(dbName, storeName, prefix, extraOpts),
  globalDbAPI,
);

/**
 * Access point for File System (OPFS) via Web Worker Proxy.
 * Ideal for use on the browser Main Thread.
 */
export const opfs: (<TDefault = unknown>(
  dbName?: string | OpfsStoreOptions,
  storeName?: string,
  prefix?: string,
  basePath?: string,
  extraOpts?: Partial<OpfsStoreOptions>,
) => WorkerOpfsAPI<TDefault>) & WorkerOpfsAPI<unknown> = Object.assign(
  <TDefault = unknown>(
    dbName?: string | OpfsStoreOptions,
    storeName?: string,
    prefix?: string,
    basePath = "",
    extraOpts?: Partial<OpfsStoreOptions>,
  ): WorkerOpfsAPI<TDefault> =>
    createScopedOpfs<TDefault>(dbName, storeName, prefix, basePath, extraOpts),
  globalOpfsAPI,
);

```

---

## Arquivo: `packages/worker-db/src/utils/id.ts`

````ts
// src/utils/id-utils.ts

/**
 * Type extending an object with an `_id` property.
 * @template T The base object type.
 */
export type WithId<T> = T & { _id: string };

/**
 * Generates a short, secure unique identifier.
 * Uses Web Crypto API if available, otherwise falls back to a mathematical generator.
 *
 * @returns {string} Generated 12-character ID (hexadecimal or base36).
 *
 * @example
 * ```ts
 * const id = gerarId();
 * console.log(id); // "a1b2c3d4e5f6"
 * ```
 */
export function gerarId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0"))
      .join("").substring(
        0,
        12,
      );
  }
  return gerarIdFallback();
}

/**
 * Fallback for ID generation if crypto.getRandomValues is unavailable.
 * Combines a base36 timestamp with a random string.
 *
 * @returns {string} Temporary ID.
 */
export function gerarIdFallback(): string {
  return Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8);
}

/**
 * Validates whether a string has an acceptable WorkerDB ID format.
 *
 * @param {string} id The ID to validate.
 * @returns {boolean} True if the ID is valid (non-empty string up to 24 characters).
 */
export function validarId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 24;
}

/**
 * Generates a prefixed unique ID.
 *
 * @param {string} prefix The prefix to prepend to the ID.
 * @returns {string} The prefixed ID.
 */
export function gerarIdComPrefixo(prefix: string): string {
  return `${prefix}${gerarId()}`;
}

/**
 * Dynamically injects the `_id` field into an object when reading from storage,
 * stripping the prefix if present.
 *
 * @param {IDBValidKey} key The raw IndexedDB/LocalStorage key.
 * @param {unknown} val The raw stored value.
 * @param {string} [prefix=""] The prefix to remove from the key.
 * @returns {unknown} The object with the injected `_id` field.
 * @internal
 */
export function formatDbItem(
  key: IDBValidKey,
  val: unknown,
  prefix = "",
): unknown {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const keyStr = String(key);
  const _id = prefix && keyStr.startsWith(prefix)
    ? keyStr.slice(prefix.length)
    : keyStr;
  return { _id, ...val };
}

/**
 * Prepares a record for storage, generating automatic keys and stripping the internal `_id`.
 *
 * @param {string | undefined | null} key Suggested key or "auto".
 * @param {unknown} val Object to be saved.
 * @param {string} [prefix=""] Prefix to apply to the final key.
 * @returns {{ key: string; cleanVal: unknown }} Object containing the final key and sanitized value.
 * @throws {Error} If no key can be determined.
 * @internal
 */
export function prepareForSave(
  key: string | undefined | null,
  val: unknown,
  prefix = "",
): { key: string; cleanVal: unknown } {
  let rawId = val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)._id as string | undefined
    : undefined;

  if (rawId === "auto") {
    rawId = gerarId();
  }

  // Intercept key provided as "auto" via direct parameter or setMany tuple
  const processKey = key === "auto" ? gerarId() : key;

  let finalKey = processKey || "";

  if (rawId) {
    if (prefix && rawId.startsWith(prefix)) {
      finalKey = rawId;
    } else {
      finalKey = prefix ? `${prefix}${rawId}` : rawId;
    }
  } else if (processKey) {
    if (prefix && processKey.startsWith(prefix)) {
      finalKey = processKey;
    } else {
      finalKey = prefix ? `${prefix}${processKey}` : processKey;
    }
  }

  if (!finalKey) {
    throw new Error(
      "A key or an '_id' attribute on the object must be provided.",
    );
  }

  if (
    val && typeof val === "object" && !Array.isArray(val) &&
    "_id" in (val as Record<string, unknown>)
  ) {
    const { _id: _, ...cleanVal } = val as Record<string, unknown>;
    return { key: finalKey, cleanVal };
  }

  return { key: finalKey, cleanVal: val };
}

````

---

## Arquivo: `packages/worker-db/src/utils/idb-keyval.ts`

```ts
/**
 * @module @workerdb/utils/idb-keyval
 * @description Lightweight IndexedDB key-value helper based on idb-keyval patterns.
 */

/**
 * Wraps an IDBRequest or IDBTransaction in a standard Promise.
 *
 * @param request The IDBRequest or IDBTransaction to convert to a Promise.
 * @returns A Promise that resolves with the request result or transaction completion.
 */
export function promisifyRequest<T = undefined>(
  request: IDBRequest<T> | IDBTransaction,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // IDBTransaction uses oncomplete, IDBRequest uses onsuccess
    // deno-lint-ignore no-explicit-any
    (request as any).oncomplete = (request as any).onsuccess = () =>
      resolve((request as IDBRequest<T>).result);
    // deno-lint-ignore no-explicit-any
    (request as any).onabort = (request as any).onerror = () =>
      reject(request.error);
  });
}

/**
 * Function type representing a store execution callback.
 */
export type UseStore = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>,
) => Promise<T>;

/**
 * Creates a custom store invoker for a given database and store name.
 *
 * @param dbName Name of the IndexedDB database.
 * @param storeName Name of the object store.
 * @returns A UseStore callback function.
 */
export function createStore(dbName: string, storeName: string): UseStore {
  let dbp: Promise<IDBDatabase> | undefined;
  const getDB = (): Promise<IDBDatabase> => {
    if (dbp) return dbp;
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    dbp = promisifyRequest(request);
    dbp.then(
      (db) => {
        db.onclose = () => {
          dbp = undefined;
        };
      },
      () => {
        dbp = undefined;
      },
    );
    return dbp;
  };
  return (txMode, callback) =>
    getDB().then((db) =>
      callback(db.transaction(storeName, txMode).objectStore(storeName))
    );
}

let defaultGetStoreFunc: UseStore | undefined;

/**
 * Returns the default store instance ('keyval-store', 'keyval').
 *
 * @returns The default UseStore function.
 */
export function defaultGetStore(): UseStore {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("keyval-store", "keyval");
  }
  return defaultGetStoreFunc;
}

/**
 * Retrieves a value by its key.
 *
 * @param key Key to query.
 * @param customStore Optional custom store callback.
 * @returns Value or undefined if not found.
 */
export function get<T = unknown>(
  key: IDBValidKey,
  customStore: UseStore = defaultGetStore(),
): Promise<T | undefined> {
  return customStore("readonly", (store) =>
    promisifyRequest<T>(store.get(key) as IDBRequest<T>)
  );
}

/**
 * Sets a value for a specific key.
 *
 * @param key Key to store against.
 * @param value Value to store.
 * @param customStore Optional custom store callback.
 */
export function set(
  key: IDBValidKey,
  value: unknown,
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Sets multiple key-value pairs at once atomically.
 *
 * @param entries Array of [key, value] pairs.
 * @param customStore Optional custom store callback.
 */
export function setMany(
  entries: [IDBValidKey, unknown][],
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    entries.forEach((entry) => store.put(entry[1], entry[0]));
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Retrieves multiple values by their keys in order.
 *
 * @param keys Array of keys to retrieve.
 * @param customStore Optional custom store callback.
 * @returns Array of retrieved values or undefined for missing keys.
 */
export function getMany<T = unknown>(
  keys: IDBValidKey[],
  customStore: UseStore = defaultGetStore(),
): Promise<(T | undefined)[]> {
  return customStore("readonly", (store) =>
    Promise.all(
      keys.map((key) => promisifyRequest<T>(store.get(key) as IDBRequest<T>)),
    )
  );
}

/**
 * Updates a value atomically using an updater callback.
 *
 * @param key Key to update.
 * @param updater Function to compute the new value from the previous value.
 * @param customStore Optional custom store callback.
 */
export function update<T = unknown>(
  key: IDBValidKey,
  updater: (oldValue: T | undefined) => T,
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore(
    "readwrite",
    (store) =>
      new Promise<void>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => {
          try {
            store.put(updater(req.result), key);
            resolve(promisifyRequest(store.transaction!));
          } catch (err) {
            reject(err);
          }
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

/**
 * Deletes a particular key from the store.
 *
 * @param key Key to delete.
 * @param customStore Optional custom store callback.
 */
export function del(
  key: IDBValidKey,
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Deletes multiple keys at once.
 *
 * @param keys Keys to delete.
 * @param customStore Optional custom store callback.
 */
export function delMany(
  keys: IDBValidKey[],
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    keys.forEach((key) => store.delete(key));
    return promisifyRequest(store.transaction!);
  });
}

/**
 * Clears all entries from the store.
 *
 * @param customStore Optional custom store callback.
 */
export function clear(
  customStore: UseStore = defaultGetStore(),
): Promise<void> {
  return customStore("readwrite", (store) => {
    store.clear();
    return promisifyRequest(store.transaction!);
  });
}

function eachCursor(
  store: IDBObjectStore,
  callback: (cursor: IDBCursorWithValue) => void,
): Promise<void> {
  store.openCursor().onsuccess = function () {
    if (!this.result) return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction!);
}

/**
 * Retrieves all keys stored in the object store.
 *
 * @param customStore Optional custom store callback.
 * @returns Array of keys.
 */
export function keys<KeyType extends IDBValidKey = IDBValidKey>(
  customStore: UseStore = defaultGetStore(),
): Promise<KeyType[]> {
  return customStore("readonly", (store) => {
    if (store.getAllKeys) {
      return promisifyRequest(
        store.getAllKeys() as unknown as IDBRequest<KeyType[]>,
      );
    }
    const items: KeyType[] = [];
    return eachCursor(store, (cursor) => items.push(cursor.key as KeyType)).then(
      () => items,
    );
  });
}

/**
 * Retrieves all values stored in the object store.
 *
 * @param customStore Optional custom store callback.
 * @returns Array of values.
 */
export function values<T = unknown>(
  customStore: UseStore = defaultGetStore(),
): Promise<T[]> {
  return customStore("readonly", (store) => {
    if (store.getAll) {
      return promisifyRequest(store.getAll() as IDBRequest<T[]>);
    }
    const items: T[] = [];
    return eachCursor(store, (cursor) => items.push(cursor.value as T)).then(
      () => items,
    );
  });
}

/**
 * Retrieves all [key, value] pairs stored in the object store.
 *
 * @param customStore Optional custom store callback.
 * @returns Array of [key, value] entries.
 */
export function entries<
  KeyType extends IDBValidKey = IDBValidKey,
  ValueType = unknown,
>(
  customStore: UseStore = defaultGetStore(),
): Promise<[KeyType, ValueType][]> {
  return customStore("readonly", (store) => {
    if (store.getAll && store.getAllKeys) {
      return Promise.all([
        promisifyRequest(
          store.getAllKeys() as unknown as IDBRequest<KeyType[]>,
        ),
        promisifyRequest(store.getAll() as IDBRequest<ValueType[]>),
      ]).then(([keysList, valuesList]) =>
        keysList.map((key, i) => [key, valuesList[i]] as [KeyType, ValueType])
      );
    }
    const items: [KeyType, ValueType][] = [];
    return eachCursor(store, (cursor) =>
      items.push([cursor.key as KeyType, cursor.value as ValueType])
    ).then(() => items);
  });
}

```

---

## Arquivo: `packages/worker-db/src/utils/opfs.ts`

```ts
// src/utils/opfs.ts

/**
 * Options for resolving OPFS file names.
 */
export interface OpfsResolveOptions {
  dbName?: string;
  storeName?: string;
  prefix?: string;
}

/**
 * Resolves a normalized OPFS file name based on storage type, names, and prefix.
 */
export function resolveOpfsFileName(
  type: "db" | "ls",
  fileName: string,
  opts?: OpfsResolveOptions,
): string {
  const parts: string[] = [type];
  if (type === "db") {
    if (opts?.dbName) parts.push(opts.dbName);
    if (opts?.storeName) parts.push(opts.storeName);
  }
  if (opts?.prefix) parts.push(opts.prefix);

  parts.push(fileName);
  return parts.join("_");
}

async function getOpfsRootDir(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}

// Navigates and creates (if needed) the full path based on slash-delimited strings from OPFS root
async function resolvePath(filePath: string, create = false) {
  const rootDir = await getOpfsRootDir();
  const parts = filePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  let curr = rootDir;
  for (const p of parts) {
    curr = await curr.getDirectoryHandle(p, { create });
  }
  return { dir: curr, fileName };
}

/**
 * Writes JSON data to an OPFS file path.
 *
 * @param filePath Relative path from OPFS root.
 * @param data JSON-serializable data.
 * @returns The resolved file path.
 */
export async function writeJsonToOpfs(
  filePath: string,
  data: unknown,
): Promise<string> {
  const { dir, fileName } = await resolvePath(filePath, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data));
  await writable.close();
  return filePath;
}

/**
 * Writes a ReadableStream of bytes to an OPFS file path.
 *
 * @param filePath Relative path from OPFS root.
 * @param stream Readable byte stream.
 * @returns The resolved file path.
 */
export async function writeStreamToOpfs(
  filePath: string,
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const { dir, fileName } = await resolvePath(filePath, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        await writable.write(value as unknown as BufferSource);
      }
    }
  } finally {
    reader.releaseLock();
  }
  await writable.close();
  return filePath;
}

/**
 * Reads and parses JSON data from an OPFS file.
 *
 * @param filePath Relative path from OPFS root.
 * @returns Parsed JSON content.
 */
export async function readJsonFromOpfs(filePath: string): Promise<unknown> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Deletes a file from OPFS.
 *
 * @param filePath Relative path from OPFS root.
 */
export async function deleteFromOpfs(filePath: string): Promise<void> {
  const { dir, fileName } = await resolvePath(filePath, false);
  await dir.removeEntry(fileName);
}

/**
 * Gets a File handle from an OPFS file path.
 *
 * @param filePath Relative path from OPFS root.
 * @returns The File object.
 */
export async function getFileFromOpfs(filePath: string): Promise<File> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  return await fileHandle.getFile();
}

/**
 * Gets a byte ReadableStream from an OPFS file.
 *
 * @param filePath Relative path from OPFS root.
 * @returns A byte ReadableStream.
 */
export async function getFileStreamFromOpfs(
  filePath: string,
): Promise<ReadableStream<Uint8Array>> {
  const { dir, fileName } = await resolvePath(filePath, false);
  const fileHandle = await dir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.stream();
}

/**
 * Recursively lists files preserving relative paths (e.g., "backup/MY_KEY/backup.json" or "demo/FS_test-file/hello.txt").
 *
 * @param dirHandle Optional directory handle to start listing from (defaults to OPFS root).
 * @param path Current relative path prefix.
 * @returns Array of relative file paths.
 */
export async function listOpfsFiles(
  dirHandle?: FileSystemDirectoryHandle,
  path = "",
): Promise<string[]> {
  const dir = dirHandle || await getOpfsRootDir();
  let files: string[] = [];
  // @ts-ignore: async iterator support
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file") {
      files.push(path ? `${path}/${name}` : name);
    } else if (handle.kind === "directory") {
      const subFiles = await listOpfsFiles(
        handle,
        path ? `${path}/${name}` : name,
      );
      files = files.concat(subFiles);
    }
  }
  return files;
}

/**
 * Triggers a browser download for an OPFS file.
 */
export async function downloadOpfsFile(fileName: string): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error(
      "downloadOpfsFile can only be executed on the Main Thread (where 'document' is defined).",
    );
  }
  const file = await getFileFromOpfs(fileName);
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.split("/").pop()!; // Download always uses only the final file name
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

```

---

## Arquivo: `packages/worker-db/src/utils/version.ts`

```ts
// Automatically generated file during build
declare const __APP_VERSION__: string;

/** Current library/application version. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined"
  ? __APP_VERSION__
  : "";

```

---

## Arquivo: `packages/worker-db/src/worker.ts`

```ts
/**
 * @module @vanaware/workerdb/worker
 * @description Dedicated Web Worker script and RPC request router for WorkerDB.
 * Handles background IndexedDB queries, validations, OPFS file storage, and data streaming.
 */

import { internalAPI } from "./db.ts";
import type { DbStoreOptions, OpfsStoreOptions } from "./db.ts";

import { APP_VERSION } from "./utils/version.ts";

console.log(`[DB] 🌌 Worker-db loaded (v${APP_VERSION}).`);

/**
 * Main RPC message handler for WorkerDB.
 * Can be integrated into an existing Web Worker or executed directly.
 */
export async function handleWorkerMessage(e: MessageEvent): Promise<void> {
  if (
    !e.data ||
    typeof e.data !== "object" ||
    !("requestId" in e.data) ||
    !("command" in e.data)
  ) {
    return;
  }

  const { requestId, command, args = {}, } = e.data;

  try {
    const dbOpts: DbStoreOptions = {
      dbName: args.dbName,
      storeName: args.storeName,
      prefix: args.prefix,
      indexes: args.indexes,
      dbVersion: args.dbVersion,
      validatorStr: args.validatorStr,
    };

    const opfsOpts: OpfsStoreOptions = {
      ...dbOpts,
      basePath: args.basePath,
    };

    let result;

    switch (command) {
      case "VERSION":
        result = { version: APP_VERSION, };
        break;
      case "GET":
        result = await internalAPI.get(args.key, dbOpts,);
        break;
      case "SET":
        if (args.key !== undefined) {
          result = await internalAPI.set(args.key, args.val, dbOpts,);
        } else {
          result = await internalAPI.set(args.val, dbOpts,);
        }
        break;
      case "DELETE":
        result = await internalAPI.delete(args.key, dbOpts,);
        break;
      case "GET_MANY":
        result = await internalAPI.getMany(args.keys, dbOpts,);
        break;
      case "SET_MANY":
        result = await internalAPI.setMany(args.entries, dbOpts,);
        break;
      case "DEL_MANY":
        result = await internalAPI.deleteMany(args.keys, dbOpts,);
        break;
      case "KEYS":
        result = await internalAPI.keys(dbOpts,);
        break;
      case "VALUES":
        result = await internalAPI.values(dbOpts,);
        break;
      case "ENTRIES":
        result = await internalAPI.entries(dbOpts,);
        break;
      case "CLEAR":
        result = await internalAPI.clear(dbOpts,);
        break;
      case "PATCH": {
        let patchOrFn;
        if (args.fnStr) {
          patchOrFn = new Function(
            "prev",
            "ctx",
            `return (${args.fnStr})(prev, ctx);`,
          ) as unknown;
        } else {
          patchOrFn = args.patch;
        }
        result = await internalAPI.patch(
          args.key,
          patchOrFn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "QUERY": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.query(fn, args.context, dbOpts,);
        break;
      }
      case "GET_SOME": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.getSome(fn, args.context, dbOpts,);
        break;
      }
      case "DEL_SOME": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.delSome(fn, args.context, dbOpts,);
        break;
      }
      case "SET_SOME": {
        const selectFn = new Function(
          "items",
          "ctx",
          `return (${args.selectFnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        const updateFn = new Function(
          "item",
          "ctx",
          `return (${args.updateFnStr})(item, ctx);`,
        ) as (item: { _id: string }, ctx?: unknown,) => { _id: string };
        result = await internalAPI.setSome(
          selectFn,
          updateFn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "EXPORT":
        result = await internalAPI.exportDB(dbOpts,);
        break;
      case "IMPORT":
        result = await internalAPI.importDB(
          args.data,
          args.clearFirst,
          dbOpts,
        );
        break;
      case "BACKUP_OPFS":
        result = await internalAPI.backupToOpfs(
          args.key,
          args.fileName,
          dbOpts,
        );
        break;
      case "RESTORE_OPFS":
        result = await internalAPI.restoreFromOpfs(
          args.key,
          args.fileName,
          args.clearFirst,
          dbOpts,
        );
        break;

      // ==== OPFS EXTENSION ====
      case "OPFS_LIST":
        result = await internalAPI.listFiles(args.key, opfsOpts,);
        break;
      case "OPFS_GET":
        result = await internalAPI.getFile(args.key, args.fileName, opfsOpts,);
        break;
      case "OPFS_ADD":
        result = await internalAPI.addFile(
          args.key,
          args.file,
          args.fileName,
          opfsOpts,
        );
        break;
      case "OPFS_DEL":
        result = await internalAPI.delFile(args.key, args.fileName, opfsOpts,);
        break;
      case "OPFS_REN":
        result = await internalAPI.renFile(
          args.key,
          args.oldName,
          args.newName,
          opfsOpts,
        );
        break;
      case "OPFS_MV":
        result = await internalAPI.mvFile(
          args.key,
          args.fileName,
          args.newKey,
          opfsOpts,
        );
        break;
      case "OPFS_ZIP":
        result = await internalAPI.zip(
          args.key,
          args.zipName,
          args.filesToZip,
          args.deleteOriginals,
          opfsOpts,
        );
        break;
      case "OPFS_UNZIP":
        result = await internalAPI.unzip(
          args.key,
          args.zipName,
          args.deleteZip,
          opfsOpts,
        );
        break;
      case "OPFS_ADDZIP":
        result = await internalAPI.addZip(
          args.key,
          args.zipName,
          args.file,
          args.fileName,
          opfsOpts,
        );
        break;
      case "OPFS_DELZIP":
        result = await internalAPI.delZip(
          args.key,
          args.zipName,
          args.fileName,
          opfsOpts,
        );
        break;
      case "GET_BY_INDEX":
        result = await internalAPI.getByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "COUNT_BY_INDEX":
        result = await internalAPI.countByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "GET_ONE_BY_INDEX":
        result = await internalAPI.getOneByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "KEYS_BY_INDEX":
        result = await internalAPI.keysByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "PATCH_BY_INDEX":
        result = await internalAPI.patchByIndex(
          args.indexName,
          args.query,
          args.patch,
          dbOpts,
        );
        break;
      case "GET_BY_INDEX_PAGINATED":
        result = await internalAPI.getByIndexPaginated(
          args.indexName,
          args.query,
          args.paginationOpts,
          dbOpts,
        );
        break;
      case "GET_MANY_BY_INDEX":
        result = await internalAPI.getManyByIndex(
          args.indexName,
          args.queries,
          dbOpts,
        );
        break;
      case "GET_SOME_BY_INDEX": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.getSomeByIndex(
          args.indexName,
          args.query,
          fn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "QUERY_BY_INDEX": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => unknown;
        result = await internalAPI.queryByIndex(
          args.indexName,
          args.query,
          fn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "DELETE_BY_INDEX":
        result = await internalAPI.deleteByIndex(
          args.indexName,
          args.query,
          dbOpts,
        );
        break;
      case "DELETE_MANY_BY_INDEX":
        result = await internalAPI.deleteManyByIndex(
          args.indexName,
          args.queries,
          dbOpts,
        );
        break;
      case "DEL_SOME_BY_INDEX": {
        const fn = new Function(
          "items",
          "ctx",
          `return (${args.fnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        result = await internalAPI.delSomeByIndex(
          args.indexName,
          args.query,
          fn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "SET_SOME_BY_INDEX": {
        const selectFn = new Function(
          "items",
          "ctx",
          `return (${args.selectFnStr})(items, ctx);`,
        ) as (items: { _id: string }[], ctx?: unknown,) => { _id: string }[];
        const updateFn = new Function(
          "item",
          "ctx",
          `return (${args.updateFnStr})(item, ctx);`,
        ) as (item: { _id: string }, ctx?: unknown,) => { _id: string };
        result = await internalAPI.setSomeByIndex(
          args.indexName,
          args.query,
          selectFn,
          updateFn,
          args.context,
          dbOpts,
        );
        break;
      }
      case "OPFS_ADD_STREAM":
        result = await internalAPI.addFileStream(
          args.key,
          args.stream,
          args.fileName,
          opfsOpts,
        );
        break;
      case "OPFS_GET_STREAM": {
        const stream = await internalAPI.getFileStream(
          args.key,
          args.fileName,
          opfsOpts,
        );
        (self as unknown as {
          postMessage: (message: unknown, transfer?: Transferable[],) => void;
        }).postMessage(
          { requestId, success: true, result: stream, },
          [stream as unknown as Transferable,],
        );
        return;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    self.postMessage({ requestId, success: true, result });
  } catch (error) {
    self.postMessage({
      requestId,
      success: false,
      error: (error as Error).message,
    });
  }
}

// Auto-register listener if running directly in a Web Worker context
if (
  typeof self !== "undefined" &&
  typeof (self as unknown as { postMessage?: unknown }).postMessage === "function" &&
  typeof (self as unknown as { document?: unknown }).document === "undefined"
) {
  self.addEventListener("message", (e: Event) => {
    handleWorkerMessage(e as MessageEvent);
  });
}


```

---

## Arquivo: `packages/worker-db/tests/db_advanced_test.ts`

```ts
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

interface Fatura {
  tag: string;
  amount: number;
  status: string;
  code: string;
}

interface Funcionario {
  _id: string;
  name: string;
  department: string;
  level: number | string;
  active: boolean;
}

Deno.test({
  name: "DB Advanced - Execução de Métodos de Array no Worker (query, getSome)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("FINANCAS", "faturas", "FAT_",);
    await store.clear();

    await store.importDB({
      FAT_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      FAT_f2: { tag: "personal", amount: 300, status: "pending", code: "y", },
      FAT_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      FAT_f4: { tag: "home", amount: 80, status: "pending", code: "w", },
      FAT_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Valida execução de funções avançadas dentro do Worker de Banco de Dados
    const result = await store.query((items: Fatura[],) => {
      return {
        count: items.length, // length
        total: items.reduce((acc: number, i: Fatura,) => acc + i.amount, 0,), // reduce
        firstWork: items.find((i: Fatura,) => i.tag === "work"), // find
        lastWork: items.findLast((i: Fatura,) => i.tag === "work"), // findLast
        lastItem: items.at(-1,), // at
        hasPending: items.some((i: Fatura,) => i.status === "pending"), // some
        allPositive: items.every((i: Fatura,) => i.amount > 0), // every
        tagsHaveHome: items.map((i: Fatura,) => i.tag).includes("home",), // map e includes
        idxPersonal: items.findIndex((i: Fatura,) => i.tag === "personal"), // findIndex
        lastIdxWork: items.findLastIndex((i: Fatura,) => i.tag === "work"), // findLastIndex
        indexOfZ: items.map((i: Fatura,) => i.code).indexOf("z",), // indexOf
        paidItems: items.filter((i: Fatura,) => i.status === "paid"), // filter
        sliced: items.slice(1, 4,), // slice
        sortedByAmount: items.toSorted((a: Fatura, b: Fatura,) =>
          a.amount - b.amount
        ), // toSorted
        reversed: items.toReversed(), // toReversed
        spliced: items.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Fatura).amount, 150,);
    assertEquals((result.lastWork as Fatura).amount, 200,);
    assertEquals((result.lastItem as Fatura).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals((result.sortedByAmount[0] as Fatura).amount, 80,);
    assertEquals((result.reversed[0] as Fatura).code, "k",);
    assertEquals(result.spliced.length, 3,);
  },
},);

Deno.test({
  name:
    "DB Advanced - Erros em tempo de execução no Worker (Retornos Inválidos)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("ERROS_WORKER", "testes", "ERR_",);
    await store.clear();
    await store.set("1", { valid: true, },);

    // AssertRejects captures throw Exceptions dispatched in worker switch(command)
    await assertRejects(
      async () =>
        await store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "The injected function in GET_SOME must return an Array.",
    );

    await assertRejects(
      async () =>
        await store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "The injected function in DEL_SOME must return an Array.",
    );

    await assertRejects(
      async () =>
        await store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "The selector function in SET_SOME must return an Array.",
    );
  },
},);

Deno.test({
  name:
    "DB Advanced - Transformações de Tipo, UPPERCASE e Exclusão Segura no Worker",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("EMPRESA", "funcionarios", "EMP_",);
    await store.clear();

    await store.importDB({
      EMP_e10: {
        name: "joão silva",
        department: "tecnologia",
        level: 2,
        active: true,
      },
      EMP_e20: {
        name: "maria souza",
        department: "rh",
        level: 3,
        active: true,
      },
      EMP_e30: {
        name: "pedro alves",
        department: "vendas",
        level: 1,
        active: false,
      },
    },);

    // Atualiza nome para UPPERCASE e converte 'level' (number) para string
    await store.setSome(
      (items: Funcionario[],) =>
        items.filter((item: Funcionario,) =>
          item.active === true
        ) as Funcionario[],
      (item: Funcionario,) => ({
        ...item,
        name: item.name.toUpperCase(),
        department: item.department.toUpperCase(),
        level: String(item.level,), // Mutação de tipo!
      }),
    );

    const e10 = await store.get<Funcionario>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECNOLOGIA",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = await store.get<Funcionario>("e30",);
    assertEquals(e30?.department, "vendas",); // Permanece em lowercase
    assertEquals(typeof e30?.level, "number",); // Permanece tipo número

    // Exclui funcionários inativos via delSome
    await store.delSome((items: Funcionario[],) =>
      items.filter((i: Funcionario,) => i.active === false)
    );

    // Checa deleção correta
    assertEquals(await store.get("e30",), undefined,);
    const remainingKeys = await store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Assegura integridade dos que ficaram
    const remaining = await store.values<Funcionario>();
    assertNotEquals(remaining[0]?.name, "pedro alves",);
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/db_opfs_extension_test.ts`

```ts
import { assert, assertEquals, } from "@std/assert";
import { opfs, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

const drive = opfs("P2P_DRIVE", "files", "FL_", "meus_compartilhamentos",);

Deno.test({
  name: "OPFS Ext - Manipulação Básica de Arquivos e Metadados",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderKey = await drive.set("auto", {
      owner: "Satoshi",
      permissions: "read-only",
      seeders: 5,
    },);

    const encoder = new TextEncoder();
    const file1 = new Blob([encoder.encode("WorkerDB PWA Rocks!",),], {
      type: "text/plain",
    },);
    const file2 = new Blob([encoder.encode("Offline First",),], {
      type: "text/plain",
    },);

    await drive.addFile(folderKey, file1, "doc1.txt",);
    await drive.addFile(folderKey, file2, "doc2.txt",);

    let files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 2,);
    assert(files.some((f,) => f.name === "doc1.txt"),);

    await drive.renFile(folderKey, "doc1.txt", "doc_renomeado.txt",);
    await drive.delFile(folderKey, "doc2.txt",);

    files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "doc_renomeado.txt",);
  },
},);

Deno.test({
  name: "OPFS Ext - Compressão e Descompressão ZIP (fflate)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderKey = await drive.set("auto", {
      description: "Album de Fotos",
    },);

    const img1 = new Blob([new Uint8Array([255, 0, 150,],),],);
    const img2 = new Blob([new Uint8Array([10, 20, 30,],),],);

    await drive.addFile(folderKey, img1, "foto1.png",);
    await drive.addFile(folderKey, img2, "foto2.png",);

    await drive.zip(folderKey, "album.zip", undefined, true,);

    let files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "album.zip",);

    const img3 = new Blob([new Uint8Array([99, 99,],),],);
    await drive.addZip(folderKey, "album.zip", img3, "foto3.png",);

    await drive.delZip(folderKey, "album.zip", "foto1.png",);

    await drive.unzip(folderKey, "album.zip", true,);

    files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 2,);
    assert(files.some((f,) => f.name === "foto2.png"),);
    assert(files.some((f,) => f.name === "foto3.png"),);
  },
},);

Deno.test({
  name: "OPFS Ext - Movendo arquivos entre registros (Pastas)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderA = await drive.set("auto", { type: "inbox", },);
    const folderB = await drive.set("auto", { type: "archive", },);

    await drive.addFile(folderA, new Blob(["Move me",],), "target.txt",);
    await drive.mvFile(folderA, "target.txt", folderB,);

    const filesA = await drive.listFiles(folderA,);
    const filesB = await drive.listFiles(folderB,);

    assertEquals(filesA.length, 0,);
    assertEquals(filesB.length, 1,);
    assertEquals(filesB[0]?.name, "target.txt",);
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/db_phase1_features_test.ts`

```ts
import { assert, assertEquals, assertRejects, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { db, opfs, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

describe("WorkerDB Phase 1 - Schema Validation", () => {
  interface UserProfile {
    _id?: string;
    username: string;
    age: number;
  }

  const validatedDb = db<UserProfile>({
    dbName: "VALIDATION_DB",
    storeName: "users",
    prefix: "USR_",
    validator: (item: unknown,) => {
      if (!item || typeof item !== "object") return false;
      const u = item as Record<string, unknown>;
      return typeof u.username === "string" && typeof u.age === "number" &&
        u.age >= 18;
    },
  },);

  it("permite inserir registro que passa na validação", async () => {
    await validatedDb.clear();
    const id = await validatedDb.set("u1", {
      username: "Alice",
      age: 25,
    },);
    assertEquals(id, "USR_u1",);
    const item = await validatedDb.get("u1",);
    assertEquals(item?.username, "Alice",);
    assertEquals(item?.age, 25,);
  });

  it("rejeita inserção de registro inválido pelo validador", async () => {
    await assertRejects(
      async () => {
        await validatedDb.set("u2", {
          username: "Bob",
          age: 16, // inválido (< 18)
        },);
      },
      Error,
      "Validation failed",
    );
  });

  it("rejeita patch que torna o registro inválido", async () => {
    await assertRejects(
      async () => {
        await validatedDb.patch("u1", { age: 10, },);
      },
      Error,
      "Validation failed",
    );
  });
});

describe("WorkerDB Phase 1 - Indexed Queries (getByIndex)", () => {
  interface Product {
    _id?: string;
    title: string;
    category: string;
    price: number;
  }

  const productStore = db<Product>({
    dbName: "CATALOG_DB",
    storeName: "products",
    indexes: ["category",],
  },);

  it("recupera registros filtrando pelo índice", async () => {
    await productStore.clear();
    await productStore.set("p1", {
      title: "Laptop",
      category: "electronics",
      price: 1200,
    },);
    await productStore.set("p2", {
      title: "Teclado",
      category: "electronics",
      price: 100,
    },);
    await productStore.set("p3", {
      title: "Cadeira",
      category: "furniture",
      price: 300,
    },);

    const electronics = await productStore.getByIndex<Product>(
      "category",
      "electronics",
    );
    assertEquals(electronics.length, 2,);
    assert(electronics.some((p,) => p.title === "Laptop"),);
    assert(electronics.some((p,) => p.title === "Teclado"),);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 1,);
    assertEquals(furniture[0]?.title, "Cadeira",);
  });

  it("recupera múltiplos valores de índice em lote com getManyByIndex", async () => {
    await productStore.set("p4", {
      title: "Livro",
      category: "books",
      price: 50,
    },);

    const multi = await productStore.getManyByIndex<Product>(
      "category",
      ["electronics", "books",],
    );
    assertEquals(multi.length, 3,);
    assert(multi.some((p,) => p.title === "Laptop"),);
    assert(multi.some((p,) => p.title === "Teclado"),);
    assert(multi.some((p,) => p.title === "Livro"),);
  });

  it("filtra subconjunto indexado com getSomeByIndex sem escanear o banco inteiro", async () => {
    // Filtra eletrônicos com preço > 500
    const expensiveElectronics = await productStore.getSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price > 500),
    );
    assertEquals(expensiveElectronics.length, 1,);
    assertEquals(expensiveElectronics[0]?.title, "Laptop",);
  });

  it("calcula agregações sobre o subconjunto indexado com queryByIndex", async () => {
    // Calcula o total gasto em eletrônicos
    const totalElectronicsPrice = await productStore.queryByIndex<
      Product,
      number
    >(
      "category",
      "electronics",
      (items,) => items.reduce((acc, p,) => acc + p.price, 0,),
    );
    assertEquals(totalElectronicsPrice, 1300,);
  });

  it("atualiza apenas registros do índice selecionados com setSomeByIndex", async () => {
    // Aplica desconto de 10% apenas em eletrônicos com preço >= 1000
    await productStore.setSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price >= 1000),
      (item,) => ({ ...item, price: item.price * 0.9, }),
    );

    const laptop = await productStore.get<Product>("p1",);
    assertEquals(laptop?.price, 1080,);

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard?.price, 100,); // Não foi alterado
  });

  it("remove itens selecionados do subconjunto indexado com delSomeByIndex", async () => {
    // Deleta eletrônicos com preço <= 150
    await productStore.delSomeByIndex<Product>(
      "category",
      "electronics",
      (items,) => items.filter((p,) => p.price <= 150),
    );

    const keyboard = await productStore.get<Product>("p2",);
    assertEquals(keyboard, undefined,);

    const laptop = await productStore.get<Product>("p1",);
    assert(laptop !== undefined,);
  });

  it("remove todos os registros de um valor de índice com deleteByIndex", async () => {
    await productStore.deleteByIndex("category", "furniture",);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);

    const cadeira = await productStore.get<Product>("p3",);
    assertEquals(cadeira, undefined,);
  });

  it("remove múltiplos grupos de índice com deleteManyByIndex", async () => {
    await productStore.set("p5", {
      title: "Mesa",
      category: "furniture",
      price: 400,
    },);
    await productStore.set("p6", {
      title: "Revista",
      category: "books",
      price: 15,
    },);

    await productStore.deleteManyByIndex("category", ["furniture", "books",],);

    const books = await productStore.getByIndex<Product>("category", "books",);
    assertEquals(books.length, 0,);

    const furniture = await productStore.getByIndex<Product>(
      "category",
      "furniture",
    );
    assertEquals(furniture.length, 0,);
  });
});

describe("WorkerDB Phase 1 - OPFS Streams (addFileStream & getFileStream)", () => {
  const streamDrive = opfs({
    dbName: "STREAM_DRIVE",
    storeName: "media",
    prefix: "MED_",
  },);

  it("grava e lê arquivo via ReadableStream", async () => {
    FakeOPFSDirectory.clear();
    await streamDrive.clear();

    const recordKey = await streamDrive.set("auto", {
      title: "Video Stream",
    },);

    const chunk1 = new Uint8Array([1, 2, 3, 4, 5,],);
    const chunk2 = new Uint8Array([6, 7, 8, 9, 10,],);

    const inputStream = new ReadableStream<Uint8Array>({
      start(controller,) {
        controller.enqueue(chunk1,);
        controller.enqueue(chunk2,);
        controller.close();
      },
    },);

    await streamDrive.addFileStream(recordKey, "data.bin", inputStream,);

    const files = await streamDrive.listFiles(recordKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "data.bin",);

    const outputStream = await streamDrive.getFileStream(
      recordKey,
      "data.bin",
    );
    assert(outputStream instanceof ReadableStream,);

    const reader = outputStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value, } = await reader.read();
      if (done) break;
      if (value) chunks.push(value,);
    }

    const totalLength = chunks.reduce((acc, c,) => acc + c.length, 0,);
    const combined = new Uint8Array(totalLength,);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset,);
      offset += c.length;
    }

    assertEquals(combined, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10,],),);
  });
});

```

---

## Arquivo: `packages/worker-db/tests/db_simple_test.ts`

```ts
import { assert, assertEquals, assertNotEquals, } from "@std/assert";

import { db, } from "../src/fake/fake-mod.ts";

Deno.test({
  name: "DB Simple - Tratamento de _id ('auto', '0990', com prefixo)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Utilizando um nome de banco isolado para o teste para evitar choque de instâncias no IndexedDB fake
    const store = db("LOJA_TEST_1", "clientes", "CLI_",);
    await store.clear();

    // 1. _id: "auto"
    const keyAuto = await store.set({ _id: "auto", name: "Alice", level: 1, },);
    assert(keyAuto.startsWith("CLI_",),);
    const itemAuto = await store.get<unknown>(keyAuto,) as Record<
      string,
      unknown
    >;
    assert(itemAuto !== undefined,);
    assertNotEquals(itemAuto?._id, "auto",);
    assertEquals(itemAuto?.name, "Alice",);

    // 2. _id: "0990"
    const key0990 = await store.set({ _id: "0990", name: "Bob", level: 2, },);
    assertEquals(key0990, "CLI_0990",);
    const item0990 = await store.get<unknown>("0990",) as Record<
      string,
      unknown
    >;
    assertEquals(item0990?._id, "0990",);
    assertEquals(item0990?.name, "Bob",);

    // 3. _id: "CLI_0990" (com prefixo pré-existente)
    const keyPref = await store.set({
      _id: "CLI_0990",
      name: "Bob Atualizado",
      level: 3,
    },);
    assertEquals(keyPref, "CLI_0990",);
    const itemPref = await store.get<unknown>("0990",) as Record<
      string,
      unknown
    >;
    assertEquals(itemPref?.name, "Bob Atualizado",);
  },
},);

Deno.test({
  name: "DB Simple - CRUD, Patch e Métodos de Coleção",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Isolando o banco para não colidir com o teste anterior
    const store = db("LOJA_TEST_2", "produtos", "PROD_",);
    await store.clear();

    await store.set("p1", { name: "Notebook", price: 3000, },);
    const p1 = await store.get<unknown>("p1",) as Record<string, unknown>;
    assertEquals(p1?.name, "Notebook",);

    const patched = await store.patch<Record<string, unknown>>("p1", {
      price: 3200,
    },);
    assertEquals((patched as Record<string, unknown>).price, 3200,);

    await store.setMany([
      ["p2", { name: "Mouse", price: 80, },],
      ["p3", { name: "Teclado", price: 200, },],
    ],);

    const items = await store.getMany<unknown>(["p1", "p2", "p3",],);
    assertEquals(items.length, 3,);

    const keys = await store.keys();
    assert(keys.includes("PROD_p1",),);

    await store.delete("p1",);
    assertEquals(await store.get("p1",), undefined,);

    await store.deleteMany(["p2", "p3",],);
    assertEquals((await store.keys()).length, 0,);
  },
},);

Deno.test({
  name: "DB Simple - ImportDB e ExportDB com Respeito ao Escopo/Prefixo",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Isolando o banco de dados
    const store = db("LOJA_TEST_3", "estoque", "EST_",);
    await store.clear();

    const mockData = {
      EST_e1: { item: "Parafuso", qty: 100, },
      EST_e2: { item: "Porca", qty: 200, },
    };

    await store.importDB(mockData, true,);

    const exported = await store.exportDB();
    assertEquals(exported, mockData,);

    const values = await store.values<unknown>();
    assertEquals(values.length, 2,);
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/id-utils.test.ts`

```ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import { gerarId, gerarIdFallback, validarId, } from "../src/utils/id.ts";

Deno.test("gerarId - Deve gerar um ID no formato string e com tamanho adequado", () => {
  const id = gerarId();
  assert(typeof id === "string", "O ID gerado deve ser uma string",);
  assert(
    id.length > 0 && id.length <= 24,
    "O tamanho do ID deve estar entre 1 e 24 caracteres",
  );
});

Deno.test("gerarId - Não deve gerar IDs duplicados em chamadas sequenciais", () => {
  const id1 = gerarId();
  const id2 = gerarId();
  assertNotEquals(
    id1,
    id2,
    "IDs gerados sequencialmente não podem ser idênticos",
  );
});

Deno.test("gerarIdFallback - Deve funcionar como alternativa segura", () => {
  const idFallback = gerarIdFallback();
  assert(
    typeof idFallback === "string",
    "O ID de fallback deve ser uma string",
  );
  assert(idFallback.length > 0, "O ID de fallback não pode ser vazio",);
});

Deno.test("validarId - Deve validar corretamente limites de tamanho", () => {
  const idValido = gerarId();
  const idInvalidoLongo = "a".repeat(25,);
  const idInvalidoVazio = "";
  assertEquals(
    validarId(idValido,),
    true,
    "Deve aceitar um ID gerado pela própria função",
  );
  assertEquals(
    validarId(idInvalidoLongo,),
    false,
    "Não deve aceitar IDs maiores que 24 caracteres",
  );
  assertEquals(
    validarId(idInvalidoVazio,),
    false,
    "Não deve aceitar IDs vazios",
  );
});

```

---

## Arquivo: `packages/worker-db/tests/idb-keyval.test.ts`

```ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  clear,
  createStore,
  del,
  delMany,
  entries,
  get,
  getMany,
  keys,
  promisifyRequest,
  set,
  setMany,
  update,
  values,
} from "../src/utils/idb-keyval.ts";

describe("Internal idb-keyval module", () => {
  it("should set and get values with a custom store", async () => {
    const store = createStore("test-db-1", "test-store-1",);
    await set("hello", "world", store,);
    const result = await get<string>("hello", store,);
    assertEquals(result, "world",);
  });

  it("should return undefined for non-existent key", async () => {
    const store = createStore("test-db-nonexistent", "test-store",);
    const result = await get("missing", store,);
    assertEquals(result, undefined,);
  });

  it("should handle setMany and getMany", async () => {
    const store = createStore("test-db-many", "test-store-many",);
    await setMany([["a", 1,], ["b", 2,], ["c", 3,],], store,);

    const res = await getMany(["a", "b", "c", "d",], store,);
    assertEquals(res, [1, 2, 3, undefined,],);
  });

  it("should atomically update a value", async () => {
    const store = createStore("test-db-update", "test-store-update",);
    await set("count", 10, store,);
    await update<number>("count", (old,) => (old ?? 0) + 5, store,);

    const val = await get<number>("count", store,);
    assertEquals(val, 15,);
  });

  it("should update a missing value gracefully", async () => {
    const store = createStore("test-db-update-missing", "test-store-update",);
    await update<number>("counter", (old,) => (old ?? 0) + 1, store,);

    const val = await get<number>("counter", store,);
    assertEquals(val, 1,);
  });

  it("should delete a key using del", async () => {
    const store = createStore("test-db-del", "test-store-del",);
    await set("temp", "value", store,);
    assertEquals(await get("temp", store,), "value",);

    await del("temp", store,);
    assertEquals(await get("temp", store,), undefined,);
  });

  it("should delete multiple keys with delMany", async () => {
    const store = createStore("test-db-delmany", "test-store-delmany",);
    await setMany([["k1", 1,], ["k2", 2,], ["k3", 3,],], store,);

    await delMany(["k1", "k2",], store,);
    assertEquals(await get("k1", store,), undefined,);
    assertEquals(await get("k2", store,), undefined,);
    assertEquals(await get<number>("k3", store,), 3,);
  });

  it("should list keys, values, and entries", async () => {
    const store = createStore("test-db-iter", "test-store-iter",);
    await set("x", 100, store,);
    await set("y", 200, store,);

    const k = await keys(store,);
    assertEquals(k.sort(), ["x", "y",],);

    const v = await values<number>(store,);
    assertEquals(v.sort(), [100, 200,],);

    const e = await entries(store,);
    assertEquals(
      e.sort((a, b,) => String(a[0],).localeCompare(String(b[0],),)),
      [["x", 100,], ["y", 200,],],
    );
  });

  it("should clear the store", async () => {
    const store = createStore("test-db-clear", "test-store-clear",);
    await setMany([["x", 1,], ["y", 2,],], store,);
    await clear(store,);

    const allKeys = await keys(store,);
    assertEquals(allKeys.length, 0,);
  });

  it("promisifyRequest resolves correctly for standard request", async () => {
    const openReq = indexedDB.open("test-promisify", 1,);
    const db = await promisifyRequest<IDBDatabase>(openReq,);
    assertEquals(typeof db.name, "string",);
    db.close();
  });
});

```

---

## Arquivo: `packages/worker-db/tests/ls_advanced_test.ts`

```ts
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "@std/assert";
import { ls, } from "../src/fake/fake-mod.ts";
import { type WithId, } from "../src/utils/id.ts";

Deno.test({
  name:
    "LS Advanced - Execução de Métodos Modernos de Array JS (query, getSome)",
  fn() {
    const store = ls("LS_FINANCAS_",);
    store.clear();

    store.importLS({
      LS_FINANCAS_f1: { tag: "work", amount: 150, status: "paid", code: "x", },
      LS_FINANCAS_f2: {
        tag: "personal",
        amount: 300,
        status: "pending",
        code: "y",
      },
      LS_FINANCAS_f3: { tag: "work", amount: 500, status: "paid", code: "z", },
      LS_FINANCAS_f4: {
        tag: "home",
        amount: 80,
        status: "pending",
        code: "w",
      },
      LS_FINANCAS_f5: { tag: "work", amount: 200, status: "paid", code: "k", },
    },);

    // Valida execução de funções avançadas síncronas de Array
    const result = store.query((items,) => {
      const data = items as Record<string, unknown>[];
      return {
        count: data.length, // length
        total: data.reduce((acc, i,) => acc + (i.amount as number), 0,), // reduce
        firstWork: data.find((i,) => i.tag === "work"), // find
        lastWork: data.findLast((i,) => i.tag === "work"), // findLast
        lastItem: data.at(-1,), // at
        hasPending: data.some((i,) => i.status === "pending"), // some
        allPositive: data.every((i,) => (i.amount as number) > 0), // every
        tagsHaveHome: data.map((i,) => i.tag as string).includes("home",), // map e includes
        idxPersonal: data.findIndex((i,) => i.tag === "personal"), // findIndex
        lastIdxWork: data.findLastIndex((i,) => i.tag === "work"), // findLastIndex
        indexOfZ: data.map((i,) => i.code as string).indexOf("z",), // indexOf
        paidItems: data.filter((i,) => i.status === "paid"), // filter
        sliced: data.slice(1, 4,), // slice
        sortedByAmount: data.toSorted((a, b,) =>
          (a.amount as number) - (b.amount as number)
        ), // toSorted
        reversed: data.toReversed(), // toReversed
        spliced: data.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Record<string, unknown>).amount, 150,);
    assertEquals((result.lastWork as Record<string, unknown>).amount, 200,);
    assertEquals((result.lastItem as Record<string, unknown>).code, "k",);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals(
      (result.sortedByAmount[0] as Record<string, unknown>).amount,
      80,
    );
    assertEquals((result.reversed[0] as Record<string, unknown>).code, "k",);
    assertEquals(result.spliced.length, 3,);

    store.clear();
  },
},);

Deno.test({
  name: "LS Advanced - Erros de Tipagem Síncronos (Retornos Inválidos)",
  fn() {
    const store = ls("LS_ERROS_",);
    store.clear();
    store.set("1", { valid: true, },);

    // AssertThrows captures synchronous exceptions dispatched by ls() wrapper
    assertThrows(
      () =>
        store.getSome(
          () => ({ obj: "invalid", } as unknown as WithId<unknown>[]),
        ),
      Error,
      "The function in getSome must return an Array.",
    );

    assertThrows(
      () => store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      "The function in delSome must return an Array.",
    );

    assertThrows(
      () =>
        store.setSome(
          () => "string" as unknown as WithId<unknown>[],
          (i: unknown,) => i as unknown as WithId<unknown>,
        ),
      Error,
      "The selector function in setSome must return an Array.",
    );

    store.clear();
  },
},);

Deno.test({
  name:
    "LS Advanced - Transformações de Tipo, Mutação em Massa e Exclusão Segura",
  fn() {
    const store = ls("LS_EMPRESA_",);
    store.clear();

    store.importLS({
      LS_EMPRESA_e10: {
        name: "joão silva",
        department: "tecnologia",
        level: 2,
        active: true,
      },
      LS_EMPRESA_e20: {
        name: "maria souza",
        department: "rh",
        level: 3,
        active: true,
      },
      LS_EMPRESA_e30: {
        name: "pedro alves",
        department: "vendas",
        level: 1,
        active: false,
      },
    },);

    // Atualiza nome para UPPERCASE e converte 'level' (number) para string
    store.setSome(
      (items,) => {
        const data = items as Record<string, unknown>[];
        return data.filter((item,) =>
          (item.active as boolean) === true
        ) as WithId<Record<string, unknown>>[];
      },
      (item,) => {
        const data = item as Record<string, unknown>;
        return {
          ...data,
          name: (data.name as string).toUpperCase(),
          department: (data.department as string).toUpperCase(),
          level: String(data.level as number,), // Mutação de tipo explícita!
          _id: data._id as string,
        };
      },
    );

    const e10 = store.get<Record<string, unknown>>("e10",);
    assertEquals(e10?.name, "JOÃO SILVA",);
    assertEquals(e10?.department, "TECNOLOGIA",);
    assertEquals(typeof e10?.level, "string",);
    assertEquals(e10?.level, "2",);

    const e30 = store.get<Record<string, unknown>>("e30",);
    assertEquals(e30?.department, "vendas",); // Permanece em lowercase pois active=false
    assertEquals(typeof e30?.level, "number",); // Permanece tipo número

    // Exclui funcionários inativos via delSome
    store.delSome((items,) => {
      const data = items as Record<string, unknown>[];
      return data.filter((i,) => (i.active as boolean) === false) as WithId<
        Record<string, unknown>
      >[];
    },);

    // Checa deleção correta
    assertEquals(store.get("e30",), undefined,);
    const remainingKeys = store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Assegura integridade dos que ficaram
    const remaining = store.values<Record<string, unknown>>();
    assertNotEquals(remaining[0]?.name as string, "pedro alves",);

    store.clear();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/ls_simple_test.ts`

```ts
import { assert, assertEquals, assertNotEquals, } from "@std/assert";
import { ls, } from "../src/fake/fake-mod.ts";

type DbItem = {
  _id: string;
  name?: string;
  type?: string;
  age?: number;
  v?: number;
};

Deno.test({
  name: "LS Simple - Gestão de _id ('auto', '0990', com prefixo)",
  fn() {
    const store = ls("LS_PRE_",);
    store.clear();

    // 1. Geração automática com _id: "auto"
    const autoKey = store.set({
      _id: "auto",
      name: "Item Auto",
      type: "system",
    },);
    assert(
      autoKey.startsWith("LS_PRE_",),
      "A chave gerada automaticamente deve conter o prefixo do banco",
    );

    // O _id retornado no objeto deve ter o prefixo removido pelo formatDbItem
    const fetchedAuto = store.get(autoKey,) as DbItem;
    assert(fetchedAuto !== undefined,);
    assertNotEquals(
      fetchedAuto._id,
      "auto",
      "O _id 'auto' deve ter sido substituído por um UUID ou Hash",
    );
    assertEquals(autoKey, `LS_PRE_${fetchedAuto._id}`,);
    assertEquals(fetchedAuto.name, "Item Auto",);

    // 2. Definindo chave customizada via parâmetro direto
    const customKey = store.set("0990", { name: "Item Fixo", type: "user", },);
    assertEquals(customKey, "LS_PRE_0990",);

    // A busca aceita tanto a chave simples quanto a formatada (resolveKey cuida disso)
    const fetchedCustom = store.get("0990",) as DbItem;
    assertEquals(fetchedCustom._id, "0990",);
    assertEquals(fetchedCustom.name, "Item Fixo",);

    // 3. Salvando passando um objeto que já possui o prefixo no _id
    const keyPref = store.set({
      _id: "LS_PRE_0991",
      name: "Item Fixo 2",
      type: "user",
    },);
    assertEquals(keyPref, "LS_PRE_0991",);
    const fetchedPref = store.get("0991",) as DbItem;
    assertEquals(fetchedPref.name, "Item Fixo 2",);

    store.clear();
  },
},);

Deno.test({
  name: "LS Simple - CRUD Básico, Patch e Iteradores (keys, values, entries)",
  fn() {
    const store = ls("LS_CRUD_",);
    store.clear();

    // Create / Read
    store.set("user1", { name: "Carlos", age: 30, },);
    let user = store.get("user1",) as DbItem;
    assertEquals(user.name, "Carlos",);

    // Update Parcial (Patch)
    const patchedUser = store.patch("user1", { age: 31, },);
    assertEquals(patchedUser.age, 31,);

    user = store.get("user1",) as DbItem;
    assertEquals(user.age, 31,);

    // Operações em Lote (setMany, getMany)
    store.setMany([
      ["user2", { name: "Ana", },],
      ["user3", { name: "Beatriz", },],
    ],);

    const users = store.getMany(["user1", "user2", "user3",],) as DbItem[];
    assertEquals(users.length, 3,);
    assertEquals(users[1]?.name, "Ana",);

    // Testando Iteradores (keys, values, entries)
    const allKeys = store.keys();
    assertEquals(allKeys.length, 3,);
    assert(allKeys.includes("LS_CRUD_user1",),);

    const allValues = store.values() as DbItem[];
    assertEquals(allValues.length, 3,);
    assert(allValues.some((v,) => v._id === "user2" && v.name === "Ana"),); // Valida se formatDbItem agiu nos values

    const allEntries = store.entries() as [string, DbItem,][];
    assertEquals(allEntries.length, 3,);
    const firstEntry = allEntries.find(([k,],) => k === "LS_CRUD_user3");
    assert(firstEntry !== undefined,);
    assertEquals(firstEntry[1].name, "Beatriz",);

    // Delete
    store.delete("user1",);
    assertEquals(store.get("user1",), undefined,);
    assertEquals(store.keys().length, 2,);

    store.deleteMany(["user2", "user3",],);
    assertEquals(store.keys().length, 0,);

    store.clear();
  },
},);

Deno.test({
  name: "LS Simple - Import e Export com Respeito ao Escopo/Prefixo",
  fn() {
    const store = ls("LS_EXP_",);
    store.clear();

    const mockData = {
      LS_EXP_k1: { v: 1, label: "A", },
      LS_EXP_k2: { v: 2, label: "B", },
    };

    store.importLS(mockData, true,);

    const exported = store.exportLS();
    assertEquals(exported, mockData,);

    const values = store.values() as DbItem[];
    assertEquals(values.length, 2,);
    assertEquals(values.find((i,) => i._id === "k1")?.v, 1,);

    store.clear();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/main.test.ts`

```ts
import { assert, assertEquals, } from "@std/assert";
import { gerarId, validarId, } from "../src/utils/id.ts";
import { db, ls, } from "../src/fake/fake-mod.ts";

Deno.test("MAIN - Validação de Utilitários de ID e Integração Global", () => {
  const id = gerarId();
  assert(id.length > 0,);

  const isValid = validarId(id,);
  assertEquals(isValid, true,);

  const dbInstance = db("MAIN_DB", "main",);
  assert(dbInstance !== undefined,);

  const lsInstance = ls("MAIN_LS_",);
  assert(lsInstance !== undefined,);
});

```

---

## Arquivo: `packages/worker-db/tests/opfs_and_isolation_test.ts`

```ts
// ## Arquivo: monorepo/worker-db/tests/opfs_and_isolation_test.ts
import { assert, assertEquals, } from "@std/assert";

import { db, ls, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

Deno.test({
  name:
    "ISOLATION - LS: Garantir que instâncias com prefixos diferentes não colidam",
  sanitizeOps: false,
  sanitizeResources: false,
  fn() {
    const storeA = ls("APP_A_",);
    const storeB = ls("APP_B_",);

    storeA.clear();
    storeB.clear();

    storeA.set("1", { data: "from A", },);
    storeB.set("1", { data: "from B", },);

    assertEquals(storeA.get<Record<string, unknown>>("1",)?.data, "from A",);
    assertEquals(storeB.get<Record<string, unknown>>("1",)?.data, "from B",);

    storeA.clear();
    assertEquals(storeA.keys().length, 0,);
    assertEquals(storeB.keys().length, 1,);
    assertEquals(storeB.get<Record<string, unknown>>("1",)?.data, "from B",);
  },
},);

db.init(new URL("../build/worker-db.js", import.meta.url,),);

Deno.test({
  name:
    "ISOLATION - DB: Garantir que instâncias no mesmo Store, com prefixos diferentes, são isoladas",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const dbApp1 = db("SHARED_DB", "keyval", "APP_1_",);
    const dbApp2 = db("SHARED_DB", "keyval", "APP_2_",);

    await dbApp1.clear();
    await dbApp2.clear();

    await dbApp1.set("config", { theme: "dark", },);
    await dbApp2.set("config", { theme: "light", },);

    const app1Vals = await dbApp1.values<unknown>();
    assertEquals(app1Vals.length, 1,);
    assertEquals((app1Vals[0] as Record<string, unknown>).theme, "dark",);

    const exportApp2 = await dbApp2.exportDB();
    assert(Object.keys(exportApp2,).includes("APP_2_config",),);
    assert(!Object.keys(exportApp2,).includes("APP_1_config",),);

    await dbApp1.clear();
    assertEquals((await dbApp1.keys()).length, 0,);

    const app2Keys = await dbApp2.keys();
    assertEquals(app2Keys.length, 1,);
    assertEquals(app2Keys[0], "APP_2_config",);
  },
},);

Deno.test({
  name:
    "OPFS - Fluxo completo de Backup e Restore (INDEXED-DB) usando record-keys",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    const store = db("OPFS_DB", "test", "BACKUP_",);
    await store.clear();

    await store.set("k1", { text: "Hello OPFS DB", },);
    await store.set("k2", { text: "WorkerDB PWA", },);

    const recordKey = "meus_snapshots_db";
    const fileNamePath = await store.backupToOpfs(
      recordKey,
      "meu_backup_db.json",
    );

    assert(fileNamePath.includes("BACKUP_",),);
    assert(fileNamePath.includes(recordKey,),);
    assert(fileNamePath.includes("meu_backup_db.json",),);

    await store.clear();
    assertEquals((await store.keys()).length, 0,);

    // Restore indicando a recordKey isolada
    await store.restoreFromOpfs(recordKey, "meu_backup_db.json",);
    const restored = await store.values<unknown>();
    assertEquals(restored.length, 2,);

    const k1 = await store.get<unknown>("k1",) as Record<string, unknown>;
    assertEquals(k1?.text, "Hello OPFS DB",);

    FakeOPFSDirectory.clear();
  },
},);

Deno.test({
  name:
    "OPFS - Fluxo completo de Backup e Restore (LOCAL-STORAGE) usando record-keys e proxy opfs()",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    const store = ls("LS_BKP_SYS_",);
    store.clear();

    // 1. Popula o LocalStorage de forma síncrona
    store.set("config", { theme: "dark", notifications: true, },);
    store.set("perfil", { alias: "Satoshi", status: "online", },);
    assertEquals(store.keys().length, 2,);

    // 2. Realiza o backup assíncrono delegando para o Worker-DB via opfs()
    const recordKey = "ls_snapshots";
    const fileNamePath = await store.backupToOpfs(recordKey, "ls_backup.json",);

    // Verifica se a rota de retorno seguiu a padronização das keys
    assert(fileNamePath.includes(recordKey,),);
    assert(fileNamePath.includes("ls_backup.json",),);

    // 3. Limpa o LocalStorage simulando uma perda de dados local ou troca de dispositivo
    store.clear();
    assertEquals(store.keys().length, 0,);

    // 4. Executa o Restore assíncrono puxando o binário via Worker e regravando no LS
    await store.restoreFromOpfs(recordKey, "ls_backup.json", true,);

    // 5. Valida a integridade dos dados resgatados
    const restoredKeys = store.keys();
    assertEquals(restoredKeys.length, 2,);

    const config = store.get<unknown>("config",) as Record<string, unknown>;
    assertEquals(config?.theme, "dark",);
    assertEquals(config?.notifications, true,);

    const perfil = store.get<unknown>("perfil",) as Record<string, unknown>;
    assertEquals(perfil?.alias, "Satoshi",);

    FakeOPFSDirectory.clear();
  },
},);

```

---

## Arquivo: `packages/worker-db/tests/opfs_explorer_root_test.ts`

```ts
// packages/worker-db/tests/opfs_explorer_root_test.ts
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";
import {
  deleteFromOpfs,
  getFileFromOpfs,
  listOpfsFiles,
  readJsonFromOpfs,
  writeJsonToOpfs,
} from "../src/utils/opfs.ts";

describe("OPFS Root & Explorer", () => {
  it("lists all files and directories starting from the OPFS root", async () => {
    FakeOPFSDirectory.clear();

    // Simula arquivos criados em múltiplos subdiretórios (ex: demo/ e backup/)
    await writeJsonToOpfs("demo/FS_test-file/hello.txt", {
      message: "Hello OPFS",
    },);
    await writeJsonToOpfs("backup/MSG_auto_backups/sw_auto_backup.json", {
      backup: true,
      timestamp: 123456789,
    },);
    await writeJsonToOpfs("media/images/avatar.png", "fake-png-content",);

    const files = await listOpfsFiles();

    // Deve listar todos os arquivos preservando caminhos relativos a partir da raiz
    assertEquals(files.length, 3,);
    assert(files.includes("demo/FS_test-file/hello.txt",),);
    assert(files.includes("backup/MSG_auto_backups/sw_auto_backup.json",),);
    assert(files.includes("media/images/avatar.png",),);

    // Lê os arquivos a partir dos caminhos relativos da raiz
    const backupContent = await readJsonFromOpfs(
      "backup/MSG_auto_backups/sw_auto_backup.json",
    ) as { backup: boolean };
    assertEquals(backupContent.backup, true,);

    const file = await getFileFromOpfs("demo/FS_test-file/hello.txt",);
    assertEquals(file.name, "hello.txt",);

    // Deleta arquivo da raiz e revalida
    await deleteFromOpfs("media/images/avatar.png",);
    const updatedFiles = await listOpfsFiles();
    assertEquals(updatedFiles.length, 2,);
    assert(!updatedFiles.includes("media/images/avatar.png",),);

    FakeOPFSDirectory.clear();
  });
});

```

---

## Arquivo: `packages/worker-db/tests/worker_lifecycle_test.ts`

```ts
import { assertEquals, } from "@std/assert";
import { db, } from "../src/fake/fake-mod.ts";

const isFake = true;

Deno.test({
  name:
    "LIFECYCLE - Inicialização, Terminação, Restart e Persistência do Worker",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_LIFECYCLE_DB", "state", "LC_",);
    await store.clear();

    await store.set("status", { alive: true, phase: "init", },);
    let result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(result?.alive, true,);

    db.terminate();

    await store.set("status", { alive: true, phase: "healed", },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(result?.phase, "healed",);

    // O restart vai recriar o Worker utilizando o último caminho válido
    // (que é o fake-db.ts garantido pelo nosso fake-mod.ts)
    db.restart();

    if (!isFake) {
      // Lógica isolada para cenários não-falsos, caso necessário
    }

    await store.patch<Record<string, unknown>>("status", {
      phase: "restarted",
    },);
    result = await store.get<unknown>("status",) as Record<string, unknown>;
    assertEquals(
      result?.phase,
      "restarted",
      "Worker recriado pelo restart() falhou",
    );

    db.terminate();
  },
},);

Deno.test({
  name:
    "LIFECYCLE - Comportamento com requisições disparadas imediatamente após restart",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const store = db("WORKER_LIFECYCLE_DB", "stress", "STRESS_",);

    db.restart();

    await store.set("k1", { val: 1, },);
    await store.set("k2", { val: 2, },);

    const keys = await store.keys();
    assertEquals(keys.length, 2,);

    await store.clear();
    db.terminate();
  },
},);

```

---

