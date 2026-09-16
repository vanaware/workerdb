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
