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

## Correções Aba Cadastros
- [x] Deletar usuários sem nome do banco de dados
- [x] Corrigir visibilidade do botão "+ Novo Usuário" na aba Cadastros
- [x] Formulário de cadastro com campos: nome, e-mail, WhatsApp, cargo e nível de aprovação

## Correções e Novas Funcionalidades (Lote 2)
- [x] Bug: salvar usuário cadastrado não está funcionando (corrigido: INSERT adicionado ao upsertUserByAdmin)
- [x] Envio de e-mail de boas-vindas ao cadastrar usuário (SMTP cgs.agr.br configurado)
- [x] Anexo PDF na etapa de cotação com upload real para S3 e visualização dentro da solicitação
- [x] Código único por solicitação (formato SOL-AAAA-NNNN, sequencial anual)
- [x] Bug: sair da conta (logout) corrigido (usa authLogout do useAuth)
- [x] Typo: corrigido "emergencialis" para "emergenciais" no dashboard
- [x] Campo de observação obrigatório para solicitações urgentes e emergenciais
- [x] Solicitações urgentes/emergenciais: aprovadas diretamente pela diretoria (pula gerente)
- [x] Bug: WhatsApp corrigido no perfil (busca usuário completo via trpc.auth.me, não cache local)

## Filtro por Urgência e Notificação WhatsApp no Cadastro
- [x] Chips de filtro por urgência (Emergencial, Urgente, Normal) na tela de Solicitações
- [x] Notificação via WhatsApp ao cadastrar novo usuário (além do e-mail de boas-vindas)

## Dashboard Urgência e Relatório Diário
- [x] Contador de solicitações urgentes/emergenciais pendentes no dashboard (card com destaque vermelho/amarelo)
- [x] Card de prazos vencendo em 24h no dashboard
- [x] Função no servidor para buscar solicitações com prazo vencendo nas próximas 24h
- [x] Função sendDailyDeadlineReport no whatsapp.ts
- [ ] Instalar node-cron para agendamento do relatório diário
- [ ] Criar serviço de relatório diário no servidor (buscar solicitações com prazo crítico)
- [ ] Envio de e-mail HTML do relatório para todos os usuários ativos
- [ ] Envio de WhatsApp do relatório para todos os usuários com telefone cadastrado
- [ ] Cron job agendado para 7h da manhã todos os dias

## Correções (Lote 3)
- [x] Corrigir botão Recusar no fluxo 07 (comprovante de pagamento)
- [x] Incluir nome do item nos relatórios diários
- [x] Remover campo "Número da OC" da etapa 06 (deixar apenas Dados de Pagamento)
- [x] Corrigir rejeição do fluxo 07: ao recusar comprovante, solicitação deve voltar para o solicitante (não para etapa 06)
- [x] Notificar via WhatsApp cada aprovador na sua etapa correspondente (gerente, orçamento, controladoria, diretoria, financeiro, verificação final)
- [x] Incluir link direto para a solicitação em todas as notificações WhatsApp
- [x] Corrigir notificações WhatsApp para aprovadores: garantir que o número é buscado do perfil cadastrado (campo phone na tabela users)
- [x] Adicionar campo de telefone editável pelo usuário Master na tela de perfil/edição de usuários
- [x] Adicionar botão "Testar envio WhatsApp" no card do usuário (apenas Master)
- [x] Adicionar botão mostrar/ocultar senha na tela de login
- [x] Tornar cards do dashboard clicáveis com navegação para histórico com filtro automático
- [x] Corrigir erro de digitação "emergencialais" para "Emergenciais" no dashboard
- [x] Corrigir números dos cards do dashboard para bater com os dados reais do banco
- [x] Adicionar card/filtro "Em Andamento" na tela de Solicitações
- [ ] Ao rejeitar solicitação, definir prazo de 10 dias para cancelamento automático
- [ ] Cancelar automaticamente solicitações vencidas sem atualização após 10 dias
- [ ] Emitir alerta WhatsApp 1 dia antes do cancelamento automático
- [ ] Exibir aviso visual no frontend quando solicitação está próxima do cancelamento
- [x] Adicionar aba Unidades na tela de Cadastros
- [x] Formulário de criação/edição/cancelamento para Centros de Custo
- [x] Formulário de criação/edição/cancelamento para Bens
- [x] Formulário de criação/edição/cancelamento para Fazendas
- [x] Formulário de criação/edição/cancelamento para Unidades
- [x] Personalizar layout com cores da logo CGS Agrícola (verde #3DB84B, amarelo #F5C842, marrom #3D2F2A)
- [x] Corrigir nome "CGS Agropecuária" para "CGS Agrícola" nos e-mails e textos do sistema
- [x] Adicionar logo CGS Agrícola no canto superior direito da tela de boas-vindas
- [x] Corrigir modal de criação de malotes: formulário sem scroll e seletor de unidades sobrepondo o modal
- [x] Adicionar campo "Observações" no formulário de criação de malotes
- [x] Corrigir seletor de unidades no modal de criação de malotes: substituir modal secundário por dropdown inline responsivo
- [x] Bug: unidades recém-cadastradas não aparecem no seletor de malotes (corrigido: tabela businessUnits criada no banco + seletor agora combina units + businessUnits)
- [x] Ícones diferenciados por categoria no seletor de unidades dos malotes (Fazenda=🌾, Escritório=🏢, Filial=🏗️, Depósito=📦, Outro=📍)
- [x] Geração automática de código nos cadastros de Bens (BEM-001), Fazendas (FAZ-001), Unidades (UN-001) e Centros de Custo (CC-001)
- [x] Botão de importação CSV nos cadastros de Bens, Fazendas, Unidades e Centros de Custo (parser de cabeçalho + inserção em lote)
- [x] Notificação WhatsApp para o aprovador correto ao receber uma solicitação em cada etapa do fluxo (busca por procurementRole OU approvalLevel, deduplicado por id)
- [x] Envio automático do relatório diário às 18h via cron job no servidor (America/Sao_Paulo)
- [x] Limpar e atualizar o Dashboard para refletir o sistema atual com solicitações zeradas
- [x] Adicionar botão de upload de PDF "OC Siagri" na tela de emissão de OC (Compras)
- [x] Tornar upload da OC Siagri obrigatório na etapa de Emissão de OC
- [x] Bug: erro "JSON Parse error: Unexpected character: <" ao aprovar solicitação como gerente (corrigido: servidor agora retorna JSON em vez de HTML para erros; handler global de sessão expirada adicionado no QueryClient)
- [ ] Corrigir fluxo emergencial/urgente: direto para diretoria → após aprovação volta para orçamento em diante
- [x] Corrigir fluxo emergencial/urgente: direto para diretoria → após aprovação volta para orçamento em diante
- [x] Seletor de bem na caixa de aplicação da solicitação
- [x] Cadastro de Departamentos (tabela, rota, aba nos cadastros)
- [x] Seletor de departamento no fluxo de criação de solicitação
- [x] Filtro por departamento na tela de Solicitações
- [x] Bug: "Ver todas" no Dashboard não exibe solicitações na aba de Solicitações
- [x] Reorganizar fluxos para 9 etapas: inserir Fluxo 7 (Aprovação Financeiro) entre Emissão de OC e Comprovante
- [x] Bug: botão de cancelar não aparece nos fluxos 1 e 2 (aguardando_gerente e aguardando_orcamento)
- [x] Motivo obrigatório no cancelamento de solicitação, registrado no histórico
- [x] Bug: Fluxo 7 (Aprovação Financeiro) aparece como aprovado prematuramente na linha do tempo
- [x] Funcionalidade: master pode reabrir solicitação cancelada (retorna ao Fluxo 1)
- [x] Funcionalidade "Lembrar Senha" na tela de Login (reset por e-mail)
- [x] Checkbox "Lembrar-me" na tela de Login (salva e-mail e senha via AsyncStorage)
- [x] Bug: motivo de cancelamento não aparece no histórico da solicitação
- [x] Garantir campo de motivo obrigatório em todos os fluxos de cancelamento
- [x] Bug: Fluxo 5 (Diretoria) aprovando volta para Fluxo 3 (Orçamento) incorretamente
- [x] Lógica especial: urgente/emergencial retorna ao Fluxo 3 após Fluxo 5 apenas UMA VEZ, depois segue fluxo normal (3→9)

## Correções de Responsividade
- [x] Corrigir scroll do modal de detalhe do malote: todo o conteúdo agora está dentro de um ScrollView, permitindo arrastar para cima para visualizar melhor
- [x] Corrigir modal de malotes: botão "Enviar Malote" cortado na borda inferior — adicionar padding inferior suficiente no ScrollView e safe area
- [x] Alterar horário do cron do relatório diário de e-mail de 18h para 19h

## Correções de Visibilidade e Dashboard
- [x] Todas as solicitações visíveis para todos os perfis (getDashboardStats não filtra mais por requesterId para solicitante)
- [x] Solicitações concluídas permanecem visíveis na aba Solicitações (já estava correto, getAllRequests retorna todos os status)
- [x] Bug: Dashboard — filtros sincronizados via useFocusEffect + useEffect para garantir que ao clicar nos cards as solicitações aparecem corretamente filtradas

## E-mail Relatório Diário
- [x] Substituir emoji 🌾 no cabeçalho do e-mail pela logo da CGS Agrícola como imagem inline (todos os 3 templates: boas-vindas, relatório diário e reset de senha)

## Otimização Android Safe Area
- [x] Auditar e corrigir todas as telas para não conflitarem com barras de interface do Android (status bar, navigation bar, gesture bar) — ScreenContainer atualizado com bottom edge no Android, paddingBottom dinâmico via useSafeAreaInsets em todas as telas, StatusBar translucent no Android

## Impressão
- [x] Adicionar botão de impressão na etapa "concluído" da tela de detalhe da solicitação — gera PDF com resumo completo da compra via expo-print

## Novos Fluxos de Aprovação
- [ ] Implementar fluxo Normal: Solicitação → Gerente → Orçamento → Controladoria → Diretoria → OC Compras → Financeiro → Comprovante → Verificação Final
- [ ] Implementar fluxo Urgente/Emergencial: Solicitação → Gerente → Diretoria → Orçamento → Controladoria → OC Compras → Financeiro → Comprovante → Verificação Final
- [ ] Atualizar tela de detalhe da solicitação para exibir o fluxo correto conforme urgência
- [ ] Garantir que ao clicar na solicitação abre tela com todas as informações

## Campo OS Myfarm
- [ ] Adicionar campo "OS Myfarm" no formulário de lançamento da solicitação

## PDF de Impressão de Solicitações
- [ ] Criar PDF de impressão para solicitações (disponível em qualquer status, não apenas concluída)

## Malotes
- [ ] Criar numeração sequencial para malotes (MAL-2026-XXXX)
- [ ] Implementar tela de impressão do malote com resumo das solicitações e itens

## Novos Fluxos de Aprovação e Melhorias (Lote 5)
- [x] Dois fluxos de aprovação: Normal (Gerente→Orçamento→Controladoria→Diretoria→OC→Financeiro→Comprovante→Verificação) e Urgente/Emergencial (Gerente→Diretoria→Orçamento→Controladoria→OC→Financeiro→Comprovante→Verificação)
- [x] ApprovalTimeline atualizado para mostrar o fluxo correto conforme urgência
- [x] Campo OS Myfarm (opcional) no formulário de nova solicitação
- [x] Campo OS Myfarm exibido na tela de detalhe da solicitação
- [x] Botão de impressão/PDF no modal de detalhe do malote (disponível em todos os status)
- [x] PDF do malote com: código, status, origem, destino, criado por, data de envio, observações e tabela de solicitações
- [x] Numeração sequencial de malotes já existente (MAL-AAAA-NNNN)

## Correção PIN Master
- [x] Diagnosticar e corrigir PIN de cadastro de usuário do master Rafael — pinHash estava nulo no banco, regenerado e salvo com bcrypt

## Correções Lote 6
- [x] Bug: tela estática ao clicar em "Finalizado" no fluxo 01 — adicionado router.back() após alert de OC finalizada
- [x] Texto errado: "solicitaçãoões" → "solicitações" corrigido nas duas ocorrências
- [x] Botão "Enviar Orçamento" habilitado após anexar PDF na etapa de Orçamento (aparece para ambos os fluxos quando status = aguardando_orcamento)

## Automação Malote
- [x] Ao finalizar etapa 9 (Verificação Final), criar automaticamente um malote com os itens da solicitação concluída — origem = departamento do usuário de Compras, destino = departamento do solicitante

## Badge Tab Malotes
- [x] Badge com contador de malotes "Abertos" no ícone da tab de Malotes — badge vermelho com número, atualiza a cada 30 segundos

## Bug Fluxo Orçamento
- [x] Bug: fluxo de orçamento não avançava ao clicar em "Enviar Orçamento" — attachBudget estava forçando status para aguardando_controladoria ao fazer upload; corrigido para apenas salvar o arquivo, avanço ocorre somente ao clicar em Enviar Orçamento

## Bug Crítico Orçamento (persistente)
- [ ] Bug: etapa de orçamento continua não avançando mesmo após correção anterior — investigar validação de papel no servidor e lógica do botão no app

## Bug Crítico Orçamento (persistente)
- [x] Bug: etapa de orçamento corrigida definitivamente — criada mutation dedicada submitBudget no servidor com validações explícitas e feedback visual claro no app (Alert de sucesso + router.back())

## Bug Upload PDF na Web
- [x] Bug: expo-file-system.readAsStringAsync não funciona na web — usar FileReader API do browser como alternativa para todas as funções de upload de PDF

## Bug Logout Web/Desktop
- [x] Bug: logout não funciona na versão web/desktop — corrigido usando window.location.href para forçar reload completo na web

## Múltiplos Papéis e Níveis de Aprovação por Usuário
- [x] Adicionar colunas extraRoles e extraApprovalLevels na tabela users (JSON)
- [x] Atualizar upsertUserByAdmin para gravar/ler múltiplos papéis e níveis
- [x] Atualizar routers.ts para aceitar extraRoles e extraApprovalLevels no input
- [x] Converter seletores de radio button para checkboxes com seleção múltipla no formulário
- [x] Exibir badge PRIMÁRIO no primeiro papel/nível selecionado
- [x] Exibir múltiplos badges na lista de usuários
- [x] Atualizar getPendingRequestsForUser para considerar todos os papéis do usuário
- [x] Atualizar canAct no detalhe da solicitação para considerar todos os papéis
- [x] 11 novos testes unitários cobrindo a lógica de múltiplos papéis

## Melhorias de UX no Cadastro de Usuários (Lote 3)
- [ ] Reordenação de papéis por arrastar (drag-and-drop) no formulário de cadastro de usuários
- [ ] Reordenação de níveis de aprovação por arrastar no formulário de cadastro de usuários
- [ ] Painel de cobertura de aprovadores com alertas visuais quando nível sem responsável
- [ ] Filtro "Aguardando Minha Ação" na tela de Solicitações
- [x] Bug: botão Emitir OC bloqueado pela OC Siagri obrigatória — corrigido: OC Siagri é opcional, botão habilitado com método de pagamento + dados preenchidos

## Bugs Desktop e Financeiro
- [ ] Bug: na versão desktop, nenhum botão de aprovação avança o fluxo (Alert.alert não funciona na web)
- [ ] Bug: card de aprovação do Financeiro não aparece na aba Aprovações para usuários com papel financeiro

## Câmera para Comprovante e Nota Fiscal
- [ ] Feature: Botão "Fotografar" nos campos de comprovante e nota fiscal para capturar imagem diretamente pela câmera

## Relatório Mensal de Compras
- [x] Endpoint getMonthlyReport no servidor (db.ts + routers.ts) com filtro por mês/ano, agrupamento por departamento e status
- [x] Tela de relatório (app/(tabs)/report.tsx) com seletor de mês/ano, abas Resumo/Departamentos/Detalhes
- [x] Exportação PDF via expo-print + expo-sharing (HTML gerado no cliente)
- [x] Exportação CSV com download direto na web e sharing nativo no mobile
- [x] Aba "Relatório" adicionada no tab bar e no sidebar desktop
- [x] Botão "Relatório" nas Ações Rápidas do Dashboard
- [x] 15 novos testes unitários para lógica de agrupamento do relatório mensal

## Bug Etapa de Orçamento — Tela não avança
- [x] Bug: após enviar PDF e clicar em "Enviar Orçamento", a tela não navegava de volta — Alert.alert com callback onPress não funciona na web; corrigido chamando router.back() diretamente no onSuccess
- [x] Mesmo padrão corrigido no finalizeOCMutation (OC Finalizada)

## Bug Botões de Aprovação na Web
- [x] Bug: Alert.alert com callback onPress não funciona na web — botão "Aprovar Pagamento" (fluxo 08 comprovante) não disparava approveMutation; corrigido com showConfirm cross-platform
- [x] Bug: handleFinalize usava Alert.alert com callback; corrigido com showConfirm

## Edição de Orçamento
- [x] Botão de edição do orçamento na tela de detalhe: visível apenas quando status = aguardando_controladoria (fluxo 04 não concluído), permitindo substituir o PDF e/ou valor do orçamento

## Edição de Orçamento nos Fluxos Subsequentes
- [x] Fluxo Normal: botão de edição do orçamento no bloco do fluxo 04 (aguardando_controladoria), abaixo de observação, visível para orcamento/compras/master
- [x] Fluxo Urgente/Emergencial: botão de edição do orçamento no bloco do fluxo 05 (aguardando_diretoria), abaixo de observação, visível para orcamento/compras/master

## Histórico e Bloqueio de Orçamento
- [x] Registrar substituição do PDF no histórico de aprovações (nome do arquivo, data, usuário)
- [x] Exibir mensagem "Orçamento bloqueado — etapa já aprovada" no card de PDF quando status passou da etapa editável

## Correção Botão Editar Orçamento
- [x] Corrigir canEditBudget: botão de edição unificado em aguardando_controladoria para todos os fluxos (fluxo 04 normal, fluxo 05 urgente/emergencial)

## Malote — Inserção Manual
- [ ] Remover inserção automática de solicitações no malote (deve ser apenas manual)

## Gráfico de Tempo de Aprovação no Dashboard
- [x] Endpoint getApprovalTimingStats: tempo médio por etapa a partir do histórico
- [x] Gráfico de barras horizontais no Dashboard ranqueando etapas mais lentas

## Bug: Master não recebe solicitações aguardando Diretoria
- [x] Corrigir pendingForMe/approvals para incluir aguardando_diretoria para usuários master

## Rankings no Relatório
- [x] Endpoint getRankingByCostCenter: top 10 centros de custo por valor total gasto no mês
- [x] Endpoint getRankingByItem: top 10 bens/itens mais solicitados por valor total no mês
- [x] Aba "Rankings" no Relatório Mensal com gráficos de barras horizontais
- [x] Gráfico de barras por Centro de Custo com valor, quantidade de solicitações e gradiente de cores
- [x] Gráfico de barras por Bem/Item com valor, ocorrências e unidades

## Sparkline nos Rankings
- [ ] Atualizar endpoints para retornar histórico de 3 meses por item/CC
- [ ] Componente Sparkline com react-native-svg
- [ ] Integrar sparkline nos gráficos de ranking

## Correção Fluxo de Orçamento
- [x] Corrigir: upload do PDF não avança o fluxo automaticamente
- [x] Adicionar botão "Enviar Orçamento" explícito após upload do PDF em todos os fluxos

## Etapa 9 — Verificação Final de Compras
- [x] Exibir card de dados de pagamento (método + info + observações) na etapa 9 para conferência completa do comprovante
- [x] Bug: Comprovante de pagamento não aparecia na etapa 9 para usuários sem permissão de agir — card estava dentro do bloco canAct; corrigido adicionando card de visualização fora do bloco canAct, visível para todos
- [x] Exibir comprovante de pagamento na etapa 8 (aguardando_comprovante_pagamento) para todos os usuários que acompanham a solicitação
- [x] Exibir nota fiscal anexada para todos os usuários quando a solicitação estiver concluída
- [x] Exibir itens da solicitação para todos os aprovadores ao abrir uma solicitação
- [x] Exibir itens da solicitação no card de aprovação (lista de aprovações pendentes)
- [x] Limitar itens no card com botão Ver mais (máx 3 visíveis)
- [x] Adicionar nome do solicitante no card
- [x] Exibir itens na tela Minhas Solicitações
- [x] Bug: Gráfico de ranking não aparece (barras de progresso com width% não funcionam em ScrollView no React Native)
- [x] Mover seleção de forma de pagamento do fluxo 06 (Emissão OC) para o fluxo 07 (Aprovação Financeiro)
- [x] Exibir dados de pagamento do Financeiro no fluxo 08 como referência
- [x] Campo de número de parcelas para Cartão Parcelado no fluxo 07
- [x] Opção de excluir solicitação cancelada (apenas solicitante ou admin, com confirmação)

## Permissões por Usuário
- [x] Liberar criação de centros de custo para Oscar Oliveira: adicionado 'admin' em extraRoles no banco; isAdmin no registers.tsx agora considera extraRoles; buildUserResponse e use-auth.ts atualizados para retornar/armazenar extraRoles

## Botões Editar/Excluir nos Cadastros
- [x] Botão 🗑️ Excluir nos centros de custo (mutation deleteCC + confirmação cross-platform)
- [x] Botão 🗑️ Excluir nos bens/assets (mutation deleteAsset + confirmação cross-platform)

## Inativar Centro de Custo
- [x] Substituir botão Excluir por Inativar/Reativar nos centros de custo
- [x] Exibir badge "Inativo" nos centros de custo inativos na lista de Cadastros
- [x] Ocultar centros de custo inativos do seletor no formulário de nova solicitação

## Visualização da OC em todos os fluxos
- [x] Exibir bloco da OC (número + arquivo) em todos os fluxos após o Fluxo 06 (Emissão de OC)

## Visualizador de PDF em Modal
- [x] Abrir PDF da OC Siagri em modal (pop-up) sem sair da tela de detalhes

## Visualizador de Orçamento em Modal
- [x] Abrir PDF do orçamento anexado em modal (pop-up) sem sair da tela de detalhes

## Visualizador de Comprovante e Nota Fiscal em Modal
- [x] Abrir Comprovante de Pagamento em modal (pop-up) sem sair da tela de detalhes
- [x] Abrir Nota Fiscal em modal (pop-up) sem sair da tela de detalhes

## Permissão Granular de Cadastro de Bens
- [x] Criar permissão 'assets_admin' para acesso exclusivo ao cadastro de Bens
- [x] Aplicar 'assets_admin' nos extraRoles do usuário wellington.pires@cgs.agr.br

## Análise de Orçamento com IA
- [x] Criar endpoint backend para análise de orçamento via GPT-4 Vision
- [x] Botão "✨ Analisar com IA" no bloco do orçamento anexado
- [x] Exibir parecer estruturado com tabela de itens e avaliação de preços
- [x] Salvar o parecer no banco de dados para consulta futura

## Gráfico Comparativo IA no Dashboard
- [x] Endpoint backend: buscar compras concluídas agrupadas por categoria com valores
- [x] Endpoint IA: gerar análise comparativa de preços por categoria vs. mercado
- [x] Gráfico de barras duplas no Dashboard: valor pago vs. valor de mercado por categoria
- [x] Card de resumo com índice geral de eficiência de compras (% abaixo/acima do mercado)

## Refinamento da Análise IA
- [x] Filtrar análise do Dashboard apenas para solicitações a partir do Fluxo 07 (aprovação financeira)
- [x] Botão "✨ Analisar Orçamento com IA" na tela de detalhes/aprovação
- [x] Extração de itens do PDF de orçamento via GPT-4 Vision e parecer de preços
- [x] Exibição do parecer estruturado (tabela de itens com avaliação) na tela de detalhes

## Análise IA Fase 2 — Busca Web em Tempo Real
- [x] Integrar Serper API (Google Shopping) para busca de preços reais por item
- [x] Atualizar endpoint analyzeBudget para buscar preços reais antes de chamar o LLM
- [x] Exibir links de referência do Google Shopping no modal de parecer
- [x] Badge indicando se a análise usou preços reais ou base de conhecimento IA

## Bug: Erro ao Criar Nova Solicitação
- [x] Corrigir erro de INSERT na tabela purchaseRequests: substituída conexão singleton por connection pool MySQL com reconexão automática (resolve ECONNRESET/timeout após inatividade)
- [x] Corrigir erro "Duplicate entry for key requestNumber_unique": substituída função generateRequestNumber de COUNT(*) para MAX(seq) para evitar colisões quando registros são deletados/cancelados

## Edição de Solicitações Abertas
- [x] Backend: função db.updatePurchaseRequest (atualiza campos + itens + reinicia aprovação)
- [x] Backend: rota tRPC requests.update com validação de status editável
- [x] Frontend: tela app/request/edit/[id].tsx (formulário pré-preenchido)
- [x] Frontend: botão "Editar" na tela de detalhe (visível quando status é editável)
- [x] Notificação WhatsApp ao gerente após edição

## Comparativo de Preços Sinop-MT na Análise IA
- [x] Atualizar busca Google Shopping para incluir "Sinop MT" na query de preços
- [x] Atualizar prompt da IA para solicitar comparativo regional com Sinop-MT e região
- [x] Exibir seção de comparativo regional no modal de parecer

## Bug: Navegação pós-criação no Desktop
- [x] Corrigir: após criar solicitação no desktop (web), a tela não navega — no web, router.back() é chamado imediatamente sem aguardar o Alert.alert (que não bloqueia no browser)

## Bug: Frontend Web não carrega em produção
- [x] Corrigir servidor para servir o bundle estático do frontend web: adicionado expo export --platform web no build e servidor serve dist/web em produção

## Bug: Erro de Build Docker na Publicação
- [x] Corrigir erro Metro no build Docker: adicionado CI=true EXPO_NO_DOTENV=1 no script build:web para desativar watchman no ambiente Docker

## Bug: Erro de Build Docker (Metro file not watched) - Persiste
- [ ] Corrigir definitivamente o erro Metro "file is not watched" no Docker (CI=true não foi suficiente)

## Feature: Botão de Edição para Controladoria
- [x] Adicionar botão de edição na etapa da Controladoria (fluxo Normal e Urgente/Emergencial)
- [x] A edição pela Controladoria NÃO deve reiniciar o fluxo - solicitação permanece na etapa atual
- [x] Backend: rota tRPC requests.updateByControladoria (atualiza dados sem mudar status/etapa)
- [x] Frontend: botão "Editar" visível apenas para usuários com role controladoria na etapa correta
- [x] Frontend: tela app/request/edit-controladoria/[id].tsx com aviso de "sem reiniciar fluxo"
