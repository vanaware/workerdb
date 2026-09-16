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
