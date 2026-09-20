#!/bin/sh
# =============================================================================
# tag-version.sh — cria e publica uma tag baseada na versão do deno.json[c]
#
# Uso:
#   ./tag-version.sh [--m="Mensagem do commit"]
#
# A tag é gerada no formato vMAJOR.MINOR (ex: v1.2).
#
# Antes de criar a tag, o script sanitiza o deno.json[c] em disco (opcional,
# controlado pela variável SANITIZE=1), garantindo que a versão gravada esteja
# no formato semver estrito.
# =============================================================================
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-version.sh
. "$SCRIPT_DIR/lib-version.sh"

# -----------------------------------------------------------------------------
# 0) Configuração
# -----------------------------------------------------------------------------
# Defina SANITIZE=1 para reescrever o deno.json[c] antes do commit.
# Defina SANITIZE=0 (default) para apenas ler e sanitizar em memória.
SANITIZE="${SANITIZE:-0}"

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
# 3) Sanitizar arquivo em disco (opcional)
# -----------------------------------------------------------------------------
if [ "$SANITIZE" = "1" ]; then
  echo "🧼 Sanitizando $DENO_FILE antes do commit..."
  "$SCRIPT_DIR/sanitize-version.sh" "$DENO_FILE"
fi

# -----------------------------------------------------------------------------
# 4) Extrair e sanitizar versão (sempre, em memória)
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
# 5) Sanidade: é um repositório git?
# -----------------------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "❌ Não está dentro de um repositório git." >&2
  exit 1
}

# -----------------------------------------------------------------------------
# 6) Commit + push do fonte
#    git add -u: apenas arquivos já rastreados (modificados/deletados).
#    Se você precisa incluir arquivos NOVOS também, use SANITIZE=1 (que reescreve
#    o deno.jsonc, já rastreado) ou troque por 'git add -A' consciente.
# -----------------------------------------------------------------------------
echo ""
echo "📦 1/3 - Empacotando e enviando código fonte..."
#git add -u
git add -A

if git diff --cached --quiet; then
  echo "ℹ️  Nada para comitar."
else
  git commit -m "$MESSAGE"
fi

git push

# -----------------------------------------------------------------------------
# 7) Limpar tag antiga (local + remota)
#    --force no push de deleção cobre o caso de múltiplas referências.
# -----------------------------------------------------------------------------
echo ""
echo "🧹 2/3 - Limpando tag antiga ($TAG_NAME)..."
git push origin --delete "$TAG_NAME" 2>/dev/null || true
git tag -d "$TAG_NAME" 2>/dev/null || true

# -----------------------------------------------------------------------------
# 8) Criar e publicar nova tag
#    Ordem correta: 'git tag -a -m <msg> <name>' (sem --, ou com -- no final).
#    No push: opções ANTES dos posicionais.
# -----------------------------------------------------------------------------
echo ""
echo "🏷️  3/3 - Publicando nova tag..."
git tag -a -m "Versão $TAG_NAME" "$TAG_NAME"
git push --force origin "$TAG_NAME"

echo ""
echo "✅ NOVA TAG ADICIONADA COM SUCESSO!"
echo "Acompanhe o andamento na aba Actions do seu repositório."
echo "============================================================"