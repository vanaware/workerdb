/// <reference lib="deno.ns" />
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { join, } from "@std/path";
import { processTarget, } from "../../src/esbuild/mod.ts";
import type { TargetConfig, } from "../../src/interfaces/mod.ts";
import {
  fileExists,
  readText,
  withFileStructure,
} from "../helpers/fixtures.ts";

describe("processTarget (integração)", () => {
  it("executa pipeline completo: clean, copy, build", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "index.html": "<html></html>",
      "dummy.ts": "// dummy",
    },);
    const { dir: publicDir, cleanup: cleanupPublic, } = await withFileStructure(
      {
        "manifest.json": `{ "name": "WorkerDB", "version": "1.0.0" }`,
      },
    );
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure({
      "old-file.js": "should be deleted",
    },);
    try {
      const config: TargetConfig = {
        srcdir: srcDir,
        distdir: distDir,
        publicdir: publicDir,
        indexHtml: true,
        clean: [".",],
        entryPoints: ["dummy.ts",],
      };
      // Mock esbuild.build
      const mockBuild = (options: Record<string, unknown>,) => {
        // Simula escrita do arquivo de saída
        const outFile = (options.outfile as string) ||
          join(options.outdir as string, "output.js",);
        Deno.writeTextFileSync(outFile, "// bundled code",);
        return Promise.resolve({ metafile: null, errors: [], warnings: [], },);
      };
      await processTarget("ui", config, "2.0.0", mockBuild,);
      // Arquivo antigo foi removido (clean: ["."])
      assertEquals(await fileExists(join(distDir, "old-file.js",),), false,);
      // Arquivos estáticos foram copiados
      assertEquals(await fileExists(join(distDir, "index.html",),), true,);
      assertEquals(await fileExists(join(distDir, "manifest.json",),), true,);
      // manifest.json foi atualizado
      const manifest = JSON.parse(
        await readText(join(distDir, "manifest.json",),),
      );
      assertEquals(manifest.version, "2.0.0",);
      // Bundle foi gerado
      assertEquals(await fileExists(join(distDir, "output.js",),), true,);
    } finally {
      await cleanupSrc();
      await cleanupPublic();
      await cleanupDist();
    }
  });

  it("salva metafile quando gerado", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "dummy.ts": "// dummy",
    },);
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );
    try {
      const config: TargetConfig = {
        srcdir: srcDir,
        distdir: distDir,
        entryPoints: ["dummy.ts",],
        metafile: true,
      };
      const mockBuild = () =>
        Promise.resolve({
          metafile: {
            inputs: { "src/main.ts": { bytes: 100, }, },
            outputs: { "dist/main.js": { bytes: 500, }, },
          },
          errors: [],
          warnings: [],
        },);
      await processTarget("ui", config, "1.0.0", mockBuild,);
      const metafilePath = join(distDir, "ui-metafile.json",);
      assertEquals(await fileExists(metafilePath,), true,);
      const metafile = JSON.parse(await readText(metafilePath,),);
      assertEquals(metafile.inputs["src/main.ts"].bytes, 100,);
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });

  it("não salva metafile quando metafile é false", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "dummy.ts": "// dummy",
    },);
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );
    try {
      const config: TargetConfig = {
        srcdir: srcDir,
        distdir: distDir,
        entryPoints: ["dummy.ts",],
        metafile: false,
      };
      const mockBuild = () =>
        Promise.resolve({
          metafile: { inputs: {}, },
        },);
      await processTarget("ui", config, "1.0.0", mockBuild,);
      assertEquals(
        await fileExists(join(distDir, "ui-metafile.json",),),
        false,
      );
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });

  it("propaga erro do esbuild.build", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "dummy.ts": "// dummy",
    },);
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );
    try {
      const config: TargetConfig = {
        srcdir: srcDir,
        distdir: distDir,
        entryPoints: ["dummy.ts",],
      };
      const mockBuild = () => {
        throw new Error("Build failed",);
      };
      let caughtError: Error | null = null;
      try {
        await processTarget("ui", config, "1.0.0", mockBuild,);
      } catch (error) {
        caughtError = error as Error;
      }
      assertEquals(caughtError !== null, true,);
      assertStringIncludes(caughtError!.message, "Build failed",);
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });

  it("usa outfile quando especificado", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "dummy.ts": "// dummy",
    },);
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure(
      {},
    );
    try {
      const config: TargetConfig = {
        srcdir: srcDir,
        distdir: distDir,
        entryPoints: ["dummy.ts",],
        outfile: "custom-name.js",
      };
      let capturedOptions: Record<string, unknown> = {};
      const mockBuild = (options: Record<string, unknown>,) => {
        capturedOptions = options;
        Deno.writeTextFileSync(options.outfile as string, "// code",);
        return Promise.resolve({ metafile: null, errors: [], warnings: [], },);
      };
      await processTarget("ui", config, "1.0.0", mockBuild,);
      assertEquals(capturedOptions.outfile, join(distDir, "custom-name.js",),);
      assertEquals(capturedOptions.outdir, undefined,);
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });

  it("lida com SW injetando assets via listFn", async () => {
    const { dir: srcDir, cleanup: cleanupSrc, } = await withFileStructure({
      "sw.ts": "// sw",
    },);
    const { dir: distDir, cleanup: cleanupDist, } = await withFileStructure({
      "app.js": "code",
      "index.html": "html",
      "service-worker.js": "sw",
    },);
    try {
      const config: TargetConfig = {
        srcdir: srcDir,
        distdir: distDir,
        entryPoints: ["sw.ts",],
      };
      let capturedDefine: Record<string, string> = {};
      const mockBuild = (options: Record<string, unknown>,) => {
        capturedDefine = options.define as Record<string, string>;
        return Promise.resolve({ metafile: null, errors: [], warnings: [], },);
      };
      const mockListFn = () => Promise.resolve(["./app.js", "./index.html",],);
      await processTarget("sw", config, "1.0.0", mockBuild, mockListFn,);
      // 🔥 CORREÇÃO: Tratamento explícito de undefined (noUncheckedIndexedAccess)
      const generatedAssets = capturedDefine["__GENERATED_ASSETS__"]!;
      const appVersion = capturedDefine["__APP_VERSION__"]!;
      const assets = JSON.parse(generatedAssets,);
      assertEquals(assets, ["./app.js", "./index.html",],);
      assertStringIncludes(appVersion, "v1.0.0",);
    } finally {
      await cleanupSrc();
      await cleanupDist();
    }
  });
});
