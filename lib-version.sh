#!/bin/sh
# =============================================================================
# lib-version.sh — funções compartilhadas para manipular a versão do deno.json[c]
#
# POSIX puro. Compatível com dash (Debian), busybox sh, bash --posix.
#
# Uso:
#   . "$(dirname "$0")/lib-version.sh"
#
# Funções exportadas:
#   find_deno_file [dir]        → imprime caminho do deno.json[c] ou falha
#   extract_raw_version <file>  → imprime "version" cru ou string vazia
#   sanitize_version <raw>      → imprime MAJOR.MINOR.PATCH
# =============================================================================

# -----------------------------------------------------------------------------
# find_deno_file [dir_inicial]
#   Procura deno.jsonc (preferido) ou deno.json subindo a árvore a partir de
#   dir_inicial (default: "."). Imprime o caminho encontrado ou retorna 1.
# -----------------------------------------------------------------------------
find_deno_file() {
  _start="${1:-.}"

  # Resolve para caminho absoluto — evita loop infinito com dirname "."
  _dir="$(cd "$_start" 2>/dev/null && pwd)" || return 1

  while [ -n "$_dir" ] && [ "$_dir" != "/" ]; do
    if [ -f "$_dir/deno.jsonc" ]; then
      printf '%s\n' "$_dir/deno.jsonc"
      return 0
    fi
    if [ -f "$_dir/deno.json" ]; then
      printf '%s\n' "$_dir/deno.json"
      return 0
    fi
    _dir="$(dirname "$_dir")"
  done

  return 1
}

# -----------------------------------------------------------------------------
# extract_raw_version <arquivo>
#   Extrai o valor bruto do campo "version" ancorado no início da linha
#   (exclui comentários JSONC e chaves aninhadas). Imprime ou retorna vazio.
# -----------------------------------------------------------------------------
extract_raw_version() {
  sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" \
    | head -n 1
}

# -----------------------------------------------------------------------------
# sanitize_version <raw>
#   Converte "v1.2.3-alpha+build" em "1.2.3". Sempre imprime algo (0.0.0 no
#   pior caso). Componentes extras (1.2.3.4) são descartados.
# -----------------------------------------------------------------------------
sanitize_version() {
  _v="$(printf '%s' "$1" \
    | sed -E 's/^[^0-9]*//' \
    | sed -E 's/[-+#].*$//' \
    | tr -cd '0-9.' \
    | sed -E 's/\.+/./g; s/^\.//; s/\.$//')"

  # read com 4 variáveis: _rest absorve componentes extras (1.2.3.4.5)
  IFS='.' read -r _ma _mi _pa _rest <<EOF
$_v
EOF

  case "$_ma" in ''|*[!0-9]*) _ma="0" ;; esac
  case "$_mi" in ''|*[!0-9]*) _mi="0" ;; esac
  case "$_pa" in ''|*[!0-9]*) _pa="0" ;; esac

  printf '%s.%s.%s\n' "$_ma" "$_mi" "$_pa"
}