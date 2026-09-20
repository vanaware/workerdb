#!/bin/sh
# =============================================================================
# tag-version.sh — cria e publica uma tag baseada na versão do deno.json[c]
#
# Uso:
#   ./tag-version.sh [--m="Mensagem do commit"]
#
# A tag é gerada no formato vMAJOR.MINOR (ex: v1.2).
# =============================================================================
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-version.sh
. "$SCRIPT_DIR/lib-version.sh"

# -----------------------------------------------------------------------------
# 1) Parsing de argumentos (--m=...)
# -----------------------------------------------------------------------------
MESSAGE=""
for _arg in "$@"; do
  case "$_arg" in
    --m=*) MESSAGE="${_arg#*=}" ;;
    *)     : ;;
  esac
done

# -----------------------------------------------------------------------------
# 2) Localizar deno.json[c]
# -----------------------------------------------------------------------------
DENO_FILE="$(find_deno_file "$SCRIPT_DIR")" || {
  echo "❌ deno.json[c] não encontrado a partir de $SCRIPT_DIR" >&2
  exit 1
}

# -----------------------------------------------------------------------------
# 3) Extrair e sanitizar versão
# -----------------------------------------------------------------------------
RAW_VERSION="$(extract_raw_version "$DENO_FILE")"
if [ -z "$RAW_VERSION" ]; then
  echo "❌ Campo \"version\" ausente em $DENO_FILE" >&2
  exit 1
fi

SANITIZED_VERSION="$(sanitize_version "$RAW_VERSION")"

# Decompõe em MAJOR MINOR PATCH (com _REST absorvendo extras)
IFS='.' read -r MAJOR MINOR _PATCH _REST <<EOF
$SANITIZED_VERSION
EOF

TAG_NAME="v${MAJOR}.${MINOR}"

[ -n "$MESSAGE" ] || MESSAGE="Versão $TAG_NAME"

echo "============================================================"
echo "🚀 INICIANDO TAG VERSION BUMP"
echo "============================================================"
echo "📌 Versão original:    $RAW_VERSION"
echo "🧼 Versão sanitizada:  $SANITIZED_VERSION"
echo "🏷️  Tag alvo:           $TAG_NAME"
echo "📝 Mensagem de commit: $MESSAGE"
echo "============================================================"

# -----------------------------------------------------------------------------
# 4) Sanidade: é um repositório git?
# -----------------------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "❌ Não está dentro de um repositório git." >&2
  exit 1
}

# -----------------------------------------------------------------------------
# 5) Commit + push do fonte
# -----------------------------------------------------------------------------
echo ""
echo "📦 1/3 - Empacotando e enviando código fonte..."
git add -u

if git diff --cached --quiet; then
  echo "ℹ️  Nada para comitar."
else
  git commit -m "$MESSAGE"
fi

git push

# -----------------------------------------------------------------------------
# 6) Limpar tag antiga (local + remota)
# -----------------------------------------------------------------------------
echo ""
echo "🧹 2/3 - Limpando tag antiga ($TAG_NAME)..."
git push origin --delete "$TAG_NAME" 2>/dev/null || true
git tag -d "$TAG_NAME" 2>/dev/null || true

# -----------------------------------------------------------------------------
# 7) Criar e publicar nova tag
# -----------------------------------------------------------------------------
echo ""
echo "🏷️  3/3 - Publicando nova tag..."
git tag -a -- "$TAG_NAME" -m "Versão $TAG_NAME"
git push origin "$TAG_NAME" --force

echo ""
echo "✅ NOVA TAG ADICIONADA COM SUCESSO!"
echo "Acompanhe o andamento na aba Actions do seu repositório."
echo "============================================================"