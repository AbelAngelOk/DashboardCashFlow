// Portado desde lib/income-streams.ts — solo las etiquetas que necesita la
// UI. RECURRENCE_TYPE_LABELS ya vive en lib/obligations.js (income-streams.ts
// lo reexporta tal cual del mismo lugar en el original).

export const INCOME_STATUS_LABELS = {
  PENDING: "Pendiente",
  COLLECTED: "Cobrado",
  REJECTED: "Rechazado",
}

export const AMOUNT_MODE_LABELS = {
  FIXED: "Monto fijo",
  PERCENTAGE: "Porcentaje del valor",
}

export const SETTLEMENT_LABELS = {
  CASH: "En efectivo",
  IN_KIND: "En especie",
}
