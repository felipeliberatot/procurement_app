/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ─── Procurement Domain Types ─────────────────────────────────────────────────

export type UrgencyLevel = "normal" | "urgente" | "emergencial";

export type RequestStatus =
  | "rascunho"
  | "aguardando_gerente"
  | "aguardando_orcamento"
  | "aguardando_controladoria"
  | "aguardando_diretoria"
  | "aguardando_ordem_compra"
  | "aguardando_aprovacao_compra"
  | "aguardando_comprovante_pagamento"
  | "aguardando_verificacao_compras"
  | "concluida"
  | "rejeitada"
  | "cancelada";

export type PaymentMethod = "pix" | "boleto" | "cartao_avista" | "cartao_parcelado";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_avista: "Cartão à Vista",
  cartao_parcelado: "Cartão Parcelado",
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  pix: "🟩",
  boleto: "🧳",
  cartao_avista: "💳",
  cartao_parcelado: "💳",
};

export type ProcurementRole =
  | "solicitante"
  | "gerente"
  | "orcamento"
  | "controladoria"
  | "diretoria"
  | "financeiro"
  | "admin";

export type ApprovalStep =
  | "criacao"
  | "gerente"
  | "orcamento"
  | "controladoria"
  | "diretoria"
  | "ordem_compra"
  | "financeiro"
  | "verificacao_compras";

export type ApprovalAction =
  | "criada"
  | "aprovada"
  | "rejeitada"
  | "orcamento_anexado"
  | "ordem_emitida"
  | "comprovante_anexado"
  | "pagamento_recusado"
  | "pagamento_verificado"
  | "nota_fiscal_anexada"
  | "oc_finalizada"
  | "cancelada"
  | "reaberta";

// ─── Labels ───────────────────────────────────────────────────────────────────

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  normal: "Normal",
  urgente: "Urgente",
  emergencial: "Emergencial",
};

export const URGENCY_DAYS: Record<UrgencyLevel, number> = {
  normal: 7,
  urgente: 3,
  emergencial: 1,
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  rascunho: "Rascunho",
  aguardando_gerente: "Aguard. Gerente",
  aguardando_orcamento: "Aguard. Orçamento",
  aguardando_controladoria: "Aguard. Controladoria",
  aguardando_diretoria: "Aguard. Diretoria",
  aguardando_ordem_compra: "Emissão de OC",
  aguardando_aprovacao_compra: "Aprovação de Compra",
  aguardando_comprovante_pagamento: "Aguard. Comprovante",
  aguardando_verificacao_compras: "Verif. Compras",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

export const ROLE_LABELS: Record<ProcurementRole, string> = {
  solicitante: "Solicitante",
  gerente: "Gerente de Unidade",
  orcamento: "Orçamento",
  controladoria: "Controladoria",
  diretoria: "Diretoria",
  financeiro: "Financeiro",
  admin: "Administrador",
};

export const STEP_LABELS: Record<ApprovalStep, string> = {
  criacao: "Criação",
  gerente: "Gerente de Unidade",
  orcamento: "Orçamento",
  controladoria: "Controladoria",
  diretoria: "Diretoria",
  ordem_compra: "Emissão de OC (Compras)",
  financeiro: "Comprovante de Pagamento",
  verificacao_compras: "Verificação Final (Compras)",
};

export const WORKFLOW_STEPS: Array<{
  step: ApprovalStep;
  label: string;
  status: RequestStatus;
  role?: ProcurementRole;
}> = [
  { step: "criacao", label: "Solicitação Criada", status: "aguardando_gerente" },
  { step: "gerente", label: "Aprovação do Gerente", status: "aguardando_gerente", role: "gerente" },
  { step: "orcamento", label: "Orçamento", status: "aguardando_orcamento" },
  { step: "controladoria", label: "Aprovação Controladoria", status: "aguardando_controladoria", role: "controladoria" },
  { step: "diretoria", label: "Aprovação Diretoria", status: "aguardando_diretoria", role: "diretoria" },
  { step: "ordem_compra", label: "Emissão de OC (Compras)", status: "aguardando_ordem_compra", role: "financeiro" },
  { step: "financeiro", label: "Comprovante de Pagamento", status: "aguardando_comprovante_pagamento", role: "financeiro" },
  { step: "verificacao_compras", label: "Verificação Final (Compras)", status: "aguardando_verificacao_compras", role: "financeiro" },
];

export const STATUS_COLORS: Record<RequestStatus, "primary" | "warning" | "success" | "error" | "muted"> = {
  rascunho: "muted",
  aguardando_gerente: "warning",
  aguardando_orcamento: "warning",
  aguardando_controladoria: "warning",
  aguardando_diretoria: "warning",
  aguardando_ordem_compra: "warning",
  aguardando_aprovacao_compra: "warning",
  aguardando_comprovante_pagamento: "warning",
  aguardando_verificacao_compras: "warning",
  concluida: "success",
  rejeitada: "error",
  cancelada: "muted",
};

export const URGENCY_COLORS: Record<UrgencyLevel, "primary" | "warning" | "error"> = {
  normal: "primary",
  urgente: "warning",
  emergencial: "error",
};
