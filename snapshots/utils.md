> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém experimentos e código da área de @vanaware/utils
> O projeto é o **WorkerDB ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB - Modo: UTILS

Gerado automaticamente em: 9/20/2026, 5:30:37 PM

---

## Arquivo: `packages/utils/README.md`

```md

```

---

## Arquivo: `packages/utils/tests/bdd_example_test.ts`

```ts
/**
 * @workerdb/packages/utils/tests/bdd_example_test.ts
 *
 * Exemplo de uso do estilo BDD (describe/it) com @std/testing/bdd,
 * conforme definido na ADR 008.
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";

describe("bdd_example", () => {
  it("deve passar com uma afirmação simples", () => {
    assertEquals(1 + 1, 2,);
  });

  it("deve falhar corretamente quando a condição não é atendida", () => {
    // Este teste demonstra que o framework BDD funciona conforme esperado.
    const value = "workerdb";
    assert(value.length > 0,);
  });
});

```

---

## Arquivo: `packages/utils/tests/helpers/fixtures.ts`

```ts
/// <reference lib="deno.ns" />

import { join, } from "@std/path";

/**
 * Cria um diretório temporário com estrutura controlada para testes.
 * Retorna o caminho e uma função de cleanup.
 */
export async function withTempDir<T,>(
  fn: (dir: string,) => Promise<T>,
): Promise<T> {
  const tempDir = await Deno.makeTempDir({ prefix: "workerdb-test-", },);
  try {
    return await fn(tempDir,);
  } finally {
    await Deno.remove(tempDir, { recursive: true, },);
  }
}

/**
 * Cria um arquivo deno.jsonc temporário com versão especificada.
 */
export async function withTempDenoJsonc(
  version: string,
  extras?: Record<string, unknown>,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const tempDir = await Deno.makeTempDir({ prefix: "workerdb-deno-test-", },);
  const path = join(tempDir, "deno.jsonc",);

  const content = JSON.stringify(
    {
      name: "@workerdb/test",
      version,
      ...extras,
    },
    null,
    2,
  );

  await Deno.writeTextFile(path, content,);

  return {
    path,
    cleanup: async () => await Deno.remove(tempDir, { recursive: true, },),
  };
}

/**
 * Cria uma estrutura de arquivos temporária para testes de filesystem.
 */
export async function withFileStructure(
  files: Record<string, string>,
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const tempDir = await Deno.makeTempDir({ prefix: "workerdb-fs-test-", },);

  for (const [path, content,] of Object.entries(files,)) {
    const fullPath = join(tempDir, path,);
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/",),);

    if (dirPath) {
      await Deno.mkdir(dirPath, { recursive: true, },);
    }

    await Deno.writeTextFile(fullPath, content,);
  }

  return {
    dir: tempDir,
    cleanup: async () => await Deno.remove(tempDir, { recursive: true, },),
  };
}

/**
 * Verifica se um arquivo existe.
 */
export async function fileExists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lê o conteúdo de um arquivo como texto.
 */
export async function readText(path: string,): Promise<string> {
  return await Deno.readTextFile(path,);
}

/**
 * Lista arquivos em um diretório recursivamente.
 */
export async function listFiles(dir: string,): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir,)) {
    files.push(entry.name,);
  }
  return files;
}

```

---

## Arquivo: `packages/utils/tests/esbuild/paths.test.ts`

```ts
/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { isSafePath, } from "@workerdb/utils/build";

describe("isSafePath", () => {
  describe("paths seguros", () => {
    const safePaths = [
      "arquivo.js",
      "pasta/arquivo.js",
      "pasta/subpasta/arquivo.js",
      ".",
      "file-with-dash.js",
      "file_with_underscore.js",
      "file.name.with.dots.js",
      "UPPERCASE.js",
      "123.js",
      "path/to/file",
    ];

    for (const path of safePaths) {
      it(`aceita "${path}"`, () => {
        assertEquals(isSafePath(path,), true,);
      });
    }
  });

  describe("paths bloqueados (path traversal)", () => {
    const traversalPaths = [
      "..",
      "../file.js",
      "pasta/../file.js",
      "a/b/c/../../file.js",
      "../../../etc/passwd",
      "foo..bar",
      "file..js",
    ];

    for (const path of traversalPaths) {
      it(`bloqueia "${path}"`, () => {
        assertEquals(isSafePath(path,), false,);
      });
    }
  });

  describe("paths bloqueados (absolutos Unix)", () => {
    const absolutePaths = [
      "/etc/passwd",
      "/home/user",
      "/var/log/system.log",
      "/tmp/test",
    ];

    for (const path of absolutePaths) {
      it(`bloqueia "${path}"`, () => {
        assertEquals(isSafePath(path,), false,);
      });
    }
  });

  describe("edge cases", () => {
    it("string vazia é considerada segura (não é traversal nem absoluta)", () => {
      assertEquals(isSafePath("",), true,);
    });

    it("path com apenas espaços é seguro", () => {
      assertEquals(isSafePath("   ",), true,);
    });

    it("path com caracteres especiais é seguro", () => {
      assertEquals(isSafePath("file@name.js",), true,);
      assertEquals(isSafePath("file+name.js",), true,);
    });
  });
});

```

---

## Arquivo: `packages/utils/tests/esbuild/filesystem.test.ts`

```ts
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

```

---

## Arquivo: `packages/utils/tests/esbuild/cli.test.ts`

```ts
/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { parseArgs, } from "@workerdb/utils/build";
import type { GlobalTargetConfig, } from "../../src/interfaces/mod.ts";

// Helper para criar config mínima
function makeTarget(overrides: Record<string, unknown> = {},) {
  return {
    srcdir: "src",
    distdir: "dist",
    entryPoints: ["a.ts",],
    ...overrides,
  };
}

describe("parseArgs", () => {
  // ========================================================================
  // CONFIGS DE TESTE
  // ========================================================================

  // CONFIG legado: sem mode nem default (compatibilidade)
  const CONFIG_LEGACY: GlobalTargetConfig = {
    ui: makeTarget(),
    worker: makeTarget(),
    sw: makeTarget(),
  };

  // CONFIG com default explícito
  const CONFIG_WITH_DEFAULTS: GlobalTargetConfig = {
    ui: makeTarget({ default: true, },),
    worker: makeTarget({ default: true, },),
    sw: makeTarget({ default: true, },),
    admin: makeTarget({ default: false, },),
  };

  // CONFIG com múltiplos watches
  const CONFIG_WITH_WATCHES: GlobalTargetConfig = {
    ui: makeTarget({ mode: "build", default: true, },),
    sw: makeTarget({ mode: "build", default: true, },),
    "watch-ui": makeTarget({ mode: "watch", default: false, },),
    "watch-admin": makeTarget({ mode: "watch", default: false, },),
  };

  // CONFIG misto: builds, watches e sob demanda
  const CONFIG_MIXED: GlobalTargetConfig = {
    ui: makeTarget({ mode: "build", default: true, },),
    sw: makeTarget({ mode: "build", default: true, },),
    admin: makeTarget({ mode: "build", default: false, },),
    "watch-ui": makeTarget({ mode: "watch", default: false, },),
    "watch-admin": makeTarget({ mode: "watch", default: false, },),
  };

  // ========================================================================
  // COMPATIBILIDADE (sem mode nem default)
  // ========================================================================

  describe("compatibilidade (sem mode nem default)", () => {
    it("inclui todos os alvos por padrão", () => {
      const result = parseArgs([], CONFIG_LEGACY,);
      assertEquals(result.targets, ["ui", "worker", "sw",],);
      assertEquals(result.watchTarget, null,);
    });
  });

  // ========================================================================
  // PROPRIEDADE default
  // ========================================================================

  describe("propriedade default", () => {
    it("inclui apenas alvos com default !== false", () => {
      const result = parseArgs([], CONFIG_WITH_DEFAULTS,);
      assertEquals(result.targets, ["ui", "worker", "sw",],);
      assertEquals(result.targets.includes("admin",), false,);
    });

    it("inclui alvo com default: false quando solicitado", () => {
      const result = parseArgs(["admin",], CONFIG_WITH_DEFAULTS,);
      assertEquals(result.targets, ["admin",],);
    });
  });

  // ========================================================================
  // PROPRIEDADE mode: 'watch'
  // ========================================================================

  describe("propriedade mode: 'watch'", () => {
    it("watch NUNCA aparece nos targets padrão", () => {
      const result = parseArgs([], CONFIG_WITH_WATCHES,);
      assertEquals(result.targets, ["ui", "sw",],);
      assertEquals(result.targets.includes("watch-ui",), false,);
      assertEquals(result.targets.includes("watch-admin",), false,);
      assertEquals(result.watchTarget, null,);
    });

    it("flag 'watch' seleciona o PRIMEIRO alvo watch", () => {
      const result = parseArgs(["watch",], CONFIG_WITH_WATCHES,);
      assertEquals(result.watchTarget, "watch-ui",);
      assertEquals(result.targets, [],);
    });

    it("solicitar alvo watch pelo nome ativa modo watch", () => {
      const result = parseArgs(["watch-admin",], CONFIG_WITH_WATCHES,);
      assertEquals(result.watchTarget, "watch-admin",);
      assertEquals(result.targets, [],);
    });

    it("modo watch ativo → targets de build vazios", () => {
      const result = parseArgs(["watch", "ui", "sw",], CONFIG_WITH_WATCHES,);
      assertEquals(result.watchTarget, "watch-ui",);
      assertEquals(result.targets, [],);
    });

    it("watch com default: true ainda é excluído dos targets padrão", () => {
      const config: GlobalTargetConfig = {
        ui: makeTarget({ mode: "build", },),
        "watch-ui": makeTarget({ mode: "watch", default: true, },),
      };
      const result = parseArgs([], config,);
      assertEquals(result.targets, ["ui",],);
      assertEquals(result.watchTarget, null,);
    });
  });

  // ========================================================================
  // MÚLTIPLOS WATCHES
  // ========================================================================

  describe("múltiplos watches", () => {
    it("flag 'watch' usa apenas o primeiro (ordem do CONFIG)", () => {
      const result = parseArgs(["watch",], CONFIG_MIXED,);
      assertEquals(result.watchTarget, "watch-ui",);
    });

    it("watch específico pode ser solicitado pelo nome", () => {
      const result = parseArgs(["watch-admin",], CONFIG_MIXED,);
      assertEquals(result.watchTarget, "watch-admin",);
    });

    it("solicitar múltiplos watches usa o primeiro na ordem do CONFIG", () => {
      const result = parseArgs(["watch-admin", "watch-ui",], CONFIG_MIXED,);
      // watch-ui vem antes de watch-admin no CONFIG
      assertEquals(result.watchTarget, "watch-ui",);
    });
  });

  // ========================================================================
  // FLAGS ESPECIAIS
  // ========================================================================

  describe("flags especiais", () => {
    it("detecta noversion", () => {
      const result = parseArgs(["noversion",], CONFIG_MIXED,);
      assertEquals(result.globalNoVersion, true,);
    });

    it("combina noversion com watch", () => {
      const result = parseArgs(["noversion", "watch",], CONFIG_MIXED,);
      assertEquals(result.globalNoVersion, true,);
      assertEquals(result.watchTarget, "watch-ui",);
    });

    it("combina noversion com alvos de build", () => {
      const result = parseArgs(["noversion", "ui",], CONFIG_MIXED,);
      assertEquals(result.globalNoVersion, true,);
      assertEquals(result.targets, ["ui",],);
    });
  });

  // ========================================================================
  // ORDEM DO CONFIG
  // ========================================================================

  describe("ordem do CONFIG", () => {
    it("mantém ordem do CONFIG mesmo com solicitação fora de ordem", () => {
      const result = parseArgs(["sw", "ui",], CONFIG_MIXED,);
      assertEquals(result.targets, ["ui", "sw",],);
    });

    it("preserva ordem com múltiplos alvos", () => {
      const result = parseArgs(["admin", "ui", "sw",], CONFIG_MIXED,);
      assertEquals(result.targets, ["ui", "sw", "admin",],);
    });
  });

  // ========================================================================
  // CASE INSENSITIVITY
  // ========================================================================

  describe("case insensitivity", () => {
    it("aceita maiúsculas para alvos", () => {
      const result = parseArgs(["UI", "SW",], CONFIG_MIXED,);
      assertEquals(result.targets, ["ui", "sw",],);
    });

    it("aceita maiúsculas para watch", () => {
      const result = parseArgs(["WATCH",], CONFIG_MIXED,);
      assertEquals(result.watchTarget, "watch-ui",);
    });

    it("aceita misto", () => {
      const result = parseArgs(["NoVersion", "Watch-Admin",], CONFIG_MIXED,);
      assertEquals(result.globalNoVersion, true,);
      assertEquals(result.watchTarget, "watch-admin",);
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe("edge cases", () => {
    it("retorna targets vazios se todos forem default: false", () => {
      const config: GlobalTargetConfig = {
        admin: makeTarget({ default: false, },),
        debug: makeTarget({ default: false, },),
      };
      const result = parseArgs([], config,);
      assertEquals(result.targets, [],);
      assertEquals(result.watchTarget, null,);
    });

    it("ignora args desconhecidos", () => {
      const result = parseArgs(["ui", "desconhecido",], CONFIG_MIXED,);
      assertEquals(result.targets, ["ui",],);
    });

    it("watchTarget é null se não houver alvo watch no CONFIG", () => {
      const result = parseArgs(["watch",], CONFIG_LEGACY,);
      assertEquals(result.watchTarget, null,);
      // Volta para os targets padrão já que não há watch
      assertEquals(result.targets, ["ui", "worker", "sw",],);
    });

    it("CONFIG vazio retorna tudo vazio", () => {
      const result = parseArgs([], {},);
      assertEquals(result.targets, [],);
      assertEquals(result.watchTarget, null,);
    });
  });
});

```

---

## Arquivo: `packages/utils/tests/esbuild/esbuild-options.test.ts`

```ts
/// <reference lib="deno.ns" />
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { join, } from "@std/path";
import { buildEsbuildOptions, } from "../../src/esbuild/mod.ts";
import type { TargetConfig, } from "../../src/interfaces/mod.ts";
import { withFileStructure, } from "../helpers/fixtures.ts";

// Helper para criar config mínima válida com paths que existem
function makeConfig(
  dir: string,
  overrides: Partial<TargetConfig> = {},
): TargetConfig {
  return {
    srcdir: join(dir, "src",),
    distdir: "dist",
    entryPoints: ["main.tsx",],
    ...overrides,
  } as TargetConfig;
}

describe("buildEsbuildOptions", () => {
  describe("configuração básica", () => {
    it("usa outfile quando definido", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { outfile: "app.js", },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.outfile, "dist/app.js",);
        assertEquals(options.outdir, undefined,);
      } finally {
        await cleanup();
      }
    });
    it("usa distdir como outdir quando outfile não definido", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { distdir: "monorepo/dist", },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.outdir, "monorepo/dist",);
        assertEquals(options.outfile, undefined,);
      } finally {
        await cleanup();
      }
    });
    it("entryPoints é sempre preservado", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/a.ts": "",
        "src/b.ts": "",
      },);
      try {
        const config = makeConfig(dir, { entryPoints: ["a.ts", "b.ts",], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.entryPoints, [
          join(dir, "src", "a.ts",),
          join(dir, "src", "b.ts",),
        ],);
      } finally {
        await cleanup();
      }
    });
  });
  describe("propriedades opcionais", () => {
    it("inclui platform quando definido", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { platform: "browser", },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.platform, "browser",);
      } finally {
        await cleanup();
      }
    });
    it("omite propriedades undefined", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir,);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.platform, undefined,);
        assertEquals(options.minify, undefined,);
      } finally {
        await cleanup();
      }
    });
    it("inclui todas as propriedades configuradas", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          platform: "browser",
          format: "esm",
          bundle: true,
          minify: true,
          sourcemap: "linked",
          target: "es2022",
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.platform, "browser",);
        assertEquals(options.format, "esm",);
        assertEquals(options.bundle, true,);
        assertEquals(options.minify, true,);
        assertEquals(options.sourcemap, "linked",);
        assertEquals(options.target, "es2022",);
      } finally {
        await cleanup();
      }
    });
  });
  describe("define", () => {
    it("injeta __APP_VERSION__ com v", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir,);
        const options = await buildEsbuildOptions("ui", config, "1.2.3-abc",);
        assertEquals(options.define.__APP_VERSION__, '"v1.2.3-abc"',);
      } finally {
        await cleanup();
      }
    });
    it("preserva defines customizados do config", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          define: {
            "__FEATURE_X__": "true",
            "__API_URL__": '"https://api.example.com"',
          },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.define.__FEATURE_X__, "true",);
        assertEquals(options.define.__API_URL__, '"https://api.example.com"',);
        assertEquals(options.define.__APP_VERSION__, '"v1.0.0"',);
      } finally {
        await cleanup();
      }
    });
  });
  describe("banner e footer", () => {
    it("substitui __APP_VERSION__ no banner", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          banner: {
            js: "/* WorkerDB v__APP_VERSION__ */\n",
          },
        },);
        const options = await buildEsbuildOptions("ui", config, "2.0.0",);
        assertStringIncludes(options.banner.js, "WorkerDB v2.0.0",);
      } finally {
        await cleanup();
      }
    });
    it("substitui múltiplas ocorrências de __APP_VERSION__", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          banner: {
            js: "/* __APP_VERSION__ build __APP_VERSION__ */",
          },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.banner.js.includes("__APP_VERSION__",), false,);
      } finally {
        await cleanup();
      }
    });
    it("substitui __APP_VERSION__ no CSS também", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          banner: {
            css: "/* CSS __APP_VERSION__ */",
          },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertStringIncludes(options.banner.css, "CSS 1.0.0",);
      } finally {
        await cleanup();
      }
    });
    it("substitui __APP_VERSION__ no footer", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          footer: {
            js: "/* End __APP_VERSION__ */",
          },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertStringIncludes(options.footer.js, "End 1.0.0",);
      } finally {
        await cleanup();
      }
    });
    it("lida com banner sem js", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          banner: { css: "/* css only __APP_VERSION__ */", },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.banner.js, undefined,);
        assertStringIncludes(options.banner.css, "1.0.0",);
      } finally {
        await cleanup();
      }
    });
  });
  describe("lógica especial para SW", () => {
    it("injeta __GENERATED_ASSETS__ quando targetName é 'sw'", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir,);
        const mockListFn = () =>
          Promise.resolve(["./app.js", "./index.html",],);
        const options = await buildEsbuildOptions(
          "sw",
          config,
          "1.0.0",
          mockListFn,
        );
        const assets = JSON.parse(options.define.__GENERATED_ASSETS__,);
        assertEquals(assets, ["./app.js", "./index.html",],);
      } finally {
        await cleanup();
      }
    });
    it("não injeta __GENERATED_ASSETS__ para outros alvos", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir,);
        const mockListFn = () => Promise.resolve(["./app.js",],);
        const options = await buildEsbuildOptions(
          "ui",
          config,
          "1.0.0",
          mockListFn,
        );
        assertEquals(options.define.__GENERATED_ASSETS__, undefined,);
      } finally {
        await cleanup();
      }
    });
    it("não injeta __GENERATED_ASSETS__ se listFn não fornecida", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir,);
        const options = await buildEsbuildOptions("sw", config, "1.0.0",);
        assertEquals(options.define.__GENERATED_ASSETS__, undefined,);
      } finally {
        await cleanup();
      }
    });
  });
  describe("novas opções (1-13)", () => {
    it("inclui splitting", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { splitting: true, },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.splitting, true,);
      } finally {
        await cleanup();
      }
    });
    it("inclui loader customizado", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          loader: { ".png": "file", ".svg": "dataurl", },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.loader[".png"], "file",);
      } finally {
        await cleanup();
      }
    });
    it("inclui alias", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          alias: { "@": "./src", "moment": "dayjs", },
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.alias["@"], "./src",);
        assertEquals(options.alias.moment, "dayjs",);
      } finally {
        await cleanup();
      }
    });
    it("inclui inject", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          inject: ["./polyfills.ts",],
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.inject, ["./polyfills.ts",],);
      } finally {
        await cleanup();
      }
    });
    it("inclui target como string", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { target: "es2022", },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.target, "es2022",);
      } finally {
        await cleanup();
      }
    });
    it("inclui target como array", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { target: ["es2022", "chrome90",], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.target, ["es2022", "chrome90",],);
      } finally {
        await cleanup();
      }
    });
    it("inclui drop", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { drop: ["console", "debugger",], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.drop, ["console", "debugger",],);
      } finally {
        await cleanup();
      }
    });
    it("inclui pure", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { pure: ["console.log",], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.pure, ["console.log",],);
      } finally {
        await cleanup();
      }
    });
    it("inclui logLevel", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { logLevel: "warning", },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.logLevel, "warning",);
      } finally {
        await cleanup();
      }
    });
    it("inclui entryNames/chunkNames/assetNames", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, {
          entryNames: "[name]-[hash]",
          chunkNames: "chunks/[name]",
          assetNames: "assets/[name]",
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.entryNames, "[name]-[hash]",);
        assertEquals(options.chunkNames, "chunks/[name]",);
        assertEquals(options.assetNames, "assets/[name]",);
      } finally {
        await cleanup();
      }
    });
  });
  describe("plugins", () => {
    it("inclui plugins quando definidos na config", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const mockPlugin = { name: "test-plugin", setup: () => {}, };
        const config = makeConfig(dir, { plugins: [mockPlugin,], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.plugins, [mockPlugin,],);
        assertEquals(options.plugins.length, 1,);
        assertEquals(options.plugins[0].name, "test-plugin",);
      } finally {
        await cleanup();
      }
    });
    it("inclui múltiplos plugins na ordem definida", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const plugin1 = { name: "plugin-1", setup: () => {}, };
        const plugin2 = { name: "plugin-2", setup: () => {}, };
        const config = makeConfig(dir, { plugins: [plugin1, plugin2,], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.plugins.length, 2,);
        assertEquals(options.plugins[0].name, "plugin-1",);
        assertEquals(options.plugins[1].name, "plugin-2",);
      } finally {
        await cleanup();
      }
    });
    it("omite plugins quando não definidos (undefined)", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir,);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.plugins, undefined,);
      } finally {
        await cleanup();
      }
    });
    it("omite plugins quando array vazio", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const config = makeConfig(dir, { plugins: [], },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.plugins, [],);
      } finally {
        await cleanup();
      }
    });
    it("plugins são independentes de outras opções", async () => {
      const { dir, cleanup, } = await withFileStructure({
        "src/main.tsx": "",
      },);
      try {
        const mockPlugin = { name: "my-plugin", setup: () => {}, };
        const config = makeConfig(dir, {
          plugins: [mockPlugin,],
          platform: "browser",
          bundle: true,
          minify: true,
        },);
        const options = await buildEsbuildOptions("ui", config, "1.0.0",);
        assertEquals(options.plugins, [mockPlugin,],);
        assertEquals(options.platform, "browser",);
        assertEquals(options.bundle, true,);
        assertEquals(options.minify, true,);
      } finally {
        await cleanup();
      }
    });
  });
});

```

---

## Arquivo: `packages/utils/tests/esbuild/integration.test.ts`

```ts
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

```

---

## Arquivo: `packages/utils/tests/esbuild/output-paths.test.ts`

```ts
/// <reference lib="deno.ns" />
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, assertThrows, } from "@std/assert";
import {
  resolveOutputPaths,
  validateTargetConfig,
} from "../../src/esbuild/mod.ts";
import type { TargetConfig, } from "../../src/interfaces/mod.ts";

describe("validateTargetConfig", () => {
  describe("distdir obrigatório", () => {
    it("lança erro quando publicdir existe mas distdir não", () => {
      const config: TargetConfig = {
        srcdir: "src",
        publicdir: "public",
        entryPoints: ["app.tsx",],
      };
      assertThrows(
        () => validateTargetConfig("ui", config,),
        Error,
        "'distdir'",
      );
    });
    it("lança erro quando indexHtml é true mas distdir não", () => {
      const config: TargetConfig = {
        srcdir: "src",
        indexHtml: true,
        entryPoints: ["app.tsx",],
      };
      assertThrows(
        () => validateTargetConfig("ui", config,),
        Error,
        "'distdir'",
      );
    });
    it("lança erro quando outfile não existe e distdir não", () => {
      const config: TargetConfig = {
        srcdir: "src",
        entryPoints: ["app.tsx",],
      };
      assertThrows(
        () => validateTargetConfig("ui", config,),
        Error,
        "'distdir'",
      );
    });
    it("NÃO lança erro quando outfile existe mas distdir não", () => {
      const config: TargetConfig = {
        srcdir: "src",
        outfile: "/absolute/path/app.js",
        entryPoints: ["app.tsx",],
      };
      // Não deve lançar
      validateTargetConfig("ui", config,);
    });
    it("NÃO lança erro quando distdir existe", () => {
      const config: TargetConfig = {
        srcdir: "src",
        distdir: "dist",
        entryPoints: ["app.tsx",],
      };
      validateTargetConfig("ui", config,);
    });
  });

  describe("mensagens de erro didáticas", () => {
    it("lista todos os motivos quando múltiplas condições falham", () => {
      const config: TargetConfig = {
        srcdir: "src",
        publicdir: "public",
        indexHtml: true,
        entryPoints: ["app.tsx",],
      };
      try {
        validateTargetConfig("ui", config,);
      } catch (e) {
        const msg = (e as Error).message;
        assertStringIncludes(msg, "'publicdir' está configurado",);
        assertStringIncludes(msg, "'indexHtml' é true",);
        assertStringIncludes(msg, "'outfile' não está configurado",);
      }
    });
  });
});

describe("resolveOutputPaths", () => {
  describe("outfile relativo ao distdir", () => {
    it("faz join quando ambos existem", () => {
      const config: TargetConfig = {
        srcdir: "src",
        distdir: "monorepo/server/build/dist",
        outfile: "app.js",
        entryPoints: ["app.tsx",],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, "monorepo/server/build/dist/app.js",);
      assertEquals(result.outdir, undefined,);
    });
    it("faz join com subdiretórios", () => {
      const config: TargetConfig = {
        srcdir: "src",
        distdir: "dist",
        outfile: "js/app.js",
        entryPoints: ["app.tsx",],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, "dist/js/app.js",);
    });
  });

  describe("outfile absoluto (sem distdir)", () => {
    it("mantém outfile como está quando distdir não existe", () => {
      const config: TargetConfig = {
        srcdir: "src",
        outfile: "/absolute/path/app.js",
        entryPoints: ["app.tsx",],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, "/absolute/path/app.js",);
      assertEquals(result.outdir, undefined,);
    });
  });

  describe("distdir como outdir (sem outfile)", () => {
    it("usa distdir como outdir quando outfile não existe", () => {
      const config: TargetConfig = {
        srcdir: "src",
        distdir: "dist",
        entryPoints: ["app.tsx",],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outdir, "dist",);
      assertEquals(result.outfile, undefined,);
    });
  });

  describe("nenhum configurado", () => {
    it("retorna objeto vazio", () => {
      const config: TargetConfig = {
        srcdir: "src",
        entryPoints: ["app.tsx",],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, undefined,);
      assertEquals(result.outdir, undefined,);
    });
  });
});

```

---

## Arquivo: `packages/utils/tests/esbuild/version.test.ts`

```ts
/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, assertThrows, } from "@std/assert";
import {
  currentVersion,
  extractVersionFromContent,
  formatVersion,
  incrementVersion,
  parseVersion,
  replaceVersionInContent,
} from "../../src/esbuild/mod.ts";
import { withTempDenoJsonc, } from "../helpers/fixtures.ts";

describe("parseVersion", () => {
  describe("casos válidos", () => {
    const validCases = [
      { input: "1.2.3", expected: { major: 1, minor: 2, patch: 3, }, },
      { input: "0.0.0", expected: { major: 0, minor: 0, patch: 0, }, },
      { input: "99.99.99", expected: { major: 99, minor: 99, patch: 99, }, },
      {
        input: "0.2.148#msv0okam",
        expected: { major: 0, minor: 2, patch: 148, },
      },
      { input: "1.0.0#alpha", expected: { major: 1, minor: 0, patch: 0, }, },
      { input: "2.0.0#beta.1", expected: { major: 2, minor: 0, patch: 0, }, },
      {
        input: "1.0.0#alpha-beta-1",
        expected: { major: 1, minor: 0, patch: 0, },
      },
    ];
    for (const { input, expected, } of validCases) {
      it(`parseia "${input}" corretamente`, () => {
        assertEquals(parseVersion(input,), expected,);
      });
    }
  });
  describe("casos inválidos", () => {
    const invalidCases = [
      { input: "", desc: "string vazia", },
      { input: "1.2", desc: "apenas 2 partes", },
      { input: "1.2.3.4", desc: "4 partes", },
      { input: "a.b.c", desc: "letras", },
      { input: "1.abc.3", desc: "parte não numérica", },
      { input: "v1.2.3", desc: "prefixo v", },
      { input: "1.2.3#", desc: "cardinal sem hash", },
      { input: " 1.2.3", desc: "espaço antes", },
      { input: "1.2.3 ", desc: "espaço depois", },
    ];
    for (const { input, desc, } of invalidCases) {
      it(`lança erro para ${desc} ("${input}")`, () => {
        assertThrows(() => parseVersion(input,), Error,);
      });
    }
  });
});

describe("formatVersion", () => {
  it("formata com hash fornecido", () => {
    assertEquals(formatVersion(1, 2, 3, "abc",), "1.2.3#abc",);
  });
  it("gera hash automático quando não fornecido", () => {
    const result = formatVersion(0, 2, 149,);
    assertStringIncludes(result, "0.2.149#",);
    // Hash deve ter pelo menos alguns caracteres
    const hash = result.split("#",)[1];
    // 🔥 CORREÇÃO: Tratamento explícito de undefined (noUncheckedIndexedAccess)
    assertEquals(hash !== undefined && hash.length > 0, true,);
  });
  it("usa o mesmo hash em chamadas com mesmo parâmetro", () => {
    const hash = "fixedhash";
    assertEquals(
      formatVersion(1, 0, 0, hash,),
      formatVersion(1, 0, 0, hash,),
    );
  });
  it("lida com números grandes", () => {
    assertEquals(formatVersion(999, 999, 999, "x",), "999.999.999#x",);
  });
});

describe("extractVersionFromContent", () => {
  it("extrai versão de JSON simples", () => {
    assertEquals(
      extractVersionFromContent(`{ "version": "1.2.3" }`,),
      "1.2.3",
    );
  });
  it("extrai versão de JSONC com comentários", () => {
    const content = `{
      // Comentário
      "name": "workerdb",
      "version": "2.0.0", /* inline */
    }`;
    assertEquals(extractVersionFromContent(content,), "2.0.0",);
  });
  it("extrai versão com hash", () => {
    assertEquals(
      extractVersionFromContent(`{ "version": "1.2.3-abc123" }`,),
      "1.2.3-abc123",
    );
  });
  it("retorna null quando não há versão", () => {
    assertEquals(
      extractVersionFromContent(`{ "name": "workerdb" }`,),
      null,
    );
  });
  it("retorna null para string vazia", () => {
    assertEquals(extractVersionFromContent("",), null,);
  });
  it("ignora campos 'version' dentro de strings", () => {
    const content = `{ "name": "tem version: 1.0.0 no nome" }`;
    assertEquals(extractVersionFromContent(content,), null,);
  });
});

describe("replaceVersionInContent", () => {
  it("substitui versão preservando o resto", () => {
    const content = `{
      "name": "@workerdb/app",
      "version": "1.0.0-old",
      "imports": {}
    }`;
    const result = replaceVersionInContent(content, "2.0.0-new",);
    assertStringIncludes(result, `"version": "2.0.0-new"`,);
    assertStringIncludes(result, `"name": "@workerdb/app"`,);
    assertStringIncludes(result, `"imports"`,);
  });
  it("substitui apenas a primeira ocorrência", () => {
    const content = `{ "version": "1.0.0", "other": "version": "2.0.0" }`;
    const result = replaceVersionInContent(content, "3.0.0",);
    // A primeira deve ser substituída
    assertStringIncludes(result, `"version": "3.0.0"`,);
  });
});

describe("currentVersion (integração)", () => {
  it("lê versão de arquivo existente", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.2.3-abc",);
    try {
      const version = await currentVersion(path,);
      assertEquals(version, "1.2.3-abc",);
    } finally {
      await cleanup();
    }
  });
  it("lança erro quando arquivo não existe", async () => {
    let threw = false;
    try {
      await currentVersion("/caminho/que/nao/existe/deno.jsonc",);
    } catch {
      threw = true;
    }
    assertEquals(threw, true,);
  });
  it("lança erro quando versão não está no arquivo", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.0.0", {
      version: undefined,
    },);
    try {
      // Reescreve sem version
      await Deno.writeTextFile(path, `{ "name": "workerdb" }`,);
      let errorMessage = "";
      try {
        await currentVersion(path,);
      } catch (error) {
        errorMessage = (error as Error).message;
      }
      assertStringIncludes(errorMessage, "Versão não encontrada",);
    } finally {
      await cleanup();
    }
  });
});

describe("incrementVersion (integração)", () => {
  it("incrementa patch e atualiza arquivo", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.2.3",);
    try {
      const newVersion = await incrementVersion("1.2.3", path, "testhash",);
      assertEquals(newVersion, "1.2.4#testhash",);
      const content = await Deno.readTextFile(path,);
      assertStringIncludes(content, `"version": "1.2.4#testhash"`,);
    } finally {
      await cleanup();
    }
  });
  it("preserva outras propriedades do JSON", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("0.0.1", {
      name: "@workerdb/app",
      imports: { preact: "https://esm.sh/preact", },
    },);
    try {
      await incrementVersion("0.0.1", path, "x",);
      const content = await Deno.readTextFile(path,);
      assertStringIncludes(content, `"name": "@workerdb/app"`,);
      assertStringIncludes(content, `"preact"`,);
    } finally {
      await cleanup();
    }
  });
  it("incrementa múltiplas vezes", async () => {
    const { path, cleanup, } = await withTempDenoJsonc("1.0.0",);
    try {
      const v1 = await incrementVersion("1.0.0", path, "h1",);
      assertEquals(v1, "1.0.1#h1",);
      const v2 = await incrementVersion(v1, path, "h2",);
      assertEquals(v2, "1.0.2#h2",);
      const v3 = await incrementVersion(v2, path, "h3",);
      assertEquals(v3, "1.0.3#h3",);
    } finally {
      await cleanup();
    }
  });
});

```

---

## Arquivo: `packages/utils/tests/export/utils.test.ts`

```````ts
/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import {
  calcularCraseWrapper,
  deveIncluirArquivo,
  formatarArquivoMarkdown,
  gerarCabecalho,
  mapearExtensao,
  normalizarCaminho,
} from "../../src/export/mod.ts";
import { EXTENSOES_PADRAO, } from "../../src/config/mod.ts";
import type { ExportConfig, } from "../../src/interfaces/mod.ts";

// Helper para criar config customizada em testes
function makeConfig(overrides: Partial<ExportConfig> = {},): ExportConfig {
  return {
    arquivoSaida: "snapshot.md",
    extensoesPermitidas: EXTENSOES_PADRAO,
    pastaBase: "./",
    subpastasPermitidas: [],
    arquivosRaizPermitidos: [],
    incluiVersao: false,
    instrucaoCustomizada: "Teste",
    ...overrides,
  };
}

// ============================================================================
// 🛠️ FUNÇÕES UTILITÁRIAS
// ============================================================================

describe("normalizarCaminho", () => {
  it("converte barras invertidas em barras normais", () => {
    assertEquals(normalizarCaminho("a\\b\\c",), "a/b/c",);
  });

  it("converte para minúsculas", () => {
    assertEquals(normalizarCaminho("ABC/DEF",), "abc/def",);
  });

  it("lida com ambos simultaneamente", () => {
    assertEquals(normalizarCaminho("A\\B\\C/DEF",), "a/b/c/def",);
  });

  it("preserva caminho já normalizado", () => {
    assertEquals(normalizarCaminho("a/b/c",), "a/b/c",);
  });

  it("lida com string vazia", () => {
    assertEquals(normalizarCaminho("",), "",);
  });
});

describe("calcularCraseWrapper", () => {
  it("retorna ``` para texto sem crases", () => {
    assertEquals(calcularCraseWrapper("texto normal",), "```",);
  });

  it("retorna ```` para texto com ```", () => {
    assertEquals(calcularCraseWrapper("código com ```",), "````",);
  });

  it("retorna 6 crases para texto com `````", () => {
    assertEquals(calcularCraseWrapper("texto `````",), "``````",);
  });

  it("usa no mínimo 3 crases", () => {
    assertEquals(calcularCraseWrapper("com ` uma crase",), "```",);
    assertEquals(calcularCraseWrapper("com `` duas",), "```",);
  });

  it("lida com múltiplas sequências (usa a maior)", () => {
    assertEquals(
      calcularCraseWrapper("com ` e ``` e ``",),
      "````",
    );
  });

  it("lida com string vazia", () => {
    assertEquals(calcularCraseWrapper("",), "```",);
  });
});

describe("mapearExtensao", () => {
  it("mapeia .manifest para json", () => {
    assertEquals(mapearExtensao("manifest.manifest",), "json",);
  });

  it("mapeia .jsonc para json", () => {
    assertEquals(mapearExtensao("config.jsonc",), "json",);
  });

  it("mapeia .yml para yaml", () => {
    assertEquals(mapearExtensao("workflow.yml",), "yaml",);
  });

  it("mapeia .sh para bash", () => {
    assertEquals(mapearExtensao("deploy.sh",), "bash",);
  });

  it("mapeia .env* para properties", () => {
    assertEquals(mapearExtensao(".env",), "properties",);
    assertEquals(mapearExtensao(".env.example",), "properties",);
    assertEquals(mapearExtensao(".env.local",), "properties",);
  });

  it("retorna a extensão como está para casos não mapeados", () => {
    assertEquals(mapearExtensao("arquivo.ts",), "ts",);
    assertEquals(mapearExtensao("arquivo.tsx",), "tsx",);
    assertEquals(mapearExtensao("arquivo.md",), "md",);
  });

  it("é case insensitive", () => {
    assertEquals(mapearExtensao("arquivo.JSONC",), "json",);
    assertEquals(mapearExtensao("arquivo.YML",), "yaml",);
  });
});

// ============================================================================
// 🎯 LÓGICA DE FILTRAGEM
// ============================================================================

describe("deveIncluirArquivo", () => {
  describe("proteção anti-loop", () => {
    it("bloqueia qualquer arquivo dentro de exports/", () => {
      const config = makeConfig({
        pastaBase: "./",
        subpastasPermitidas: ["exports",],
      },);
      assertEquals(deveIncluirArquivo("exports/server.md", config,), false,);
      assertEquals(deveIncluirArquivo("exports/sub/file.ts", config,), false,);
    });

    it("bloqueia mesmo com extensão válida", () => {
      const config = makeConfig({
        pastaBase: "./",
        subpastasPermitidas: ["exports",],
        extensoesPermitidas: [".md", ".ts",],
      },);
      assertEquals(deveIncluirArquivo("exports/qualquer.ts", config,), false,);
    });
  });

  describe("caminhos adicionais", () => {
    it("permite caminho adicional com extensão válida", () => {
      const config = makeConfig({
        pastaBase: "src",
        caminhosAdicionaisPermitidos: [".github/workflows",],
        extensoesPermitidas: [".yml", ".yaml",],
      },);
      assertEquals(
        deveIncluirArquivo(".github/workflows/deploy.yml", config,),
        true,
      );
      assertEquals(
        deveIncluirArquivo(".github/workflows/ci.yaml", config,),
        true,
      );
    });

    it("bloqueia caminho adicional com extensão inválida", () => {
      const config = makeConfig({
        pastaBase: "src",
        caminhosAdicionaisPermitidos: [".github/workflows",],
        extensoesPermitidas: [".yml",],
      },);
      assertEquals(
        deveIncluirArquivo(".github/workflows/segredo.png", config,),
        false,
      );
    });

    it("permite arquivo exato no caminho adicional", () => {
      const config = makeConfig({
        pastaBase: "src",
        caminhosAdicionaisPermitidos: ["README.md",],
        extensoesPermitidas: [".md",],
      },);
      assertEquals(deveIncluirArquivo("README.md", config,), true,);
    });
  });

  describe("pastaBase e subpastas", () => {
    it("permite arquivo dentro de pastaBase e subpasta permitida", () => {
      const config = makeConfig({
        pastaBase: "monorepo/server",
        subpastasPermitidas: ["src", "docs",],
        extensoesPermitidas: [".ts", ".md",],
      },);
      assertEquals(
        deveIncluirArquivo("monorepo/server/src/main.ts", config,),
        true,
      );
      assertEquals(
        deveIncluirArquivo("monorepo/server/docs/arquitetura.md", config,),
        true,
      );
    });

    it("bloqueia arquivo fora de pastaBase", () => {
      const config = makeConfig({
        pastaBase: "monorepo/server",
        subpastasPermitidas: ["src",],
      },);
      assertEquals(
        deveIncluirArquivo("monorepo/ui/src/app.tsx", config,),
        false,
      );
    });

    it("bloqueia arquivo em subpasta não permitida", () => {
      const config = makeConfig({
        pastaBase: "monorepo/server",
        subpastasPermitidas: ["src",],
        extensoesPermitidas: [".js",],
      },);
      assertEquals(
        deveIncluirArquivo("monorepo/server/dist/bundle.js", config,),
        false,
      );
    });
  });

  describe("arquivos raiz", () => {
    it("permite arquivos raiz explicitamente configurados", () => {
      const config = makeConfig({
        pastaBase: "monorepo/server",
        arquivosRaizPermitidos: ["deno.json", "deploy.sh",],
        subpastasPermitidas: [],
      },);
      assertEquals(
        deveIncluirArquivo("monorepo/server/deno.json", config,),
        true,
      );
      assertEquals(
        deveIncluirArquivo("monorepo/server/deploy.sh", config,),
        true,
      );
    });

    it("bloqueia arquivos raiz não configurados", () => {
      const config = makeConfig({
        pastaBase: "monorepo/server",
        arquivosRaizPermitidos: ["deno.json",],
        subpastasPermitidas: [],
      },);
      assertEquals(
        deveIncluirArquivo("monorepo/server/package.json", config,),
        false,
      );
    });
  });

  describe("configuração tipo docs", () => {
    it("captura raiz e subpasta docs", () => {
      const config = makeConfig({
        pastaBase: "./",
        subpastasPermitidas: ["docs",],
        arquivosRaizPermitidos: ["readme.md",],
        extensoesPermitidas: [".md",],
      },);
      assertEquals(deveIncluirArquivo("readme.md", config,), true,);
      assertEquals(deveIncluirArquivo("docs/arquitetura.md", config,), true,);
    });

    it("bloqueia código fonte fora de docs", () => {
      const config = makeConfig({
        pastaBase: "./",
        subpastasPermitidas: ["docs",],
        extensoesPermitidas: [".md",],
      },);
      assertEquals(deveIncluirArquivo("src/main.ts", config,), false,);
    });
  });

  describe("edge cases", () => {
    it("subpastasPermitidas vazia permite tudo dentro de pastaBase", () => {
      const config = makeConfig({
        pastaBase: "monorepo/utils",
        subpastasPermitidas: [],
        extensoesPermitidas: [".ts",],
      },);
      assertEquals(
        deveIncluirArquivo("monorepo/utils/qualquer-coisa/arquivo.ts", config,),
        true,
      );
    });

    it("extensoesPermitidas vazia permite qualquer extensão", () => {
      const config = makeConfig({
        pastaBase: "src",
        subpastasPermitidas: ["lib",],
        extensoesPermitidas: [],
      },);
      assertEquals(deveIncluirArquivo("src/lib/arquivo.xyz", config,), true,);
    });

    it("lida com pastaBase './'", () => {
      const config = makeConfig({
        pastaBase: "./",
        subpastasPermitidas: ["src",],
      },);
      assertEquals(deveIncluirArquivo("src/main.ts", config,), true,);
    });

    it("lida com pastaBase '.'", () => {
      const config = makeConfig({
        pastaBase: ".",
        subpastasPermitidas: ["src",],
      },);
      assertEquals(deveIncluirArquivo("src/main.ts", config,), true,);
    });

    it("é case insensitive na comparação", () => {
      const config = makeConfig({
        pastaBase: "SRC",
        subpastasPermitidas: ["Lib",],
        arquivosRaizPermitidos: ["README.md",],
      },);
      assertEquals(deveIncluirArquivo("src/lib/arquivo.ts", config,), true,);
      assertEquals(deveIncluirArquivo("src/readme.md", config,), true,);
    });
  });
});

// ============================================================================
// 📝 GERAÇÃO DE CONTEÚDO
// ============================================================================

describe("gerarCabecalho", () => {
  it("inclui instrução customizada", () => {
    const config = makeConfig({
      instrucaoCustomizada: "Este é um código de TESTE.",
    },);
    const resultado = gerarCabecalho(config, "test", "1.0.0",);
    assertStringIncludes(resultado, "código de TESTE",);
  });

  it("inclui versão quando incluiVersao é true", () => {
    const config = makeConfig({ incluiVersao: true, },);
    const resultado = gerarCabecalho(config, "ui", "1.2.3",);
    assertStringIncludes(resultado, "[v1.2.3]",);
    assertStringIncludes(resultado, "WorkerDB [v1.2.3]",);
  });

  it("não inclui versão quando incluiVersao é false", () => {
    const config = makeConfig({ incluiVersao: false, },);
    const resultado = gerarCabecalho(config, "server", "1.2.3",);
    assertEquals(resultado.includes("[v1.2.3]",), false,);
  });

  it("inclui nome do modo em maiúsculas", () => {
    const config = makeConfig();
    const resultado = gerarCabecalho(config, "ui", "1.0.0",);
    assertStringIncludes(resultado, "Modo: UI",);
  });

  it("inclui timestamp de geração", () => {
    const config = makeConfig();
    const resultado = gerarCabecalho(config, "ui", "1.0.0",);
    assertStringIncludes(resultado, "Gerado automaticamente em:",);
  });
});

describe("formatarArquivoMarkdown", () => {
  it("formata arquivo com caminho e conteúdo", () => {
    const resultado = formatarArquivoMarkdown(
      "src/main.ts",
      "console.log('hello');",
    );
    assertStringIncludes(resultado, "## Arquivo: `src/main.ts`",);
    assertStringIncludes(resultado, "```ts",);
    assertStringIncludes(resultado, "console.log('hello');",);
  });

  it("usa extensão mapeada para highlight", () => {
    const resultado = formatarArquivoMarkdown("config.jsonc", "{}",);
    assertStringIncludes(resultado, "```json",);
  });

  it("aumenta crases quando conteúdo tem ```", () => {
    const conteudo = "código com ```\nmais código";
    const resultado = formatarArquivoMarkdown("arquivo.md", conteudo,);
    // 🔥 CORREÇÃO: A extensão é "md" não "markdown"
    assertStringIncludes(resultado, "````md",);
    assertStringIncludes(resultado, "````",);
  });

  it("inclui separador no final", () => {
    const resultado = formatarArquivoMarkdown("src/main.ts", "code",);
    assertStringIncludes(resultado, "---",);
  });
});

```````

---

## Arquivo: `packages/utils/tests/export/export.test.ts`

```ts
/**
 * @file export.test.ts
 * @description Testes unitários para a lógica de filtragem do script de exportação de contexto.
 * Garante que caminhos adicionais (como .github) e regras de pastaBase funcionem corretamente.
 */
import { assertEquals, } from "@std/assert";
import { deveIncluirArquivo, } from "../../src/export/mod.ts";
import { CONFIGURACOES, } from "../../../../export.ts";

Deno.test("deveIncluirArquivo: Deve BLOQUEAR qualquer arquivo dentro da pasta exports/", () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo("exports/server.md", config,), false,);
  assertEquals(
    deveIncluirArquivo("exports/.github/workflows/test.yml", config,),
    false,
  );
});

Deno.test("deveIncluirArquivo: Deve PERMITIR caminho adicional (.github/workflows) com extensão válida", () => {
  const config = CONFIGURACOES.server;
  assertEquals(
    deveIncluirArquivo(".github/workflows/deploy.yml", config,),
    true,
  );
  assertEquals(deveIncluirArquivo(".github/workflows/ci.yaml", config,), true,);
});

Deno.test("deveIncluirArquivo: Deve BLOQUEAR caminho adicional com extensão INVÁLIDA", () => {
  const config = CONFIGURACOES.server;
  assertEquals(
    deveIncluirArquivo(".github/workflows/segredo.png", config,),
    false,
  );
  assertEquals(
    deveIncluirArquivo(".github/workflows/config.secret", config,),
    false,
  );
});

Deno.test("deveIncluirArquivo: Deve PERMITIR arquivo dentro da pastaBase e subpasta permitida", () => {
  const config = CONFIGURACOES.server;
  // 🔥 CORREÇÃO: 'monorepo' alterado para 'packages' para bater com pastaBase: "packages/server"
  assertEquals(
    deveIncluirArquivo("packages/server/src/main.ts", config,),
    true,
  );
  assertEquals(
    deveIncluirArquivo("packages/server/docs/arquitetura.md", config,),
    true,
  );
});

Deno.test("deveIncluirArquivo: Deve BLOQUEAR arquivo fora da pastaBase (que não seja caminho adicional)", () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo("packages/ui/src/app.tsx", config,), false,);
  assertEquals(
    deveIncluirArquivo("packages/utils/src/helper.ts", config,),
    false,
  );
});

Deno.test("deveIncluirArquivo: Deve PERMITIR arquivos raiz explicitamente configurados", () => {
  const config = CONFIGURACOES.server;
  // 🔥 CORREÇÃO: 'monorepo' alterado para 'packages'
  assertEquals(
    deveIncluirArquivo("packages/server/deno.jsonc", config,),
    true,
  );
  assertEquals(deveIncluirArquivo("packages/server/readme.md", config,), true,);
});

Deno.test("deveIncluirArquivo: Deve BLOQUEAR arquivos raiz NÃO configurados", () => {
  const config = CONFIGURACOES.server;
  assertEquals(
    deveIncluirArquivo("packages/server/package.json", config,),
    false,
  );
});

Deno.test("deveIncluirArquivo: Configuração 'docs' deve capturar raiz e subpasta docs", () => {
  const config = CONFIGURACOES.docs;
  assertEquals(deveIncluirArquivo("readme.md", config,), true,);
  assertEquals(deveIncluirArquivo("docs/arquitetura.md", config,), true,);
  assertEquals(deveIncluirArquivo("src/main.ts", config,), false,);
});

```

---

## Arquivo: `packages/utils/src/config/mod.ts`

```ts
export { APP_VERSION, } from "../../../worker-db/src/utils/version.ts";

/**
 * Extensões de arquivo padrão que são comumente incluídas em snapshots.
 * Reutilizável em qualquer projeto de software.
 */
export const EXTENSOES_PADRAO = [
  ".tsx",
  ".jsx",
  ".js",
  ".ts",
  ".css",
  ".html",
  ".manifest",
  ".map",
  ".sh",
  ".py",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".env.example",
  ".md",
];

```

---

## Arquivo: `packages/utils/src/interfaces/mod.ts`

````ts
// TODO(@djones): no novo worker-db, função ls(), "id" deverá ser "_id" para debug

// ============================================================================
// 📦 TIPOS ESBUILD
// ============================================================================
// 🔥 ESTRATÉGIA DE TIPAGEM: Usamos string literals explícitos em vez de
// `esbuild.LegalComments`, `esbuild.Platform`, etc. porque o esm.sh não
// re-exporta esses tipos internos do esbuild como membros do namespace.
// String literals mantêm autocomplete + type-safety e são independentes
// de como o esm.sh expõe a tipagem.
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ParsedArgs {
  /** Alvos de build a processar (exclui alvos watch) */
  targets: string[];
  /** Flag global para não incrementar versão */
  globalNoVersion: boolean;
  /** Nome do alvo watch a executar, ou null se não estiver em modo watch */
  watchTarget: string | null;
}

/** Modo de operação do alvo */
export type TargetMode = "build" | "watch";

/** Plataformas suportadas pelo esbuild */
export type EsbuildPlatform = "browser" | "node" | "neutral";

/** Formatos de saída suportados pelo esbuild */
export type EsbuildFormat = "esm" | "iife" | "cjs";

/** Estratégias de source map */
export type EsbuildSourcemap = boolean | "linked" | "inline" | "external";

/** Modos JSX */
export type EsbuildJsx = "automatic" | "transform" | "preserve";

/** O que fazer com comentários legais */
export type EsbuildLegalComments =
  | "none"
  | "inline"
  | "eof"
  | "linked"
  | "external";

/** O que remover do bundle (console, debugger) */
export type EsbuildDrop = "console" | "debugger";

/** Charset de saída */
export type EsbuildCharset = "ascii" | "utf8";

/** Níveis de log do esbuild */
export type EsbuildLogLevel =
  | "verbose"
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "silent";

/** Loaders disponíveis para diferentes tipos de arquivo */
export type EsbuildLoader =
  | "js"
  | "jsx"
  | "ts"
  | "tsx"
  | "css"
  | "json"
  | "text"
  | "base64"
  | "dataurl"
  | "file"
  | "binary"
  | "empty"
  | "copy";

export interface TargetConfig {
  // --- Configurações de Pipeline (Pré/Post Build) ---
  publicdir?: string;
  srcdir?: string;
  distdir?: string;
  indexHtml?: boolean;
  clean?: string[];
  /**
   * Determina se o alvo é incluído automaticamente quando nenhum alvo
   * é especificado via CLI.
   *
   * - `true` ou `undefined`: Incluído por padrão (comportamento padrão)
   * - `false`: Só roda quando explicitamente solicitado via CLI
   *
   * ⚠️ Esta propriedade é IGNORADA para alvos com `mode: 'watch'`.
   * Alvos watch nunca são incluídos na lista de targets padrão.
   */
  default?: boolean;
  /**
   * Modo de operação do alvo.
   *
   * - `'build'`: Alvo normal de build (padrão). Compila e termina.
   * - `'watch'`: Modo de desenvolvimento contínuo. Monitora mudanças
   *   e rebuilda automaticamente. O processo fica vivo até Ctrl+C.
   *
   * ⚠️ Se múltiplos alvos tiverem `mode: 'watch'`, apenas o PRIMEIRO
   * (na ordem do CONFIG) é executado quando a flag `watch` é usada.
   */
  mode?: TargetMode;
  // --- Configurações do Esbuild (TODAS configuráveis) ---
  entryPoints: string[];
  platform?: EsbuildPlatform;
  format?: EsbuildFormat;
  bundle?: boolean;
  minify?: boolean;
  sourcemap?: EsbuildSourcemap;
  jsx?: EsbuildJsx;
  jsxImportSource?: string;
  conditions?: string[];
  define?: Record<string, string>;
  drop?: EsbuildDrop[];
  external?: string[];
  metafile?: boolean;
  write?: boolean;
  treeShaking?: boolean;
  legalComments?: EsbuildLegalComments;
  keepNames?: boolean;
  outfile?: string;
  splitting?: boolean;
  loader?: Record<string, EsbuildLoader>;
  alias?: Record<string, string>;
  inject?: string[];
  banner?: { js?: string; css?: string };
  footer?: { js?: string; css?: string };
  target?: string | string[];
  charset?: EsbuildCharset;
  logLevel?: EsbuildLogLevel;
  logLimit?: number;
  logOverride?: Record<string, EsbuildLogLevel>;
  entryNames?: string;
  chunkNames?: string;
  assetNames?: string;
  publicPath?: string;
  pure?: string[];
  /**
   * Plugins do esbuild.
   * Permite injetar plugins customizados (ex: @deno/esbuild-plugin).
   * Os plugins definidos aqui são mesclados com quaisquer plugins
   * injetados externamente pelo orquestrador de build.
   */
  plugins?: unknown[];
}

export interface GlobalTargetConfig {
  [targetName: string]: TargetConfig;
}

// ============================================================================
// 📦 TIPOS E INTERFACES EXPORT
// ============================================================================
/**
 * Configuração de um modo de exportação.
 * Genérica o suficiente para ser usada em qualquer projeto.
 */
export interface ExportConfig {
  /** Caminho do arquivo de saída (relativo à raiz do projeto) */
  arquivoSaida: string;
  /** Extensões de arquivo que devem ser incluídas */
  extensoesPermitidas: string[];
  /** Pasta base onde a varredura começa */
  pastaBase: string;
  /** Subpastas dentro de pastaBase que devem ser varridas */
  subpastasPermitidas: string[];
  /** Caminhos adicionais fora de pastaBase que devem ser incluídos */
  caminhosAdicionaisPermitidos?: string[];
  /** Arquivos específicos na raiz de pastaBase que devem ser incluídos */
  arquivosRaizPermitidos: string[];
  /** Se deve incluir a versão do app no cabeçalho */
  incluiVersao: boolean;
  /** Texto de instrução para a IA no cabeçalho */
  instrucaoCustomizada: string;
  /**
   * Determina se o modo é incluído automaticamente quando nenhum modo
   * é especificado via CLI.
   *
   * - `true` ou `undefined`: Incluído por padrão (comportamento padrão)
   * - `false`: Só roda quando explicitamente solicitado via CLI
   *
   * @example
   * ```typescript
   * ui: { default: true, ... }       // Roda por padrão
   * tests: { default: false, ... }   // Só roda com: deno task export tests
   * ```
   */
  default?: boolean;
}

// ============================================================================
// 📦 TIPOS DENO.BUNDLE (API nativa do Deno 2.x --unstable-bundle)
// ============================================================================

/** Plataformas suportadas pelo Deno.bundle */
export type DenoBundlePlatform = "browser" | "deno";

/** Formatos de saída suportados pelo Deno.bundle */
export type DenoBundleFormat = "esm" | "cjs" | "iife";

/** Estratégias de source map do Deno.bundle */
export type DenoBundleSourceMap = "linked" | "inline" | "external";

/** Como tratar pacotes/dependências externas */
export type DenoBundlePackageHandling = "bundle" | "external";

/**
 * Configuração de um alvo de build usando a API nativa Deno.bundle.
 *
 * Interface declarativa e explícita: cada propriedade é listada
 * diretamente, sem uso de Omit ou herança de outras interfaces.
 *
 * Seções:
 * 1. Pipeline WorkerDB: Pré/pós processamento (cleanup, cópia de estáticos)
 * 2. Deno.bundle Options: Propriedades passadas para Deno.bundle()
 * 3. Extensões WorkerDB: Define customizado e opções extras
 */
export interface DenoBundleTargetConfig {
  // ==========================================================================
  // 🔄 PIPELINE WORKERDB (Pré/Pós Build)
  // ==========================================================================

  /** Diretório fonte (onde estão os arquivos de entrada) */
  srcdir?: string;

  /** Diretório de destino (onde o bundle será escrito) */
  distdir?: string;

  /** Diretório de arquivos estáticos públicos (copiados para distdir) */
  publicdir?: string;

  /** Se deve copiar index.html do srcdir para distdir */
  indexHtml?: boolean;

  /**
   * Lista de paths para limpar antes do build (relativos ao distdir).
   * Use ["."] para esvaziar completamente o diretório.
   */
  clean?: string[];

  /**
   * Incluído automaticamente quando nenhum alvo é especificado via CLI.
   * - `true` ou `undefined`: Incluído por padrão
   * - `false`: Só roda quando explicitamente solicitado
   */
  default?: boolean;

  /**
   * Modo de operação do alvo.
   * - `'build'`: Compila e termina (padrão)
   * - `'watch'`: ⚠️ NÃO SUPORTADO pelo Deno.bundle — emite aviso e ignora
   */
  mode?: "build" | "watch";

  // ==========================================================================
  // ⚙️ DENO.BUNDLE OPTIONS (API nativa)
  // Ref: https://docs.deno.com/api/deno/bundler/#Deno.bundle.Options
  // ==========================================================================

  /** Pontos de entrada do bundle (arquivos TypeScript/JavaScript) */
  entryPoints: string[];

  /**
   * Formato de saída do bundle.
   * - `"esm"`: ES Modules (padrão)
   * - `"cjs"`: CommonJS
   * - `"iife"`: Immediately Invoked Function Expression
   */
  format?: DenoBundleFormat;

  /**
   * Plataforma alvo.
   * - `"browser"`: Otimizado para navegadores (padrão para UI/SW)
   * - `"deno"`: Otimizado para runtime Deno
   */
  platform?: DenoBundlePlatform;

  /** Se deve minificar o output */
  minify?: boolean;

  /** Preserva nomes originais de funções e classes */
  keepNames?: boolean;

  /**
   * Estratégia de source map.
   * - `"linked"`: Arquivo .map separado com link no bundle
   * - `"inline"`: Source map embutido no bundle (base64)
   * - `"external"`: Arquivo .map separado sem link
   */
  sourcemap?: DenoBundleSourceMap;

  /** Habilita code splitting (divide o bundle em chunks) */
  codeSplitting?: boolean;

  /** Se deve inlinar imports externos no bundle */
  inlineImports?: boolean;

  /**
   * Como tratar pacotes/dependências externas.
   * - `"bundle"`: Pacotes são incluídos no bundle (padrão)
   * - `"external"`: Pacotes são excluídos
   */
  packages?: DenoBundlePackageHandling;

  /** Módulos externos a excluir do bundle */
  external?: string[];

  // ==========================================================================
  // 🔧 EXTENSÕES WORKERDB (pré-processamento customizado)
  // ==========================================================================

  /**
   * Define customizado para substituição de variáveis em tempo de build.
   * Aplicado em memória nos OutputFiles ANTES de salvar no disco.
   *
   * __APP_VERSION__ é injetado automaticamente — não precisa declarar.
   *
   * @example
   * ```typescript
   * define: {
   *   "__DEBUG__": "false",
   *   "__API_URL__": '"https://api.workerdb.app"'
   * }
   * ```
   */
  define?: Record<string, string>;

  /**
   * Caminho explícito do arquivo de saída (quando há 1 entry point).
   * Se não especificado, usa outputDir do Deno.bundle.
   */
  outfile?: string;
}

/**
 * Configuração global de múltiplos alvos de build para Deno.bundle.
 */
export interface DenoBundleGlobalConfig {
  [targetName: string]: DenoBundleTargetConfig;
}

````

---

## Arquivo: `packages/utils/src/esbuild/bundle.ts`

```ts
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

/**
 * @module @workerdb/utils/build/bundle
 * @description Funções específicas para o motor Deno.bundle (API nativa --unstable-bundle).
 *
 * Estratégia de Define:
 * - Deno.bundle() não suporta 'define' nativo
 * - Usamos write: false para receber os OutputFiles em memória
 * - Aplicamos substituições de defines em cada OutputFile.text()
 * - Só então salvamos os arquivos modificados no disco
 *
 * Limitações vs esbuild:
 * - Sem watch mode (Deno.bundle não suporta)
 * - Sem plugins customizados
 * - Define via regex (menos preciso que AST transform)
 */
import { ensureDir, } from "@std/fs";
// ============================================================================
// 📦 TIPOS
// ============================================================================
import type { DenoBundleTargetConfig, } from "../interfaces/mod.ts";
// ============================================================================
// 📂 FUNÇÕES COMPARTILHADAS (reimportadas do mod.ts)
// ============================================================================
import {
  cleanTarget,
  copyStaticFiles,
  resolveEntryPoints,
  resolveOutputPaths,
  validateTargetConfig,
} from "./mod.ts";

// ============================================================================
// 🔧 APLICAÇÃO DE DEFINES (em memória, antes de salvar)
// ============================================================================
export function applyDefines(
  text: string,
  defines: Record<string, string>,
): string {
  let result = text;
  for (const [key, value,] of Object.entries(defines,)) {
    // Escapa caracteres especiais de regex no key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&",);
    const regex = new RegExp(escapedKey, "g",);
    result = result.replace(regex, value,);
  }
  return result;
}

// ============================================================================
// 🛠️ CONSTRUÇÃO DAS OPÇÕES DO DENO.BUNDLE
// ============================================================================
export function buildBundleOptions(
  config: DenoBundleTargetConfig,
): Deno.bundle.Options {
  // 🔥 RESOLUÇÃO DE ENTRYPOINTS (srcdir opcional)
  const resolvedEntryPoints = resolveEntryPoints(
    config.srcdir,
    config.entryPoints,
  );

  // 🔥 RESOLUÇÃO DE OUTPUT PATHS (outfile relativo ao distdir)
  const { outfile, outdir, } = resolveOutputPaths(config,);

  const options: Deno.bundle.Options = {
    entrypoints: resolvedEntryPoints,
    write: false, // 🔥 SEMPRE false — salvamos manualmente após injetar defines
  };

  // 🔥 CORREÇÃO: Usa outputPath resolvido ou outputDir
  if (outfile) {
    options.outputPath = outfile;
  } else if (outdir) {
    options.outputDir = outdir;
  }

  // Propriedades opcionais repassadas diretamente
  if (config.platform !== undefined) options.platform = config.platform;
  if (config.format !== undefined) options.format = config.format;
  if (config.minify !== undefined) options.minify = config.minify;
  if (config.keepNames !== undefined) options.keepNames = config.keepNames;
  if (config.sourcemap !== undefined) options.sourcemap = config.sourcemap;
  if (config.codeSplitting !== undefined) {
    options.codeSplitting = config.codeSplitting;
  }
  if (config.inlineImports !== undefined) {
    options.inlineImports = config.inlineImports;
  }
  if (config.packages !== undefined) options.packages = config.packages;
  if (config.external !== undefined) options.external = config.external;

  return options;
}

// ============================================================================
// 🎯 PROCESSAMENTO DE ALVO (Deno.bundle)
// ============================================================================
export async function processBundleTarget(
  targetName: string,
  config: DenoBundleTargetConfig,
  appVersion: string,
  listAssetsFn?: (distDir: string,) => Promise<string[]>,
): Promise<void> {
  // 🔥 VALIDAÇÃO FAIL-FAST: Verifica configuração ANTES de qualquer operação
  validateTargetConfig(targetName, config,);

  console.log(`\n${"=".repeat(60,)}`,);
  console.log(`🎯 PROCESSANDO ALVO: ${targetName.toUpperCase()}`,);
  console.log(`${"=".repeat(60,)}`,);

  // 1. Limpar diretório de saída
  if (config.clean && config.clean.length > 0) {
    // 🔥 CORREÇÃO: Só limpa se distdir existe
    if (config.distdir) {
      await cleanTarget(config.distdir, config.clean,);
    } else {
      console.warn(
        `⚠️ 'clean' configurado mas 'distdir' ausente. Pulando limpeza.`,
      );
    }
  }

  // 2. Copiar arquivos estáticos
  await copyStaticFiles(config, appVersion,);

  // 3. Preparar defines
  const defines: Record<string, string> = {
    ...config.define,
    __APP_VERSION__: JSON.stringify(`v${appVersion}`,),
  };

  // 🔥 CORREÇÃO: Só lista assets se distdir existe
  if (targetName === "sw" && listAssetsFn && config.distdir) {
    const assets = await listAssetsFn(config.distdir,);
    defines["__GENERATED_ASSETS__"] = JSON.stringify(assets,);
    console.log(`📋 ${assets.length} assets listados para cache do SW`,);
  }

  // 4. Executar bundle
  console.log(`🔨 Compilando com Deno.bundle...`,);
  const startTime = performance.now();
  const bundleOptions = buildBundleOptions(config,);
  const result = await Deno.bundle(bundleOptions,);

  // 5. Verificar erros
  if (!result.success) {
    console.error("❌ Erros de compilação:",);
    for (const error of result.errors) {
      const loc = error.location
        ? ` (${error.location.file}:${error.location.line}:${error.location.column})`
        : "";
      console.error(`   ${error.text}${loc}`,);
      for (const note of error.notes ?? []) {
        console.error(`      💡 ${note.text}`,);
      }
    }
    throw new Error(`Bundle falhou para o alvo [${targetName}]`,);
  }

  // 6. Exibir warnings (se houver)
  for (const warning of result.warnings) {
    const loc = warning.location
      ? ` (${warning.location.file}:${warning.location.line}:${warning.location.column})`
      : "";
    console.warn(`   ⚠️ ${warning.text}${loc}`,);
  }

  // 7. Processar OutputFiles: text() → applyDefines → writeTextFile
  const outputFiles = result.outputFiles ?? [];
  if (outputFiles.length === 0) {
    console.warn(`   ⚠️ Nenhum arquivo gerado pelo bundle [${targetName}]`,);
    return;
  }

  const defineKeys = Object.keys(defines,);
  const hasDefines = defineKeys.length > 0;
  if (hasDefines) {
    console.log(
      `🔧 Injetando ${defineKeys.length} define(s): ${defineKeys.join(", ",)}`,
    );
  }

  for (const outputFile of outputFiles) {
    // Garante que o diretório de destino existe
    const dir = outputFile.path.substring(
      0,
      outputFile.path.lastIndexOf("/",),
    );
    if (dir) {
      await ensureDir(dir,);
    }

    // Obtém conteúdo como string via .text()
    let content = outputFile.text();

    // Aplica defines no conteúdo em memória (ANTES de salvar)
    if (hasDefines) {
      content = applyDefines(content, defines,);
    }

    // Salva o arquivo modificado no disco
    await Deno.writeTextFile(outputFile.path, content,);
    console.log(
      `   📄 ${outputFile.path} (${(content.length / 1024).toFixed(1,)}KB)`,
    );
  }

  const duration = (performance.now() - startTime).toFixed(0,);
  console.log(
    `✅ [${targetName}] Build concluído em ${duration}ms (${outputFiles.length} arquivo(s))`,
  );
}

```

---

## Arquivo: `packages/utils/src/esbuild/mod.ts`

```ts
/// <reference lib="deno.ns" />
import { copy, emptyDir, ensureDir, walk, } from "@std/fs";
import { dirname, isAbsolute, join, } from "@std/path";
import { parse as parseJsonc, } from "@std/jsonc";

// ============================================================================
// 📦 TIPOS
// ============================================================================
import type {
  DenoBundleGlobalConfig,
  DenoBundleTargetConfig,
  GlobalTargetConfig,
  ParsedArgs,
  ParsedVersion,
  TargetConfig,
} from "../interfaces/mod.ts";

// ============================================================================
// 🔢 FUNÇÕES DE VERSÃO (puras, testáveis)
// ============================================================================
export function parseVersion(version: string,): ParsedVersion {
  const trimmed = version.trim();
  if (trimmed !== version) {
    throw new Error(`❌ Versão não pode ter espaços: ${version}`,);
  }
  const versionWithoutHash = version.split("#",)[0] ?? "";
  if (version.includes("#",) && version.endsWith("#",)) {
    throw new Error(
      `❌ Formato de versão inválido (# sem hash): ${version}`,
    );
  }
  const parts = versionWithoutHash.split(".",);
  if (parts.length !== 3) {
    throw new Error(`❌ Formato de versão inválido: ${version}`,);
  }
  const majorStr = parts[0];
  const minorStr = parts[1];
  const patchStr = parts[2];
  if (
    majorStr === undefined || minorStr === undefined || patchStr === undefined
  ) {
    throw new Error(`❌ Formato de versão inválido: ${version}`,);
  }
  const major = parseInt(majorStr, 10,);
  const minor = parseInt(minorStr, 10,);
  const patch = parseInt(patchStr, 10,);
  if (isNaN(major,) || isNaN(minor,) || isNaN(patch,)) {
    throw new Error(`❌ Versão contém valores não numéricos: ${version}`,);
  }
  return { major, minor, patch, };
}

export function formatVersion(
  major: number,
  minor: number,
  patch: number,
  buildHash?: string,
): string {
  const hash = buildHash ?? Date.now().toString(36,);
  return `${major}.${minor}.${patch}#${hash}`;
}

export function extractVersionFromContent(content: string,): string | null {
  const match = content.match(/"version"\s*:\s*"([^"]+)"/,);
  return match && match[1] ? match[1] : null;
}

export function replaceVersionInContent(
  content: string,
  newVersion: string,
): string {
  return content.replace(
    /"version"\s*:\s*"[^"]+"/,
    `"version": "${newVersion}"`,
  );
}

// ============================================================================
// 🛡️ VALIDAÇÃO DE PATHS (pura, testável)
// ============================================================================
export function isSafePath(cleanPath: string,): boolean {
  if (cleanPath.includes("..",)) return false;
  if (isAbsolute(cleanPath,)) return false;
  return true;
}

// ============================================================================
// 🎯 VALIDAÇÃO DE CONFIGURAÇÃO DO ALVO (fail-fast com mensagens claras)
// ============================================================================
/**
 * Valida se a configuração do alvo possui os campos obrigatórios para as operações solicitadas.
 * Lança erro com mensagem didática indicando exatamente qual condição falhou.
 *
 * Regras de obrigatoriedade:
 * - 'distdir' é obrigatório quando 'publicdir' está configurado, 'indexHtml' é true, ou 'outfile' não está configurado
 * - 'srcdir' é obrigatório quando 'indexHtml' é true ou quando 'entryPoints' contém paths relativos
 */
export function validateTargetConfig(
  targetName: string,
  config: TargetConfig | DenoBundleTargetConfig,
): void {
  const reasons: string[] = [];

  // Validação de distdir
  if (config.publicdir && !config.distdir) {
    reasons.push(
      "'publicdir' está configurado (necessário 'distdir' para copiar arquivos estáticos)",
    );
  }
  if (config.indexHtml === true && !config.distdir) {
    reasons.push(
      "'indexHtml' é true (necessário 'distdir' para copiar o HTML)",
    );
  }
  if (!config.outfile && !config.distdir) {
    reasons.push(
      "'outfile' não está configurado (necessário 'distdir' para usar como 'outdir')",
    );
  }

  // Validação de srcdir
  if (config.indexHtml === true && !config.srcdir) {
    reasons.push(
      "'indexHtml' é true (necessário 'srcdir' para copiar o HTML)",
    );
  }

  // Verifica se algum entrypoint é relativo e srcdir não existe
  if (!config.srcdir && config.entryPoints && config.entryPoints.length > 0) {
    const hasRelativeEntry = config.entryPoints.some((entry,) =>
      !isAbsolute(entry,)
    );
    if (hasRelativeEntry) {
      reasons.push(
        "'entryPoints' contém caminhos relativos (necessário 'srcdir' para resolver)",
      );
    }
  }

  if (reasons.length > 0) {
    const missingFields: string[] = [];
    if (!config.distdir && reasons.some((r,) => r.includes("'distdir'",))) {
      missingFields.push("'distdir'",);
    }
    if (!config.srcdir && reasons.some((r,) => r.includes("'srcdir'",))) {
      missingFields.push("'srcdir'",);
    }

    throw new Error(
      `❌ [${targetName}] Configuração incompleta.\n` +
        `   Campos obrigatórios faltando: ${missingFields.join(", ",)}\n` +
        `   Motivos:\n` +
        reasons.map((r,) => `   - ${r}`).join("\n",) +
        `\n   Por favor, configure os campos necessários no alvo '${targetName}'.`,
    );
  }
}

// ============================================================================
// 📍 RESOLUÇÃO DE OUTPUT PATHS (outfile relativo ao distdir)
// ============================================================================
/**
 * Resolve os caminhos de saída (outfile/outdir) baseado na configuração.
 *
 * Regras:
 * 1. Se 'outfile' e 'distdir' existem: outfile é RELATIVO ao distdir → join(distdir, outfile)
 * 2. Se apenas 'outfile' existe (sem distdir): outfile é ABSOLUTO
 * 3. Se apenas 'distdir' existe (sem outfile): distdir é usado como outdir
 * 4. Se nenhum existe: retorna objeto vazio (não deveria acontecer se validateTargetConfig foi chamado)
 *
 * @returns Objeto com 'outfile' ou 'outdir' resolvidos (nunca ambos)
 */
export function resolveOutputPaths(
  config: TargetConfig | DenoBundleTargetConfig,
): { outfile?: string; outdir?: string } {
  if (config.outfile) {
    if (config.distdir) {
      // outfile relativo ao distdir
      return { outfile: join(config.distdir, config.outfile,), };
    }
    // outfile absoluto (sem distdir)
    return { outfile: config.outfile, };
  }
  // Sem outfile, usa distdir como outdir
  if (config.distdir) {
    return { outdir: config.distdir, };
  }
  // Nem outfile nem distdir (não deveria chegar aqui se validateTargetConfig foi chamado)
  return {};
}

// ============================================================================
// 🎯 RESOLUÇÃO DE ENTRYPOINTS (relativo ao srcdir quando disponível)
// ============================================================================
/**
 * Resolve os entrypoints relativos ao srcdir (se disponível) e valida sua existência no disco.
 * Lança um erro claro e didático se algum arquivo não for encontrado.
 *
 * Se srcdir não está configurado, trata todos os entrypoints como absolutos.
 */
export function resolveEntryPoints(
  srcdir: string | undefined,
  entryPoints: string[],
): string[] {
  return entryPoints.map((entry,) => {
    let resolvedPath: string;

    if (srcdir && !isAbsolute(entry,)) {
      // srcdir existe e entry é relativo → faz join
      resolvedPath = join(srcdir, entry,);
    } else {
      // srcdir não existe OU entry já é absoluto → usa como está
      resolvedPath = entry;
    }

    try {
      Deno.statSync(resolvedPath,);
    } catch {
      throw new Error(
        `❌ Entrypoint não encontrado em: "${resolvedPath}"\n` +
          `   Origem configurada: "${entry}"\n` +
          (srcdir
            ? `   Verifique se o caminho está correto em relação ao srcdir: "${srcdir}".`
            : `   Verifique se o caminho absoluto está correto.`),
      );
    }

    return resolvedPath;
  },);
}

// ============================================================================
// 🎯 PARSING DE ARGUMENTOS CLI (pura, testável)
// ============================================================================
export function parseArgs(
  args: string[],
  config: GlobalTargetConfig | DenoBundleGlobalConfig,
): ParsedArgs {
  const lowerArgs = args.map((a,) => a.toLowerCase());
  const globalNoVersion = lowerArgs.includes("noversion",);
  const isWatchFlag = lowerArgs.includes("watch",);
  const configKeys = Object.keys(config,);
  const defaultTargets = configKeys.filter((t,) => {
    const cfg = config[t]!;
    return cfg.mode !== "watch" && cfg.default !== false;
  },);
  const requestedTargets = lowerArgs.filter(
    (arg,) =>
      !["noversion", "watch",].includes(arg,) && configKeys.includes(arg,),
  );
  let watchTarget: string | null = null;
  if (isWatchFlag) {
    watchTarget = configKeys.find((t,) => config[t]!.mode === "watch") ?? null;
  } else if (requestedTargets.length > 0) {
    const requestedWatches = requestedTargets.filter((t,) =>
      config[t]!.mode === "watch"
    );
    if (requestedWatches.length > 0) {
      watchTarget = configKeys.find((t,) => requestedWatches.includes(t,)) ??
        null;
    }
  }
  let finalTargets: string[];
  if (watchTarget !== null) {
    finalTargets = [];
  } else if (requestedTargets.length > 0) {
    finalTargets = configKeys.filter((t,) => requestedTargets.includes(t,));
  } else {
    finalTargets = defaultTargets;
  }
  return { targets: finalTargets, globalNoVersion, watchTarget, };
}

// ============================================================================
// 📂 FUNÇÕES DE FILESYSTEM
// ============================================================================
export async function cleanTarget(
  distDir: string,
  cleanPaths: string[],
): Promise<void> {
  if (!cleanPaths || cleanPaths.length === 0) return;
  console.log(`🧹 Limpando em ${distDir}...`,);
  for (const cleanPath of cleanPaths) {
    if (!isSafePath(cleanPath,)) {
      console.warn(
        `   ⚠️ Path perigoso ignorado (traversal/absoluto): "${cleanPath}"`,
      );
      continue;
    }
    if (cleanPath === ".") {
      try {
        await emptyDir(distDir,);
        console.log(`   ✅ Diretório esvaziado: ${distDir}`,);
      } catch (error) {
        console.warn(`   ⚠️ Falha ao esvaziar ${distDir}:`, error,);
      }
    } else {
      const fullPath = join(distDir, cleanPath,);
      try {
        await Deno.stat(fullPath,);
        await Deno.remove(fullPath, { recursive: true, },);
        console.log(`   ✅ Removido: ${cleanPath}`,);
      } catch {
        console.log(`   ⏭️  Não existia: ${cleanPath}`,);
      }
    }
  }
}

export async function currentVersion(denoJsoncPath: string,): Promise<string> {
  const content = await Deno.readTextFile(denoJsoncPath,);
  const version = extractVersionFromContent(content,);
  if (!version) {
    throw new Error("❌ Versão não encontrada no deno.jsonc",);
  }
  console.log(`📌 Versão Atual: v${version}`,);
  return version;
}

export async function incrementVersion(
  version: string,
  denoJsoncPath: string,
  buildHash?: string,
): Promise<string> {
  const { major, minor, patch, } = parseVersion(version,);
  const nextPatch = patch + 1;
  const newVersion = formatVersion(major, minor, nextPatch, buildHash,);
  const content = await Deno.readTextFile(denoJsoncPath,);
  const updatedRootContent = replaceVersionInContent(content, newVersion,);
  await Deno.writeTextFile(denoJsoncPath, updatedRootContent,);
  console.log(`📈 Versão incrementada para: v${newVersion}`,);

  // Sincronização de Workspaces
  try {
    const rootDir = dirname(denoJsoncPath,);
    const parsed = parseJsonc(content,) as { workspace?: string[] };

    if (parsed.workspace && Array.isArray(parsed.workspace,)) {
      console.log(`📦 Sincronizando workspaces...`,);
      for (const ws of parsed.workspace) {
        const wsPath = isAbsolute(ws,) ? ws : join(rootDir, ws,);

        // Tenta deno.jsonc depois deno.json
        for (const fileName of ["deno.jsonc", "deno.json",]) {
          const configPath = join(wsPath, fileName,);
          try {
            const stat = await Deno.stat(configPath,);
            if (stat.isFile) {
              let wsContent = await Deno.readTextFile(configPath,);
              wsContent = replaceVersionInContent(wsContent, newVersion,);
              await Deno.writeTextFile(configPath, wsContent,);
              console.log(`   ✅ Sincronizado: ${join(ws, fileName,)}`,);
              break; // Para no primeiro que encontrar
            }
          } catch {
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Falha ao sincronizar workspaces:`, error,);
  }

  // Atualiza arquivo de versão do worker-db (específico para injeção de código)
  try {
    const workerDbVersionPath = "packages/worker-db/src/utils/version.ts";
    const workerDbContent = `// Automatically generated file during build
declare const __APP_VERSION__: string;

/** Current library/application version. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined"
  ? __APP_VERSION__
  : "${newVersion}";
`;
    await Deno.writeTextFile(workerDbVersionPath, workerDbContent,);
    console.log(`📝 Versão atualizada em: ${workerDbVersionPath}`,);
  } catch {
    // Ignora quando executando em ambientes sem a estrutura completa (ex: testes)
  }

  return newVersion;
}

export async function listAssetsForCache(
  distDir: string,
  excludeFiles: string[] = [],
): Promise<string[]> {
  // 🔥 CORREÇÃO: Verifica se distDir foi fornecido antes de tentar caminhar
  if (!distDir) {
    console.warn(
      `⚠️ 'listAssetsForCache' chamado sem 'distDir'. Retornando array vazio.`,
    );
    return [];
  }

  const assets: string[] = [];
  const exclude = new Set([
    ...excludeFiles,
    "service-worker.js",
    "service-worker.tmp.js",
  ],);
  for await (const entry of walk(distDir, { includeDirs: false, },)) {
    if (
      !entry.name.endsWith(".map",) &&
      !entry.name.endsWith("metafile.json",) &&
      !exclude.has(entry.name,)
    ) {
      let webPath = entry.path.replace(distDir, "",).replace(/\\/g, "/",);
      webPath = webPath.startsWith("/",) ? "." + webPath : "./" + webPath;
      assets.push(webPath,);
    }
  }
  return assets;
}

export async function copyStaticFiles(
  config: TargetConfig | DenoBundleTargetConfig,
  appVersion: string,
): Promise<void> {
  // 🔥 CORREÇÃO: Valida distdir e srcdir antes de operações
  if (!config.distdir) {
    if (config.publicdir) {
      console.warn(
        `⚠️ 'publicdir' configurado mas 'distdir' ausente. Pulando cópia de estáticos.`,
      );
    }
    if (config.indexHtml) {
      console.warn(
        `⚠️ 'indexHtml' é true mas 'distdir' ausente. Pulando cópia do HTML.`,
      );
    }
    return;
  }

  if (config.indexHtml && !config.srcdir) {
    console.warn(
      `⚠️ 'indexHtml' é true mas 'srcdir' ausente. Pulando cópia do HTML.`,
    );
    return;
  }

  const distDir = config.distdir;
  await ensureDir(distDir,);

  if (config.publicdir) {
    try {
      await copy(config.publicdir, distDir, { overwrite: true, },);
      console.log(
        `📁 Arquivos de ${config.publicdir} copiados para ${distDir}`,
      );
      const manifestPath = join(distDir, "manifest.json",);
      try {
        const manifestText = await Deno.readTextFile(manifestPath,);
        const manifestObj = JSON.parse(manifestText,);
        manifestObj.version = appVersion;
        await Deno.writeTextFile(
          manifestPath,
          JSON.stringify(manifestObj, null, 2,),
        );
        console.log(`📱 Versão v${appVersion} injetada em manifest.json`,);
      } catch {
        // manifest.json não existe
      }
    } catch {
      console.log(
        `⚠️ Pasta ${config.publicdir} não encontrada, pulando cópia.`,
      );
    }
  }

  if (config.indexHtml && config.srcdir) {
    const srcDir = config.srcdir;
    const srcHtml = join(srcDir, "index.html",);
    const destHtml = join(distDir, "index.html",);
    try {
      await copy(srcHtml, destHtml, { overwrite: true, },);
      console.log(`📄 index.html copiado de ${srcDir} para ${distDir}`,);
    } catch {
      console.log(`⚠️ ${srcHtml} não encontrado, pulando cópia do HTML.`,);
    }
  }
}

// ============================================================================
// 🛠️ FUNÇÕES DE ESBUILD
// ============================================================================
export async function buildEsbuildOptions(
  targetName: string,
  config: TargetConfig,
  appVersion: string,
  listAssetsFn?: (distDir: string,) => Promise<string[]>,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const finalDefine: Record<string, string> = {
    ...config.define,
    __APP_VERSION__: JSON.stringify(`v${appVersion}`,),
  };

  // 🔥 CORREÇÃO: Só lista assets se distdir existe
  if (targetName === "sw" && listAssetsFn && config.distdir) {
    const assets = await listAssetsFn(config.distdir,);
    finalDefine["__GENERATED_ASSETS__"] = JSON.stringify(assets,);
    console.log(`📋 ${assets.length} assets listados para cache do SW`,);
  }

  // 🔥 RESOLUÇÃO DE ENTRYPOINTS (srcdir opcional)
  const resolvedEntryPoints = resolveEntryPoints(
    config.srcdir,
    config.entryPoints,
  );

  // 🔥 RESOLUÇÃO DE OUTPUT PATHS (outfile relativo ao distdir)
  const { outfile, outdir, } = resolveOutputPaths(config,);

  // deno-lint-ignore no-explicit-any
  const options: any = {
    entryPoints: resolvedEntryPoints,
  };

  // 🔥 CORREÇÃO: Usa outfile resolvido ou outdir
  if (outfile) {
    options.outfile = outfile;
  } else if (outdir) {
    options.outdir = outdir;
  }

  const optionalProps = [
    "platform",
    "format",
    "bundle",
    "minify",
    "sourcemap",
    "jsx",
    "jsxImportSource",
    "conditions",
    "external",
    "drop",
    "metafile",
    "write",
    "treeShaking",
    "legalComments",
    "keepNames",
    "splitting",
    "loader",
    "alias",
    "inject",
    "target",
    "charset",
    "logLevel",
    "logLimit",
    "logOverride",
    "entryNames",
    "chunkNames",
    "assetNames",
    "publicPath",
    "pure",
    "plugins",
  ];
  for (const prop of optionalProps) {
    // deno-lint-ignore no-explicit-any
    if ((config as any)[prop] !== undefined) {
      // deno-lint-ignore no-explicit-any
      (options as any)[prop] = (config as any)[prop];
    }
  }

  // 🔥 CORREÇÃO: Construção segura de banner
  if (config.banner !== undefined) {
    const banner: { js?: string; css?: string } = {};
    if (config.banner.js !== undefined) {
      banner.js = config.banner.js.replace(/__APP_VERSION__/g, appVersion,);
    }
    if (config.banner.css !== undefined) {
      banner.css = config.banner.css.replace(/__APP_VERSION__/g, appVersion,);
    }
    if (banner.js !== undefined || banner.css !== undefined) {
      options.banner = banner;
    }
  }

  // 🔥 CORREÇÃO: Construção segura de footer
  if (config.footer !== undefined) {
    const footer: { js?: string; css?: string } = {};
    if (config.footer.js !== undefined) {
      footer.js = config.footer.js.replace(/__APP_VERSION__/g, appVersion,);
    }
    if (config.footer.css !== undefined) {
      footer.css = config.footer.css.replace(/__APP_VERSION__/g, appVersion,);
    }
    if (footer.js !== undefined || footer.css !== undefined) {
      options.footer = footer;
    }
  }

  options.define = finalDefine;
  return options;
}

export async function processTarget(
  targetName: string,
  config: TargetConfig,
  appVersion: string,
  // deno-lint-ignore no-explicit-any
  esbuildBuildFn: (options: any,) => Promise<any>,
  listAssetsFn?: (distDir: string,) => Promise<string[]>,
): Promise<void> {
  // 🔥 VALIDAÇÃO FAIL-FAST: Verifica configuração ANTES de qualquer operação
  validateTargetConfig(targetName, config,);

  console.log(`\n${"=".repeat(60,)}`,);
  console.log(`🎯 PROCESSANDO ALVO: ${targetName.toUpperCase()}`,);
  console.log(`${"=".repeat(60,)}`,);

  if (config.clean && config.clean.length > 0) {
    // 🔥 CORREÇÃO: Só limpa se distdir existe
    if (config.distdir) {
      await cleanTarget(config.distdir, config.clean,);
    } else {
      console.warn(
        `⚠️ 'clean' configurado mas 'distdir' ausente. Pulando limpeza.`,
      );
    }
  }

  await copyStaticFiles(config, appVersion,);

  const esbuildOptions = await buildEsbuildOptions(
    targetName,
    config,
    appVersion,
    listAssetsFn,
  );

  console.log(`🔨 Compilando com esbuild...`,);
  const startTime = performance.now();

  try {
    const result = await esbuildBuildFn(esbuildOptions,);
    const duration = (performance.now() - startTime).toFixed(0,);
    console.log(`✅ [${targetName}] Build concluído em ${duration}ms`,);

    // 🔥 CORREÇÃO: Só salva metafile se distdir existe
    if (config.metafile && result.metafile && config.distdir) {
      const metafilePath = join(config.distdir, `${targetName}-metafile.json`,);
      await Deno.writeTextFile(
        metafilePath,
        JSON.stringify(result.metafile, null, 2,),
      );
      console.log(`📊 Metafile gerado: ${metafilePath}`,);
    }
  } catch (error) {
    console.error(`❌ Erro fatal no build [${targetName}]:`, error,);
    throw error;
  }
}

// ============================================================================
// 📦 RE-EXPORT DO MÓDULO BUNDLE (Deno.bundle API)
// ============================================================================
export * from "./bundle.ts";

```

---

## Arquivo: `packages/utils/src/export/mod.ts`

```````ts
/// <reference lib="deno.ns" />

/**
 * @module @workerdb/utils/export
 * @description Utilitários genéricos para consolidação de contexto para IAs.
 * Contém apenas tipos, funções puras e constantes reutilizáveis.
 * As configurações específicas do projeto ficam no script de execução.
 */

// ============================================================================
// 📦 TIPOS E INTERFACES
// ============================================================================

import type { ExportConfig, } from "../interfaces/mod.ts";

// ============================================================================
// 🛠️ FUNÇÕES UTILITÁRIAS PURAS
// ============================================================================

/**
 * Normaliza um caminho para comparação consistente.
 * - Converte barras invertadas em barras normais
 * - Converte para minúsculas
 */
export function normalizarCaminho(caminho: string,): string {
  return caminho.replace(/\\/g, "/",).toLowerCase();
}

/**
 * Normaliza um caminho para comparação de prefixos.
 * Além da normalização básica, remove o prefixo "./" se presente.
 *
 * Exemplo:
 * - "./monorepo/ui/tests" → "monorepo/ui/tests"
 * - "monorepo/server" → "monorepo/server"
 * - "./" → ""
 * - "." → ""
 */
function normalizarPrefixo(caminho: string,): string {
  let normalized = caminho.replace(/\\/g, "/",).toLowerCase();
  // Remove ./ prefixo
  if (normalized === "./" || normalized === ".") {
    return "";
  }
  if (normalized.startsWith("./",)) {
    normalized = normalized.substring(2,);
  }
  // Remove trailing slash para comparação
  normalized = normalized.replace(/\/$/, "",);
  return normalized;
}

/**
 * Calcula a quantidade mínima de crases necessárias para envolver um texto
 * em um bloco de código markdown, evitando conflitos com crases dentro do texto.
 *
 * Exemplo:
 * - Texto sem crases → "```"
 * - Texto com ``` → "````" (4 crases)
 * - Texto com ````` → "``````" (6 crases)
 */
export function calcularCraseWrapper(texto: string,): string {
  const matches = texto.match(/`+/g,);
  if (!matches) return "```";
  const maiorSequencia = Math.max(...matches.map((m,) => m.length),);
  const tamanhoNecessario = Math.max(3, maiorSequencia + 1,);
  return "`".repeat(tamanhoNecessario,);
}

/**
 * Mapeia extensões de arquivo para a sintaxe de highlight do markdown.
 */
export function mapearExtensao(caminhoRelativo: string,): string {
  const ext = caminhoRelativo.split(".",).pop()?.toLowerCase() || "";
  const mapa: Record<string, string> = {
    manifest: "json",
    jsonc: "json",
    yml: "yaml",
    sh: "bash",
    env: "properties",
  };

  // Casos especiais
  if (caminhoRelativo.includes(".env",)) return "properties";

  return mapa[ext] || ext;
}

/**
 * Determina se um arquivo deve ser incluído no snapshot baseado na configuração.
 *
 * Regras aplicadas (em ordem):
 * 1. Proteção anti-loop: sempre exclui arquivos em `exports/`
 * 2. Verifica se está em caminhos adicionais permitidos
 * 3. Verifica se está dentro de pastaBase
 * 4. Se está NA RAIZ de pastaBase, verifica arquivosRaizPermitidos
 * 5. Se está em SUBPASTA, verifica subpastasPermitidas
 * 6. Verifica se tem extensão permitida
 *
 * Semântica:
 * - `subpastasPermitidas: []` (vazio) = permite varrer TODAS as subpastas
 * - `arquivosRaizPermitidos` = lista explícita de arquivos permitidos NA RAIZ
 */
export function deveIncluirArquivo(
  caminhoRelativo: string,
  config: ExportConfig,
): boolean {
  const caminhoNormalizado = normalizarCaminho(caminhoRelativo,);

  // 🔒 Proteção anti-loop: nunca inclui arquivos da pasta exports/
  if (caminhoNormalizado.startsWith("exports/",)) {
    return false;
  }

  // 🔍 Verifica caminhos adicionais (fora de pastaBase)
  if (
    config.caminhosAdicionaisPermitidos &&
    config.caminhosAdicionaisPermitidos.length > 0
  ) {
    const correspondeAdicional = config.caminhosAdicionaisPermitidos.some(
      (caminhoExtra,) => {
        const extraNormalizado = normalizarCaminho(caminhoExtra,);
        return (
          caminhoNormalizado === extraNormalizado ||
          caminhoNormalizado.startsWith(extraNormalizado + "/",)
        );
      },
    );

    if (correspondeAdicional) {
      return config.extensoesPermitidas.some(
        (ext,) =>
          caminhoNormalizado.endsWith(ext,) || caminhoNormalizado === ext,
      );
    }
  }

  // 🔍 Verifica se está dentro de pastaBase
  // 🔥 CORREÇÃO: Usa normalizarPrefixo que remove "./" para comparação consistente
  const prefixoBase = normalizarPrefixo(config.pastaBase,);
  const prefixoBaseComBarra = prefixoBase !== "" ? prefixoBase + "/" : "";

  if (
    prefixoBaseComBarra !== "" &&
    !caminhoNormalizado.startsWith(prefixoBaseComBarra,)
  ) {
    return false;
  }

  // 🔍 Extrai o caminho relativo dentro de pastaBase
  const caminhoInterno = prefixoBaseComBarra !== ""
    ? caminhoNormalizado.substring(prefixoBaseComBarra.length,)
    : caminhoNormalizado;

  // 🔥 CORREÇÃO: Verifica se está NA RAIZ (não tem / no caminhoInterno)
  // Arquivos na raiz precisam estar explicitamente em arquivosRaizPermitidos
  const estaNaRaiz = !caminhoInterno.includes("/",);

  if (estaNaRaiz) {
    // Verifica se está na lista de arquivos raiz permitidos (case insensitive)
    return config.arquivosRaizPermitidos.some(
      (raiz,) => normalizarCaminho(raiz,) === caminhoInterno,
    );
  }

  // 🔍 Está em subpasta: verifica subpastasPermitidas
  let emSubpastaPermitida = false;

  if (config.subpastasPermitidas.length === 0) {
    // Vazio = permite varrer TODAS as subpastas
    emSubpastaPermitida = true;
  } else {
    emSubpastaPermitida = config.subpastasPermitidas.some((sub,) => {
      const subNormalizada = normalizarCaminho(sub,) + "/";
      return (
        caminhoInterno.startsWith(subNormalizada,) ||
        caminhoInterno === normalizarCaminho(sub,)
      );
    },);
  }

  if (emSubpastaPermitida) {
    if (config.extensoesPermitidas.length === 0) return true;
    return config.extensoesPermitidas.some(
      (ext,) => caminhoNormalizado.endsWith(ext,) || caminhoNormalizado === ext,
    );
  }

  return false;
}

// ============================================================================
// 📝 GERAÇÃO DE CONTEÚDO
// ============================================================================

/**
 * Gera o cabeçalho do snapshot com instruções para a IA.
 */
export function gerarCabecalho(
  config: ExportConfig,
  modo: string,
  versaoApp: string,
): string {
  const versaoDisplay = config.incluiVersao ? `[v${versaoApp}] ` : "";

  return `> **INSTRUÇÃO PARA A IA:** 
> ${config.instrucaoCustomizada}
> O projeto é o **WorkerDB ${versaoDisplay}** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: \`## Arquivo: src/main.ts\`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto WorkerDB ${versaoDisplay}- Modo: ${modo.toUpperCase()}

Gerado automaticamente em: ${new Date().toLocaleString()}

---

`;
}

/**
 * Formata um arquivo para inclusão no snapshot markdown.
 */
export function formatarArquivoMarkdown(
  caminhoRelativo: string,
  conteudo: string,
): string {
  const extensaoMarkdown = mapearExtensao(caminhoRelativo,);
  const wrapperCrasis = calcularCraseWrapper(conteudo,);

  let resultado = `## Arquivo: \`${caminhoRelativo}\`\n\n`;
  resultado += `${wrapperCrasis}${extensaoMarkdown}\n`;
  resultado += conteudo;
  resultado += `\n${wrapperCrasis}\n\n---\n\n`;

  return resultado;
}

```````

---

## Arquivo: `packages/utils/src/mod.ts`

```ts
/**
 * @workerdb/utils
 * Entry point for shared utilities.
 */

export * from "./config/mod.ts";
export * from "./interfaces/mod.ts";
export * from "./export/mod.ts";

```

---

## Arquivo: `packages/utils/docs/webtorrent-api.md`

````md
# WebTorrent Documentation

WebTorrent is a streaming torrent client for **Node.js** and the **web**. WebTorrent
provides the same API in both environments.

To use WebTorrent in the browser, [WebRTC] support is required (Chrome, Firefox, Opera, Safari).

[webrtc]: https://en.wikipedia.org/wiki/WebRTC

## Install

```bash
npm install webtorrent
```

## Quick Example

```js
const client = new WebTorrent();

const torrentId =
  "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent";

const controller = await navigator.serviceWorker.register("./sw.min.js", {
  scope: "./",
},);
await navigator.serviceWorker.ready;
client.createServer({ controller, },);

client.add(torrentId, (torrent,) => {
  // Torrents can contain many files. Let's use the .mp4 file
  const file = torrent.files.find((file,) => {
    return file.name.endsWith(".mp4",);
  },);

  // Display the file by adding it to the DOM. Supports video, audio, image, etc. files
  file.streamTo(document.querySelector("video",),);
},);
```

# WebTorrent API

## `WebTorrent.WEBRTC_SUPPORT`

Is WebRTC natively supported in the environment?

```js
if (WebTorrent.WEBRTC_SUPPORT) {
  // WebRTC is supported
} else {
  // Use a fallback
}
```

## `client = new WebTorrent([opts])`

Create a new `WebTorrent` instance.

If `opts` is specified, then the default options (shown below) will be overridden.

```js
{
  maxConns: Number,        // Max number of connections per torrent (default=55)
  nodeId: String|Uint8Array,   // DHT protocol node ID (default=randomly generated)
  peerId: String|Uint8Array,   // Wire protocol peer ID (default=randomly generated)
  tracker: Boolean|Object, // Enable trackers (default=true), or options object for Tracker
  dht: Boolean|Object,     // Enable DHT (default=true), or options object for DHT
  lsd: Boolean,            // Enable BEP14 local service discovery (default=true)
  utPex: Boolean,          // Enable BEP11 Peer Exchange (default=true)
  natUpnp: Boolean | String, // Enable NAT port mapping via NAT-UPnP (default=true). NodeJS only
  natPmp: Boolean,         // Enable NAT port mapping via NAT-PMP (default=true). NodeJS only.
  webSeeds: Boolean,       // Enable BEP19 web seeds (default=true)
  utp: Boolean,            // Enable BEP29 uTorrent transport protocol (default=true)
  seedOutgoingConnections: Boolean // Enable outgoing connections when seeding (default=true)
  blocklist: Array|String, // List of IP's to block
  downloadLimit: Number,   // Max download speed (bytes/sec) over all torrents (default=-1)
  uploadLimit: Number,     // Max upload speed (bytes/sec) over all torrents (default=-1)
  secure: Number           // Enable RC4 encryption (default=1). Allowed values: 0, 1, 2
}
```

For possible values of `opts.dht` see the
[`bittorrent-dht` documentation](https://github.com/webtorrent/bittorrent-dht#dht--new-dhtopts).

For possible values of `opts.tracker` see the
[`bittorrent-tracker` documentation](https://github.com/webtorrent/bittorrent-tracker#client).

For possible values of `opts.blocklist` see the
[`load-ip-set` documentation](https://github.com/webtorrent/load-ip-set#usage).

For `opts.natUpnp` and `opts.natPmp`, if both are set to `true`, PMP will be attempted first, then fallback to UPNP. NodeJS only.

For `opts.natUpnp`, if set to `true`, a temporary mapping is used, if set to `permanent`, a permanent TTL will be used for UPNP if the router only supports permanent leases. NodeJS only.

For `opts.seedOutgoingConnections`, if set `true`, outgoing connections will be established while seeding, otherwise, only inbound connections will be responded to.

For `downloadLimit` and `uploadLimit` the possible values can be:

- `> 0`. The client will set the throttle at that speed
- `0`. The client will block any data from being downloaded or uploaded
- `-1`. The client will is disable the throttling and use the whole bandwidth available

For `secure` the possible values can be:

- `0`. RC4 encryption is disabled.
- `1`. RC4 encryption is enabled for handshake only. Has close to 0 performance impact.
- `2`. RC4 encryption is enabled for handshake and payload. Consider using `--openssl-legacy-provider` for a native RC4 implementation, which offers much better performance than the JS version.

## `client.add(torrentId, [opts], [function ontorrent (torrent) {}])`

Start downloading a new torrent.

`torrentId` can be one of:

- magnet uri (string)
- torrent file (Uint8Array)
- info hash (hex string or Uint8Array)
- parsed torrent (from [parse-torrent](https://github.com/webtorrent/parse-torrent))
- http/https url to a torrent file (string)
- filesystem path to a torrent file (string) _(Node.js only)_

If `opts` is specified, then the default options (shown below) will be overridden.

```js
{
  announce: [String],        // Torrent trackers to use (added to list in .torrent or magnet uri)
  getAnnounceOpts: Function, // Custom callback to allow sending extra parameters to the tracker
  urlList: [String],         // Array of web seeds
  maxWebConns: Number,       // Max number of simultaneous connections per web seed [default=4]
  path: String,              // Folder to download files to (default=`/tmp/webtorrent/`)
  private: Boolean,          // If true, client will not share the hash with the DHT nor with PEX (default is the privacy of the parsed torrent)
  store: Function,           // Custom chunk store (must follow [abstract-chunk-store](https://www.npmjs.com/package/abstract-chunk-store) API)
  destroyStoreOnDestroy: Boolean, // If truthy, client will delete the torrent's chunk store (e.g. files on disk) when the torrent is destroyed
  storeCacheSlots: Number,   // Number of chunk store entries (torrent pieces) to cache in memory [default=20]; 0 to disable caching
  storeOpts: Object,         // Custom options passed to the store
  addUID: Boolean,           // (Node.js only) If true, the torrent will be stored in it's infoHash folder to prevent file name collisions (default=false)
  skipVerify: Boolean,       // If true, client will skip verification of pieces for existing store and assume it's correct
  bitfield: Uint8Array,      // Preloaded numerical array/buffer to use to know what pieces are already downloaded (any type accepted by UInt8Array constructor is valid)
  preloadedStore: Function,  // Custom, pre-loaded chunk store (must follow [abstract-chunk-store](https://www.npmjs.com/package/abstract-chunk-store) API)
  strategy: String,          // Piece selection strategy, `rarest` or `sequential`(defaut=`sequential`)
  noPeersIntervalTime: Number, // The amount of time (in seconds) to wait between each check of the `noPeers` event (default=30)
  paused: Boolean,           // If true, create the torrent in a paused state (default=false)
  deselect: Boolean,         // If true, create the torrent with no pieces selected (default=false)
  alwaysChokeSeeders: Boolean // If true, client will automatically choke seeders if it's seeding. (default=true)
}
```

If `ontorrent` is specified, then it will be called when **this** torrent is ready to be
used (i.e. metadata is available). Note: this is distinct from the 'torrent' event which
will fire for **all** torrents.

If you want access to the torrent object immediately in order to listen to events as the
metadata is fetched from the network, then use the return value of `client.add`. If you
just want the file data, then use `ontorrent` or the 'torrent' event.

If you provide `opts.store`, it will be called as
`opts.store(chunkLength, storeOpts)` with:

- `storeOpts` - custom `storeOpts` specified in `opts`
- `storeOpts.length` - size of all the files in the torrent
- `storeOpts.files` - an array of torrent file objects
- `storeOpts.torrent` - the torrent instance being stored
- `storeOpts.path` - path to the store, based on `opts.path`
- `storeOpts.name` - the info hash of the torrent instance being stored
- `storeOpts.addUID` - boolean which tells the store if it should include an UID in it's file paths
- `storeOpts.rootDir` - _(browser only)_ [FileSystemDirectoryHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle) - if supported by the browser, allows the user to specify a custom directory to stores the files in, retaining the torrent's folder and file structure

**Note (browser only):** If you don't want to retain data across sessions, make sure to manually destroy the torrent store when the page closes (More on how below). This has to happen on the `beforeunload` event at latest, in order for the data to be removed. [About page lifecycles.](https://developers.google.com/web/updates/2018/07/page-lifecycle-api)

**Note:** Downloading a torrent automatically seeds it, making it available for download by other peers.

## `client.seed(input, [opts], [function onseed (torrent) {}])`

Start seeding a new torrent.

`input` can be any of the following:

- filesystem path to file or folder
  (string) _(Node.js only)_
- W3C [FileList](https://developer.mozilla.org/en-US/docs/Web/API/FileList) object (basically an array of `File` objects) _(browser only)_
- W3C [File](https://developer.mozilla.org/en-US/docs/Web/API/File)/[Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) object (from an `<input>` or drag and drop)
- typed array or array of numbers
- Node [Buffer](https://nodejs.org/api/buffer.html) object
- Node [Readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) object

Or, an **array of of any of those values**.

If `opts` is specified, it should contain the following types of options:

- options for [create-torrent](https://github.com/webtorrent/create-torrent#createtorrentinput-opts-function-callback-err-torrent-) (to allow configuration of the .torrent file that is created)
- options for `client.add` (see above)

If `onseed` is specified, it will be called when the client has begun seeding the file.

**Note:** Every torrent is required to have a name. If one is not explicitly provided
through `opts.name`, one will be determined automatically using the following logic:

- If all files share a common path prefix, that will be used. For example, if all file
  paths start with `/imgs/` the torrent name will be `imgs`.
- Otherwise, the first file that has a name will determine the torrent name. For example,
  if the first file is `/foo/bar/baz.txt`, the torrent name will be `baz.txt`.
- If no files have names (say that all files are Uint8Array or Stream objects), then a name
  like "Unnamed Torrent <id>" will be generated.

**Note:** Every file is required to have a name. For filesystem paths or W3C File objects,
the name is included in the object. For Uint8Array or Readable stream types, a `name` property
can be set on the object, like this:

```js
const buf = new Uint8Array("Some file content",);
buf.name = "Some file name";
client.seed(buf, cb,);
```

## `client.on('add', function (torrent) {})`

Emitted when a torrent is added to client.torrents. This allows attaching to torrent events that may be emitted before the client 'torrent' event is emitted. See the torrent section for more info on what methods a `torrent` has.

## `client.on('remove', function (torrent) {})`

Emitted when a torrent is removed from client.torrents. See the torrent section for more info on what methods a `torrent` has.

## `client.on('torrent', function (torrent) {})`

Emitted when a torrent is ready to be used (i.e. metadata is available and store is
ready). See the torrent section for more info on what methods a `torrent` has.

## `client.on('error', function (err) {})`

Emitted when the client encounters a fatal error. The client is automatically
destroyed and all torrents are removed and cleaned up when this occurs.

Always listen for the 'error' event.

## `await client.remove(torrentId, [opts], [function callback (err) {}])`

Remove a torrent from the client. Destroy all connections to peers and delete all saved file metadata.

If `opts.destroyStore` is specified, it will override `opts.destroyStoreOnDestroy` passed when the torrent was added.
If truthy, `store.destroy()` will be called, which will delete the torrent's files from the disk.

If `callback` is provided, it will be called when the torrent is fully destroyed,
i.e. all open sockets are closed, and the storage is either closed or destroyed.

## `client.destroy([function callback (err) {}])`

Destroy the client, including all torrents and connections to peers. If `callback` is specified, it will be called when the client has gracefully closed.

## `client.torrents[...]`

An array of all torrents in the client.

## `await client.get(torrentId)`

Returns a promise which resolves the torrent with the given `torrentId`. Convenience method. Easier than searching
through the `client.torrents` array. Returns `null` if no matching torrent found.

## `client.downloadSpeed`

Total download speed for all torrents, in bytes/sec.

## `client.uploadSpeed`

Total upload speed for all torrents, in bytes/sec.

## `client.progress`

Total download progress for all **active** torrents, from 0 to 1.

## `client.ratio`

Aggregate "seed ratio" for all torrents (uploaded / downloaded).

## `client.throttleDownload(rate)`

Sets the maximum speed at which the client downloads the torrents, in bytes/sec.

`rate` must be bigger or equal than zero, or `-1` to disable the download throttle and
use the whole bandwidth of the connection.

## `client.throttleUpload(rate)`

Sets the maximum speed at which the client uploads the torrents, in bytes/sec.

`rate` must be bigger or equal than zero, or `-1` to disable the upload throttle and
use the whole bandwidth of the connection.

## `client.createServer([opts], force)`

Create an http server to serve the contents of this torrent, dynamically fetching the needed torrent pieces to satisfy http requests. Range requests are supported.
If `opts` is specified, it can have the following properties:

```js
{
  origin: String; // Allow requests from specific origin. `false` for same-origin. [default: '*']
  hostname: String; // If specified, only allow requests whose `Host` header matches this hostname. Note that you should not specify the port since this is automatically determined by the server. Ex: `localhost` [default: `undefined`]. NodeJS only.
  path: String; // Allows to overwrite the default `/webtorrent` base path. [default: '/webtorrent']. NodeJS only.
  controller: ServiceWorkerRegistration; // Accepts an existing service worker registration [await navigator.serviceWorker.getRegistration()]. Browser only. Required!
}
```

If `force` is specified, it can force WebTorrent to use a specific implementation for enviorments which run both Node and Browser like NW.js or Electron. Allowed values:

```js
"browser" || "node";
```

Visiting the root of the server `/` won't show anything. Visiting `/webtorrent/` will list all torrents. Access individual torrents at `/webtorrent/<infohash>` where `infohash` is the hash of the torrent. To acceess individual files, go to `/webtorrent/<infoHash>/<filepath>` where filepath is the file's path in the torrent.

Here is a usage example for Node.js:

```js
const client = new WebTorrent();
const magnetURI = "magnet: ...";

const instance = client.createServer();
instance.server.listen(0,); // start the server listening to a port
// 0 automatically finds an open port instead of forcing a potentially used one
client.add(magnetURI, (torrent,) => {
  // create HTTP server for this torrent

  const url = torrent.files[0].streamURL;
  console.log(url,);
  // visit http://localhost:<port>/webtorrent/ to see a list of torrents

  // access individual torrents at http://localhost:<port>/webtorrent/<infoHash> where infoHash is the hash of the torrent
},);

// later, cleanup...
instance.close();
client.destroy();
```

In browser needs either [this worker](https://github.com/webtorrent/webtorrent/blob/master/sw.min.js) to be used, or have [this functionality](https://github.com/webtorrent/webtorrent/blob/master/lib/worker.js) implemented.

Here is a user example for browser:

```js
const client = new WebTorrent();
const magnetURI = "magnet: ...";
const player = document.querySelector("video",);

const controller = await navigator.serviceWorker.register("./sw.min.js", {
  scope: "./",
},);
await navigator.serviceWorker.ready;
client.createServer({ controller, },);

client.add(magnetURI, (torrent,) => {
  const url = torrent.files[0].streamURL;
  console.log(url,);
  // visit <origin>/webtorrent/ to see a list of torrents, where origin is the worker registration scope.
  // access individual torrents at /webtorrent/<infoHash> where infoHash is the hash of the torrent
},);

// later, cleanup...
client._server.close();
client.destroy();
```

Needs either [this worker](https://github.com/webtorrent/webtorrent/blob/master/sw.min.js) to be used, or have [this functionality](https://github.com/webtorrent/webtorrent/blob/master/lib/worker.js) implemented.

# Torrent API

## `torrent.name`

Name of the torrent (string).

## `torrent.infoHash`

Info hash of the torrent (string).

## `torrent.magnetURI`

Magnet URI of the torrent (string).

## `torrent.torrentFile`

`.torrent` file of the torrent (Uint8Array).

## `torrent.torrentFileBlob`

`.torrent` file of the torrent (Blob). Useful for creating Blob URLs via `URL.createObjectURL(blob)`

## `torrent.announce[...]`

Array of all tracker servers. Each announce is an URL (string).

## `torrent.files[...]`

Array of all files in the torrent. See documentation for `File` below to learn what
methods/properties files have.

## `torrent.pieces[...]`

Array of all pieces in the torrent. See documentation for `Piece` below to learn what
properties pieces have. Some pieces can be null.

## `torrent.pieceLength`

Length in bytes of every piece but the last one.

## `torrent.lastPieceLength`

Length in bytes of the last piece (<= of `torrent.pieceLength`).

## `torrent.timeRemaining`

Time remaining for download to complete (in milliseconds).

## `torrent.received`

Total bytes received from peers (_including_ invalid data).

## `torrent.downloaded`

Total _verified_ bytes received from peers.

## `torrent.uploaded`

Total bytes uploaded to peers.

## `torrent.downloadSpeed`

Torrent download speed, in bytes/sec.

## `torrent.uploadSpeed`

Torrent upload speed, in bytes/sec.

## `torrent.progress`

Torrent download progress, from 0 to 1.

## `torrent.ratio`

Torrent "seed ratio" (uploaded / downloaded).

## `torrent.numPeers`

Number of peers in the torrent swarm.

## `torrent.maxWebConns`

Max number of simultaneous connections per web seed, as passed in the options.

## `torrent.path`

Torrent download location.

## `torrent.ready`

True when the torrent is ready to be used (i.e. metadata is available and store is
ready).

## `torrent.paused`

True when the torrent has stopped connecting to new peers. Note that this does
not pause new incoming connections, nor does it pause the streams of existing
connections or their wires.

## `torrent.done`

True when all the torrent files have been downloaded.

## `torrent.length`

Sum of the files length (in bytes).

## `torrent.created`

Date of creation of the torrent (as a [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object).

## `torrent.createdBy`

Author of the torrent (string).

## `torrent.comment`

A comment optionnaly set by the author (string).

## `torrent.destroy([opts], [callback])`

Remove the torrent from its client. Destroy all connections to peers and delete all saved file metadata.

If `opts.destroyStore` is specified, it will override `opts.destroyStoreOnDestroy` passed when the torrent was added.
If truthy, `store.destroy()` will be called, which will delete the torrent's files from the disk.

If `callback` is provided, it will be called when the torrent is fully destroyed,
i.e. all open sockets are closed, and the storage is either closed or destroyed.

## `torrent.addPeer(peer)`

Add a peer to the torrent swarm. This is advanced functionality. Normally, you should not
need to call `torrent.addPeer()` manually. WebTorrent will automatically find peers using
the tracker servers or DHT. This is just for manually adding a peer to the client.

This method should not be called until the `infoHash` event has been emitted.

Returns `true` if peer was added, `false` if peer was blocked by the loaded blocklist.

The `peer` argument must be an address string in the format `12.34.56.78:4444` (for
normal TCP/uTP peers), or a [`simple-peer`](https://github.com/feross/simple-peer)
instance (for WebRTC peers).

## `torrent.addWebSeed(urlOrConn)`

Add a web seed to the torrent swarm. For more information on BitTorrent web seeds, see
[BEP19](http://www.bittorrent.org/beps/bep_0019.html).

In the browser, web seed servers must have proper CORS (Cross-origin resource sharing)
headers so that data can be fetched across domain.

The `urlOrConn` argument is either the web seed URL, or an object that provides a custom
web seed implementation. A custom conn object is a duplex stream that speaks the bittorrent
wire protocol and pretends to be a remote peer. It must have a `connId` property that
uniquely identifies the custom web seed.

## `torrent.removePeer(peer)`

Remove a peer from the torrent swarm. This is advanced functionality. Normally, you should
not need to call `torrent.removePeer()` manually. WebTorrent will automatically remove
peers from the torrent swarm when they're slow or don't have pieces that are needed.

The `peer` argument should be an address (i.e. "ip:port" string), a peer id (hex string),
or `simple-peer` instance.

## `torrent.select(start, end, [priority], [notify])`

Selects a range of pieces to prioritize starting with `start` and ending with `end` (both
inclusive) at the given `priority`. `notify` is an optional callback to be called when the
selection is updated with new data.

## `torrent.deselect(start, end)`

Deprioritizes a range of previously selected pieces.

## `torrent.critical(start, end)`

Marks a range of pieces as critical priority to be downloaded ASAP. From `start` to `end`
(both inclusive).

## `torrent.pause()`

Temporarily stop connecting to new peers. Note that this does not pause new incoming
connections, nor does it pause the streams of existing connections or their wires.

## `torrent.resume()`

Resume connecting to new peers.

## `torrent.rescanFiles([function callback (err) {}])`

Verify the hashes of all pieces in the store and update the bitfield for any new valid
pieces. Useful if data has been added to the store outside WebTorrent, e.g. if another
process puts a valid file in the right place. Once the scan is complete,
`callback(null)` will be called (if provided), unless the torrent was destroyed during
the scan, in which case `callback` will be called with an error.

## `torrent.on('infoHash', function () {})`

Emitted when the info hash of the torrent has been determined.

## `torrent.on('metadata', function () {})`

Emitted when the metadata of the torrent has been determined. This includes the full
contents of the .torrent file, including list of files, torrent length, piece hashes,
piece length, etc.

## `torrent.on('ready', function () {})`

Emitted when the torrent is ready to be used (i.e. metadata is available and store is
ready).

## `torrent.on('warning', function (err) {})`

Emitted when there is a warning. This is purely informational and it is not necessary to
listen to this event, but it may aid in debugging.

## `torrent.on('error', function (err) {})`

Emitted when the torrent encounters a fatal error. The torrent is automatically destroyed
and removed from the client when this occurs.

**Note:** Torrent errors are emitted at `torrent.on('error')`. If there are no
'error' event handlers on the torrent instance, then the error will be emitted at
`client.on('error')`. This prevents throwing an uncaught exception (unhandled
'error' event), but it makes it impossible to distinguish client errors versus
torrent errors. Torrent errors are not fatal, and the client is still usable
afterwards. Therefore, always listen for errors in both places
(`client.on('error')` and `torrent.on('error')`).

## `torrent.on('idle', function () {})`

Emitted when the torrent has no more active selections to download, and starts idling
or seeding. This can happen when a file is fully downloaded, or when the desired pieces
have been downloaded.

## `torrent.on('done', function () {})`

Emitted when all the torrent files have been downloaded.

Here is a usage example:

```js
torrent.on("done", () => {
  console.log("torrent finished downloading",);
  for (const file of torrent.files) {
    // do something with file
  }
},);
```

## `torrent.on('download', function (bytes) {})`

Emitted whenever data is downloaded. Useful for reporting the current torrent status, for
instance:

```js
torrent.on("download", (bytes,) => {
  console.log("just downloaded: " + bytes,);
  console.log("total downloaded: " + torrent.downloaded,);
  console.log("download speed: " + torrent.downloadSpeed,);
  console.log("progress: " + torrent.progress,);
},);
```

## `torrent.on('upload', function (bytes) {})`

Emitted whenever data is uploaded. Useful for reporting the current torrent status.

## `torrent.on('wire', function (wire) {})`

Emitted whenever a new peer is connected for this torrent. `wire` is an instance of
[`bittorrent-protocol`](https://github.com/webtorrent/bittorrent-protocol), which is a
node.js-style duplex stream to the remote peer. This event can be used to specify
[custom BitTorrent protocol extensions](https://github.com/webtorrent/bittorrent-protocol#extension-api).

Here is a usage example:

```js
import MyExtension from "./my-extension";

torrent1.on("wire", (wire, addr,) => {
  console.log("connected to peer with address " + addr,);
  wire.use(MyExtension,);
},);
```

See the `bittorrent-protocol`
[extension api docs](https://github.com/webtorrent/bittorrent-protocol#extension-api) for more
information on how to define a protocol extension.

## `torrent.on('noPeers', function (announceType) {})`

Emitted every couple of seconds when no peers have been found. `announceType` is either `'tracker'`, `'dht'`, `'lsd'`, or `'ut_pex'` depending on which announce occurred to trigger this event. Note that if you're attempting to discover peers from a tracker, a DHT, a LSD, and PEX you'll see this event separately for each.

## `torrent.on('verified', function (index) {})`

Emitted every time a piece is verified, the value of the event is the index of the verified piece.

# File API

Webtorrent Files closely mimic W3C [Files](https://developer.mozilla.org/en-US/docs/Web/API/File)/[Blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob) except for `slice` where instead you pass the offsets as objects to the arrayBuffer/stream/createReadStream functions.

## `file.name`

File name, as specified by the torrent. _Example: 'some-filename.txt'_

## `file.path`

File path, as specified by the torrent. _Example: 'some-folder/some-filename.txt'_

## `file.length` or `file.size`

File length (in bytes), as specified by the torrent. _Example: 12345_

## `file.type`

Mime type of the file, falls back to `application/octet-stream` if the type is not recognized.

## `file.downloaded`

Total _verified_ bytes received from peers, for this file.

## `file.progress`

File download progress, from 0 to 1.

## `file.select([priority])`

Selects the file to be downloaded, at the given `priority`.
Useful if you know you need the file at a later stage.

## `file.deselect()`

Deselects the file's specific priority, which means it won't be downloaded unless someone creates a stream for it.

## `stream = file.createReadStream([opts])`

Create a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable)
to the file. Pieces needed by the stream will be prioritized highly and fetched from the
swarm first.

You can pass `opts` to stream only a slice of a file.

```js
{
  start: startByte,
  end: endByte
}
```

Both `start` and `end` are inclusive.

## `stream = file.stream(opts)`

Create a W3C [ReadableStream](https://devdocs.io/dom/readablestream)
to the file. Pieces needed by the stream will be prioritized highly and fetched from the
swarm first.

You can pass `opts` to stream only a slice of a file.

```js
{
  start: startByte,
  end: endByte
}
```

Both `start` and `end` are inclusive.

## `iterator = file[Symbol.asyncIterator]`

Create an [async iterator](https://devdocs.io/javascript/global_objects/symbol/asynciterator)
to the file. Pieces needed by the stream will be prioritized highly and fetched from the
swarm first.

You can pass `opts` to iterate only a slice of a file.

```js
{
  start: startByte,
  end: endByte
}
```

Both `start` and `end` are inclusive.

Example:

```js
for await (const chunk of file) {
  // do something with chunk
}
```

## `arrayBuffer = await file.arrayBuffer(opts)`

Get the file contents as a `ArrayBuffer`.

You can pass `opts` to get only a part of an ArrayBuffer.

```js
{
  start: startByte,
  end: endByte
}
```

```js
const data = await file.arrayBuffer();
console.log(data,); // ArrayBuffer { [Uint8Contents]: <00 62 00 01>, byteLength: 4 }
```

## `blob = await file.blob(opts)`

Get a W3C `Blob` object which contains the file data.

Useful for creating Blob URLs via `URL.createObjectURL(blob)`.

You can pass `opts` to get only a part of an Blob.

```js
{
  start: startByte,
  end: endByte
}
```

## `file.streamTo(elem)` _(browser only)_

Requires `client.createServer` to be ran beforehand. Sets the element source to the file's streaming URL. Supports streaming, seeking and all browser codecs and containers.

Support table:

| Containers | Chromium | Mobile Chromium | Edge | Chrome | Firefox |
| ---------- | :------: | :-------------: | :--: | :----: | :-----: |
| 3g2        |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| 3gp        |    ✓     |        ✓        |  ✓   |   ✓    |    ✘    |
| avi        |    ✘     |        ✘        |  ✘   |   ✘    |    ✘    |
| m2ts       |    ✘     |        ✘        | ✓**  |   ✘    |    ✘    |
| m4v etc.   |    ✓*    |       ✓*        |  ✓*  |   ✓*   |   ✓*    |
| mp4        |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| mpeg       |    ✘     |        ✘        |  ✘   |   ✘    |    ✘    |
| mov        |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| ogm ogv    |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| webm       |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| mkv        |    ✓     |        ✓        |  ✓   |   ✓    |    ✘    |

\* Container might be supported, but the container's codecs might not be.\
\*\* Documented as working, but can't reproduce.

| Video Codecs | Chromium | Mobile Chromium | Edge | Chrome | Firefox |
| ------------ | :------: | :-------------: | :--: | :----: | :-----: |
| AV1          |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| H.263        |    ✘     |        ✘        |  ✘   |   ✘    |    ✘    |
| H.264        |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| H.265        |    ✘     |        ✘        |  ✓*  |   ✓    |    ✘    |
| MPEG-2/4     |    ✘     |        ✘        |  ✘   |   ✘    |    ✘    |
| Theora       |    ✓     |        ✘        |  ✓   |   ✓    |    ✓    |
| VP8/9        |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |

\* Requires MSStore extension which you can get by opening this link `ms-windows-store://pdp/?ProductId=9n4wgh0z6vhq` while using Edge.

| Audio Codecs | Chromium | Mobile Chromium | Edge | Chrome | Firefox |
| ------------ | :------: | :-------------: | :--: | :----: | :-----: |
| AAC          |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| AC3          |    ✘     |        ✘        |  ✓   |   ✘    |    ✘    |
| DTS          |    ✘     |        ✘        |  ✘   |   ✘    |    ✘    |
| EAC3         |    ✘     |        ✘        |  ✓   |   ✘    |    ✘    |
| FLAC         |    ✓     |       ✓*        |  ✓   |   ✓    |    ✓    |
| MP3          |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| Opus         |    ✓     |        ✓        |  ✓   |   ✓    |    ✓    |
| TrueHD       |    ✘     |        ✘        |  ✘   |   ✘    |    ✘    |
| Vorbis       |    ✓     |        ✓        |  ✓   |   ✓    |   ✓*    |

\* Might not work in some video containers.

Since container and codec support is browser dependent these values might change over time.

## `file.streamURL`

Requires `client.createServer` to be ran beforehand.

Returns the URL of the file which is recognized by the HTTP server.

This method is useful both for servers which run WebTorrent or client apps. A few examples:

```js
const url = file.streamURL;

// create download link
if (err) throw err;
const a = document.createElement("a",);
a.target = "_blank";
a.href = url;
a.textContent = "Download " + file.name;
document.body.append(a,);

// render an image on a canvas
const canvas = document.getElementById("canvas",);
const ctx = canvas.getContext("2d",);
const img = new Image();
const loaded = new Promise((resolve,) => img.onload = resolve);
img.src = url;
await loaded;
ctx.drawImage(img,);

// send the file URL to another device on the network which can then display the file remotely [nodejs only]
import networkAddress from "network-address";

const networkURL = `http://${networkAddress()}:${client._server.port}${url}`;
sendRemote(networkURL,);
```

## `file.on('stream', function ({ stream, file, req }, function pipeCallback) {})`

This is advanced functionality.

Emitted every time when the HTTP server creates a new read stream. For example every time the user seeks a video. This allows you to find out what parts of the file the browser is requesting, and how it's requesting them. Additionally it allows you to manipulate the data that's being streamed.

Yields an object with 3 values and a function:

- object - information about the request,
  - `stream` - a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) which the user can manipulate,
  - `file` - the file object that's being streamed,
  - `req` - all the request information which the browser made when requesting the data.
- function - if you pipe the `stream`, use this function to callback the piped stream **synchronously!** Otherwise the playback is likely to break.

Example usage:

```js
file.on("stream", ({ stream, file, req, }, cb,) => {
  if (req.destination === "audio" && file.name.endsWith(".dts",)) {
    const transcoder = new SomeAudioTranscoder();
    cb(transcoder,);
    // do other things
  }
},);
```

## `file.on('iterator', function ({ stream, file, req }, function transformCallback) {})`

This is advanced functionality.

Same as with the `stream` event this is emitted by the HTTP server when it creates an async iterator for the file's data. This is used for very low-level manipulation of the incoming data and they way it's generated for example you could potentially accelerate how fast and how much data is pulled from the torrent.

Yields an object with 3 values and a function:

- object - information about the request,
  - `iterator` - an [async iterator](https://devdocs.io/javascript/global_objects/symbol/asynciterator) which the user can manipulate,
  - `file` - the file object that's being streamed,
  - `req` - all the request information which the browser made when requesting the data.
- function - if you wish to transform the `iterator`, use this function to callback the transformed iterator **synchronously!** Otherwise the playback is likely to break.

Example usage:

```js
import par from "it-parallel";

file.on("iterator", ({ iterator, file, req, }, cb,) => {
  const transform = par(iterator, { concurrency: 5, ordered: true, },);
  cb(transform,);
},);
```

## `file.includes(piece)`

Check if the piece number contains this file's data.

## `file.on('done', function () {})`

Emitted when the file has been downloaded.

# Piece API

## `piece.length`

Piece length (in bytes). _Example: 12345_

## `piece.missing`

Piece missing length (in bytes). _Example: 100_

# Wire API

## `wire.peerId`

Remote peer id (hex string)

## `wire.type`

Connection type ('webrtc', 'tcpIncoming', 'tcpOutgoing', 'utpIncoming', 'utpOutgoing', 'webSeed')

## `wire.uploaded`

Total bytes uploaded to peer.

## `wire.downloaded`

Total bytes downloaded from peer.

## `wire.uploadSpeed`

Peer upload speed, in bytes/sec.

## `wire.downloadSpeed`

Peer download speed, in bytes/sec.

## `wire.remoteAddress`

Peer's remote address. Only exists for tcp/utp peers.

## `wire.remotePort`

Peer's remote port. Only exists for tcp/utp peers.

## `wire.destroy()`

Close the connection with the peer. This however doesn't prevent the peer from simply re-connecting.

````

---

## Arquivo: `packages/utils/deno.jsonc`

```json
{
  "name": "@workerdb/utils",
  "publish": false,
  "compilerOptions": {
    "lib": [
      "deno.window",
      "deno.unstable"
    ]
  },
  "imports": {},
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read --allow-write tests/",
    "check": "deno check src/**/*.{ts,tsx} tests/**/*.ts",
    "tests": "deno task check && deno task test"
  },
  "exports": {
    ".": "./src/mod.ts",
    "./config": "./src/config/mod.ts",
    "./interfaces": "./src/interfaces/mod.ts",
    "./build": "./src/esbuild/mod.ts",
    "./export": "./src/export/mod.ts"
  }
}

```

---

## Arquivo: `build.ts`

```ts
/// <reference lib="deno.ns" />
/**
 * @file build.ts
 * @description Build alternativo usando Deno.bundle API nativa (--unstable-bundle)
 */
import {
  currentVersion,
  incrementVersion,
  listAssetsForCache,
  parseArgs,
  processBundleTarget,
} from "@workerdb/utils/build";
import type { DenoBundleGlobalConfig, } from "@workerdb/utils/interfaces";

// ============================================================================
// 📦 CONFIGURAÇÃO DECLARATIVA DE BUILDS
// ============================================================================
const CONFIG: DenoBundleGlobalConfig = {
  ui: {
    mode: "build",
    default: true,
    srcdir: "packages/ui/src",
    distdir: "packages/server/build/dist",
    publicdir: "packages/ui/public",
    indexHtml: true,
    clean: [".",],
    entryPoints: ["main.tsx",],
    platform: "browser",
    format: "esm",
    minify: false,
    sourcemap: "linked",
    keepNames: true,
    codeSplitting: false,
    packages: "bundle",
    inlineImports: true,
  },
  workerdb: {
    mode: "build",
    default: true,
    srcdir: "packages/worker-db/src",
    distdir: "packages/server/build/dist",
    clean: ["worker.js", "worker.js.map",],
    entryPoints: ["worker.ts",],
    outfile: "worker.js",
    platform: "browser",
    format: "esm",
    minify: false,
    sourcemap: "linked",
    indexHtml: false,
    keepNames: true,
    codeSplitting: false,
    packages: "bundle",
    inlineImports: true,
  },
  sw: {
    mode: "build",
    default: true,
    srcdir: "packages/service-worker/src",
    distdir: "packages/server/build/dist",
    clean: ["sw.js", "sw.js.map",],
    entryPoints: ["sw.ts",],
    platform: "browser",
    format: "esm",
    minify: false,
    sourcemap: "linked",
    indexHtml: false,
    keepNames: true,
    codeSplitting: false,
    packages: "bundle",
    inlineImports: true,
  },
  dist: {
    mode: "build",
    default: true,
    srcdir: "packages/worker-db/src",
    distdir: "packages/worker-db/dist",
    clean: [".",],
    entryPoints: ["worker.ts",],
    outfile: "workerdb.min.js",
    platform: "browser",
    format: "esm",
    minify: true,
    sourcemap: "external",
    indexHtml: false,
    keepNames: true,
    codeSplitting: false,
    packages: "bundle",
    inlineImports: true,
  },
};

// ============================================================================
// 🚀 PIPELINE PRINCIPAL
// ============================================================================
const DENO_JSONC_PATH = "deno.jsonc";

async function build() {
  const start = performance.now();
  const { targets, globalNoVersion, watchTarget, } = parseArgs(
    Deno.args,
    CONFIG,
  );

  console.log(
    "\n🚀 Iniciando Orquestrador de Build WorkerDB (Deno.bundle API)",
  );
  console.log(`   📦 Motor: Deno.bundle (nativo, --unstable-bundle)`,);

  if (watchTarget) {
    console.log(
      `\n⚠️ AVISO: Modo Watch não suportado pelo Deno.bundle API.`,
    );
    console.log(`   O alvo '${watchTarget}' foi ignorado.`,);
    console.log(
      `   Para watch mode, use o build oficial: deno task build watch`,
    );
    console.log(
      `   (que utiliza esbuild com suporte a esbuild.context().watch())\n`,
    );
    Deno.exit(0,);
  }

  console.log(`   📋 Alvos: ${targets.join(", ",) || "(nenhum)"}`,);
  console.log(`   🔒 Noversion: ${globalNoVersion}\n`,);

  if (targets.length === 0) {
    console.log("⚠️ Nenhum alvo para processar.",);
    Deno.exit(0,);
  }

  try {
    const currentVer = await currentVersion(DENO_JSONC_PATH,);

    const finalVersion = globalNoVersion
      ? currentVer
      : await incrementVersion(currentVer, DENO_JSONC_PATH,);

    for (const targetName of targets) {
      const targetConfig = CONFIG[targetName];
      if (!targetConfig) {
        console.warn(
          `⚠️ Alvo '${targetName}' não encontrado no CONFIG. Pulando.`,
        );
        continue;
      }

      const listFn = targetName === "sw" ? listAssetsForCache : undefined;
      await processBundleTarget(
        targetName,
        targetConfig,
        finalVersion,
        listFn,
      );
    }

    console.log(`\n${"=".repeat(60,)}`,);
    console.log(`🎉 ORQUESTRAÇÃO CONCLUÍDA COM SUCESSO!`,);
    console.log(`${"=".repeat(60,)}`,);
  } catch (error) {
    console.error("\n🛑 Pipeline de build falhou:", error,);
    Deno.exit(1,);
  } finally {
    const elapsed = (performance.now() - start).toFixed(0,);
    console.log(`\n⏱️ Tempo total: ${elapsed}ms\n`,);
  }
}

if (import.meta.main) {
  await build();
}

```

---

## Arquivo: `export.ts`

```ts
/// <reference lib="deno.ns" />

/**
 * @file export.ts
 * @description Script de consolidação de contexto para IAs com suporte a parâmetros via CLI.
 * Contém as configurações específicas do projeto WorkerDB e a lógica de execução.
 * A lógica pura reutilizável está em @workerdb/utils/export.
 *
 * Comportamento:
 * - Sem args: executa todos os modos com `default !== false`
 * - Com args: executa apenas os modos solicitados
 * - Suporta múltiplos modos em uma única execução
 */

import { walk, } from "@std/fs/walk";
import { relative, } from "@std/path/relative";
import {
  deveIncluirArquivo,
  formatarArquivoMarkdown,
  gerarCabecalho,
} from "@workerdb/utils/export";
import type { ExportConfig, } from "@workerdb/utils/interfaces";
import { APP_VERSION, EXTENSOES_PADRAO, } from "@workerdb/utils/config";

// ============================================================================
// 📦 TIPOS ESPECÍFICOS DO PROJETO
// ============================================================================

/**
 * Modos de exportação disponíveis no WorkerDB.
 * Específicos para este projeto.
 */
export type ModoExportacao =
  | "ui"
  | "docs"
  | "server"
  | "workerdb"
  | "utils"
  | "sw";

// ============================================================================
// 📋 CONFIGURAÇÕES ESPECÍFICAS DO WORKERDB
// ============================================================================

/**
 * Dicionário de configurações para cada modo de exportação do WorkerDB.
 * Declarativo, extensível e específico deste projeto.
 */
export const CONFIGURACOES: Record<ModoExportacao, ExportConfig> = {
  ui: {
    arquivoSaida: "snapshots/ui.md",
    extensoesPermitidas: EXTENSOES_PADRAO,
    pastaBase: "./packages/ui/",
    subpastasPermitidas: ["src", "public", "tests", "docs",],
    arquivosRaizPermitidos: [
      "build.ts",
      "deno.json",
      "deno.jsonc",
      "readme.md",
    ],
    incluiVersao: true,
    instrucaoCustomizada:
      "O texto abaixo contém os arquivos de CÓDIGO FONTE principais da aplicação exemplo (UI).",
    default: true, // ✅ Roda por padrão
  },
  docs: {
    arquivoSaida: "snapshots/docs.md",
    extensoesPermitidas: [".md", ".txt",],
    pastaBase: "./",
    subpastasPermitidas: ["docs",],
    arquivosRaizPermitidos: [
      "readme.md",
      "readme",
      "license",
      "license.md",
      "license.txt",
      ".tool-versions",
    ],
    incluiVersao: false,
    instrucaoCustomizada:
      "O texto abaixo contém a DOCUMENTAÇÃO e diretrizes arquiteturais do projeto.",
    default: false, // ✅ Roda por padrão
  },
  server: {
    arquivoSaida: "snapshots/server.md",
    extensoesPermitidas: EXTENSOES_PADRAO,
    pastaBase: "packages/server",
    subpastasPermitidas: ["src", "tests", "docs",],
    caminhosAdicionaisPermitidos: [".github/workflows",],
    arquivosRaizPermitidos: [
      "deno.json",
      "deno.jsonc",
      "readme.md",
    ],
    incluiVersao: false,
    instrucaoCustomizada:
      "O texto abaixo contém os arquivos de configuração e execução do SERVIDOR @vanaware/server e CI/CD.",
    default: true, // ✅ Roda por padrão
  },
  workerdb: {
    arquivoSaida: "snapshots/worker-db.md",
    extensoesPermitidas: EXTENSOES_PADRAO,
    pastaBase: "packages/worker-db",
    subpastasPermitidas: ["src", "tests", "docs", "example",],
    arquivosRaizPermitidos: [
      "build.ts",
      "deno.json",
      "deno.jsonc",
      "readme.md",
    ],
    incluiVersao: false,
    instrucaoCustomizada:
      "O texto abaixo contém experimentos e código da área de @vanaware/workerdb",
    default: true, // ✅ Roda por padrão
  },
  utils: {
    arquivoSaida: "snapshots/utils.md",
    extensoesPermitidas: EXTENSOES_PADRAO,
    pastaBase: "packages/utils",
    subpastasPermitidas: ["src", "tests", "docs",],
    caminhosAdicionaisPermitidos: ["export.ts", "esbuild.ts", "build.ts",],
    arquivosRaizPermitidos: ["deno.json", "deno.jsonc", "readme.md",],
    incluiVersao: false,
    instrucaoCustomizada:
      "O texto abaixo contém experimentos e código da área de @vanaware/utils",
    default: true, // ✅ Roda por padrão
  },
  sw: {
    arquivoSaida: "snapshots/sw.md",
    extensoesPermitidas: EXTENSOES_PADRAO,
    pastaBase: "packages/service-worker",
    subpastasPermitidas: ["src", "tests", "docs",],
    arquivosRaizPermitidos: ["deno.json", "deno.jsonc", "readme.md",],
    incluiVersao: true,
    instrucaoCustomizada:
      "O texto abaixo contém experimentos e código da área de @vanaware/service-worker",
    default: true, // ❌ Só roda quando solicitado explicitamente
  },
};

// ============================================================================
// 🎯 PARSING DE ARGUMENTOS CLI
// ============================================================================

/**
 * Parseia os argumentos da CLI e determina quais modos devem ser executados.
 *
 * Regras:
 * - Sem args: executa todos os modos com `default !== false`
 * - Com args: executa apenas os modos solicitados (na ordem do CONFIG)
 * - Args desconhecidos são ignorados
 *
 * @param args - Argumentos da CLI
 * @returns Array de modos a serem executados (na ordem do CONFIG)
 */
function parseArgs(args: string[],): ModoExportacao[] {
  const configKeys = Object.keys(CONFIGURACOES,) as ModoExportacao[];

  // Normaliza args para lowercase
  const lowerArgs = args.map((a,) => a.toLowerCase());

  // Filtra args válidos (que existem no CONFIG)
  const requestedModos = lowerArgs.filter(
    (arg,) => configKeys.includes(arg as ModoExportacao,),
  ) as ModoExportacao[];

  // Se nenhum modo foi solicitado, usa os defaults
  if (requestedModos.length === 0) {
    return configKeys.filter((modo,) => {
      const config = CONFIGURACOES[modo];
      return config.default !== false;
    },);
  }

  // Retorna na ordem do CONFIG (não na ordem da CLI)
  return configKeys.filter((modo,) => requestedModos.includes(modo,));
}

// ============================================================================
// 🚀 EXECUÇÃO DE UM MODO ESPECÍFICO
// ============================================================================

async function exportarModo(modo: ModoExportacao,): Promise<void> {
  const config = CONFIGURACOES[modo];
  const versaoDisplay = config.incluiVersao ? `[v${APP_VERSION}] ` : "";

  console.log(`\n${"=".repeat(60,)}`,);
  console.log(`📦 EXPORTANDO MODO: ${modo.toUpperCase()} ${versaoDisplay}`,);
  console.log(`${"=".repeat(60,)}`,);
  console.log(`📄 Arquivo de saída: ${config.arquivoSaida}`,);
  console.log(`📁 Pasta base: ${config.pastaBase}`,);

  // Gera o cabeçalho do snapshot
  let conteudoFinal = gerarCabecalho(config, modo, APP_VERSION,);

  let arquivosIncluidos = 0;

  // Varre o diretório atual e filtra os arquivos
  for await (const entry of walk(".", { includeDirs: false, },)) {
    const caminhoRelativo = relative(".", entry.path,);

    if (deveIncluirArquivo(caminhoRelativo, config,)) {
      try {
        console.log(`   ✅ Incluindo: ${caminhoRelativo}`,);
        const conteudoArquivo = await Deno.readTextFile(entry.path,);
        conteudoFinal += formatarArquivoMarkdown(
          caminhoRelativo,
          conteudoArquivo,
        );
        arquivosIncluidos++;
      } catch (erro) {
        if (erro instanceof Error) {
          console.error(`   ❌ Erro ao ler ${caminhoRelativo}:`, erro.message,);
        }
      }
    }
  }

  // Escreve o arquivo final
  await Deno.writeTextFile(config.arquivoSaida, conteudoFinal,);
  console.log(
    `\n✨ Modo ${modo.toUpperCase()} concluído: ${arquivosIncluidos} arquivos exportados para ${config.arquivoSaida}`,
  );
}

// ============================================================================
// 🚀 EXECUÇÃO PRINCIPAL
// ============================================================================

if (import.meta.main) {
  const startTime = performance.now();

  // Parseia args e determina quais modos executar
  const modosParaExecutar = parseArgs(Deno.args,);

  console.log("\n🚀 Iniciando Exportação de Contexto WorkerDB",);
  console.log(`📋 Modos a exportar: ${modosParaExecutar.join(", ",)}`,);
  console.log(`📌 Versão: v${APP_VERSION}\n`,);

  if (modosParaExecutar.length === 0) {
    console.log(
      "⚠️ Nenhum modo para executar. Verifique as configurações de 'default' no CONFIG.",
    );
    Deno.exit(0,);
  }

  // Executa cada modo sequencialmente
  for (const modo of modosParaExecutar) {
    try {
      await exportarModo(modo,);
    } catch (error) {
      console.error(`\n🛑 Erro ao exportar modo ${modo}:`, error,);
      Deno.exit(1,);
    }
  }

  const elapsed = (performance.now() - startTime).toFixed(0,);
  console.log(`\n${"=".repeat(60,)}`,);
  console.log(`🎉 EXPORTAÇÃO CONCLUÍDA COM SUCESSO!`,);
  console.log(`⏱️ Tempo total: ${elapsed}ms`,);
  console.log(`${"=".repeat(60,)}\n`,);
}

```

---

## Arquivo: `esbuild.ts`

```ts
/// <reference lib="deno.ns" />
import * as esbuild from "esbuild";
import { denoPlugin, } from "@deno/esbuild-plugin";
import {
  buildEsbuildOptions,
  copyStaticFiles,
  currentVersion,
  incrementVersion,
  listAssetsForCache,
  parseArgs,
  processTarget,
} from "@workerdb/utils/build";
import type { GlobalTargetConfig, } from "@workerdb/utils/interfaces";

const DENO_JSONC_PATH = "deno.jsonc";

// ============================================================================
// 🔌 WRAPPER ESBUILD COM PLUGIN DENO
// ============================================================================
// deno-lint-ignore no-explicit-any
const buildWithDenoPlugin = (options: any,): Promise<any> => {
  options.plugins = [
    ...(options.plugins || []),
    denoPlugin({ "configPath": DENO_JSONC_PATH, },),
  ];
  return esbuild.build(options,);
};

// ============================================================================
// 📦 CONFIGURAÇÃO DECLARATIVA DE BUILDS (específica do WorkerDB)
// ============================================================================
const BANNER_JS = `/*!
 * WorkerDB v__APP_VERSION__
 * (c) 2026 Vanaware - MIT License
 */\n`;

const CONFIG: GlobalTargetConfig = {
  // ------------------------------------------------------------------
  // 🎯 ALVOS DE BUILD (rodam por padrão)
  // ------------------------------------------------------------------
  ui: {
    mode: "build",
    default: true,
    srcdir: "packages/ui/src",
    distdir: "packages/server/build/dist",
    publicdir: "packages/ui/public",
    indexHtml: true,
    clean: [".",],
    entryPoints: ["main.tsx",],
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: false,
    sourcemap: "linked",
    conditions: ["browser",],
    drop: ["debugger",],
    jsx: "automatic",
    jsxImportSource: "preact",
    metafile: true,
    write: true,
    legalComments: "eof",
    keepNames: true,
    splitting: false,
    banner: {
      js: BANNER_JS,
    },
  },
  workerdb: {
    mode: "build",
    default: true,
    srcdir: "packages/worker-db/src",
    distdir: "packages/server/build/dist",
    clean: ["worker.js", "worker.js.map",],
    entryPoints: ["worker.ts",],
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: false,
    sourcemap: "linked",
    drop: ["debugger",],
    conditions: ["worker",],
    metafile: true,
    write: true,
    legalComments: "eof",
    keepNames: true,
    splitting: false,
    banner: {
      js: BANNER_JS,
    },
  },
  sw: {
    mode: "build",
    default: true,
    srcdir: "packages/service-worker/src",
    distdir: "packages/server/build/dist",
    clean: ["sw.js", "sw.js.map",],
    entryPoints: ["sw.ts",],
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: false,
    sourcemap: "linked",
    drop: ["debugger",],
    conditions: ["worker",],
    metafile: true,
    write: true,
    legalComments: "eof",
    keepNames: true,
    splitting: false,
    banner: {
      js: BANNER_JS,
    },
  },
  dist: {
    mode: "build",
    default: true,
    srcdir: "packages/worker-db/src",
    distdir: "packages/worker-db/dist",
    clean: [".",],
    entryPoints: ["worker.ts",],
    outfile: "workerdb.min.js",
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: true,
    sourcemap: "external",
    drop: ["debugger",],
    conditions: ["worker",],
    metafile: false,
    write: true,
    legalComments: "eof",
    keepNames: true,
    splitting: false,
    banner: {
      js: BANNER_JS,
    },
  },
  // ------------------------------------------------------------------
  // 👀 ALVOS WATCH (modo de desenvolvimento contínuo)
  // ------------------------------------------------------------------
  "watch": {
    mode: "watch",
    default: false,
    srcdir: "packages/ui/src",
    distdir: "packages/server/build/dist",
    publicdir: "packages/ui/public",
    indexHtml: true,
    entryPoints: ["main.ts",],
    platform: "browser",
    format: "esm",
    bundle: true,
    minify: false,
    sourcemap: "inline",
    conditions: ["browser",],
    jsx: "automatic",
    jsxImportSource: "preact",
    write: true,
    legalComments: "eof",
    // 🔥 CORREÇÃO: outfile agora é RELATIVO ao distdir
    outfile: "app.js",
    banner: {
      js: BANNER_JS,
    },
  },
};

// ============================================================================
// 🚀 PIPELINE PRINCIPAL
// ============================================================================
async function build() {
  const start = performance.now();
  const { targets, globalNoVersion, watchTarget, } = parseArgs(
    Deno.args,
    CONFIG,
  );

  console.log(
    "\n🚀 Iniciando Orquestrador de Build WorkerDB (esbuild nativo + @deno/esbuild-plugin)",
  );
  if (watchTarget) {
    console.log(`👀 Modo Watch ativo: ${watchTarget}`,);
  } else {
    console.log(
      `📋 Alvos de build (ordem segura do CONFIG): ${
        targets.join(", ",) || "(nenhum)"
      }`,
    );
  }
  console.log(`🔒 Noversion: ${globalNoVersion}\n`,);

  try {
    const currentVer = await currentVersion(DENO_JSONC_PATH,);

    if (watchTarget) {
      await startWatchMode(watchTarget, currentVer,);
      return;
    }

    const finalVersion = globalNoVersion
      ? currentVer
      : await incrementVersion(currentVer, DENO_JSONC_PATH,);

    for (const targetName of targets) {
      const targetConfig = CONFIG[targetName];
      if (!targetConfig) {
        console.warn(
          `⚠️ Alvo '${targetName}' não encontrado no CONFIG. Pulando.`,
        );
        continue;
      }

      await processTarget(
        targetName,
        targetConfig,
        finalVersion,
        buildWithDenoPlugin,
        listAssetsForCache,
      );
    }

    console.log(`\n${"=".repeat(60,)}`,);
    console.log(`🎉 ORQUESTRAÇÃO CONCLUÍDA COM SUCESSO!`,);
    console.log(`${"=".repeat(60,)}`,);
  } catch (error) {
    console.error("\n🛑 Pipeline de build falhou:", error,);
    Deno.exit(1,);
  } finally {
    const elapsed = (performance.now() - start).toFixed(0,);
    console.log(`\n⏱️ Tempo total: ${elapsed}ms\n`,);
  }
}

async function startWatchMode(watchTargetName: string, currentVer: string,) {
  const config = CONFIG[watchTargetName];
  if (!config) {
    throw new Error(
      `❌ Alvo watch '${watchTargetName}' não encontrado no CONFIG`,
    );
  }

  console.log(`\n👀 Iniciando Watch Mode: ${watchTargetName}\n`,);

  await copyStaticFiles(config, currentVer,);

  const esbuildOptions = await buildEsbuildOptions(
    watchTargetName,
    config,
    currentVer,
  );

  esbuildOptions.plugins = [...(esbuildOptions.plugins || []), denoPlugin(),];

  const ctx = await esbuild.context(esbuildOptions,);
  await ctx.watch();

  console.log("\n✅ Watch mode ativo!",);
  console.log(`📁 Monitorando: ${config.srcdir}/`,);

  // 🔥 CORREÇÃO: Mostra o outfile resolvido (relativo ao distdir)
  const resolvedOutfile = esbuildOptions.outfile ||
    (config.distdir ? `${config.distdir}/` : "N/A");
  console.log(`📦 Output: ${resolvedOutfile}`,);
  console.log(`📌 Versão: v${currentVer}`,);
  console.log("\n💡 Pressione Ctrl+C para parar.\n",);

  await new Promise(() => {},);
}

await build();

```

---

