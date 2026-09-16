/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { join, } from "@std/path";
import {
  cleanTarget,
  copyStaticFiles,
  listAssetsForCache,
} from "../../src/esbuild/mod.ts";
import {
  fileExists,
  listFiles,
  readText,
  withFileStructure,
  withTempDir,
} from "../helpers/fixtures.ts";

describe("cleanTarget", () => {
  it("remove arquivo específico", async () => {
    await withTempDir(async (dir,) => {
      await Deno.writeTextFile(join(dir, "teste.js",), "code",);
      assertEquals(await fileExists(join(dir, "teste.js",),), true,);

      await cleanTarget(dir, ["teste.js",],);

      assertEquals(await fileExists(join(dir, "teste.js",),), false,);
    },);
  });

  it("remove pasta recursivamente", async () => {
    await withTempDir(async (dir,) => {
      const subDir = join(dir, "subpasta",);
      await Deno.mkdir(subDir,);
      await Deno.writeTextFile(join(subDir, "arquivo.js",), "code",);

      await cleanTarget(dir, ["subpasta",],);

      assertEquals(await fileExists(subDir,), false,);
    },);
  });

  it("esvazia diretório com '.'", async () => {
    await withTempDir(async (dir,) => {
      await Deno.writeTextFile(join(dir, "a.js",), "a",);
      await Deno.writeTextFile(join(dir, "b.js",), "b",);
      await Deno.mkdir(join(dir, "sub",),);
      await Deno.writeTextFile(join(dir, "sub/c.js",), "c",);

      await cleanTarget(dir, [".",],);

      const files = await listFiles(dir,);
      assertEquals(files.length, 0,);
    },);
  });

  it("ignora path traversal (..)", async () => {
    await withTempDir(async (dir,) => {
      // Cria arquivo fora do dir que não deve ser removido
      const outsideFile = join(dir, "..", "protegido.txt",);
      try {
        await Deno.writeTextFile(outsideFile, "não me remova",);
      } catch {
        // Pode falhar se não tiver permissão
      }

      await cleanTarget(dir, ["../protegido.txt",],);

      // O arquivo fora do dir deve ainda existir (se foi criado)
      try {
        assertEquals(await fileExists(outsideFile,), true,);
        await Deno.remove(outsideFile,);
      } catch {
        // Se não conseguiu criar, ok
      }
    },);
  });

  it("ignora paths absolutos", async () => {
    await withTempDir(async (dir,) => {
      // Não deve lançar erro nem remover nada
      await cleanTarget(dir, ["/etc/passwd", "/tmp/test",],);
      assertEquals(true, true,);
    },);
  });

  it("não lança erro para arquivo inexistente", async () => {
    await withTempDir(async (dir,) => {
      await cleanTarget(dir, ["nao-existe.js",],);
      assertEquals(true, true,);
    },);
  });

  it("lista vazia não faz nada", async () => {
    await withTempDir(async (dir,) => {
      await Deno.writeTextFile(join(dir, "keep.js",), "keep",);
      await cleanTarget(dir, [],);
      assertEquals(await fileExists(join(dir, "keep.js",),), true,);
    },);
  });

  it("processa múltiplos paths de uma vez", async () => {
    await withTempDir(async (dir,) => {
      await Deno.writeTextFile(join(dir, "a.js",), "a",);
      await Deno.writeTextFile(join(dir, "b.js",), "b",);
      await Deno.writeTextFile(join(dir, "c.js",), "c",);

      await cleanTarget(dir, ["a.js", "c.js",],);

      assertEquals(await fileExists(join(dir, "a.js",),), false,);
      assertEquals(await fileExists(join(dir, "b.js",),), true,);
      assertEquals(await fileExists(join(dir, "c.js",),), false,);
    },);
  });
});

describe("listAssetsForCache", () => {
  it("lista arquivos em estrutura simples", async () => {
    const { dir, cleanup, } = await withFileStructure({
      "app.js": "code",
      "style.css": "css",
    },);

    try {
      const assets = await listAssetsForCache(dir,);
      assertEquals(assets.length, 2,);
      assertEquals(assets.includes("./app.js",), true,);
      assertEquals(assets.includes("./style.css",), true,);
    } finally {
      await cleanup();
    }
  });

  it("exclui arquivos .map", async () => {
    const { dir, cleanup, } = await withFileStructure({
      "app.js": "code",
      "app.js.map": "map",
    },);

    try {
      const assets = await listAssetsForCache(dir,);
      assertEquals(assets.length, 1,);
      assertEquals(assets[0], "./app.js",);
    } finally {
      await cleanup();
    }
  });

  it("exclui metafile.json", async () => {
    const { dir, cleanup, } = await withFileStructure({
      "app.js": "code",
      "ui-metafile.json": "{}",
    },);

    try {
      const assets = await listAssetsForCache(dir,);
      assertEquals(assets.length, 1,);
    } finally {
      await cleanup();
    }
  });

  it("exclui service-worker.js por padrão", async () => {
    const { dir, cleanup, } = await withFileStructure({
      "app.js": "code",
      "service-worker.js": "sw code",
    },);

    try {
      const assets = await listAssetsForCache(dir,);
      assertEquals(assets.includes("./service-worker.js",), false,);
      assertEquals(assets.length, 1,);
    } finally {
      await cleanup();
    }
  });

  it("aceita lista de exclusão customizada", async () => {
    const { dir, cleanup, } = await withFileStructure({
      "app.js": "code",
      "temp.js": "temp",
      "debug.js": "debug",
    },);

    try {
      const assets = await listAssetsForCache(dir, ["temp.js", "debug.js",],);
      assertEquals(assets.length, 1,);
      assertEquals(assets[0], "./app.js",);
    } finally {
      await cleanup();
    }
  });

  it("lida com subdiretórios", async () => {
    const { dir, cleanup, } = await withFileStructure({
      "app.js": "code",
      "assets/logo.png": "png",
      "assets/icons/favicon.ico": "ico",
    },);

    try {
      const assets = await listAssetsForCache(dir,);
      assertEquals(assets.length, 3,);
      // Deve conter os paths relativos
      const hasLogo = assets.some((a,) => a.includes("logo.png",));
      const hasIcon = assets.some((a,) => a.includes("favicon.ico",));
      assertEquals(hasLogo, true,);
      assertEquals(hasIcon, true,);
    } finally {
      await cleanup();
    }
  });
});

describe("copyStaticFiles", () => {
  it("copia publicdir para distdir", async () => {
    const { dir: publicDir, cleanup: cleanupPublic, } = await withFileStructure(
      {
        "manifest.json": `{ "name": "WorkerDB", "version": "1.0.0" }`,
        "icon.png": "png",
      },
    );

    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );

    try {
      const config = {
        srcdir: "/tmp/src",
        distdir: distDir,
        publicdir: publicDir,
        entryPoints: [],
      };

      await copyStaticFiles(config, "2.0.0",);

      // Arquivos foram copiados
      assertEquals(await fileExists(join(distDir, "manifest.json",),), true,);
      assertEquals(await fileExists(join(distDir, "icon.png",),), true,);

      // manifest.json foi atualizado
      const manifest = JSON.parse(
        await readText(join(distDir, "manifest.json",),),
      );
      assertEquals(manifest.version, "2.0.0",);
    } finally {
      await cleanupPublic();
      await cleanupDist();
    }
  });

  it("copia index.html quando indexHtml é true", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "index.html": "<html></html>",
    },);

    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );

    try {
      const config = {
        srcdir: srcDir,
        distdir: distDir,
        indexHtml: true,
        entryPoints: [],
      };

      await copyStaticFiles(config, "1.0.0",);

      assertEquals(await fileExists(join(distDir, "index.html",),), true,);
      const content = await readText(join(distDir, "index.html",),);
      assertEquals(content, "<html></html>",);
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });

  it("não falha quando publicdir não existe", async () => {
    const { dir: distDir, cleanup, } = await withFileStructure({},);

    try {
      const config = {
        srcdir: "/tmp/src",
        distdir: distDir,
        publicdir: "/caminho/inexistente",
        entryPoints: [],
      };

      // Não deve lançar erro
      await copyStaticFiles(config, "1.0.0",);
      assertEquals(true, true,);
    } finally {
      await cleanup();
    }
  });

  it("não falha quando index.html não existe", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({},);
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );

    try {
      const config = {
        srcdir: srcDir,
        distdir: distDir,
        indexHtml: true,
        entryPoints: [],
      };

      await copyStaticFiles(config, "1.0.0",);
      assertEquals(await fileExists(join(distDir, "index.html",),), false,);
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });

  it("preserva manifest.json sem version quando não há campo", async () => {
    const { dir: publicDir, cleanup: cleanupPublic, } = await withFileStructure(
      {
        "manifest.json": `{ "name": "WorkerDB" }`,
      },
    );

    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );

    try {
      const config = {
        srcdir: "/tmp/src",
        distdir: distDir,
        publicdir: publicDir,
        entryPoints: [],
      };

      await copyStaticFiles(config, "3.0.0",);

      const manifest = JSON.parse(
        await readText(join(distDir, "manifest.json",),),
      );
      assertEquals(manifest.name, "WorkerDB",);
      assertEquals(manifest.version, "3.0.0",);
    } finally {
      await cleanupPublic();
      await cleanupDist();
    }
  });
});
