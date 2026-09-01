export type RequestFinancialFields = {
  status?: string | null;
  totalEstimatedValue?: string | null;
  orderValue?: string | null;
};

function hasPositiveFinancialValue(value?: string | null): boolean {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0;
}

export function resolveCardFinancialValue(request: RequestFinancialFields) {
  const afterOC = ["aguardando_aprovacao_ceo", "aguardando_aprovacao_compra", "aguardando_comprovante_pagamento", "aguardando_verificacao_compras", "parcialmente_concluida", "concluida"].includes(request.status ?? "");
  const hasEstimatedValue = hasPositiveFinancialValue(request.totalEstimatedValue);
  const hasOrderValue = hasPositiveFinancialValue(request.orderValue);
  const value = afterOC
    ? (hasOrderValue ? request.orderValue : hasEstimatedValue ? request.totalEstimatedValue : null)
    : (hasEstimatedValue ? request.totalEstimatedValue : hasOrderValue ? request.orderValue : null);
  const label = afterOC
    ? "Valor da OC"
    : !hasEstimatedValue && hasOrderValue
      ? "Valor da Cotação"
      : "Valor Estimado";

  return { value, label, afterOC };
}
