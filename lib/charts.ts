// Helpers puros de los gráficos. Sin DB ni sesión: se usan en cliente y servidor.

import { convertAmount, type Currency, type Snapshot } from "./finance"

export type MonthKey = string // "YYYY-MM"

export interface MonthlyAmount {
  month: MonthKey
  currency: Currency
  amount: number
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

export function monthKeyOf(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function addMonthKey(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split("-").map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

/** "ago 26" — corto para ejes */
export function monthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number)
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`
}

/** Meses consecutivos desde `from` (inclusive), `count` en total. */
export function monthRange(from: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonthKey(from, i))
}

/** Suma por mes convirtiendo todo a la moneda base. */
export function totalsByMonth(
  items: MonthlyAmount[],
  months: MonthKey[],
  baseCurrency: Currency,
  rates: Record<Currency, number>,
): number[] {
  const index = new Map(months.map((m, i) => [m, i]))
  const totals = months.map(() => 0)
  for (const it of items) {
    const i = index.get(it.month)
    if (i === undefined) continue
    totals[i] += convertAmount(it.amount, it.currency, baseCurrency, rates)
  }
  return totals
}

/** Índice del valor máximo (> 0), o -1 si no hay ninguno. */
export function peakIndex(values: number[]): number {
  let best = -1
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0 && (best === -1 || values[i] > values[best])) best = i
  }
  return best
}

/**
 * Total de activos de un snapshot sin contar dos veces los grupos.
 *
 * Un padre de grupo vale la suma de sus hijos y ambos quedaron congelados en
 * los snapshots viejos (SnapshotRecord no guarda parentId). Desde 2026-09-30
 * los snapshots ya no guardan padres; para los anteriores se descartan los
 * registros cuyo nombre coincide con un grupo de activos actual.
 */
export function snapshotAssetsTotal(
  snapshot: Snapshot,
  groupParentNames: Set<string>,
  baseCurrency: Currency,
  rates: Record<Currency, number>,
): number {
  return snapshot.records
    .filter((r) => r.type === "activo" && !groupParentNames.has(r.name))
    .reduce((s, r) => s + convertAmount(r.amount, r.currency, baseCurrency, rates), 0)
}
