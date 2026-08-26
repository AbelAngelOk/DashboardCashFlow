// Portado 1:1 desde lib/obligations.ts — solo lo que necesitan las
// notificaciones y el shell (etiquetas + isDueWithin/isOverdue/formatDate).
// El resto de la lógica de obligaciones vive server-side y se consume vía API.

export const OBLIGATION_TYPE_LABELS = {
  RECURRING: "Recurrente",
  INSTALLMENT: "Por cuotas",
  FIXED: "Monto fijo",
}

export const OBLIGATION_STATUS_LABELS = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
}

export const RECURRENCE_TYPE_LABELS = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMI_ANNUAL: "Semestral",
  ANNUAL: "Anual",
}

export const PAYMENT_TYPE_LABELS = {
  PAYMENT: "Pago",
  INTEREST: "Interés",
  FEE: "Comisión",
}

export const INSTALLMENT_STATUS_LABELS = {
  PENDING: "Pendiente",
  OVERDUE: "Vencida",
  PAID: "Pagada",
  REJECTED: "Rechazada",
}

const OCCURRENCES_PER_YEAR = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMI_ANNUAL: 2,
  ANNUAL: 1,
}

export function computeRecurringBreakdown(rules) {
  const totals = {}
  for (const rule of rules) {
    if (rule.status !== "ACTIVE") continue
    const perYear = rule.expectedAmount * OCCURRENCES_PER_YEAR[rule.recurrenceType]
    totals[rule.currency] = (totals[rule.currency] ?? 0) + perYear
  }
  return totals
}

export function pendingInstallmentsTotal(installments) {
  return installments
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .reduce((s, i) => s + i.expectedAmount, 0)
}

export function formatObligationDate(iso) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function isDueWithin(dateStr, days) {
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() + days)
  return due <= cutoff
}

export function isOverdue(dateStr) {
  const due = new Date(dateStr)
  due.setHours(23, 59, 59, 999)
  return due < new Date()
}
