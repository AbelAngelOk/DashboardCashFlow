export type RecordType = "activo" | "pasivo" | "ingreso" | "gasto"
export type Currency = "USD" | "EUR" | "MXN" | "ARS" | "USDT"

// Ciclo de lo que genera el corte (cuotas, pagos, cobros de reglas, dividendos):
//   REVIEW    "Por revisar"            entra al dashboard, nadie lo miró todavía
//   CONFIRMED "Pendiente" / "Por cobrar"  validado, falta pagarlo o cobrarlo
//   ACTIVE    "Pagado" / "Cobrado"     ya se pagó o cobró
export type RecordStatus =
  | "ACTIVE" | "REVIEW" | "CONFIRMED" | "PENDING" | "CANCELLED" | "HISTORICAL" | "ARCHIVED"

/** Estados de ingreso/gasto que forman parte del período en curso (el dashboard). */
export const LIVE_FLOW_STATUSES: RecordStatus[] = ["ACTIVE", "REVIEW", "CONFIRMED"]
/** De los anteriores, los que todavía no se pagaron ni cobraron. */
export const UNSETTLED_FLOW_STATUSES: RecordStatus[] = ["REVIEW", "CONFIRMED"]

export const NAME_MAX_LENGTH = 30

export interface FinancialRecord {
  id: string
  type: RecordType
  name: string
  amount: number
  currency: Currency
  linkedTo?: string
  parentId?: string
  assetType?: string
  isGroupParent?: boolean
  status?: RecordStatus
  /** Activo que produce ingreso (negocio, renta): solo estos cuentan en la Libertad Financiera. */
  generatesIncome?: boolean
  /** Lo generó una obligación, una regla de ingreso o un dividendo (no se cargó a mano). */
  generated?: boolean
  /** Texto plano. En activos es de solo lectura: se edita con el editor rico del detalle. */
  description?: string
  createdAt?: string
  effectiveDate?: string
  previousVersionId?: string
}

/**
 * Las descripciones de activos se guardan como JSON de TipTap; el resto como
 * texto. Devuelve siempre texto plano, o undefined si no hay nada que mostrar.
 */
export function plainTextDescription(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const text = raw.trim()
  if (!text.startsWith("{")) return text || undefined
  try {
    const parts: string[] = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return
      const n = node as { type?: string; text?: string; content?: unknown[] }
      if (typeof n.text === "string") parts.push(n.text)
      if (Array.isArray(n.content)) {
        n.content.forEach(walk)
        if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") parts.push("\n")
      }
    }
    walk(JSON.parse(text))
    const result = parts.join("").replace(/\n{2,}/g, "\n").trim()
    return result || undefined
  } catch {
    return text
  }
}

export interface Snapshot {
  id: string
  name: string
  period: string
  createdAt: string
  records: FinancialRecord[]
  data?: Record<string, unknown>
}

export type MovementAction = "creado" | "editado" | "eliminado"

export interface Movement {
  id: string
  date: string
  action: MovementAction
  recordType: RecordType
  recordName: string
  detail: string
  comment: string
}

export const currencies: Currency[] = ["USD", "EUR", "MXN", "ARS", "USDT"]

export const currencySymbols: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  MXN: "$",
  ARS: "$",
  USDT: "₮",
}

export const recordTypeLabels: Record<RecordType, string> = {
  activo: "Activo",
  pasivo: "Obligación",
  ingreso: "Ingreso",
  gasto: "Gasto",
}

export const defaultCurrency: Currency = "USD"

export const emptyTotals = (): Record<Currency, number> => ({
  USD: 0,
  EUR: 0,
  MXN: 0,
  ARS: 0,
  USDT: 0,
})

export function calculateTotals(items: FinancialRecord[]) {
  const totals = emptyTotals()
  items.forEach((item) => {
    totals[item.currency] += item.amount
  })
  return totals
}

export function formatAmount(amount: number, currency: Currency) {
  return `${currencySymbols[currency]}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Umbral a partir del cual una tasa de cambio se considera vieja. */
export const RATES_STALE_AFTER_DAYS = 7

/**
 * Días desde `ratesLastUpdated` (ISO). `null` si nunca se actualizó o el
 * valor no es parseable (formato legado, pre-ISO) — se trata como "vieja".
 */
export function ratesAgeDays(ratesLastUpdated: string | null): number | null {
  if (!ratesLastUpdated) return null
  const t = new Date(ratesLastUpdated).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24))
}

export function formatRatesAge(ratesLastUpdated: string | null): string {
  const days = ratesAgeDays(ratesLastUpdated)
  if (ratesLastUpdated && days === null) return "hace tiempo (formato antiguo)"
  if (days === null) return "nunca se actualizaron"
  if (days === 0) return "hoy"
  if (days === 1) return "hace 1 día"
  return `hace ${days} días`
}

export function formatTotals(totals: Record<Currency, number>) {
  const active = (Object.keys(totals) as Currency[]).filter(
    (c) => totals[c] !== 0,
  )
  if (active.length === 0) return "—"
  return active.map((c) => `${formatAmount(totals[c], c)} ${c}`).join(" | ")
}

// Returns active (non-zero) currencies sorted by absolute value descending
export function activeCurrencies(totals: Record<Currency, number>): Currency[] {
  return (Object.keys(totals) as Currency[])
    .filter((c) => totals[c] !== 0)
    .sort((a, b) => Math.abs(totals[b]) - Math.abs(totals[a]))
}

// Converts amount from one currency to another using rates relative to a shared base
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>, // rates[X] = how many "base" units 1 X is worth
): number {
  if (from === to) return amount
  const rateFrom = rates[from] ?? 1
  const rateTo = rates[to] ?? 1
  return (amount * rateFrom) / rateTo
}

// Sums all records converting each to baseCurrency
export function calculateTotalsConverted(
  records: FinancialRecord[],
  baseCurrency: Currency,
  rates: Record<Currency, number>,
): number {
  return records.reduce(
    (sum, r) => sum + convertAmount(r.amount, r.currency, baseCurrency, rates),
    0,
  )
}

// ── Group valuation ───────────────────────────────────────────────────────────

export type GroupValueResult =
  | { type: "single"; value: number; currency: Currency }
  | { type: "breakdown"; entries: Array<{ currency: Currency; value: number }> }

/**
 * Compute the display value of a group from its children.
 * This is the single source of truth for group valuation across all views.
 *
 * - convertCurrencies=true  → single total in baseCurrency
 * - convertCurrencies=false → per-currency breakdown (or single if all same currency)
 */
export function computeGroupValue(
  children: Array<{ amount: number; currency: Currency }>,
  convertCurrencies: boolean,
  baseCurrency: Currency,
  exchangeRates: Record<Currency, number>,
): GroupValueResult {
  if (children.length === 0) {
    return { type: "single", value: 0, currency: baseCurrency }
  }

  if (convertCurrencies) {
    const total = children.reduce(
      (sum, c) => sum + convertAmount(c.amount, c.currency, baseCurrency, exchangeRates),
      0,
    )
    return { type: "single", value: total, currency: baseCurrency }
  }

  // No conversion: group by currency
  const breakdown: Record<string, number> = {}
  for (const c of children) {
    breakdown[c.currency] = (breakdown[c.currency] ?? 0) + c.amount
  }

  const entries = (Object.entries(breakdown) as Array<[Currency, number]>)
    .filter(([, v]) => v > 0)
    .map(([currency, value]) => ({ currency, value }))

  if (entries.length <= 1) {
    const e = entries[0]
    return { type: "single", value: e?.value ?? 0, currency: e?.currency ?? baseCurrency }
  }

  return { type: "breakdown", entries }
}
