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
