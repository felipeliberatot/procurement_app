#!/bin/bash
# hot-deploy.sh
# Envia o bundle web atual para o servidor permanente via rota de hot-deploy
# Uso: ./scripts/hot-deploy.sh [URL_DO_SERVIDOR]

set -e

SERVER_URL="${1:-https://procureapp-3hnvqvcm.manus.space}"
DEPLOY_TOKEN="${HOT_DEPLOY_TOKEN:-55c00efb36aa42a92fc3478da4f46b9426e3a91919b5ae7ede51304d218db921}"
DIST_DIR="$(dirname "$0")/../dist/web"
ZIP_FILE="/tmp/procurement_web_bundle.zip"

# Verificar se o dist/web existe
if [ ! -d "$DIST_DIR" ]; then
  echo "[HotDeploy] ERRO: dist/web nao encontrado. Execute: pnpm rebuild:web"
  exit 1
fi

echo "[HotDeploy] Compactando bundle web..."
cd "$DIST_DIR"
zip -r "$ZIP_FILE" . -q
ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
echo "[HotDeploy] Bundle compactado: $ZIP_SIZE"

echo "[HotDeploy] Enviando para $SERVER_URL..."
RESPONSE=$(curl -s -X POST \
  -H "x-deploy-token: $DEPLOY_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP_FILE" \
  --max-time 120 \
  "$SERVER_URL/api/admin/hot-deploy")

echo "[HotDeploy] Resposta: $RESPONSE"

# Verificar se o deploy foi bem-sucedido
if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "[HotDeploy] ✓ Bundle atualizado com sucesso no servidor permanente!"
  rm -f "$ZIP_FILE"
else
  echo "[HotDeploy] ✗ Erro no deploy. Verifique a resposta acima."
  rm -f "$ZIP_FILE"
  exit 1
fi
