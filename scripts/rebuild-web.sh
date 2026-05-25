#!/bin/bash
# Script de rebuild manual do bundle web
# Uso: pnpm rebuild:web
# Reconstrói o bundle e adiciona ao git staging

set -e

echo "🔨 Reconstruindo bundle web..."
pnpm build:web

echo "📦 Adicionando bundle ao git..."
git add -f dist/web/

echo "✅ Bundle web reconstruído e pronto para commit"
echo "   Arquivos staged:"
git diff --cached --name-only | grep "dist/web" | head -5
