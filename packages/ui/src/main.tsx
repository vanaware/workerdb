import { render, } from "preact";
import { useEffect, useState, } from "preact/hooks";
import { db, opfs, } from "@vanaware/workerdb";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations,) {
    let unregisteredAny = false;
    const unregisterPromises = registrations.map((registration,) => {
      console.log(
        "Unregistering old service worker to fix AI Studio cache loop...",
      );
      unregisteredAny = true;
      return registration.unregister();
    },);

    Promise.all(unregisterPromises,).then(() => {
      if (unregisteredAny) {
        console.log(
          "Service Workers unregistered. Reloading to bust cache...",
        );
        globalThis.location.reload();
      } else {
        // Only register if we didn't just unregister (to avoid infinite reload loops)
        navigator.serviceWorker.register("./sw.js", { type: "module", },)
          .then((reg,) =>
            console.log("Service Worker registrado com sucesso:", reg,)
          )
          .catch((err,) =>
            console.warn(
              "Erro ao registrar Service Worker (esperado no preview do AI Studio devido a redirecionamentos):",
              err,
            )
          );
      }
    },);
  },);
}

const OPFSDemo = () => {
  const [log, setLog,] = useState("",);
  const addLog = (msg: string,) => setLog((prev,) => prev + msg + "\n");

  const runTest = async () => {
    try {
      const myOpfs = opfs("WORKERDB_DATA", "files", "FS_", "demo",);
      addLog("OPFS started.",);

      const fileData = new TextEncoder().encode("Hello from OPFS!",);
      await myOpfs.addFile(
        "test-file",
        new File([fileData,], "hello.txt", { type: "text/plain", },),
        "hello.txt",
      );
      addLog("File added to OPFS.",);

      const file = await myOpfs.getFile("test-file", "hello.txt",);
      if (file) {
        addLog("File retrieved: " + await file.text(),);
      }

      const list = await myOpfs.listFiles("test-file",);
      addLog("Files list: " + list.map((f,) => f.name).join(", ",),);
    } catch (err) {
      addLog("Error: " + err,);
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
        <a href="./opfs/" target="_blank" class="button transparent">
          <i>
            open_in_new
          </i>{" "}
          Open OPFS Explorer
        </a>
      </nav>
      <pre><code>{log}</code></pre>
    </article>
  );
};

const IndexQueryDemo = () => {
  const [log, setLog,] = useState("",);
  const addLog = (msg: string,) => setLog((prev,) => prev + msg + "\n");

  const runTest = async () => {
    try {
      db.init();
      const store = db({
        dbName: "INDEX_DEMO",
        storeName: "store",
        prefix: "TEST_",
        indexes: ["role", "age", "active",],
      },);

      addLog("Setting up data...",);
      await store.setMany([
        ["u1", { role: "admin", age: 30, active: 1, },],
        ["u2", { role: "user", age: 25, active: 1, },],
        ["u3", { role: "user", age: 40, active: 0, },],
        ["u4", { role: "manager", age: 35, active: 1, },],
      ],);

      const count = await store.countByIndex("active", 1,);
      addLog("Count of active users (countByIndex): " + count,);

      const one = await store.getOneByIndex("role", "admin",);
      addLog("One admin (getOneByIndex): " + JSON.stringify(one,),);

      const keys = await store.keysByIndex("role", "user",);
      addLog("Keys of users (keysByIndex): " + JSON.stringify(keys,),);

      const range = await store.getByIndex("age", { gte: 30, lte: 40, },);
      addLog("Users age 30-40 (Range): " + JSON.stringify(range,),);

      addLog("Patching inactive users to active...",);
      await store.patchByIndex("active", 0, { active: 1, },);
      const newCount = await store.countByIndex("active", 1,);
      addLog("Count of active users after patch: " + newCount,);
    } catch (err) {
      addLog("Error: " + err,);
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
      <pre><code>{log}</code></pre>
    </article>
  );
};

const PaginationDemo = () => {
  const [log, setLog,] = useState("",);
  const addLog = (msg: string,) => setLog((prev,) => prev + msg + "\n");

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
      addLog("Inserted 15 items.",);

      addLog("Page 1 (Limit 5):",);
      let res = await store.getByIndexPaginated("category", "sys", {
        limit: 5,
      },);
      addLog(
        JSON.stringify(
          res.items.map((i,) => (i as unknown as Record<string, unknown>).val),
        ),
      );
      addLog("Next cursor: " + res.nextCursor,);

      addLog("Page 2 (Limit 5):",);
      res = await store.getByIndexPaginated("category", "sys", {
        limit: 5,
        cursor: res.nextCursor,
      },);
      addLog(
        JSON.stringify(
          res.items.map((i,) => (i as unknown as Record<string, unknown>).val),
        ),
      );
    } catch (err) {
      addLog("Error: " + err,);
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
      <pre><code>{log}</code></pre>
    </article>
  );
};

const SWDemo = () => {
  const [log, setLog,] = useState("",);
  const addLog = (msg: string,) => setLog((prev,) => prev + msg + "\n");

  const runTest = () => {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      addLog(
        "Error: Service Worker not active.\n\nNote: If you are in the AI Studio preview environment, strict redirects might prevent the Service Worker from registering correctly during development. This feature works beautifully in production (like GitHub Pages)!",
      );
      return;
    }

    addLog("Sending 'RUN_SW_DEMO' to Service Worker...",);
    const channel = new MessageChannel();
    channel.port1.onmessage = (event,) => {
      addLog(
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
      <pre><code>{log}</code></pre>
    </article>
  );
};

const App = () => {
  const [tab, setTab,] = useState("opfs",);
  return (
    <main class="responsive">
      <h3 class="center-align">
        WorkerDB Interactive Demo
      </h3>

      <nav class="m-b-4">
        <button
          type="button"
          class={`chip ${tab === "opfs" ? "active" : "transparent"}`}
          onClick={() => setTab("opfs",)}>
          <i>
            folder
          </i>
          OPFS Explorer
        </button>
        <button
          type="button"
          class={`chip ${tab === "index" ? "active" : "transparent"}`}
          onClick={() => setTab("index",)}>
          <i>
            search
          </i>
          Indexed Queries
        </button>
        <button
          type="button"
          class={`chip ${tab === "pagination" ? "active" : "transparent"}`}
          onClick={() => setTab("pagination",)}>
          <i>
            list
          </i>
          Pagination
        </button>
        <button
          type="button"
          class={`chip ${tab === "sw" ? "active" : "transparent"}`}
          onClick={() => setTab("sw",)}>
          <i>
            memory
          </i>
          Service Worker
        </button>
      </nav>

      <div class="space">
      </div>

      {tab === "opfs" && <OPFSDemo />}
      {tab === "index" && <IndexQueryDemo />}
      {tab === "pagination" && <PaginationDemo />}
      {tab === "sw" && <SWDemo />}
    </main>
  );
};

render(<App />, document.getElementById("app",)!,);
