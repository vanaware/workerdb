#!/usr/bin/env bash
set -e

# Se um argumento foi passado, usa ele como o caminho do arquivo
# Caso contrário, procura deno.json ou deno.jsonc no mesmo diretório do script
if [ -n "$1" ]; then
  FILE_PATH="$1"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/deno.jsonc" ]; then
    FILE_PATH="$SCRIPT_DIR/deno.jsonc"
  elif [ -f "$SCRIPT_DIR/deno.json" ]; then
    FILE_PATH="$SCRIPT_DIR/deno.json"
  else
    echo "❌ Erro: Nenhum arquivo de configuração do Deno encontrado no diretório do script." >&2
    exit 1
  fi
fi

if [ ! -f "$FILE_PATH" ]; then
  echo "❌ Erro: Arquivo '$FILE_PATH' não encontrado." >&2
  exit 1
fi

echo "🔍 Buscando versão no arquivo: $FILE_PATH"

# Extrai o valor do campo "version" (lida com aspas duplas)
RAW_VERSION=$(grep -E '"version"\s*:\s*"[^"]+"' "$FILE_PATH" | head -n 1 | sed -E 's/.*"version"\s*:\s*"([^"]+)".*/\1/' || true)

if [ -z "$RAW_VERSION" ]; then
  # Tenta com aspas simples caso exista
  RAW_VERSION=$(grep -E "'version'\s*:\s*'[^']+'" "$FILE_PATH" | head -n 1 | sed -E "s/.*'version'\s*:\s*'([^']+)'.*/\1/" || true)
fi

if [ -z "$RAW_VERSION" ]; then
  echo "⚠️ Nenhum campo 'version' encontrado em $FILE_PATH. Criando versão '0.0.0'..."
  awk 'BEGIN{done=0} { if (!done && /{/) { print "{"; print "  \"version\": \"0.0.0\","; done=1 } else { print } }' "$FILE_PATH" > "$FILE_PATH.tmp"
  mv "$FILE_PATH.tmp" "$FILE_PATH"
  RAW_VERSION="0.0.0"
fi

echo "📌 Versão original encontrada: $RAW_VERSION"

# Remove qualquer prefixo não numérico no início (como 'v', 'V', 'release-', etc.)
VERSION_CLEAN=$(echo "$RAW_VERSION" | sed -E 's/^[^0-9]*//')

# Remove qualquer sufixo começando com hífens ou mais (como -alpha, -mu73p02v, +build)
VERSION_CLEAN=$(echo "$VERSION_CLEAN" | sed -E 's/[-+].*$//')

# Filtra apenas números e pontos
VERSION_CLEAN=$(echo "$VERSION_CLEAN" | tr -cd '0-9.')

# Divide a versão por pontos
IFS='.' read -r -a PARTS <<< "$VERSION_CLEAN"

MAJOR="${PARTS[0]}"
MINOR="${PARTS[1]}"
PATCH="${PARTS[2]}"

# Se alguma parte estiver vazia ou não for numérica, substitui por 0
if [[ ! "$MAJOR" =~ ^[0-9]+$ ]]; then MAJOR="0"; fi
if [[ ! "$MINOR" =~ ^[0-9]+$ ]]; then MINOR="0"; fi
if [[ ! "$PATCH" =~ ^[0-9]+$ ]]; then PATCH="0"; fi

SANITIZED_VERSION="$MAJOR.$MINOR.$PATCH"
echo "✅ Versão sanitizada para semver: $SANITIZED_VERSION"

# Se a versão sanitizada for diferente da original, atualiza o arquivo
if [ "$RAW_VERSION" != "$SANITIZED_VERSION" ]; then
  if sed --version >/dev/null 2>&1; then
    # GNU sed
    sed -i "s/\"version\"[[:space:]]*:[[:space:]]*\"$RAW_VERSION\"/\"version\": \"$SANITIZED_VERSION\"/g" "$FILE_PATH"
  else
    # BSD sed (macOS)
    sed -i '' "s/\"version\"[[:space:]]*:[[:space:]]*\"$RAW_VERSION\"/\"version\": \"$SANITIZED_VERSION\"/g" "$FILE_PATH"
  fi
  echo "📝 Arquivo atualizado com sucesso com a versão sanitizada!"
else
  echo "✨ A versão já estava no formato semver correto."
fi
