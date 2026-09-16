declare const __APP_VERSION__: string;

export const APP_VERSION = typeof __APP_VERSION__ !== "undefined"
  ? __APP_VERSION__
  : "dev";

export const DB_NAMES = {
  CONFIG: "Config",
} as const;

export const STORE_NAMES = {
  KEYVAL: "keyval",
} as const;

export const KEY_NAMES = {
  PROFILE: "profile",
  CONFIG: "config",
} as const;

export const DEBUG_CHANNEL_NAME = "workerdb_debug_channel";

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
