// TODO(@djones): no novo worker-db, função ls(), "id" deverá ser "_id" para debug
export interface DebugLogPayload {
  id: string;
  timestamp: string;
  type: "info" | "warn" | "error" | "success";
  module: string;
  message: string;
  details?: unknown;
}

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
  // 🔄 PIPELINE SYNTAXMESH (Pré/Pós Build)
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
  // 🔧 EXTENSÕES SYNTAXMESH (pré-processamento customizado)
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
