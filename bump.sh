#!/bin/bash

# Aborta o script se ocorrer algum erro crítico nas operações normais
set -e

# ==============================================================================
# 1. PARSING DE ARGUMENTOS (--m=...)
# ==============================================================================

MESSAGE=""

for i in "$@"; do
  case $i in
    --m=*)
      MESSAGE="${i#*=}"
      shift
      ;;
    *)
      ;;
  esac
done

# ==============================================================================
# 2. EXTRAÇÃO DINÂMICA DA VERSÃO E CONFIGURAÇÃO
# ==============================================================================

FULL_VERSION=$(grep '"version"' ./deno.jsonc | awk -F'"' '{print $4}')
MAJOR_MINOR=$(echo $FULL_VERSION | awk -F'.' '{print $1"."$2}')
TAG_NAME="v${MAJOR_MINOR}"

if [ -z "$MESSAGE" ]; then
  MESSAGE="Versão $TAG_NAME"
fi

echo "============================================================"
echo "🚀 INICIANDO TAG VERSION BUMP"
echo "============================================================"
echo "📌 Versão completa: $FULL_VERSION"
echo "🏷️  Tag alvo: $TAG_NAME"
echo "📝 Mensagem de commit: $MESSAGE"
echo "============================================================"

# ==============================================================================
# 3. BUMP AND TAG
# ==============================================================================

echo ""
echo "📦 1/3 - Empacotando e enviando código fonte para o repositório..."
git add :/
git commit -m "$MESSAGE" || true
git push

echo ""
echo "🧹 2/3 - Limpando tags antigas ($TAG_NAME)..."
git push origin --delete $TAG_NAME 2>/dev/null || true
git tag -d $TAG_NAME 2>/dev/null || true

echo ""
echo "🏷️  3/3 - Publicando nova tag ..."
git tag -a $TAG_NAME -m "Versão $TAG_NAME"
git push origin $TAG_NAME --force

echo " "
echo "✅ NOVA TAG ADICIONADA COM SUCESSO!"
echo "Acompanhe o andamento na aba Actions do seu repositório."
echo "============================================================"