// packages/service-worker/tests/explorer_test.ts
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import "../../worker-db/src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../../worker-db/src/fake/fake-opfs.ts";
import {
  createOpfsFetchHandler,
  getFileFromOpfs,
  getMimeType,
  handleOpfsRequest,
  listOpfsFiles,
  renderDirectoryHtml,
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
});
