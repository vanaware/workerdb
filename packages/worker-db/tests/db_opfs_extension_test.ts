import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { db, opfs, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

const drive = opfs("P2P_DRIVE", "files", "FL_", "my_shares",);

Deno.test({
  name: "OPFS Ext - Basic file manipulation and metadata",
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

    await drive.renFile(folderKey, "doc1.txt", "doc_renamed.txt",);
    await drive.delFile(folderKey, "doc2.txt",);

    files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "doc_renamed.txt",);
  },
},);

Deno.test({
  name: "OPFS Ext - ZIP compression and decompression (fflate)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    await drive.clear();

    const folderKey = await drive.set("auto", {
      description: "Photo Album",
    },);

    const img1 = new Blob([new Uint8Array([255, 0, 150,],),],);
    const img2 = new Blob([new Uint8Array([10, 20, 30,],),],);

    await drive.addFile(folderKey, img1, "photo1.png",);
    await drive.addFile(folderKey, img2, "photo2.png",);

    await drive.zip(folderKey, "album.zip", undefined, true,);

    let files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 1,);
    assertEquals(files[0]?.name, "album.zip",);

    const img3 = new Blob([new Uint8Array([99, 99,],),],);
    await drive.addZip(folderKey, "album.zip", img3, "photo3.png",);

    await drive.delZip(folderKey, "album.zip", "photo1.png",);

    await drive.unzip(folderKey, "album.zip", true,);

    files = await drive.listFiles(folderKey,);
    assertEquals(files.length, 2,);
    assert(files.some((f,) => f.name === "photo2.png"),);
    assert(files.some((f,) => f.name === "photo3.png"),);
  },
},);

Deno.test({
  name: "OPFS Ext - Moving files across records (folders)",
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

describe("OPFS Ext – backupToOpfs / restoreFromOpfs roundtrip", () => {
  const backupStore = db({
    dbName: "BACKUP_TEST_DB",
    storeName: "records",
    prefix: "BCK_",
  },);

  it("saves all records to OPFS and restores them back", async () => {
    FakeOPFSDirectory.clear();
    await backupStore.clear();

    await backupStore.set("r1", { label: "Item One", value: 100, },);
    await backupStore.set("r2", { label: "Item Two", value: 200, },);

    // Export the current store contents to an OPFS backup file
    const backupPath = await backupStore.backupToOpfs("snap1",);
    assert(
      backupPath.includes("snap1",),
      `backup path should contain the key: ${backupPath}`,
    );

    // Wipe the in-memory store
    await backupStore.clear();
    assertEquals(
      (await backupStore.keys()).length,
      0,
      "store should be empty after clear",
    );

    // Restore from the backup
    await backupStore.restoreFromOpfs("snap1", "backup.json",);

    const r1 = await backupStore.get<{ label: string; value: number }>("r1",);
    const r2 = await backupStore.get<{ label: string; value: number }>("r2",);

    assertEquals(r1?.label, "Item One",);
    assertEquals(r1?.value, 100,);
    assertEquals(r2?.label, "Item Two",);
    assertEquals(r2?.value, 200,);
  });

  it("clears the store before restoring when clearFirst is true", async () => {
    FakeOPFSDirectory.clear();
    await backupStore.clear();

    await backupStore.set("r1", { label: "Original", value: 1, },);
    await backupStore.backupToOpfs("snap2",);

    // Add a stray record that is NOT in the backup
    await backupStore.set("stray", { label: "Stray", value: 999, },);

    // Restore with clearFirst = true – stray must be gone
    await backupStore.restoreFromOpfs("snap2", "backup.json", true,);

    const stray = await backupStore.get("stray",);
    assert(
      stray === undefined,
      "stray record should have been cleared before restore",
    );

    const r1 = await backupStore.get<{ label: string; value: number }>("r1",);
    assertEquals(r1?.label, "Original",);
  });
});
