import type { Currency } from "@/lib/finance"

// ── Asset types ───────────────────────────────────────────────────────────────

export type AssetType =
  | "STOCK"
  | "CRYPTO"
  | "FUTURES"
  | "OPTIONS"
  | "REBALANCE_BOT"
  | "TRADING_BOT"
  | "TRADING"
  | "FIXED_TERM"
  | "BOND"

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  STOCK: "Acciones",
  CRYPTO: "Crypto",
  FUTURES: "Futuros",
  OPTIONS: "Opciones",
  REBALANCE_BOT: "Bot Rebalanceo",
  TRADING_BOT: "Bot Trading",
  TRADING: "Trading",
  FIXED_TERM: "Plazo Fijo",
  BOND: "Bonos",
}

// ── Movement types ────────────────────────────────────────────────────────────

export type MovementType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "FEE"
  | "COLLECT"
  | "ADJUSTMENT"
  | "EXTRACT"
  | "DEPOSIT"

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  BUY: "Compra",
  SELL: "Venta",
  DIVIDEND: "Dividendo",
  FEE: "Comisión",
  COLLECT: "Cobro",
  ADJUSTMENT: "Ajuste",
  EXTRACT: "Extracción",
  DEPOSIT: "Depósito",
}

// ── Per-type metadata shapes ──────────────────────────────────────────────────

export interface DividendEntry {
  id: string
  month: string          // "YYYY-MM"
  percentage: number
  estimatedGain: number
  actualGain?: number
  ingresoRecordId?: string
}

export interface StockMetadata {
  dividends: DividendEntry[]
}

export interface FixedTermMetadata {
  startDate: string
  endDate: string
  rate: number           // annual %
  collected: boolean
  ingresoRecordId?: string
}

export interface BondDisbursement {
  id: string
  dueDate: string
  amount: number
  currency: Currency
  collected: boolean
}

export interface BondMetadata {
  disbursements: BondDisbursement[]
}

export interface FuturesMovementMetadata {
  positionType: "LONG" | "SHORT"
}

export interface FuturesMetadata {
  liquidated?: boolean
  liquidationSuffix?: number
}

export interface TradingBotMetadata {
  totalInvested: number
  totalGained: number
  totalLost: number
  totalExtracted: number
  currency: Currency
}

export interface RebalanceBotAsset {
  id: string
  name: string
  ticker?: string
  invested: number
  currentPrice: number
  initialQty: number
  currentQty: number
  currency: Currency
}

export interface RebalanceBotMetadata {
  assets: RebalanceBotAsset[]
}

export interface TradingMetadata {
  totalInvested: number
  totalObtained: number
  currency: Currency
}

// ── Seguimiento (configurable tracking table) ────────────────────────────────

export interface TrackingColumn {
  id: string
  name: string
  type: "text" | "number" | "date"
}

export interface TrackingRow {
  id: string
  cells: Record<string, string>
}

export interface TrackingConfig {
  columns: TrackingColumn[]
  rows: TrackingRow[]
}

// ── Core interfaces ───────────────────────────────────────────────────────────

export interface AssetFinancialMovement {
  id: string
  recordId: string
  movementType: MovementType
  amount: number
  quantity?: number
  unitPrice?: number
  currency: Currency
  exchangeRate?: number
  description?: string
  operationDate: string  // ISO string
  metadata?: FuturesMovementMetadata | Record<string, unknown>
}

export interface Asset {
  id: string
  name: string
  assetType: AssetType
  ticker?: string
  amount: number
  currency: Currency
  currentQty?: number
  avgBuyPrice?: number
  description?: string
  parentId?: string
  isGroupParent: boolean
  metadata?: StockMetadata | FixedTermMetadata | BondMetadata | TradingBotMetadata | RebalanceBotMetadata | TradingMetadata | null
  tracking?: TrackingConfig
  movements: AssetFinancialMovement[]
  children?: Asset[]
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function calcWeightedAvgPrice(
  prevQty: number,
  prevAvg: number,
  newQty: number,
  newPrice: number,
): number {
  const total = prevQty + newQty
  return total === 0 ? 0 : (prevQty * prevAvg + newQty * newPrice) / total
}

export function assetTypeFromString(s: string | null | undefined): AssetType | undefined {
  if (!s) return undefined
  return Object.keys(ASSET_TYPE_LABELS).includes(s) ? (s as AssetType) : undefined
}

export function calcFixedTermReturn(metadata: FixedTermMetadata, principal: number): number {
  const start = new Date(metadata.startDate)
  const end = new Date(metadata.endDate)
  const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return principal * (metadata.rate / 100) * (days / 365)
}
