# Migração para novo servidor

## Objetivo

Este repositório contém o frontend Expo/React Native, o backend Express/tRPC, o schema Drizzle e um snapshot SQL completo em `database/backup.sql`. A restauração deve ser feita em ambiente isolado antes de apontar usuários ou integrações externas para o novo servidor.

> **Segurança:** o repositório é privado, porém o arquivo de backup contém dados corporativos e pessoais. Mantenha o acesso restrito à equipe responsável pela migração. Os segredos de ambiente não estão versionados; use `.env.example` apenas como referência e gere valores próprios para o novo servidor.

## Componentes e dependências

| Componente | Versão/tecnologia | Finalidade |
|---|---|---|
| Runtime | Node.js 22+ | Executa o servidor, ferramentas de build e scripts. |
| Gerenciador de pacotes | pnpm 9+ | Instala dependências conforme `pnpm-lock.yaml`. |
| Banco de dados | MySQL 8+ | Armazena solicitações, itens, malotes, usuários e históricos. |
| Aplicativo | Expo SDK 54 / React Native 0.81 | Fornece app móvel e versão web. |
| Backend | Express + tRPC + Drizzle ORM | Fornece API, regras de negócio e acesso ao MySQL. |

## Restauração do zero

Primeiro, clone a branch principal e instale as dependências preservando o lockfile:

```bash
git clone https://github.com/felipeliberatot/procurement_app.git
cd procurement_app
pnpm install --frozen-lockfile
cp ENVIRONMENT.example .env
```

Preencha `.env` com as credenciais do novo ambiente. O arquivo `ENVIRONMENT.example` é o template detalhado e seguro a ser copiado; o arquivo `.env` preenchido permanece ignorado pelo Git. O campo `DATABASE_URL` deve apontar para um banco MySQL vazio e ter o formato `mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO`. Gere um `JWT_SECRET` novo e não reutilize tokens de SMTP, WhatsApp, Z-API, Serper ou integrações internas do ambiente anterior.

Depois, restaure o snapshot de dados. Este comando cria o banco definido no dump e insere todas as estruturas e registros:

```bash
mysql -u SEU_USUARIO -p < database/backup.sql
```

Se optar por uma instalação sem dados históricos, crie o banco manualmente e aplique as migrações do projeto:

```bash
pnpm db:push
```

Em desenvolvimento, inicie API e Expo juntos com `pnpm dev`. Para produção, gere os artefatos com `pnpm build` e inicie o servidor com `pnpm start`.

```bash
pnpm dev
# ou
pnpm build
NODE_ENV=production pnpm start
```

Para gerar um novo backup antes de qualquer migração futura, use `pnpm db:backup` e atualize o checksum com `sha256sum database/backup.sql > database/backup.sql.sha256`.

## Autenticação atual e pontos de reestruturação

A autenticação atual está distribuída entre o backend e o cliente. No servidor, `server/_core/oauth.ts` lida com o fluxo OAuth e `server/_core/trpc.ts` injeta o contexto de sessão nas rotas protegidas. No cliente, `app/login.tsx` inicia a entrada, `lib/_core/auth.ts` persiste o token, `lib/_core/api.ts` o anexa às chamadas e `lib/_core/auth-context.tsx` mantém o usuário autenticado em memória.

Os registros de usuários estão em `users`, descritos em `drizzle/schema.ts`. Essa tabela reúne `openId`, e-mail, papéis operacionais, hash de PIN e hash de senha. A futura reestruturação de contas deve preservar as chaves internas já referenciadas em solicitações, aprovações, malotes e chaves de API, ou então preparar uma migração de IDs com integridade referencial validada.

## Integrações que exigem nova configuração

| Integração | Variáveis principais | Ação no novo servidor |
|---|---|---|
| Banco MySQL | `DATABASE_URL` | Criar usuário com privilégios suficientes para a aplicação e restauração. |
| E-mail SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Criar ou transferir uma conta SMTP e testar o envio. |
| WhatsApp genérico | `WHATSAPP_*` | Configurar URL, token, remetente e webhook do novo domínio. |
| Z-API | `ZAPI_*` | Atualizar tokens e URL de webhook após a mudança de domínio. |
| IA e busca de preços | `BUILT_IN_FORGE_*`, `SERPER_API_KEY` | Inserir credenciais novas autorizadas para o ambiente. |
| Integração de manutenção | `CGS_MAINTENANCE_API_KEY` | Configurar chave e validar as rotas `/api/integration/*`. |

## Validação pós-migração

Antes de liberar o novo servidor, valide o login, a criação de uma solicitação de teste, a consulta de dados históricos, o upload de documento e os fluxos de aprovação. Em seguida, teste as notificações de e-mail e WhatsApp com credenciais novas. Só após essa validação altere DNS, webhooks ou URLs das integrações externas.
