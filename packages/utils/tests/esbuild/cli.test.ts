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
