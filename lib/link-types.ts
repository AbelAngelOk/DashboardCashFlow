import type { Currency } from "./finance"

export interface GastoIngresoLink {
  id: string
  gastoId: string
  ingresoId: string
  attributedAmount: number
  currency: Currency
  createdAt: string
  // Populated when loaded via loadLinksForGasto / loadLinksForIngreso
  ingresoName?: string
  gastoName?: string
}
