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

## Aprovação via WhatsApp (nova funcionalidade)
- [ ] Webhook POST /api/whatsapp/webhook para receber mensagens dos aprovadores
- [ ] Verificação de token do webhook (GET /api/whatsapp/webhook)
- [ ] Parser de mensagens: APROVAR, REJEITAR <motivo>, DETALHES
- [ ] Sessão de contexto: mapear número de telefone → solicitação pendente
- [ ] Tabela whatsapp_sessions no banco para rastrear contexto de aprovação
- [ ] Mensagens com instruções claras de resposta rápida
- [ ] Confirmação de ação via WhatsApp (feedback ao aprovador)
- [ ] Rota tRPC para listar sessões WhatsApp ativas (admin)
- [ ] Tela de configuração do webhook no app
- [ ] Tela de status da integração WhatsApp com logs

## Cadastro de Usuários (nova aba dedicada)
- [x] Rota tRPC users.list (com busca e filtro por papel)
- [x] Rota tRPC users.create (admin cria usuário manualmente)
- [x] Rota tRPC users.update (editar nome, papel, telefone, departamento, status)
- [x] Rota tRPC users.delete (desativar usuário)
- [x] Tela de listagem de usuários com busca e filtro por papel
- [x] Card de usuário com avatar, nome, papel e status
- [x] Tela de formulário de criação/edição de usuário
- [x] Campos: nome, e-mail, WhatsApp, departamento, papel, ativo/inativo
- [x] Validação de campos obrigatórios
- [x] Feedback de sucesso/erro nas ações

## Importação CSV de Usuários
- [ ] Rota tRPC users.importBatch para inserção em lote
- [ ] Função de banco para upsert em lote (por e-mail como chave)
- [ ] Modal de importação CSV com 3 etapas: upload → prévia → confirmação
- [ ] Geração e download do template CSV com colunas corretas
- [ ] Parser de CSV no cliente (sem dependência externa)
- [ ] Validação de cada linha (campos obrigatórios, papéis válidos)
- [ ] Tela de prévia com tabela de dados e indicadores de erro por linha
- [ ] Feedback de resultado (X importados, Y com erro)
- [ ] Botão "Importar CSV" na aba de Usuários (apenas admin)

## Importação CSV de Centros de Custo
- [ ] Função de banco importCostCentersBatch (upsert por código)
- [ ] Rota tRPC costCenters.importBatch
- [ ] Template CSV de centros de custo com colunas: codigo, nome, responsavel
- [ ] Modal de importação CSV integrado na aba Centros de Custo
- [ ] Validação e prévia antes de confirmar importação

## Importação CSV de Bens
- [ ] Função de banco importAssetsBatch (upsert por código)
- [ ] Rota tRPC assets.importBatch
- [ ] Template CSV de bens com colunas: codigo, descricao, categoria, localizacao
- [ ] Modal de importação CSV integrado na aba Bens
- [ ] Componente CsvImportModal reutilizável para as 3 entidades

## Vinculação de Aprovadores por Nível
- [ ] Seção "Responsável por Aprovações" no card de usuário na aba Cadastros
- [ ] Exibir quais etapas do fluxo cada usuário cobre (Gerente, Controladoria, Diretoria, Financeiro)
- [ ] Painel de resumo dos aprovadores: mostrar quem está vinculado a cada nível
- [ ] Alerta visual quando um nível de aprovação não tem responsável cadastrado
- [ ] Importação CSV para centros de custo e bens

## Aprovação via WhatsApp (fluxo completo)
- [ ] Webhook Express POST /api/whatsapp/webhook para receber mensagens
- [ ] Tabela whatsappSessions no banco para rastrear tokens de aprovação
- [ ] Geração de token único por solicitação+etapa para validar resposta
- [ ] Mensagem enviada ao aprovador com: resumo da solicitação, instruções APROVAR ou REJEITAR motivo
- [ ] Parser de resposta: detectar APROVAR ou REJEITAR <motivo> na mensagem recebida
- [ ] Processamento automático: chamar approveRequest ou rejectRequest ao receber resposta válida
- [ ] Notificação ao solicitante após aprovação/rejeição via WhatsApp
- [ ] Rota tRPC whatsapp.getWebhookUrl para exibir URL do webhook no app
- [ ] Tela de configuração do webhook no app (Perfil > Integração WhatsApp)
- [ ] Suporte a Z-API, Twilio e Meta Business API

## Bugs Corrigidos
- [x] Bug: insert de requestItems falha — requestId inserido como 'default' em vez do ID real (corrigido: result[0].insertId)

## Cadastro de Usuários — Cargo e Nível de Aprovação
- [x] Adicionar coluna `jobTitle` (cargo) na tabela users do banco
- [x] Adicionar coluna `approvalLevel` (nível de aprovação) na tabela users do banco
- [x] Migrar banco de dados com as novas colunas
- [x] Atualizar funções do servidor (upsertUserByAdmin, updateUserProfile) para incluir jobTitle e approvalLevel
- [x] Atualizar rotas tRPC users.upsertByAdmin e users.updateProfile com os novos campos
- [x] Adicionar campo "Cargo" no formulário de cadastro/edição de usuário
- [x] Adicionar campo "Nível de Aprovação" no formulário com opções: Nenhum, Gerente, Controladoria, Diretoria, Financeiro
- [x] Exibir cargo e nível de aprovação no card de usuário na listagem

## Usuário Master e Gerenciamento de Usuários
- [x] Adicionar nível de aprovação 'master' ao ENUM approvalLevel no schema e banco
- [x] Atualizar rotas tRPC para aceitar 'master' como approvalLevel
- [x] Criar usuário master Felipe Tagami Liberato no banco de dados
- [x] Interface exclusiva do master no app: tela de gerenciamento de usuários
- [x] Master pode criar novos usuários diretamente no app
- [x] Master pode editar cargo e nível de aprovação de qualquer usuário
- [x] Indicador visual de usuário master no card e no perfil (badge roxo ⭐ MASTER)

## Vinculação de Login por E-mail
- [x] Implementar match por e-mail no login OAuth: se o e-mail do OAuth coincidir com um usuário pré-cadastrado, atualizar o openId para vincular a conta
- [x] Preservar dados do usuário pré-cadastrado (cargo, nível de aprovação, departamento) ao vincular

## Proteção do Nível Master e Painel de Aprovadores
- [x] Servidor: bloquear alteração de approvalLevel para 'master' por usuários não-master
- [x] Servidor: bloquear edição de usuário master por usuários não-master
- [x] App: ocultar opção 'Master' no seletor de nível de aprovação para não-masters
- [x] App: bloquear edição de usuário master por não-masters (card não abre modal)
- [x] Painel visual de aprovadores por nível na aba Usuários
- [x] Painel mostra quem está em cada nível (Gerente, Controladoria, Diretoria, Financeiro, Master)
- [x] Alerta visual quando um nível não tem responsável cadastrado

## Exportação CSV de Usuários (Master)
- [x] Função de geração de CSV com campos: nome, e-mail, WhatsApp, cargo, nível de aprovação, perfil de acesso, departamento, status
- [x] Botão "Exportar CSV" visível apenas para o usuário master na aba Usuários
- [x] Compartilhar o arquivo gerado via share sheet nativo do dispositivo

## PIN de Acesso Rápido (Master)
- [x] Adicionar coluna `pinHash` na tabela users do banco
- [x] Salvar PIN `cgs@2026` do Felipe com hash bcrypt
- [x] Rota tRPC `users.verifyPin` para verificar o PIN
- [x] Rota tRPC `users.updatePin` para o master alterar o PIN
- [x] Modal de verificação de PIN no app (teclado numérico/alfanumérico)
- [x] Proteger ações administrativas sensíveis com verificação de PIN
