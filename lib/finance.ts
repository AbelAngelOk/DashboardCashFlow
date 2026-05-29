export type RecordType = "activo" | "pasivo" | "ingreso" | "gasto"
export type Currency = "USD" | "EUR" | "MXN" | "ARS" | "USDT"

export interface FinancialRecord {
  id: string
  type: RecordType
  name: string
  amount: number
  currency: Currency
  linkedTo?: string
}

export interface Snapshot {
  id: string
  name: string
  period: string
  createdAt: string
  records: FinancialRecord[]
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

export function formatTotals(totals: Record<Currency, number>) {
  const active = (Object.keys(totals) as Currency[]).filter(
    (c) => totals[c] !== 0,
  )
  if (active.length === 0) return "—"
  return active.map((c) => `${formatAmount(totals[c], c)} ${c}`).join(" | ")
}
