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
  | "aguardando_financeiro"
  | "concluida"
  | "rejeitada"
  | "cancelada";

export type ProcurementRole =
  | "solicitante"
  | "gerente"
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
  | "financeiro";

export type ApprovalAction =
  | "criada"
  | "aprovada"
  | "rejeitada"
  | "orcamento_anexado"
  | "ordem_emitida"
  | "pagamento_realizado"
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
  aguardando_ordem_compra: "Aguard. Ordem de Compra",
  aguardando_financeiro: "Aguard. Financeiro",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

export const ROLE_LABELS: Record<ProcurementRole, string> = {
  solicitante: "Solicitante",
  gerente: "Gerente de Unidade",
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
  ordem_compra: "Ordem de Compra",
  financeiro: "Financeiro",
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
  { step: "ordem_compra", label: "Ordem de Compra", status: "aguardando_ordem_compra", role: "financeiro" },
  { step: "financeiro", label: "Pagamento", status: "aguardando_financeiro", role: "financeiro" },
];

export const STATUS_COLORS: Record<RequestStatus, "primary" | "warning" | "success" | "error" | "muted"> = {
  rascunho: "muted",
  aguardando_gerente: "warning",
  aguardando_orcamento: "warning",
  aguardando_controladoria: "warning",
  aguardando_diretoria: "warning",
  aguardando_ordem_compra: "warning",
  aguardando_financeiro: "warning",
  concluida: "success",
  rejeitada: "error",
  cancelada: "muted",
};

export const URGENCY_COLORS: Record<UrgencyLevel, "primary" | "warning" | "error"> = {
  normal: "primary",
  urgente: "warning",
  emergencial: "error",
};
