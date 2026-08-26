// Portado 1:1 desde lib/finance.ts — misma lógica, sin tipos.
// No reinterpretar reglas de negocio acá: si algo cambia, cambia en el original
// y se vuelve a portar.

export const currencies = ["USD", "EUR", "MXN", "ARS", "USDT"]

export const currencySymbols = { USD: "$", EUR: "€", MXN: "$", ARS: "$", USDT: "₮" }

export const recordTypeLabels = {
  activo: "Activo",
  pasivo: "Obligación",
  ingreso: "Ingreso",
  gasto: "Gasto",
}

export const defaultCurrency = "USD"

export function emptyTotals() {
  return { USD: 0, EUR: 0, MXN: 0, ARS: 0, USDT: 0 }
}

export function calculateTotals(items) {
  const totals = emptyTotals()
  for (const item of items) totals[item.currency] += item.amount
  return totals
}

export function formatAmount(amount, currency) {
  return `${currencySymbols[currency]}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatTotals(totals) {
  const active = Object.keys(totals).filter((c) => totals[c] !== 0)
  if (active.length === 0) return "—"
  return active.map((c) => `${formatAmount(totals[c], c)} ${c}`).join(" | ")
}

export function activeCurrencies(totals) {
  return Object.keys(totals)
    .filter((c) => totals[c] !== 0)
    .sort((a, b) => Math.abs(totals[b]) - Math.abs(totals[a]))
}

export function convertAmount(amount, from, to, rates) {
  if (from === to) return amount
  const rateFrom = rates[from] ?? 1
  const rateTo = rates[to] ?? 1
  return (amount * rateFrom) / rateTo
}

export function calculateTotalsConverted(records, baseCurrency, rates) {
  return records.reduce((sum, r) => sum + convertAmount(r.amount, r.currency, baseCurrency, rates), 0)
}

export function computeGroupValue(children, convertCurrencies, baseCurrency, exchangeRates) {
  if (children.length === 0) return { type: "single", value: 0, currency: baseCurrency }

  if (convertCurrencies) {
    const total = children.reduce(
      (sum, c) => sum + convertAmount(c.amount, c.currency, baseCurrency, exchangeRates),
      0,
    )
    return { type: "single", value: total, currency: baseCurrency }
  }

  const breakdown = {}
  for (const c of children) breakdown[c.currency] = (breakdown[c.currency] ?? 0) + c.amount

  const entries = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([currency, value]) => ({ currency, value }))

  if (entries.length <= 1) {
    const e = entries[0]
    return { type: "single", value: e?.value ?? 0, currency: e?.currency ?? baseCurrency }
  }
  return { type: "breakdown", entries }
}
