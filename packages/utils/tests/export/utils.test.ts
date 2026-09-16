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
