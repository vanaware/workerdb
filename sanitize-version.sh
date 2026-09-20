#!/bin/sh
# =============================================================================
# sanitize-version.sh — normaliza a versão do deno.json[c] para semver estrito
#
# Uso:
#   ./sanitize-version.sh [caminho/para/deno.json[c]]
#
# Sem argumento, procura deno.jsonc (preferido) ou deno.json a partir do
# diretório do script.
# =============================================================================
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-version.sh
. "$SCRIPT_DIR/lib-version.sh"

# -----------------------------------------------------------------------------
# 1) Localizar arquivo
# -----------------------------------------------------------------------------
if [ "$#" -gt 0 ]; then
  FILE_PATH="$1"
  if [ ! -f "$FILE_PATH" ]; then
    echo "❌ Erro: Arquivo '$FILE_PATH' não encontrado." >&2
    exit 1
  fi
else
  FILE_PATH="$(find_deno_file "$SCRIPT_DIR")" || {
    echo "❌ Erro: Nenhum deno.json[c] encontrado a partir de $SCRIPT_DIR" >&2
    exit 1
  }
fi

echo "🔍 Buscando versão em: $FILE_PATH"

# -----------------------------------------------------------------------------
# 2) Extrair versão bruta
# -----------------------------------------------------------------------------
RAW_VERSION="$(extract_raw_version "$FILE_PATH")"

# -----------------------------------------------------------------------------
# 3) Se ausente, injeta "0.0.0" após a primeira "{" de abertura
#    Ancorado em /^[[:space:]]*\{/ para não casar com "{" em comentários.
# -----------------------------------------------------------------------------
if [ -z "$RAW_VERSION" ]; then
  echo "⚠️  Nenhum campo 'version' encontrado. Inserindo \"0.0.0\"..."

  awk '
    BEGIN { done = 0 }
    !done && /^[[:space:]]*\{/ {
      print
      print "  \"version\": \"0.0.0\","
      done = 1
      next
    }
    { print }
  ' "$FILE_PATH" > "$FILE_PATH.tmp" && mv "$FILE_PATH.tmp" "$FILE_PATH"

  RAW_VERSION="0.0.0"
fi

echo "📌 Versão original: $RAW_VERSION"

# -----------------------------------------------------------------------------
# 4) Sanitizar via lib
# -----------------------------------------------------------------------------
SANITIZED_VERSION="$(sanitize_version "$RAW_VERSION")"
echo "✅ Versão sanitizada: $SANITIZED_VERSION"

# -----------------------------------------------------------------------------
# 5) Reescrever o arquivo se mudou
#    Substituição LITERAL via awk + index() — nada de regex em RAW_VERSION.
# -----------------------------------------------------------------------------
if [ "$RAW_VERSION" != "$SANITIZED_VERSION" ]; then
  awk -v old="$RAW_VERSION" -v new="$SANITIZED_VERSION" '
    {
      pos = index($0, "\"version\"")
      if (pos > 0) {
        vpos = index(substr($0, pos), old)
        if (vpos > 0) {
          actual = pos + vpos - 1
          printf "%s%s%s\n", substr($0, 1, actual - 1), new, substr($0, actual + length(old))
          next
        }
      }
      print
    }
  ' "$FILE_PATH" > "$FILE_PATH.tmp" && mv "$FILE_PATH.tmp" "$FILE_PATH"

  echo "📝 Arquivo atualizado: $RAW_VERSION → $SANITIZED_VERSION"
else
  echo "✨ Já estava no formato semver correto."
fi