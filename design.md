# Design — CompraFácil (Sistema de Compras Empresarial)

## Identidade Visual

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `primary` | `#1A56DB` | `#3B82F6` | Ações principais, CTA |
| `background` | `#F8FAFC` | `#0F172A` | Fundo de telas |
| `surface` | `#FFFFFF` | `#1E293B` | Cards, formulários |
| `foreground` | `#0F172A` | `#F1F5F9` | Texto principal |
| `muted` | `#64748B` | `#94A3B8` | Texto secundário |
| `border` | `#E2E8F0` | `#334155` | Bordas |
| `success` | `#16A34A` | `#22C55E` | Aprovado |
| `warning` | `#D97706` | `#F59E0B` | Pendente / Urgente |
| `error` | `#DC2626` | `#EF4444` | Rejeitado / Emergencial |

---

## Fluxo do Processo de Compras

```
[1] SOLICITAÇÃO DE COMPRA
        ↓ (prazo: normal=7d, urgente=3d, emergencial=1d)
[2] APROVAÇÃO DO GERENTE DE UNIDADE
        ↓ (48h para aprovar, senão retorna ao solicitante)
[3] ORÇAMENTO (upload PDF)
        ↓ (solicitante anexa orçamento)
[4] APROVAÇÃO DA CONTROLADORIA
        ↓ (48h para aprovar, senão retorna ao passo anterior)
[5] APROVAÇÃO DA DIRETORIA
        ↓ (48h para aprovar, senão retorna ao passo anterior)
[6] ORDEM DE COMPRA
        ↓ (geração da OC)
[7] FINANCEIRO (pagamento)
        ↓
[CONCLUÍDA]
```

**Regras de prazo:**
- Normal: 7 dias para atendimento total
- Urgente: 3 dias para atendimento total
- Emergencial: 1 dia para atendimento total
- Cada aprovador tem 48h; se não aprovar, retorna ao passo anterior
- Se o solicitante não corrigir em 48h, a solicitação é cancelada automaticamente

---

## Perfis de Usuário

| Perfil | Ações |
|--------|-------|
| `solicitante` | Criar e acompanhar solicitações |
| `gerente` | Aprovar/rejeitar na etapa 2 |
| `controladoria` | Aprovar/rejeitar na etapa 4 |
| `diretoria` | Aprovar/rejeitar na etapa 5 |
| `financeiro` | Processar pagamento na etapa 7 |
| `admin` | Acesso total + cadastros |

---

## Telas

### Tab Bar Principal
| Tab | Ícone | Tela |
|-----|-------|------|
| Início | house.fill | Dashboard |
| Solicitações | doc.text.fill | Lista de Solicitações |
| Aprovações | checkmark.seal.fill | Fila de Aprovação |
| Cadastros | folder.fill | Cadastros Auxiliares |
| Perfil | person.fill | Perfil |

### 1. Dashboard
- Cards de métricas: Total, Pendentes, Aprovadas, Rejeitadas, Urgentes, Emergenciais
- Gráfico de status (barras horizontais)
- Lista de solicitações com prazo próximo do vencimento
- Alertas de itens vencendo em menos de 24h

### 2. Nova Solicitação
Formulário com:
- **Solicitante** (preenchido automaticamente)
- **Departamento** (texto livre)
- **Centro de Custo** (seleção de lista cadastrada)
- **Aplicação** (para qual projeto/finalidade)
- **Nível de Atendimento**: Normal (7d) | Urgente (3d) | Emergencial (1d)
- **Itens** (lista dinâmica):
  - Descrição do item
  - Quantidade
  - Unidade
  - Valor unitário estimado
- **Observações** (campo livre)

### 3. Lista de Solicitações
- Filtros: Todas / Minhas / Pendentes / Urgentes / Emergenciais
- Cards com: número, título, status, nível, prazo restante, valor total
- Busca por número ou descrição

### 4. Detalhe da Solicitação
- Todas as informações do formulário
- Timeline do fluxo (etapas 1-7 com status visual)
- Histórico de ações com timestamps
- Botões contextuais por perfil e etapa atual
- Seção de orçamento (upload/visualização PDF)

### 5. Fila de Aprovação
- Lista de solicitações aguardando ação do usuário logado
- Ordenada por urgência e prazo
- Ação rápida: Aprovar / Rejeitar com comentário

### 6. Cadastros Auxiliares (Admin)
- **Usuários**: Nome, email, perfil, departamento
- **Centros de Custo**: Código, nome, responsável
- **Bens**: Código, descrição, categoria, localização

### 7. Perfil
- Dados do usuário
- Perfil/função
- Logout

---

## Componentes Reutilizáveis

- `StatusBadge`: Badge colorido por status
- `UrgencyBadge`: Badge por nível (Normal/Urgente/Emergencial)
- `DeadlineTimer`: Contador regressivo de prazo
- `RequestCard`: Card de solicitação
- `ApprovalTimeline`: Timeline visual do fluxo
- `ItemsTable`: Tabela de itens da solicitação
- `MetricCard`: Card de métrica para dashboard
- `EmptyState`: Estado vazio
- `PdfUploader`: Upload e visualização de PDF de orçamento
