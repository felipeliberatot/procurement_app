#!/bin/bash
# =============================================================================
# deploy-testflight.sh
# Script de automação: Build iOS + Upload para TestFlight
# Compras CGS Agrícola Ltda.
# =============================================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # Sem cor

# Banner
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Compras CGS Agrícola — Deploy TestFlight       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# CONFIGURAÇÕES — EDITE ANTES DE RODAR
# =============================================================================
APPLE_ID=""          # Seu Apple ID (ex: seuemail@empresa.com.br)
APPLE_TEAM_ID=""     # Team ID do Apple Developer (ex: ABC1234567)
ASC_APP_ID=""        # App ID no App Store Connect (ex: 1234567890)
PROFILE="preview"    # preview = TestFlight | production = App Store

# =============================================================================
# FUNÇÕES AUXILIARES
# =============================================================================

print_step() {
  echo ""
  echo -e "${BLUE}▶ $1${NC}"
  echo -e "${BLUE}$(printf '─%.0s' {1..54})${NC}"
}

print_success() {
  echo -e "${GREEN}✔ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✖ $1${NC}"
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    print_error "Comando '$1' não encontrado. Instale antes de continuar."
    return 1
  fi
  print_success "$1 encontrado: $(command -v $1)"
}

# =============================================================================
# PASSO 1 — VERIFICAR PRÉ-REQUISITOS
# =============================================================================
print_step "Verificando pré-requisitos"

check_command "node" || exit 1
check_command "pnpm" || { npm install -g pnpm && print_success "pnpm instalado"; }

# Verificar/instalar EAS CLI
if ! command -v eas &> /dev/null; then
  print_warning "EAS CLI não encontrado. Instalando..."
  npm install -g eas-cli
  print_success "EAS CLI instalado"
else
  print_success "EAS CLI encontrado: $(eas --version)"
fi

# Verificar configurações obrigatórias
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo ""
  print_error "CONFIGURAÇÕES INCOMPLETAS!"
  echo ""
  echo -e "${YELLOW}Edite este script e preencha as variáveis no topo:${NC}"
  echo ""
  echo -e "  ${CYAN}APPLE_ID${NC}       → Seu Apple ID (e-mail da conta Developer)"
  echo -e "  ${CYAN}APPLE_TEAM_ID${NC}  → Team ID (em developer.apple.com/account → Membership)"
  echo -e "  ${CYAN}ASC_APP_ID${NC}     → App ID do App Store Connect (opcional para primeiro build)"
  echo ""
  echo -e "${YELLOW}Como encontrar seu Team ID:${NC}"
  echo "  1. Acesse https://developer.apple.com/account"
  echo "  2. Clique em 'Membership Details'"
  echo "  3. Copie o 'Team ID' (10 caracteres, ex: ABC1234567)"
  echo ""
  exit 1
fi

# =============================================================================
# PASSO 2 — LOGIN NO EAS
# =============================================================================
print_step "Verificando autenticação EAS"

if eas whoami &> /dev/null; then
  LOGGED_USER=$(eas whoami 2>/dev/null || echo "desconhecido")
  print_success "Já autenticado como: $LOGGED_USER"
else
  print_warning "Não autenticado. Fazendo login..."
  eas login
  print_success "Login realizado com sucesso"
fi

# =============================================================================
# PASSO 3 — CONFIGURAR CREDENCIAIS APPLE NO EAS
# =============================================================================
print_step "Configurando credenciais Apple"

# Exportar variáveis de ambiente para o EAS
export EXPO_APPLE_ID="$APPLE_ID"
export EXPO_APPLE_TEAM_ID="$APPLE_TEAM_ID"

print_success "Apple ID configurado: $APPLE_ID"
print_success "Team ID configurado: $APPLE_TEAM_ID"

# =============================================================================
# PASSO 4 — BUILD iOS
# =============================================================================
print_step "Iniciando build iOS (perfil: $PROFILE)"

echo ""
echo -e "${YELLOW}Isso pode levar 15–25 minutos nos servidores do Expo.${NC}"
echo -e "${YELLOW}Você receberá um e-mail quando o build terminar.${NC}"
echo ""

# Confirmar antes de iniciar
read -p "$(echo -e ${CYAN}Iniciar o build agora? [s/N]: ${NC})" CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  print_warning "Build cancelado pelo usuário."
  exit 0
fi

# Rodar o build
eas build \
  --platform ios \
  --profile "$PROFILE" \
  --non-interactive \
  2>&1 | tee /tmp/eas-build-output.log

# Verificar se o build foi bem-sucedido
if [ ${PIPESTATUS[0]} -eq 0 ]; then
  print_success "Build concluído com sucesso!"
else
  print_error "Build falhou. Verifique o log acima."
  echo ""
  echo -e "${YELLOW}Possíveis soluções:${NC}"
  echo "  1. Verifique se o Apple ID e Team ID estão corretos"
  echo "  2. Confirme que o Apple Developer Program está ativo em:"
  echo "     https://developer.apple.com/account"
  echo "  3. Se aparecer erro de 2FA, aprove no seu iPhone quando solicitado"
  echo "  4. Tente novamente em alguns minutos (pode ser instabilidade da Apple)"
  exit 1
fi

# =============================================================================
# PASSO 5 — UPLOAD PARA TESTFLIGHT
# =============================================================================
print_step "Fazendo upload para o TestFlight"

echo ""
echo -e "${YELLOW}Enviando o build para o App Store Connect...${NC}"
echo ""

# Configurar submit
if [ -n "$ASC_APP_ID" ]; then
  eas submit \
    --platform ios \
    --latest \
    --non-interactive \
    --apple-id "$APPLE_ID" \
    --asc-app-id "$ASC_APP_ID" \
    2>&1 | tee /tmp/eas-submit-output.log
else
  # Sem App ID — EAS vai criar o app automaticamente
  eas submit \
    --platform ios \
    --latest \
    --non-interactive \
    --apple-id "$APPLE_ID" \
    2>&1 | tee /tmp/eas-submit-output.log
fi

if [ ${PIPESTATUS[0]} -eq 0 ]; then
  print_success "Upload para TestFlight concluído!"
else
  print_error "Upload falhou. Verifique o log acima."
  exit 1
fi

# =============================================================================
# PASSO 6 — INSTRUÇÕES FINAIS
# =============================================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              BUILD E UPLOAD CONCLUÍDOS!              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Próximos passos para distribuir para sua equipe:${NC}"
echo ""
echo "  1. Acesse https://appstoreconnect.apple.com"
echo "  2. Vá em 'Meus Apps' → 'Compras CGS Agrícola'"
echo "  3. Clique em 'TestFlight'"
echo "  4. Aguarde o processamento do build (5–10 min)"
echo "  5. Vá em 'Testadores Internos' → '+' → adicione os e-mails"
echo "  6. Os funcionários recebem convite por e-mail"
echo "  7. Eles instalam o app TestFlight e depois o Compras CGS Agrícola"
echo ""
echo -e "${YELLOW}Dica:${NC} Para testadores externos (sem conta Apple Developer),"
echo "  use 'Grupos de Testadores Externos' no TestFlight — até 10.000 pessoas."
echo ""
