// Portado 1:1 desde las funciones puras de lib/assets.ts relacionadas a
// dividendos recurrentes.

export const RECURRING_TYPE_LABELS = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  "semi-annual": "Semestral",
  annual: "Anual",
}

const RECURRING_MONTHS = {
  monthly: 1,
  quarterly: 3,
  "semi-annual": 6,
  annual: 12,
}

export function nextRecurringMonth(currentMonth, type) {
  const [year, month] = currentMonth.split("-").map(Number)
  const offset = RECURRING_MONTHS[type]
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Genera hasta windowSize instancias futuras de DividendEntry para una serie recurrente */
export function generateRecurringDividends(seed, windowSize = 12) {
  if (!seed.recurring) return []
  const { type, expectedAmount, seriesId } = seed.recurring
  const entries = []
  let month = seed.month
  for (let i = 0; i < windowSize; i++) {
    month = nextRecurringMonth(month, type)
    entries.push({
      id: crypto.randomUUID(),
      month,
      percentage: seed.percentage,
      estimatedGain: expectedAmount ?? seed.estimatedGain,
      recurring: { type, expectedAmount, isGenerated: true, seriesId },
    })
  }
  return entries
}
