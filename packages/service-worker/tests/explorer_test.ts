// packages/service-worker/tests/explorer_test.ts
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import "../../worker-db/src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../../worker-db/src/fake/fake-opfs.ts";
import {
  createOpfsFetchHandler,
  getFileFromOpfs,
  getMimeType,
  getScopePath,
  handleOpfsRequest,
  listOpfsFiles,
  normalizeOptions,
  renderDirectoryHtml,
  resolveRoutePrefix,
} from "../src/mod.ts";

describe("@vanaware/opfs-explorer", () => {
  it("determines correct mime types", () => {
    assertEquals(getMimeType("data.json",), "application/json; charset=utf-8",);
    assertEquals(getMimeType("README.md",), "text/plain; charset=utf-8",);
    assertEquals(getMimeType("index.html",), "text/html; charset=utf-8",);
    assertEquals(getMimeType("photo.png",), "image/png",);
    assertEquals(getMimeType("photo.JPG",), "image/jpeg",);
    assertEquals(getMimeType("app.wasm",), "application/wasm",);
    assertEquals(
      getMimeType("script.js",),
      "application/javascript; charset=utf-8",
    );
    assertEquals(getMimeType("unknown.xyz",), "application/octet-stream",);
  });

  it("renders directory html properly", () => {
    const files = ["backup/data.json", "demo/file.txt", "root-file.json",];
    const html = renderDirectoryHtml("", files, { title: "Custom Explorer", },);

    assert(html.includes("Custom Explorer",),);
    assert(html.includes("backup/",),);
    assert(html.includes("demo/",),);
    assert(html.includes("root-file.json",),);
  });

  it("handles OPFS routing correctly with fake OPFS", async () => {
    FakeOPFSDirectory.clear();
    const fakeRoot = new FakeOPFSDirectory("",);
    const demoDir = fakeRoot.getDirectoryHandle("demo", { create: true, },);
    const fileHandle = demoDir.getFileHandle("test.txt", { create: true, },);
    const writable = fileHandle.createWritable();
    await writable.write("hello world",);
    writable.close();

    // Route matching non-opfs path
    const nonOpfsReq = new Request("https://example.com/api/users",);
    const res1 = await handleOpfsRequest(nonOpfsReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res1.matched, false,);

    // Route matching opfs base redirect
    const redirectReq = new Request("https://example.com/opfs",);
    const res2 = await handleOpfsRequest(redirectReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res2.matched, true,);
    assertEquals(res2.response?.status, 301,);

    // Route matching opfs root folder
    const rootReq = new Request("https://example.com/opfs/",);
    const res3 = await handleOpfsRequest(rootReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res3.matched, true,);
    assertEquals(res3.response?.status, 200,);
    const htmlText = await res3.response?.text();
    assert(htmlText?.includes("demo/",),);

    // Route matching file request
    const fileReq = new Request("https://example.com/opfs/demo/test.txt",);
    const res4 = await handleOpfsRequest(fileReq, {
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);
    assertEquals(res4.matched, true,);
    assertEquals(res4.response?.status, 200,);
    assertEquals(
      res4.response?.headers.get("Content-Type",),
      "text/plain; charset=utf-8",
    );
    const fileContent = await res4.response?.text();
    assertEquals(fileContent, "hello world",);
  });

  it("createOpfsFetchHandler responds to matching paths", async () => {
    FakeOPFSDirectory.clear();
    const fakeRoot = new FakeOPFSDirectory("",);
    const fileHandle = fakeRoot.getFileHandle("app.json", { create: true, },);
    const writable = fileHandle.createWritable();
    await writable.write(JSON.stringify({ active: true, },),);
    writable.close();

    const handler = createOpfsFetchHandler({
      routePrefix: "/opfs",
      rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
    },);

    let respondedWith: Response | null = null;
    const fakeEvent = {
      request: new Request("https://example.com/opfs/app.json",),
      respondWith: (promise: Promise<Response>,) => {
        promise.then((res,) => {
          respondedWith = res;
        },);
      },
    } as unknown as FetchEvent;

    handler(fakeEvent,);

    // Wait for promise resolution
    await new Promise((r,) => setTimeout(r, 50,));
    assert(respondedWith !== null,);
    assertEquals((respondedWith as unknown as Response).status, 200,);
    assertEquals(
      (respondedWith as unknown as Response).headers.get("Content-Type",),
      "application/json; charset=utf-8",
    );
  });

  describe("Service Worker scope resolution", () => {
    it("getScopePath normalizes custom scope properly", () => {
      assertEquals(getScopePath(), "/",);
      assertEquals(getScopePath("workerdb",), "/workerdb/",);
      assertEquals(getScopePath("/workerdb",), "/workerdb/",);
      assertEquals(getScopePath("/workerdb/",), "/workerdb/",);
      assertEquals(getScopePath(" /workerdb/ "), "/workerdb/",);
    });

    it("resolveRoutePrefix combines scope and route prefix correctly", () => {
      // Root scope
      assertEquals(resolveRoutePrefix(), "/opfs",);
      assertEquals(resolveRoutePrefix({ routePrefix: "opfs", },), "/opfs",);
      assertEquals(resolveRoutePrefix({ routePrefix: "/opfs", },), "/opfs",);
      assertEquals(
        resolveRoutePrefix({ routePrefix: "/storage/opfs", },),
        "/storage/opfs",
      );

      // Custom GitHub Pages scope /workerdb/
      assertEquals(
        resolveRoutePrefix({ scopePath: "/workerdb/", },),
        "/workerdb/opfs",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "opfs",
        },),
        "/workerdb/opfs",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "/opfs",
        },),
        "/workerdb/opfs",
      );
      // If already prefixed with scope
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "/workerdb/opfs",
        },),
        "/workerdb/opfs",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/workerdb/",
          routePrefix: "./opfs",
        },),
        "/workerdb/opfs",
      );
    });

    it("handles OPFS routing with scope /workerdb/ (GitHub Pages setup)", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const demoDir = fakeRoot.getDirectoryHandle("demo", { create: true, },);
      const fileHandle = demoDir.getFileHandle("test.txt", { create: true, },);
      const writable = fileHandle.createWritable();
      await writable.write("github pages opfs content",);
      writable.close();

      const options = {
        scopePath: "/workerdb/",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      };

      // Non-matching path outside opfs
      const nonMatch = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/index.html",),
        options,
      );
      assertEquals(nonMatch.matched, false,);

      // Non-matching path at root
      const nonMatchRoot = await handleOpfsRequest(
        new Request("https://vanaware.github.io/other",),
        options,
      );
      assertEquals(nonMatchRoot.matched, false,);

      // Base redirect: /workerdb/opfs -> /workerdb/opfs/
      const redirectReq = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/opfs",),
        options,
      );
      assertEquals(redirectReq.matched, true,);
      assertEquals(redirectReq.response?.status, 301,);
      assertEquals(
        redirectReq.response?.headers.get("Location",),
        "https://vanaware.github.io/workerdb/opfs/",
      );

      // Root folder listing: /workerdb/opfs/
      const rootReq = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/opfs/",),
        options,
      );
      assertEquals(rootReq.matched, true,);
      assertEquals(rootReq.response?.status, 200,);
      const htmlText = await rootReq.response?.text();
      assert(htmlText?.includes("demo/",),);

      // File retrieval: /workerdb/opfs/demo/test.txt
      const fileReq = await handleOpfsRequest(
        new Request("https://vanaware.github.io/workerdb/opfs/demo/test.txt",),
        options,
      );
      assertEquals(fileReq.matched, true,);
      assertEquals(fileReq.response?.status, 200,);
      assertEquals(
        fileReq.response?.headers.get("Content-Type",),
        "text/plain; charset=utf-8",
      );
      const fileText = await fileReq.response?.text();
      assertEquals(fileText, "github pages opfs content",);
    });

    it("createOpfsFetchHandler handles requests under scope /workerdb/", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const fileHandle = fakeRoot.getFileHandle("data.json", { create: true, },);
      const writable = fileHandle.createWritable();
      await writable.write(JSON.stringify({ deployed: true, },),);
      writable.close();

      const handler = createOpfsFetchHandler({
        scopePath: "/workerdb/",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      },);

      let respondedWith: Response | null = null;
      const fakeEvent = {
        request: new Request(
          "https://vanaware.github.io/workerdb/opfs/data.json",
        ),
        respondWith: (promise: Promise<Response>,) => {
          promise.then((res,) => {
            respondedWith = res;
          },);
        },
      } as unknown as FetchEvent;

      handler(fakeEvent,);

      await new Promise((r,) => setTimeout(r, 50,));
      assert(respondedWith !== null,);
      assertEquals((respondedWith as unknown as Response).status, 200,);
      const json = await (respondedWith as unknown as Response).json();
      assertEquals(json, { deployed: true, },);
    });
  });

  describe("Custom subfolder configuration (files, arquivos, etc.)", () => {
    it("normalizeOptions normalizes strings and objects correctly", () => {
      assertEquals(normalizeOptions(), {},);
      assertEquals(normalizeOptions("files",), {
        subfolder: "files",
        routePrefix: "files",
      },);
      assertEquals(normalizeOptions("arquivos",), {
        subfolder: "arquivos",
        routePrefix: "arquivos",
      },);
      assertEquals(
        normalizeOptions({ subfolder: "arquivos", title: "Meus Arquivos", },),
        { subfolder: "arquivos", title: "Meus Arquivos", },
      );
    });

    it("resolveRoutePrefix handles custom subfolder strings and options", () => {
      assertEquals(resolveRoutePrefix("files",), "/files",);
      assertEquals(resolveRoutePrefix("arquivos",), "/arquivos",);
      assertEquals(resolveRoutePrefix({ subfolder: "arquivos", },), "/arquivos",);
      assertEquals(
        resolveRoutePrefix({ scopePath: "/my-app/", subfolder: "files", },),
        "/my-app/files",
      );
      assertEquals(
        resolveRoutePrefix({
          scopePath: "/my-app/",
          subfolder: "arquivos",
        },),
        "/my-app/arquivos",
      );
    });

    it("renderDirectoryHtml dynamically computes title based on subfolder", () => {
      const html1 = renderDirectoryHtml("", [], "files",);
      assert(html1.includes("Files Explorer",),);

      const html2 = renderDirectoryHtml("", [], "arquivos",);
      assert(html2.includes("Arquivos Explorer",),);

      const html3 = renderDirectoryHtml("", [], {
        subfolder: "arquivos",
        title: "Painel de Documentos",
      },);
      assert(html3.includes("Painel de Documentos",),);
    });

    it("handleOpfsRequest intercepts custom subfolder 'arquivos'", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const demoDir = fakeRoot.getDirectoryHandle("docs", { create: true, },);
      const fileHandle = demoDir.getFileHandle("nota.txt", { create: true, },);
      const writable = fileHandle.createWritable();
      await writable.write("conteudo em arquivos",);
      writable.close();

      const options = {
        scopePath: "/my-repo/",
        subfolder: "arquivos",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      };

      // Base redirect: /my-repo/arquivos -> /my-repo/arquivos/
      const redirectRes = await handleOpfsRequest(
        new Request("https://user.github.io/my-repo/arquivos",),
        options,
      );
      assertEquals(redirectRes.matched, true,);
      assertEquals(redirectRes.response?.status, 301,);
      assertEquals(
        redirectRes.response?.headers.get("Location",),
        "https://user.github.io/my-repo/arquivos/",
      );

      // File request: /my-repo/arquivos/docs/nota.txt
      const fileRes = await handleOpfsRequest(
        new Request("https://user.github.io/my-repo/arquivos/docs/nota.txt",),
        options,
      );
      assertEquals(fileRes.matched, true,);
      assertEquals(fileRes.response?.status, 200,);
      assertEquals(await fileRes.response?.text(), "conteudo em arquivos",);
    });

    it("createOpfsFetchHandler works with string subfolder shortcut", async () => {
      FakeOPFSDirectory.clear();
      const fakeRoot = new FakeOPFSDirectory("",);
      const fileHandle = fakeRoot.getFileHandle("report.csv", {
        create: true,
      },);
      const writable = fileHandle.createWritable();
      await writable.write("id,name\n1,Alpha",);
      writable.close();

      // Passing options object with custom subfolder "files" and fake root
      const handler = createOpfsFetchHandler({
        subfolder: "files",
        rootDir: fakeRoot as unknown as FileSystemDirectoryHandle,
      },);

      let respondedWith: Response | null = null;
      const fakeEvent = {
        request: new Request("https://example.com/files/report.csv",),
        respondWith: (promise: Promise<Response>,) => {
          promise.then((res,) => {
            respondedWith = res;
          },);
        },
      } as unknown as FetchEvent;

      handler(fakeEvent,);

      await new Promise((r,) => setTimeout(r, 50,));
      assert(respondedWith !== null,);
      assertEquals((respondedWith as unknown as Response).status, 200,);
      const text = await (respondedWith as unknown as Response).text();
      assertEquals(text, "id,name\n1,Alpha",);
    });
  });
});
