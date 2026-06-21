import type { Currency } from "@/lib/finance"

// ── Enums ─────────────────────────────────────────────────────────────────────

export type ObligationType = "RECURRING" | "INSTALLMENT" | "FIXED"
export type ObligationStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
export type RecurrenceType = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL"
export type InstallmentStatus = "PENDING" | "OVERDUE" | "PAID" | "REJECTED"
export type PaymentType = "PAYMENT" | "INTEREST" | "FEE"
export type PaymentStatus = "PENDING" | "PAID" | "REJECTED"

// ── Labels ────────────────────────────────────────────────────────────────────

export const OBLIGATION_TYPE_LABELS: Record<ObligationType, string> = {
  RECURRING: "Recurrente",
  INSTALLMENT: "Por cuotas",
  FIXED: "Monto fijo",
}

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
}

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMI_ANNUAL: "Semestral",
  ANNUAL: "Anual",
}

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  PAYMENT: "Pago",
  INTEREST: "Interés",
  FEE: "Comisión",
}

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Pendiente",
  OVERDUE: "Vencida",
  PAID: "Pagada",
  REJECTED: "Rechazada",
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const RECURRENCE_MONTHS: Record<RecurrenceType, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
}

export const OCCURRENCES_PER_YEAR: Record<RecurrenceType, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMI_ANNUAL: 2,
  ANNUAL: 1,
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ObligationRule {
  id: string
  obligationId: string
  name: string
  recurrenceType: RecurrenceType
  startDate: string
  expectedAmount: number
  currency: Currency
  status: "ACTIVE" | "PAUSED"
}

export interface ObligationInstallment {
  id: string
  obligationId: string
  installmentNumber: number
  dueDate: string
  expectedAmount: number
  status: InstallmentStatus
  gastoRecordId?: string
}

export interface ObligationPayment {
  id: string
  obligationId: string
  ruleId?: string
  paymentType: PaymentType
  expectedDate?: string
  expectedAmount?: number
  currency: Currency
  gastoRecordId?: string
  status: PaymentStatus
  comment?: string
  createdAt: string
  actualAmount?: number  // read at load time from linked record
}

export interface Obligation {
  id: string
  userId: string
  obligationType: ObligationType
  name: string
  description?: string
  currency: Currency
  amount: number
  status: ObligationStatus
  nextDueDate?: string
  createdAt: string
  rules: ObligationRule[]
  installments: ObligationInstallment[]
  payments: ObligationPayment[]
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/** First occurrence of a rule that falls on or after `after`. */
export function nextOccurrenceOnOrAfter(rule: ObligationRule, after: Date): Date {
  const months = RECURRENCE_MONTHS[rule.recurrenceType]
  let date = new Date(rule.startDate)
  date.setHours(0, 0, 0, 0)
  const target = new Date(after)
  target.setHours(0, 0, 0, 0)
  while (date < target) {
    date = addMonths(date, months)
  }
  return date
}

/** All dates from `from` (inclusive) to `to` (inclusive) for a rule's schedule. */
export function ruleDatesInWindow(rule: ObligationRule, from: Date, to: Date): Date[] {
  const months = RECURRENCE_MONTHS[rule.recurrenceType]
  const dates: Date[] = []
  let date = nextOccurrenceOnOrAfter(rule, from)
  while (date <= to) {
    dates.push(new Date(date))
    date = addMonths(date, months)
  }
  return dates
}

/** Annual projected cost per currency for all ACTIVE rules. */
export function computeRecurringBreakdown(rules: ObligationRule[]): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {}
  for (const rule of rules) {
    if (rule.status !== "ACTIVE") continue
    const perYear = rule.expectedAmount * OCCURRENCES_PER_YEAR[rule.recurrenceType]
    totals[rule.currency] = (totals[rule.currency] ?? 0) + perYear
  }
  return totals
}

/** Sum of remaining PENDING/OVERDUE installment amounts. */
export function pendingInstallmentsTotal(installments: ObligationInstallment[]): number {
  return installments
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .reduce((s, i) => s + i.expectedAmount, 0)
}

export function formatObligationDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function isDueWithin(dateStr: string, days: number): boolean {
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() + days)
  return due <= cutoff
}

export function isOverdue(dateStr: string): boolean {
  const due = new Date(dateStr)
  due.setHours(23, 59, 59, 999)
  return due < new Date()
}
