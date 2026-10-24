// packages/worker-db/tests/opfs_and_isolation_test.ts
import { assert, assertEquals, } from "@std/assert";

import { db, ls, } from "../src/fake/fake-mod.ts";
import { FakeOPFSDirectory, } from "../src/fake/fake-opfs.ts";

Deno.test({
  name: "ISOLATION - LS: Instances with different prefixes must not collide",
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
    "ISOLATION - DB: Instances in the same Store with different prefixes are isolated",
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
  name: "OPFS - Full Backup and Restore flow (INDEXED-DB) using record-keys",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    const store = db("OPFS_DB", "test", "BACKUP_",);
    await store.clear();

    await store.set("k1", { text: "Hello OPFS DB", },);
    await store.set("k2", { text: "WorkerDB PWA", },);

    const recordKey = "my_db_snapshots";
    const fileNamePath = await store.backupToOpfs(
      recordKey,
      "my_db_backup.json",
    );

    assert(fileNamePath.includes("BACKUP_",),);
    assert(fileNamePath.includes(recordKey,),);
    assert(fileNamePath.includes("my_db_backup.json",),);

    await store.clear();
    assertEquals((await store.keys()).length, 0,);

    // Restore pointing to the isolated recordKey
    await store.restoreFromOpfs(recordKey, "my_db_backup.json",);
    const restored = await store.values<unknown>();
    assertEquals(restored.length, 2,);

    const k1 = await store.get<unknown>("k1",) as Record<string, unknown>;
    assertEquals(k1?.text, "Hello OPFS DB",);

    FakeOPFSDirectory.clear();
  },
},);

Deno.test({
  name:
    "OPFS - Full Backup and Restore flow (LOCAL-STORAGE) using record-keys and the opfs() proxy",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    FakeOPFSDirectory.clear();
    const store = ls("LS_BKP_SYS_",);
    store.clear();

    // 1. Populate LocalStorage synchronously
    store.set("config", { theme: "dark", notifications: true, },);
    store.set("profile", { alias: "Satoshi", status: "online", },);
    assertEquals(store.keys().length, 2,);

    // 2. Perform the asynchronous backup by delegating to Worker-DB via opfs()
    const recordKey = "ls_snapshots";
    const fileNamePath = await store.backupToOpfs(recordKey, "ls_backup.json",);

    // Verify the returned path follows the key naming convention
    assert(fileNamePath.includes(recordKey,),);
    assert(fileNamePath.includes("ls_backup.json",),);

    // 3. Clear LocalStorage to simulate local data loss or a device swap
    store.clear();
    assertEquals(store.keys().length, 0,);

    // 4. Run the asynchronous restore by pulling the binary via the Worker and rewriting it into LS
    await store.restoreFromOpfs(recordKey, "ls_backup.json", true,);

    // 5. Validate the integrity of the recovered data
    const restoredKeys = store.keys();
    assertEquals(restoredKeys.length, 2,);

    const config = store.get<unknown>("config",) as Record<string, unknown>;
    assertEquals(config?.theme, "dark",);
    assertEquals(config?.notifications, true,);

    const profile = store.get<unknown>("profile",) as Record<string, unknown>;
    assertEquals(profile?.alias, "Satoshi",);

    FakeOPFSDirectory.clear();
  },
},);
