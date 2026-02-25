# Guia de Publicação — App Store (iOS)
## Compras CGS Agrícola

---

## Visão Geral

Este guia descreve o processo completo para publicar o app **Compras CGS Agrícola** na App Store usando o **EAS Build** (Expo Application Services). O projeto já está configurado e pronto para o processo de build.

---

## Pré-requisitos

| Item | Status | Observação |
|---|---|---|
| `eas.json` configurado | ✅ Pronto | Perfis `development`, `preview` e `production` configurados |
| `app.config.ts` configurado | ✅ Pronto | Bundle ID `com.cgsagricola.compras`, permissões iOS declaradas |
| Ícone do app | ✅ Pronto | `assets/images/icon.png` |
| Splash screen | ✅ Pronto | `assets/images/splash-icon.png` |
| **Apple Developer Account** | ⚠️ Necessário | Conta paga em [developer.apple.com](https://developer.apple.com) — US$ 99/ano |
| **Node.js + EAS CLI** | ⚠️ Necessário | Instalar no seu computador |

---

## Etapa 1 — Criar a conta Apple Developer

Acesse [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) e crie uma conta de desenvolvedor individual ou empresarial. O processo leva até 2 dias úteis para aprovação e custa **US$ 99/ano**.

Após a aprovação, anote os seguintes dados — eles serão necessários nas próximas etapas:

- **Apple ID** (e-mail da conta Apple Developer)
- **Team ID** (encontrado em [developer.apple.com/account](https://developer.apple.com/account) → Membership)
- **App Store Connect App ID** (gerado na Etapa 3)

---

## Etapa 2 — Instalar o EAS CLI no seu computador

Execute os comandos abaixo no terminal do seu computador (não no servidor):

```bash
# Instalar o EAS CLI globalmente
npm install -g eas-cli

# Fazer login com a conta Expo (crie em expo.dev se não tiver)
eas login
```

---

## Etapa 3 — Registrar o app no App Store Connect

1. Acesse [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Clique em **"Meus Apps"** → **"+"** → **"Novo App"**
3. Preencha:
   - **Plataformas:** iOS
   - **Nome:** Compras CGS Agrícola
   - **Idioma principal:** Português (Brasil)
   - **Bundle ID:** `com.cgsagricola.compras`
   - **SKU:** `cgsagricola-compras-001` (qualquer identificador único)
4. Anote o **App ID numérico** gerado (ex: `6743210987`) — será usado no `eas.json`

---

## Etapa 4 — Atualizar o `eas.json` com seus dados

Abra o arquivo `eas.json` na raiz do projeto e preencha os campos na seção `submit.production.ios`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "seu@email.com",        ← seu Apple ID
      "ascAppId": "6743210987",          ← App ID do App Store Connect
      "appleTeamId": "ABCD1234EF"        ← Team ID da conta Apple Developer
    }
  }
}
```

---

## Etapa 5 — Gerar o build de produção

Na pasta do projeto, execute:

```bash
# Navegar para a pasta do projeto
cd /caminho/para/procurement_app

# Gerar o build de produção para iOS
eas build --platform ios --profile production
```

O EAS irá:
1. Solicitar que você faça login na sua conta Apple Developer
2. Gerar automaticamente os certificados e provisioning profiles
3. Fazer o build na nuvem (leva aproximadamente 15–30 minutos)
4. Disponibilizar o arquivo `.ipa` para download

---

## Etapa 6 — Enviar para a App Store

Após o build concluído:

```bash
eas submit --platform ios --profile production
```

O EAS Submit irá enviar automaticamente o `.ipa` para o **App Store Connect**.

---

## Etapa 7 — Preencher as informações na App Store Connect

Após o upload, acesse o [App Store Connect](https://appstoreconnect.apple.com) e preencha:

| Campo | Sugestão |
|---|---|
| **Descrição** | "Sistema de gestão de compras e aprovações da CGS Agrícola. Permite criar solicitações de compra, acompanhar o fluxo de aprovação em tempo real e gerenciar malotes internos." |
| **Palavras-chave** | compras, aprovação, procurement, agrícola, gestão |
| **Categoria** | Negócios |
| **Classificação etária** | 4+ |
| **URL de Privacidade** | URL de uma página com a política de privacidade da empresa |
| **Screenshots** | Capturas de tela do app em iPhone 6.5" e 5.5" |

> **Atenção:** A **URL de Política de Privacidade** é obrigatória. Se a empresa não tiver uma, é necessário criar uma página simples descrevendo quais dados o app coleta.

---

## Etapa 8 — Submeter para revisão da Apple

1. No App Store Connect, acesse a versão do app
2. Clique em **"Adicionar para Revisão"**
3. Responda as perguntas sobre criptografia (o app já tem `ITSAppUsesNonExemptEncryption: false` configurado)
4. Clique em **"Enviar para Revisão"**

A Apple revisa o app em **1 a 3 dias úteis**. Você receberá um e-mail com o resultado.

---

## Resumo do Fluxo

```
Criar conta Apple Developer
        ↓
Instalar EAS CLI + login
        ↓
Registrar app no App Store Connect
        ↓
Atualizar eas.json com seus dados
        ↓
eas build --platform ios --profile production
        ↓
eas submit --platform ios --profile production
        ↓
Preencher informações no App Store Connect
        ↓
Submeter para revisão da Apple
        ↓
App publicado na App Store ✅
```

---

## Dúvidas Frequentes

**Preciso de um Mac?**
Não. O EAS Build faz o build na nuvem, sem necessidade de Mac local.

**O que é o Bundle ID `com.cgsagricola.compras`?**
É o identificador único do app na App Store. Uma vez publicado, não pode ser alterado. Certifique-se de que este Bundle ID está registrado na sua conta Apple Developer antes do build.

**Quanto tempo leva o processo completo?**
Da criação da conta Apple até a publicação, geralmente 3 a 5 dias úteis (incluindo a aprovação da conta e a revisão da Apple).

**Como atualizar o app depois?**
Basta incrementar a versão no `app.config.ts` (`version: "1.0.1"`) e repetir as Etapas 5 e 6. O `autoIncrement: true` no `eas.json` cuida do `buildNumber` automaticamente.

---

*Documento gerado em fevereiro de 2026 — Compras CGS Agrícola*
