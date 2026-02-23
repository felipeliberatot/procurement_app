#!/bin/bash
# =============================================================================
# deploy-android.sh
# Script de automação: Build Android APK para distribuição interna
# Compras CGS Agrícola Ltda.
# Não requer conta Apple Developer — funciona 100% independente da Apple
# =============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Compras CGS Agrícola — Build Android APK         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# PASSO 1 — VERIFICAR PRÉ-REQUISITOS
# =============================================================================
echo -e "${BLUE}▶ Verificando pré-requisitos${NC}"
echo -e "${BLUE}──────────────────────────────────────────────────────${NC}"

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✖ Node.js não encontrado. Instale em https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✔ Node.js: $(node --version)${NC}"

# Verificar/instalar EAS CLI
if ! command -v eas &> /dev/null; then
  echo -e "${YELLOW}⚠ EAS CLI não encontrado. Instalando...${NC}"
  npm install -g eas-cli
  echo -e "${GREEN}✔ EAS CLI instalado${NC}"
else
  echo -e "${GREEN}✔ EAS CLI: $(eas --version)${NC}"
fi

# =============================================================================
# PASSO 2 — LOGIN NO EAS (conta Expo — NÃO é conta Apple)
# =============================================================================
echo ""
echo -e "${BLUE}▶ Verificando autenticação EAS${NC}"
echo -e "${BLUE}──────────────────────────────────────────────────────${NC}"

if eas whoami &> /dev/null 2>&1; then
  LOGGED_USER=$(eas whoami 2>/dev/null)
  echo -e "${GREEN}✔ Logado como: $LOGGED_USER${NC}"
else
  echo -e "${YELLOW}⚠ Não autenticado. Fazendo login na conta Expo...${NC}"
  echo ""
  echo -e "${CYAN}Crie sua conta gratuita em: https://expo.dev/signup${NC}"
  echo ""
  eas login
  echo -e "${GREEN}✔ Login realizado com sucesso${NC}"
fi

# =============================================================================
# PASSO 3 — BUILD ANDROID APK
# =============================================================================
echo ""
echo -e "${BLUE}▶ Iniciando build Android APK${NC}"
echo -e "${BLUE}──────────────────────────────────────────────────────${NC}"
echo ""
echo -e "${YELLOW}⏱  Tempo estimado: 15–25 minutos nos servidores Expo${NC}"
echo -e "${YELLOW}📧 Você receberá um e-mail quando o build terminar${NC}"
echo -e "${YELLOW}🍎 Não requer conta Apple Developer${NC}"
echo ""

read -p "$(echo -e ${CYAN}Iniciar o build Android agora? [s/N]: ${NC})" CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  echo -e "${YELLOW}⚠ Build cancelado.${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}Executando: eas build --platform android --profile preview${NC}"
echo ""

eas build --platform android --profile preview

BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              BUILD ANDROID CONCLUÍDO!                ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Como instalar o APK nos celulares da equipe:${NC}"
  echo ""
  echo "  1. Acesse https://expo.dev e faça login"
  echo "  2. Vá em 'Projects' → 'procurement-app' → 'Builds'"
  echo "  3. Clique no build concluído e baixe o arquivo .apk"
  echo "  4. Envie o .apk por WhatsApp, e-mail ou Google Drive"
  echo "  5. No celular Android: abra o arquivo .apk"
  echo "     (pode pedir para ativar 'Instalar de fontes desconhecidas')"
  echo "  6. Toque em 'Instalar' — pronto!"
  echo ""
  echo -e "${YELLOW}Dica:${NC} Você também pode usar o link QR Code gerado pelo EAS"
  echo "  para que os funcionários escaneiem e instalem diretamente."
  echo ""
else
  echo ""
  echo -e "${RED}✖ Build falhou. Verifique os erros acima.${NC}"
  echo ""
  echo -e "${YELLOW}Possíveis soluções:${NC}"
  echo "  1. Verifique se está logado: eas whoami"
  echo "  2. Verifique conexão com a internet"
  echo "  3. Tente novamente: bash scripts/deploy-android.sh"
  exit 1
fi
