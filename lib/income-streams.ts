// Tipos y helpers puros del módulo Flujos de Ingresos.
// Espejo de lib/obligations.ts — sin acceso a DB ni a sesión.

import type { Currency } from "@/lib/finance"
import {
  OCCURRENCES_PER_YEAR,
  RECURRENCE_MONTHS,
  RECURRENCE_TYPE_LABELS,
  type RecurrenceType,
} from "@/lib/obligations"

export { RECURRENCE_TYPE_LABELS }
export type { RecurrenceType }

// ── Enums ─────────────────────────────────────────────────────────────────────

export type IncomeRuleStatus = "ACTIVE" | "PAUSED" | "COMPLETED"
export type IncomeOccurrenceStatus = "PENDING" | "COLLECTED" | "REJECTED"

/** Cómo se determina el monto de cada ocurrencia */
export type AmountMode = "FIXED" | "PERCENTAGE"

/** Qué entra al cobrar: efectivo, o más cantidad del propio activo (staking) */
export type Settlement = "CASH" | "IN_KIND"

export const INCOME_STATUS_LABELS: Record<IncomeOccurrenceStatus, string> = {
  PENDING: "Pendiente",
  COLLECTED: "Cobrado",
  REJECTED: "Rechazado",
}

export const RULE_STATUS_LABELS: Record<IncomeRuleStatus, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Completada",
}

export const AMOUNT_MODE_LABELS: Record<AmountMode, string> = {
  FIXED: "Monto fijo",
  PERCENTAGE: "Porcentaje del valor",
}

export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  CASH: "En efectivo",
  IN_KIND: "En especie",
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface IncomeRule {
  id: string
  recordId: string
  name: string
  recurrenceType: RecurrenceType
  startDate: string
  expectedAmount: number
  currency: Currency
  status: IncomeRuleStatus
  /** true = el cobro descuenta del capital del activo (cuota de préstamo) */
  reducesPrincipal: boolean
  amountMode: AmountMode
  /** Solo con amountMode="PERCENTAGE" */
  percentage?: number
  /** Solo con amountMode="FIXED": ajuste compuesto cada `adjustEveryN` ocurrencias */
  adjustmentPct?: number
  adjustEveryN?: number
  settlement: Settlement
  /** null/undefined = recurrente indefinido; N = cronograma finito */
  installmentCount?: number
  /** Ocurrencias ya resueltas, para mostrar avance en cronogramas finitos */
  settledCount?: number
}

export interface IncomeOccurrence {
  id: string
  ruleId: string
  recordId: string
  ruleName: string
  expectedDate: string
  expectedAmount: number
  actualAmount?: number
  currency: Currency
  status: IncomeOccurrenceStatus
  ingresoRecordId?: string
  /** true si el corte ya activó su ingreso en el dashboard */
  ingresoActive: boolean
  comment?: string
  reducesPrincipal: boolean
  settlement: Settlement
  installmentNumber?: number
  quantity?: number
}

export interface IncomeStreamData {
  rules: IncomeRule[]
  occurrences: IncomeOccurrence[]
  /** Ganancia anual proyectada por moneda, solo de reglas ACTIVE */
  annualProjection: Partial<Record<Currency, number>>
  /** true si el valor del activo se deriva de la proyección anual */
  valueIsProjection: boolean
}

// ── Monto de una ocurrencia ───────────────────────────────────────────────────

export interface AmountRuleInput {
  amountMode: AmountMode
  expectedAmount: number
  percentage?: number
  adjustmentPct?: number
  adjustEveryN?: number
}

/**
 * Monto esperado de la ocurrencia número `index` (0-based desde startDate).
 *
 * - PERCENTAGE: porcentaje sobre el valor del activo al momento de generarla.
 *   El ajuste no aplica: seguir el valor del activo ya es la forma de ajustarse.
 * - FIXED: monto base, con ajuste compuesto cada `adjustEveryN` ocurrencias.
 *   Con adjustmentPct=10 y adjustEveryN=3, las ocurrencias 0-2 valen el base,
 *   las 3-5 un 10% más, las 6-8 un 21% más, etc.
 */
export function occurrenceAmount(
  rule: AmountRuleInput,
  index: number,
  assetAmount: number,
): number {
  if (rule.amountMode === "PERCENTAGE") {
    return (assetAmount * (rule.percentage ?? 0)) / 100
  }
  const pct = rule.adjustmentPct ?? 0
  const every = rule.adjustEveryN ?? 0
  if (pct === 0 || every <= 0) return rule.expectedAmount
  const steps = Math.floor(Math.max(0, index) / every)
  return rule.expectedAmount * Math.pow(1 + pct / 100, steps)
}

// ── Proyección ────────────────────────────────────────────────────────────────

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Ganancia anual proyectada por moneda.
 *
 * Con ocurrencias disponibles se suman las PENDING de los próximos 12 meses: es
 * la única forma fiel cuando el monto varía por ajuste, porcentaje o cronograma
 * finito. Sin ellas cae a la fórmula `monto × ocurrenciasPorAño`, que solo es
 * exacta para reglas de monto fijo sin ajuste.
 */
export function computeAnnualProjection(
  rules: IncomeRule[],
  occurrences?: IncomeOccurrence[],
  now: Date = new Date(),
): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {}
  const activeRuleIds = new Set(rules.filter((r) => r.status === "ACTIVE").map((r) => r.id))

  if (occurrences && occurrences.length > 0) {
    const from = now.getTime()
    const to = from + YEAR_MS
    for (const occ of occurrences) {
      if (occ.status !== "PENDING") continue
      if (!activeRuleIds.has(occ.ruleId)) continue
      const t = new Date(occ.expectedDate).getTime()
      if (t < from || t > to) continue
      totals[occ.currency] = (totals[occ.currency] ?? 0) + occ.expectedAmount
    }
    return totals
  }

  for (const rule of rules) {
    if (rule.status !== "ACTIVE") continue
    const perYear = rule.expectedAmount * OCCURRENCES_PER_YEAR[rule.recurrenceType]
    totals[rule.currency] = (totals[rule.currency] ?? 0) + perYear
  }
  return totals
}

/** Índice 0-based de una fecha dentro del cronograma de una regla. */
export function occurrenceIndexOf(
  startDate: Date,
  date: Date,
  recurrenceType: RecurrenceType,
): number {
  const months = RECURRENCE_MONTHS[recurrenceType]
  const diff =
    (date.getFullYear() - startDate.getFullYear()) * 12 +
    (date.getMonth() - startDate.getMonth())
  return Math.max(0, Math.round(diff / months))
}

// ── Presets del tipo INCOME_STREAM ────────────────────────────────────────────

export type IncomePreset = "SALARY" | "LOAN" | "INSTALLMENT" | "CUSTOM"

export const PRESET_LABELS: Record<IncomePreset, string> = {
  SALARY: "Salario",
  LOAN: "Préstamo otorgado",
  INSTALLMENT: "Cobro en cuotas",
  CUSTOM: "Personalizado",
}

export const PRESET_DESCRIPTIONS: Record<IncomePreset, string> = {
  SALARY: "Sin valor patrimonial. Una regla mensual que no descuenta capital.",
  LOAN: "El valor es el capital prestado. Dos reglas: capital (descuenta) e interés (no descuenta).",
  INSTALLMENT: "El valor baja con cada cobro. Una regla que descuenta capital.",
  CUSTOM: "Se crea sin reglas. Las agregás después desde el detalle del activo.",
}

/** true si el preset representa un activo sin valor patrimonial */
export function presetHasNoPrincipal(preset: IncomePreset): boolean {
  return preset === "SALARY"
}

export interface PresetRuleInput {
  recurrenceType: RecurrenceType
  startDate: string
  currency: Currency
  /** Monto principal de la regla: sueldo, cuota de capital o cuota */
  primaryAmount: number
  /** Solo para LOAN: monto del interés por período */
  interestAmount?: number
  /** Cantidad de cuotas para LOAN e INSTALLMENT. Sin valor = cronograma indefinido */
  installmentCount?: number
  /** Ajuste periódico opcional, en % */
  adjustmentPct?: number
  adjustEveryN?: number
}

export interface PresetRule {
  name: string
  recurrenceType: RecurrenceType
  startDate: string
  expectedAmount: number
  currency: Currency
  reducesPrincipal: boolean
  amountMode: AmountMode
  percentage?: number
  adjustmentPct?: number
  adjustEveryN?: number
  settlement: Settlement
  installmentCount?: number
}

/** Reglas iniciales que crea cada preset. */
export function buildPresetRules(
  preset: IncomePreset,
  input: PresetRuleInput,
): PresetRule[] {
  const base = {
    recurrenceType: input.recurrenceType,
    startDate: input.startDate,
    currency: input.currency,
    amountMode: "FIXED" as AmountMode,
    settlement: "CASH" as Settlement,
  }
  const adj =
    input.adjustmentPct && input.adjustEveryN
      ? { adjustmentPct: input.adjustmentPct, adjustEveryN: input.adjustEveryN }
      : {}
  const n = input.installmentCount && input.installmentCount > 0 ? input.installmentCount : undefined

  switch (preset) {
    case "SALARY":
      return [
        {
          ...base,
          ...adj,
          name: "Sueldo",
          expectedAmount: input.primaryAmount,
          reducesPrincipal: false,
        },
      ]
    case "LOAN":
      return [
        {
          ...base,
          name: "Capital",
          expectedAmount: input.primaryAmount,
          reducesPrincipal: true,
          installmentCount: n,
        },
        ...(input.interestAmount && input.interestAmount > 0
          ? [
              {
                ...base,
                name: "Interés",
                expectedAmount: input.interestAmount,
                reducesPrincipal: false,
                installmentCount: n,
              },
            ]
          : []),
      ]
    case "INSTALLMENT":
      return [
        {
          ...base,
          name: "Cuota",
          expectedAmount: input.primaryAmount,
          reducesPrincipal: true,
          installmentCount: n,
        },
      ]
    case "CUSTOM":
      return []
  }
}

// ── Modo de valuación del activo ──────────────────────────────────────────────

/**
 * "PROJECTION" = el valor del activo ES su ganancia anual proyectada (salario).
 * Espejo de cómo una obligación RECURRING vale su costo anual proyectado.
 *
 * "MANUAL" = el valor lo fija el usuario o lo amortizan las reglas de capital.
 * Es el default: nunca se pisa un valor de mercado sin que se pida.
 */
export type ValueMode = "PROJECTION" | "MANUAL"

export const VALUE_MODE_LABELS: Record<ValueMode, string> = {
  PROJECTION: "Proyección anual de ingresos",
  MANUAL: "Valor propio del activo",
}

export function valueModeOf(metadata: unknown): ValueMode {
  const raw = (metadata as { valueMode?: string } | null | undefined)?.valueMode
  return raw === "PROJECTION" ? "PROJECTION" : "MANUAL"
}

/** El preset Salario es el único que vale su proyección en vez de un capital. */
export function presetValueMode(preset: IncomePreset): ValueMode {
  return preset === "SALARY" ? "PROJECTION" : "MANUAL"
}
