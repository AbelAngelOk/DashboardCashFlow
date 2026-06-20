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
  | "GROUP"

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
  GROUP: "Grupo",
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

// ── Dividend recurring config ─────────────────────────────────────────────────

export type RecurringType = "monthly" | "quarterly" | "semi-annual" | "annual"

export const RECURRING_TYPE_LABELS: Record<RecurringType, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  "semi-annual": "Semestral",
  annual: "Anual",
}

/** Months offset between occurrences */
export const RECURRING_MONTHS: Record<RecurringType, number> = {
  monthly: 1,
  quarterly: 3,
  "semi-annual": 6,
  annual: 12,
}

// ── Per-type metadata shapes ──────────────────────────────────────────────────

export interface DividendEntry {
  id: string
  month: string           // "YYYY-MM"
  percentage: number
  estimatedGain: number
  actualGain?: number
  ingresoRecordId?: string
  recurring?: {
    type: RecurringType
    expectedAmount?: number
    isGenerated: boolean   // true = auto-generated, false = user-created seed
    seriesId: string       // groups all entries from the same series
  }
}

/** @deprecated — dividends moved to boards[type="dividends"]; kept for legacy read */
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
  totalInvested?: number
}

export interface TradingMetadata {
  totalInvested: number
  totalObtained: number
  currency: Currency
}

// ── Boards system ─────────────────────────────────────────────────────────────

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

export interface BoardConfig {
  id: string
  type: "dividends" | "custom"
  title: string
  order: number
  config?: TrackingConfig    // for type: "custom"
  dividends?: DividendEntry[] // for type: "dividends"
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string                  // deterministic: "dividend-{assetId}-{dividendId}"
  type: "dividend_pending"    // extensible
  title: string
  body: string
  assetId?: string
  dividendId?: string
  createdAt: string
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
  boards: BoardConfig[]      // always present (may be empty)
  /** @deprecated use boards instead */
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

/** Generate the next YYYY-MM string given a current month and recurring type */
export function nextRecurringMonth(currentMonth: string, type: RecurringType): string {
  const [year, month] = currentMonth.split("-").map(Number)
  const offset = RECURRING_MONTHS[type]
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Generate up to windowSize future DividendEntry instances for a recurring series */
export function generateRecurringDividends(
  seed: DividendEntry,
  windowSize = 12,
): DividendEntry[] {
  if (!seed.recurring) return []
  const { type, expectedAmount, seriesId } = seed.recurring
  const entries: DividendEntry[] = []
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

/** Extract boards from raw metadata, migrating legacy tracking and dividends */
export function extractBoards(raw: Record<string, unknown> | null | undefined): BoardConfig[] {
  const boards = (raw?.boards as BoardConfig[] | undefined) ?? []

  // Migrate legacy tracking → custom board
  if (raw?.tracking && !boards.some((b) => b.id === "legacy-tracking")) {
    boards.push({
      id: "legacy-tracking",
      type: "custom",
      title: "Seguimiento",
      order: boards.length,
      config: raw.tracking as TrackingConfig,
    })
  }

  // Migrate legacy StockMetadata.dividends → dividends board
  const legacyDividends = raw?.dividends as DividendEntry[] | undefined
  if (legacyDividends?.length && !boards.some((b) => b.type === "dividends")) {
    boards.push({
      id: "legacy-dividends",
      type: "dividends",
      title: "Dividendos",
      order: boards.length,
      dividends: legacyDividends,
    })
  }

  return boards.sort((a, b) => a.order - b.order)
}
