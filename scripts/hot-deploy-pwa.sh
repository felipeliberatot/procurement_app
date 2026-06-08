#!/bin/bash
# hot-deploy-pwa.sh
# Envia os arquivos da landing page PWA para o servidor permanente
set -e
SERVER_URL="${1:-https://procureapp-3hnvqvcm.manus.space}"
DEPLOY_TOKEN="${HOT_DEPLOY_TOKEN:-55c00efb36aa42a92fc3478da4f46b9426e3a91919b5ae7ede51304d218db921}"
SCRIPT_DIR="$(dirname "$0")"
PWA_DIR="$SCRIPT_DIR/../public/pwa"
ICONS_DIR="$SCRIPT_DIR/../public/icons"
ZIP_FILE="/tmp/procurement_pwa_bundle.zip"

# Verificar se os diretórios existem
if [ ! -d "$PWA_DIR" ]; then
  echo "[HotDeploy-PWA] ERRO: public/pwa nao encontrado."
  exit 1
fi

echo "[HotDeploy-PWA] Compactando arquivos PWA..."
cd "$SCRIPT_DIR/.."

# Criar ZIP com estrutura: pwa/ e pwa/icons/
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" public/pwa/ -q
# Adicionar ícones dentro de pwa/icons/ no ZIP
if [ -d "$ICONS_DIR" ]; then
  # Recriar ZIP com estrutura correta: icons/ dentro do zip
  rm -f "$ZIP_FILE"
  mkdir -p /tmp/pwa_bundle
  cp -r public/pwa/. /tmp/pwa_bundle/
  mkdir -p /tmp/pwa_bundle/icons
  cp public/icons/*.png /tmp/pwa_bundle/icons/
  cd /tmp/pwa_bundle
  zip -r "$ZIP_FILE" . -q
  cd - > /dev/null
  rm -rf /tmp/pwa_bundle
fi

ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
echo "[HotDeploy-PWA] Bundle compactado: $ZIP_SIZE"
echo "[HotDeploy-PWA] Enviando para $SERVER_URL..."

RESPONSE=$(curl -s -X POST \
  -H "x-deploy-token: $DEPLOY_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP_FILE" \
  --max-time 60 \
  "$SERVER_URL/api/admin/hot-deploy-pwa")

echo "[HotDeploy-PWA] Resposta: $RESPONSE"

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "[HotDeploy-PWA] ✓ Arquivos PWA atualizados com sucesso no servidor permanente!"
  rm -f "$ZIP_FILE"
else
  echo "[HotDeploy-PWA] ✗ Erro no deploy. Verifique a resposta acima."
  rm -f "$ZIP_FILE"
  exit 1
fi
