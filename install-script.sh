#!/usr/bin/env bash
set -eu

# ---------- Localizar .tool-versions ----------
# Procura no diretório do script, depois sobe a árvore até a raiz
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

find_tool_versions() {
  dir="$1"
  while [ -n "$dir" ] && [ "$dir" != "/" ]; do
    if [ -f "$dir/.tool-versions" ]; then
      printf '%s\n' "$dir/.tool-versions"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  # Último recurso: diretório atual
  if [ -f ".tool-versions" ]; then
    printf '%s\n' ".tool-versions"
    return 0
  fi
  return 1
}

TOOL_VERSIONS_FILE=""
if TOOL_VERSIONS_FILE="$(find_tool_versions "$SCRIPT_DIR")"; then
  echo "📄 Usando $TOOL_VERSIONS_FILE"
else
  echo "⚠️ .tool-versions não encontrado — instalará a versão mais recente" >&2
fi

# ---------- Extrair versão do Deno ----------
DENO_VERSION=""
if [ -n "$TOOL_VERSIONS_FILE" ]; then
  DENO_VERSION="$(awk '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*deno[[:space:]]+/ { print $2; exit }
  ' "$TOOL_VERSIONS_FILE")"
fi

# Normaliza: remove prefixo "v" se existir
DENO_VERSION="${DENO_VERSION#v}"

# Valida formato (apenas dígitos e pontos)
case "$DENO_VERSION" in
  ''|*[!0-9.]*)
    if [ -n "$DENO_VERSION" ]; then
      echo "⚠️ Versão inválida em .tool-versions: '$DENO_VERSION'" >&2
    fi
    DENO_VERSION=""
    ;;
esac

# ---------- PATH e detecção do Deno instalado ----------
export PATH="${HOME:-/root}/.deno/bin:/root/.deno/bin:/usr/local/bin:$PATH"

INSTALLED_VERSION=""
if command -v deno >/dev/null 2>&1; then
  INSTALLED_VERSION="$(deno --version 2>/dev/null | head -n 1 | awk '{print $2}')"
fi

# ---------- Instalar / reinstalar se necessário ----------
if [ -n "$DENO_VERSION" ]; then
  if [ "$INSTALLED_VERSION" = "$DENO_VERSION" ]; then
    echo "✅ Deno $DENO_VERSION já instalado"
  else
    if [ -n "$INSTALLED_VERSION" ]; then
      echo "🔄 Deno $INSTALLED_VERSION encontrado, reinstalando $DENO_VERSION..."
    else
      echo "📥 Instalando Deno $DENO_VERSION (unattended)..."
    fi
    curl -fsSL https://deno.land/install.sh \
      | sh -s -- -y -f "v$DENO_VERSION"
  fi
else
  if [ -z "$INSTALLED_VERSION" ]; then
    echo "📥 Instalando Deno (versão mais recente)..."
    curl -fsSL https://deno.land/install.sh | sh -s -- -y
  fi
fi

# ---------- Symlinks (Debian/root-friendly) ----------
if [ -w /usr/local/bin ] && [ -x "${HOME:-/root}/.deno/bin/deno" ]; then
  ln -sf "${HOME:-/root}/.deno/bin/deno" /usr/local/bin/deno || true
fi

echo "✅ Deno ready: $(deno --version | head -n 1)"

# ---------- denoDir ----------
DENO_DIR_PATH="${DENO_DIR:-$(deno info --json \
  | sed -n 's/.*"denoDir": *"\([^"]*\)".*/\1/p')}"
echo "     denoDir: ${DENO_DIR_PATH}"

export PORT=3000