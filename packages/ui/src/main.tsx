import { render, } from "preact";
import { useEffect, useState, } from "preact/hooks";
import { db, opfs, } from "@workerdb/workerdb";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations,) {
    let unregisteredAny = false;
    const unregisterPromises = registrations.map((registration,) => {
      console.log("Unregistering old service worker to fix AI Studio cache loop...",);
      unregisteredAny = true;
      return registration.unregister();
    });

    Promise.all(unregisterPromises).then(() => {
      if (unregisteredAny) {
        console.log("Service Workers unregistered. Reloading to bust cache...",);
        window.location.reload();
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
    });
  });
}

const OPFSDemo = () => {
  const [log, setLog,] = useState("",);
  const addLog = (msg: string,) => setLog((prev,) => prev + msg + "\n");

  const runTest = async () => {
    try {
      const myOpfs = opfs("SYNTAXMESH_DATA", "files", "FS_", "demo",);
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
    <article>
      <h4>
        OPFS Demo
      </h4>
      <p>
        Origin Private File System interaction without blocking the main thread.
      </p>
      <button type="button" class="primary" onClick={runTest}>
        Run OPFS Test
      </button>
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
    <article>
      <h4>
        Index Queries Demo
      </h4>
      <p>
        Native IDB features like countByIndex, ranges, etc.
      </p>
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
    <article>
      <h4>
        Pagination Demo
      </h4>
      <p>
        Cursor based pagination via{" "}
        <code>
          getByIndexPaginated
        </code>.
      </p>
      <button type="button" class="primary" onClick={runTest}>
        Run Pagination Test
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
      </nav>

      <div class="space">
      </div>

      {tab === "opfs" && <OPFSDemo />}
      {tab === "index" && <IndexQueryDemo />}
      {tab === "pagination" && <PaginationDemo />}
    </main>
  );
};

render(<App />, document.getElementById("app",)!,);
