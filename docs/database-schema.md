# Estrutura do Banco de Dados — CGS Agrícola Compras

**Banco de dados:** MySQL (TiDB Cloud — compatível com MySQL 8.0)
**ORM:** Drizzle ORM
**Schema:** `/drizzle/schema.ts`
**Migrações:** `/drizzle/migrations/`

---

## Visão Geral das Tabelas

| Tabela | Descrição |
|---|---|
| `users` | Usuários do sistema com papéis e níveis de aprovação |
| `costCenters` | Centros de custo da empresa |
| `assets` | Bens patrimoniais da empresa |
| `purchaseRequests` | Solicitações de compra (entidade central do workflow) |
| `requestItems` | Itens de cada solicitação de compra |
| `approvalHistory` | Histórico de ações e aprovações de cada solicitação |
| `whatsappSessions` | Tokens de sessão para aprovação via link no WhatsApp |
| `malotes` | Malotes físicos de documentos entre unidades |
| `maloteItems` | Itens (solicitações) dentro de cada malote |
| `maloteTags` | Tags de categorização para malotes |
| `maloteTagLinks` | Associação N:N entre malotes e tags |
| `units` | Unidades operacionais da empresa |
| `businessUnits` | Unidades de negócio (filiais, escritórios, depósitos) |
| `departments` | Departamentos da empresa |
| `harvests` | Safras agrícolas |
| `budgets` | Orçamentos por safra e centro de custo |

---

## Diagrama de Relacionamentos

```
users ──────────────────────────────────────────────────────────────────────────────────┐
  │ id                                                                                   │
  │                                                                                      │
  ├──< purchaseRequests (requesterId)                                                    │
  │       │ id                                                                           │
  │       ├──< requestItems (requestId)                                                  │
  │       ├──< approvalHistory (requestId)                                               │
  │       ├──< whatsappSessions (requestId)                                              │
  │       └──< maloteItems (requestId)                                                   │
  │                                                                                      │
  ├──< approvalHistory (userId)                                                          │
  └──< whatsappSessions (approverId) ──────────────────────────────────────────────────┘

costCenters ──< purchaseRequests (costCenterId)
costCenters ──< assets (costCenterId)
costCenters ──< budgets (costCenterId)

harvests ──< budgets (harvestId)

malotes ──< maloteItems (maloteId)
malotes ──< maloteTagLinks (maloteId)
maloteTags ──< maloteTagLinks (tagId)
```

---

## Tabelas Detalhadas

### `users` — Usuários

Armazena todos os usuários do sistema, incluindo papéis de acesso e níveis de aprovação no workflow de compras.

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `openId` | VARCHAR(64) UNIQUE | NÃO | — | ID externo do provedor OAuth |
| `name` | TEXT | SIM | NULL | Nome completo |
| `email` | VARCHAR(320) | SIM | NULL | E-mail do usuário |
| `loginMethod` | VARCHAR(64) | SIM | NULL | Método de login (ex: `email`, `google`) |
| `role` | ENUM | NÃO | `user` | Papel no sistema: `user`, `admin` |
| `procurementRole` | ENUM | NÃO | `solicitante` | Papel no workflow: `solicitante`, `gerente`, `orcamento`, `controladoria`, `diretoria`, `financeiro`, `admin` |
| `department` | VARCHAR(128) | SIM | NULL | Departamento do usuário |
| `phone` | VARCHAR(32) | SIM | NULL | Número WhatsApp (ex: `5565999999999`) |
| `jobTitle` | VARCHAR(128) | SIM | NULL | Cargo/título |
| `approvalLevel` | ENUM | NÃO | `nenhum` | Nível de aprovação: `nenhum`, `gerente`, `controladoria`, `orcamento`, `diretoria`, `financeiro`, `master` |
| `extraRoles` | TEXT | SIM | NULL | JSON array de papéis extras (ex: `["gerente","orcamento"]`) |
| `extraApprovalLevels` | TEXT | SIM | NULL | JSON array de níveis de aprovação extras |
| `pinHash` | VARCHAR(255) | SIM | NULL | Hash do PIN para acesso rápido master |
| `passwordHash` | VARCHAR(255) | SIM | NULL | Hash da senha para login email+senha |
| `active` | BOOLEAN | NÃO | `true` | Usuário ativo no sistema |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |
| `lastSignedIn` | TIMESTAMP | NÃO | `NOW()` | Último login |

**Índices:** `openId` (UNIQUE)

---

### `costCenters` — Centros de Custo

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `code` | VARCHAR(32) UNIQUE | NÃO | — | Código único do centro de custo |
| `name` | VARCHAR(128) | NÃO | — | Nome do centro de custo |
| `responsible` | VARCHAR(128) | SIM | NULL | Responsável pelo centro de custo |
| `active` | BOOLEAN | NÃO | `true` | Centro de custo ativo |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

**Índices:** `code` (UNIQUE)

---

### `assets` — Bens Patrimoniais

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `code` | VARCHAR(32) UNIQUE | NÃO | — | Código único do bem |
| `description` | VARCHAR(255) | NÃO | — | Descrição do bem |
| `category` | VARCHAR(64) | SIM | NULL | Categoria (ex: `veículo`, `equipamento`) |
| `location` | VARCHAR(128) | SIM | NULL | Localização física |
| `value` | VARCHAR(32) | SIM | NULL | Valor do bem |
| `hasChassi` | BOOLEAN | NÃO | `false` | Possui chassi/placa |
| `chassiNumber` | VARCHAR(64) | SIM | NULL | Número do chassi |
| `licensePlate` | VARCHAR(16) | SIM | NULL | Placa do veículo |
| `patrimonialCode` | VARCHAR(16) | SIM | NULL | Código patrimonial sequencial (ex: `PAT-00001`) |
| `costCenterId` | INT | SIM | NULL | FK → `costCenters.id` |
| `costCenterCode` | VARCHAR(32) | SIM | NULL | Código do centro de custo (desnormalizado) |
| `active` | BOOLEAN | NÃO | `true` | Bem ativo |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

**Chaves estrangeiras:** `costCenterId` → `costCenters.id`

---

### `purchaseRequests` — Solicitações de Compra

Entidade central do sistema. Representa cada solicitação de compra e seu estado no workflow de aprovação.

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `requestNumber` | VARCHAR(32) UNIQUE | NÃO | — | Número único (ex: `SOL-2026-0001`) |
| `requesterId` | INT | NÃO | — | FK → `users.id` |
| `requesterName` | VARCHAR(128) | NÃO | — | Nome do solicitante (desnormalizado) |
| `department` | VARCHAR(128) | NÃO | — | Departamento do solicitante |
| `costCenterId` | INT | SIM | NULL | FK → `costCenters.id` |
| `costCenterCode` | VARCHAR(32) | SIM | NULL | Código do centro de custo (desnormalizado) |
| `application` | VARCHAR(255) | NÃO | — | Finalidade/aplicação da compra |
| `urgencyLevel` | ENUM | NÃO | `normal` | Urgência: `normal`, `urgente`, `emergencial` |
| `observations` | TEXT | SIM | NULL | Observações gerais |
| `totalEstimatedValue` | DECIMAL(14,2) | SIM | NULL | Valor total estimado |
| `status` | ENUM | NÃO | `aguardando_gerente` | Status atual no workflow (ver abaixo) |
| `budgetFileUrl` | TEXT | SIM | NULL | URL do PDF de orçamento |
| `purchaseOrderNumber` | VARCHAR(64) | SIM | NULL | Número da ordem de compra |
| `paymentMethod` | ENUM | SIM | NULL | Método: `pix`, `boleto`, `cartao_avista`, `cartao_parcelado` |
| `paymentInfo` | TEXT | SIM | NULL | Dados de pagamento (Compras) |
| `paymentProofUrl` | TEXT | SIM | NULL | URL do comprovante de pagamento (PDF) |
| `paymentObservations` | TEXT | SIM | NULL | Observações de pagamento |
| `paymentInstallments` | INT | SIM | NULL | Número de parcelas (cartão parcelado) |
| `invoiceUrl` | TEXT | SIM | NULL | URL da nota fiscal (PDF) |
| `ocSiagriUrl` | TEXT | SIM | NULL | URL da OC Siagri (PDF) |
| `osMyfarm` | VARCHAR(64) | SIM | NULL | Número da OS Myfarm vinculada |
| `orcamentoFeitoUrgente` | BOOLEAN | NÃO | `false` | Orçamento já feito em pedidos urgentes/emergenciais |
| `directorApprovals` | TEXT | SIM | NULL | JSON de aprovações duplas da Diretoria |
| `isEnabledInMalotes` | BOOLEAN | NÃO | `false` | Habilitado nos Malotes após OC finalizada |
| `deadlineAt` | TIMESTAMP | SIM | NULL | Prazo geral baseado na urgência |
| `stepDeadlineAt` | TIMESTAMP | SIM | NULL | Prazo de 48h para o aprovador atual |
| `cancellationDeadlineAt` | TIMESTAMP | SIM | NULL | Prazo de 10 dias antes do cancelamento automático |
| `cancellationWarningSentAt` | TIMESTAMP | SIM | NULL | Quando o aviso de 1 dia foi enviado |
| `aiAnalysis` | TEXT | SIM | NULL | JSON do parecer de análise de orçamento pela IA |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

**Status do workflow (fluxo normal):**

```
aguardando_gerente
  → aguardando_orcamento
    → aguardando_controladoria
      → aguardando_diretoria
        → aguardando_ordem_compra
          → aguardando_aprovacao_compra
            → aguardando_comprovante_pagamento
              → aguardando_verificacao_compras
                → concluida
```

**Status terminais:** `concluida`, `rejeitada`, `cancelada`

**Chaves estrangeiras:** `requesterId` → `users.id`, `costCenterId` → `costCenters.id`

---

### `requestItems` — Itens da Solicitação

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `requestId` | INT | NÃO | — | FK → `purchaseRequests.id` |
| `description` | VARCHAR(255) | NÃO | — | Descrição do item |
| `quantity` | DECIMAL(10,2) | NÃO | — | Quantidade |
| `unit` | VARCHAR(32) | NÃO | `un` | Unidade de medida (ex: `un`, `kg`, `L`) |
| `unitPrice` | DECIMAL(12,2) | SIM | NULL | Preço unitário |
| `totalPrice` | DECIMAL(14,2) | SIM | NULL | Preço total (quantity × unitPrice) |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |

**Chaves estrangeiras:** `requestId` → `purchaseRequests.id`

---

### `approvalHistory` — Histórico de Aprovações

Registro imutável de todas as ações realizadas em cada solicitação.

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `requestId` | INT | NÃO | — | FK → `purchaseRequests.id` |
| `userId` | INT | NÃO | — | FK → `users.id` |
| `userName` | VARCHAR(128) | SIM | NULL | Nome do usuário (desnormalizado) |
| `step` | ENUM | NÃO | — | Etapa: `criacao`, `gerente`, `orcamento`, `controladoria`, `diretoria`, `ordem_compra`, `aprovacao_compra`, `financeiro`, `verificacao_compras`, `cancelamento`, `reabertura`, `edicao` |
| `action` | ENUM | NÃO | — | Ação: `criada`, `aprovada`, `rejeitada`, `orcamento_anexado`, `ordem_emitida`, `comprovante_anexado`, `comprovante_aprovado`, `comprovante_recusado`, `pagamento_recusado`, `pagamento_verificado`, `nota_fiscal_anexada`, `oc_finalizada`, `cancelada`, `reaberta`, `compra_aprovada`, `compra_cancelada`, `editada` |
| `comment` | TEXT | SIM | NULL | Comentário ou justificativa |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data da ação |

**Chaves estrangeiras:** `requestId` → `purchaseRequests.id`, `userId` → `users.id`

---

### `whatsappSessions` — Sessões de Aprovação WhatsApp

Tokens de uso único enviados por link no WhatsApp para aprovação/rejeição remota.

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `token` | VARCHAR(64) UNIQUE | NÃO | — | Token único da sessão |
| `requestId` | INT | NÃO | — | FK → `purchaseRequests.id` |
| `requestNumber` | VARCHAR(32) | NÃO | — | Número da solicitação (desnormalizado) |
| `approverPhone` | VARCHAR(32) | NÃO | — | Telefone do aprovador |
| `approverId` | INT | NÃO | — | FK → `users.id` |
| `approverName` | VARCHAR(128) | SIM | NULL | Nome do aprovador (desnormalizado) |
| `step` | VARCHAR(64) | NÃO | — | Etapa do workflow para esta sessão |
| `status` | ENUM | NÃO | `pending` | Status: `pending`, `approved`, `rejected`, `expired` |
| `expiresAt` | TIMESTAMP | NÃO | — | Data de expiração do token |
| `resolvedAt` | TIMESTAMP | SIM | NULL | Data em que foi resolvido |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |

**Índices:** `token` (UNIQUE)
**Chaves estrangeiras:** `requestId` → `purchaseRequests.id`, `approverId` → `users.id`

---

### `malotes` — Malotes de Documentos

Malotes físicos enviados entre unidades da empresa, contendo documentos de solicitações finalizadas.

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `maloteCode` | VARCHAR(32) UNIQUE | NÃO | — | Código único do malote (ex: `MAL-2026-0001`) |
| `status` | ENUM | NÃO | `aberto` | Status: `aberto`, `enviado`, `recebido`, `devolvido` |
| `originUnit` | VARCHAR(100) | NÃO | — | Unidade de origem |
| `destinationUnit` | VARCHAR(100) | NÃO | — | Unidade de destino |
| `createdById` | INT | NÃO | — | FK → `users.id` |
| `createdByName` | VARCHAR(255) | NÃO | — | Nome do criador (desnormalizado) |
| `sentAt` | TIMESTAMP | SIM | NULL | Data de envio |
| `sentById` | INT | SIM | NULL | FK → `users.id` (quem enviou) |
| `sentByName` | VARCHAR(255) | SIM | NULL | Nome de quem enviou |
| `receivedAt` | TIMESTAMP | SIM | NULL | Data de recebimento |
| `receivedById` | INT | SIM | NULL | FK → `users.id` (quem recebeu) |
| `receivedByName` | VARCHAR(255) | SIM | NULL | Nome de quem recebeu |
| `notes` | TEXT | SIM | NULL | Observações de envio |
| `receiptNotes` | TEXT | SIM | NULL | Observações de recebimento |
| `signatureData` | LONGTEXT | SIM | NULL | Assinatura digital (base64) |
| `returnReason` | TEXT | SIM | NULL | Motivo de devolução |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

---

### `maloteItems` — Itens do Malote

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `maloteId` | INT | NÃO | — | FK → `malotes.id` |
| `requestId` | INT | NÃO | — | FK → `purchaseRequests.id` |
| `requestCode` | VARCHAR(20) | NÃO | — | Código da solicitação (desnormalizado) |
| `requesterName` | VARCHAR(255) | NÃO | — | Nome do solicitante (desnormalizado) |
| `application` | VARCHAR(255) | NÃO | — | Finalidade da compra (desnormalizado) |
| `addedById` | INT | NÃO | — | FK → `users.id` |
| `addedByName` | VARCHAR(255) | NÃO | — | Nome de quem adicionou |
| `receiptStatus` | ENUM | NÃO | `pendente` | Status de recebimento: `pendente`, `recebido`, `devolvido` |
| `receiptNotes` | TEXT | SIM | NULL | Observações de recebimento |
| `addedAt` | TIMESTAMP | NÃO | `NOW()` | Data de adição ao malote |

**Chaves estrangeiras:** `maloteId` → `malotes.id`, `requestId` → `purchaseRequests.id`

---

### `maloteTags` — Tags de Malotes

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `name` | VARCHAR(64) | NÃO | — | Nome da tag |
| `color` | VARCHAR(16) | NÃO | `#6B7280` | Cor hexadecimal |
| `icon` | VARCHAR(8) | NÃO | `🏷️` | Emoji/ícone |
| `category` | ENUM | NÃO | `custom` | Categoria: `prioridade`, `tipo`, `custom` |
| `active` | BOOLEAN | NÃO | `true` | Tag ativa |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |

---

### `maloteTagLinks` — Associação Malote ↔ Tag

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `maloteId` | INT | NÃO | — | FK → `malotes.id` |
| `tagId` | INT | NÃO | — | FK → `maloteTags.id` |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |

**Chaves estrangeiras:** `maloteId` → `malotes.id`, `tagId` → `maloteTags.id`

---

### `units` — Unidades Operacionais

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `name` | VARCHAR(150) | NÃO | — | Nome da unidade |
| `code` | VARCHAR(30) UNIQUE | NÃO | — | Código único |
| `address` | VARCHAR(255) | SIM | NULL | Endereço |
| `city` | VARCHAR(100) | SIM | NULL | Cidade |
| `state` | VARCHAR(50) | SIM | NULL | Estado |
| `responsibleName` | VARCHAR(150) | SIM | NULL | Nome do responsável |
| `responsiblePhone` | VARCHAR(32) | SIM | NULL | Telefone do responsável |
| `active` | BOOLEAN | NÃO | `true` | Unidade ativa |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

---

### `businessUnits` — Unidades de Negócio

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `name` | VARCHAR(150) | NÃO | — | Nome da unidade de negócio |
| `code` | VARCHAR(30) UNIQUE | NÃO | — | Código único |
| `type` | ENUM | NÃO | `escritorio` | Tipo: `escritorio`, `filial`, `deposito`, `outro` |
| `address` | VARCHAR(255) | SIM | NULL | Endereço |
| `city` | VARCHAR(100) | SIM | NULL | Cidade |
| `state` | VARCHAR(50) | SIM | NULL | Estado |
| `responsibleName` | VARCHAR(150) | SIM | NULL | Nome do responsável |
| `responsiblePhone` | VARCHAR(32) | SIM | NULL | Telefone do responsável |
| `active` | BOOLEAN | NÃO | `true` | Unidade ativa |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

---

### `departments` — Departamentos

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `code` | VARCHAR(32) UNIQUE | NÃO | — | Código único do departamento |
| `name` | VARCHAR(128) | NÃO | — | Nome do departamento |
| `responsible` | VARCHAR(128) | SIM | NULL | Responsável pelo departamento |
| `active` | BOOLEAN | NÃO | `true` | Departamento ativo |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

---

### `harvests` — Safras Agrícolas

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `name` | VARCHAR(128) | NÃO | — | Nome da safra (ex: `Safra 2024/2025`) |
| `year` | VARCHAR(9) | NÃO | — | Ano da safra (ex: `2024/2025`) |
| `startDate` | VARCHAR(10) | SIM | NULL | Data de início (ISO: `YYYY-MM-DD`) |
| `endDate` | VARCHAR(10) | SIM | NULL | Data de fim (ISO: `YYYY-MM-DD`) |
| `active` | BOOLEAN | NÃO | `true` | Safra ativa |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

---

### `budgets` — Orçamentos por Safra

| Coluna | Tipo | Nulo | Padrão | Descrição |
|---|---|---|---|---|
| `id` | INT AUTO_INCREMENT | NÃO | — | Chave primária |
| `harvestId` | INT | NÃO | — | FK → `harvests.id` |
| `costCenterId` | INT | SIM | NULL | FK → `costCenters.id` |
| `costCenterCode` | VARCHAR(32) | SIM | NULL | Código do centro de custo (desnormalizado) |
| `costCenterName` | VARCHAR(128) | SIM | NULL | Nome do centro de custo (desnormalizado) |
| `category` | VARCHAR(64) | SIM | NULL | Categoria do orçamento |
| `totalValue` | DECIMAL(15,2) | NÃO | `0.00` | Valor total orçado |
| `usedValue` | DECIMAL(15,2) | NÃO | `0.00` | Valor já utilizado |
| `notes` | TEXT | SIM | NULL | Observações |
| `createdBy` | VARCHAR(128) | SIM | NULL | Nome do usuário que criou |
| `createdAt` | TIMESTAMP | NÃO | `NOW()` | Data de criação |
| `updatedAt` | TIMESTAMP | NÃO | `NOW()` | Data de última atualização |

**Chaves estrangeiras:** `harvestId` → `harvests.id`, `costCenterId` → `costCenters.id`

---

## Guia para Futuras Migrações

### Como gerar e aplicar migrações com Drizzle

```bash
# 1. Editar o schema em /drizzle/schema.ts

# 2. Gerar o arquivo de migração SQL
pnpm db:push
# (equivale a: drizzle-kit generate && drizzle-kit migrate)

# 3. Os arquivos gerados ficam em /drizzle/migrations/
```

### Boas práticas para migrações

Ao adicionar novas colunas a tabelas existentes, sempre defina um valor padrão (`default`) ou marque como nullable para evitar erros em registros já existentes. Ao adicionar novos valores a colunas `ENUM`, inclua o novo valor no final da lista para compatibilidade com dados existentes. Nunca remova valores de `ENUM` sem verificar se ainda existem registros com aquele valor no banco.

Colunas desnormalizadas (sufixo `Name`, `Code` em tabelas filhas) são intencionais para performance de leitura — ao atualizar o registro pai, considere se é necessário atualizar os valores desnormalizados nas tabelas filhas.

### Próximas migrações sugeridas

| Prioridade | Migração | Justificativa |
|---|---|---|
| Alta | Adicionar FK explícita `purchaseRequests.costCenterId → costCenters.id` | Garantir integridade referencial no banco |
| Alta | Adicionar FK explícita `requestItems.requestId → purchaseRequests.id` | Integridade e cascade delete |
| Média | Adicionar tabela `notifications` | Rastrear notificações enviadas por WhatsApp/e-mail |
| Média | Adicionar coluna `purchaseRequests.supplierName` | Registrar fornecedor selecionado pelo Compras |
| Baixa | Adicionar tabela `suppliers` | Cadastro de fornecedores aprovados |
| Baixa | Adicionar tabela `auditLog` | Log de auditoria de alterações sensíveis |

---

*Documento gerado automaticamente a partir de `/drizzle/schema.ts` — CGS Agrícola Compras*
