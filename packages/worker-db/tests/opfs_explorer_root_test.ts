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
