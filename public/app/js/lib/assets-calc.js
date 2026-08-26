// Portado 1:1 desde las funciones puras de cálculo en lib/assets.ts.

export function calcFixedTermReturn(metadata, principal) {
  const start = new Date(metadata.startDate)
  const end = new Date(metadata.endDate)
  const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return principal * (metadata.rate / 100) * (days / 365)
}

export function calcWeightedAvgPrice(prevQty, prevAvg, newQty, newPrice) {
  const total = prevQty + newQty
  return total === 0 ? 0 : (prevQty * prevAvg + newQty * newPrice) / total
}
