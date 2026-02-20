# TODO — CompraFácil

## Infraestrutura e Configuração
- [x] Tema de cores corporativo (azul)
- [x] Ícones mapeados no icon-symbol.tsx
- [x] Logo gerado e configurado
- [x] Schema do banco de dados (users, purchase_requests, request_items, cost_centers, assets, approval_history)
- [x] Rotas tRPC completas
- [x] Migração do banco de dados

## Autenticação e Perfis
- [x] Tela de login
- [x] Seleção de perfil (solicitante, gerente, controladoria, diretoria, financeiro, admin)
- [x] Controle de acesso por perfil

## Navegação
- [x] Tab bar com 5 abas (Dashboard, Solicitações, Aprovações, Cadastros, Perfil)
- [x] Stack de navegação para telas de detalhe

## Formulário de Solicitação
- [x] Campo: Solicitante (automático)
- [x] Campo: Departamento
- [x] Campo: Centro de Custo (seleção)
- [x] Campo: Aplicação/Finalidade
- [x] Campo: Nível de Atendimento (Normal/Urgente/Emergencial)
- [x] Lista dinâmica de itens (descrição, qtd, unidade, valor unitário)
- [x] Campo: Observações
- [x] Cálculo automático do valor total
- [x] Envio para aprovação

## Lista de Solicitações
- [x] Filtros por status e urgência
- [x] Busca por número ou descrição
- [x] Cards com prazo restante (DeadlineTimer)
- [x] Badge de urgência

## Detalhe da Solicitação
- [x] Exibição completa do formulário
- [x] Timeline de aprovação (7 etapas)
- [x] Histórico de ações
- [x] Upload de PDF de orçamento (etapa 3)
- [x] Visualização do PDF
- [x] Botões de ação por perfil/etapa

## Fluxo de Aprovações
- [x] Etapa 1: Criação da solicitação
- [x] Etapa 2: Aprovação do Gerente de Unidade
- [x] Etapa 3: Orçamento (upload PDF pelo solicitante)
- [x] Etapa 4: Aprovação da Controladoria
- [x] Etapa 5: Aprovação da Diretoria
- [x] Etapa 6: Ordem de Compra
- [x] Etapa 7: Financeiro (pagamento)
- [x] Rejeição retorna ao passo anterior
- [x] Prazo de 48h por aprovador
- [x] Cancelamento automático após 48h sem correção

## Prazos e Alertas
- [x] Prazo Normal: 7 dias
- [x] Prazo Urgente: 3 dias
- [x] Prazo Emergencial: 1 dia
- [x] Timer regressivo visível nos cards
- [x] Alertas de prazo próximo
- [x] Cancelamento automático por timeout

## Cadastros Auxiliares (Admin)
- [x] Tela de listagem de usuários
- [x] Formulário de cadastro/edição de usuário
- [x] Tela de listagem de centros de custo
- [x] Formulário de cadastro/edição de centro de custo
- [x] Tela de listagem de bens
- [x] Formulário de cadastro/edição de bem

## Dashboard
- [x] Cards de métricas (total, pendentes, aprovadas, rejeitadas)
- [x] Cards de urgência (urgentes, emergenciais)
- [x] Lista de solicitações com prazo crítico
- [x] Resumo por status

## Integração WhatsApp
- [x] Serviço de notificação WhatsApp (server/whatsapp.ts)
- [x] Notificação automática em cada mudança de status
- [x] Tela de configuração do WhatsApp (instruções e links)
- [x] Suporte a Meta WhatsApp Business API, Twilio, Z-API
- [x] Configuração do número de WhatsApp por usuário no perfil

## Qualidade
- [x] Estados de loading em todas as telas
- [x] Estados vazios (empty states)
- [x] Feedback háptico nas ações
- [x] TypeScript sem erros (0 errors)
