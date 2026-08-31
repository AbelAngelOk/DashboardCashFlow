// Helpers puros del Corte Mensual.
// Sin acceso a DB ni a sesión — se usan tanto en cliente como en servidor.

export const MIN_CUTOFF_DAY = 1
export const MAX_CUTOFF_DAY = 28
export const DEFAULT_CUTOFF_DAY = 1

/** Clave de período: "YYYY-MM" */
export type PeriodKey = string

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/** Restringido a 1-28 para que el día exista en todos los meses (febrero incluido). */
export function isValidCutoffDay(day: number): boolean {
  return Number.isInteger(day) && day >= MIN_CUTOFF_DAY && day <= MAX_CUTOFF_DAY
}

export function normalizeCutoffDay(day: number | null | undefined): number {
  if (day == null || !isValidCutoffDay(day)) return DEFAULT_CUTOFF_DAY
  return day
}

/** Date → "YYYY-MM" */
export function periodKeyOf(date: Date): PeriodKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** "YYYY-MM" → { year, monthIndex } con monthIndex 0-based */
export function parsePeriodKey(key: PeriodKey): { year: number; monthIndex: number } {
  const [year, month] = key.split("-").map(Number)
  return { year, monthIndex: month - 1 }
}

/** Desplaza un período n meses (n puede ser negativo). */
export function addPeriodMonths(key: PeriodKey, n: number): PeriodKey {
  const { year, monthIndex } = parsePeriodKey(key)
  return periodKeyOf(new Date(year, monthIndex + n, 1))
}

/** Cantidad de meses entre dos períodos (b - a). Positivo si b es posterior a a. */
export function periodsBetween(a: PeriodKey, b: PeriodKey): number {
  const pa = parsePeriodKey(a)
  const pb = parsePeriodKey(b)
  return (pb.year - pa.year) * 12 + (pb.monthIndex - pa.monthIndex)
}

/** "2026-08" → "Agosto 2026" */
export function periodLabel(key: PeriodKey): string {
  const { year, monthIndex } = parsePeriodKey(key)
  return `${MONTH_NAMES[monthIndex]} ${year}`
}

/**
 * Período abierto hoy.
 * El período P va del día `cutoffDay` del mes P al día `cutoffDay` del mes P+1 (exclusivo),
 * así que antes del día de corte todavía estamos en el período del mes anterior.
 */
export function currentOpenPeriod(today: Date, cutoffDay: number): PeriodKey {
  const day = normalizeCutoffDay(cutoffDay)
  const thisMonth = periodKeyOf(today)
  return today.getDate() >= day ? thisMonth : addPeriodMonths(thisMonth, -1)
}

/** Período que corresponde cerrar: el anterior al que está abierto. */
export function pendingCutoffPeriod(today: Date, cutoffDay: number): PeriodKey {
  return addPeriodMonths(currentOpenPeriod(today, cutoffDay), -1)
}

/** Rango [inicio, fin) que abarca un período. */
export function periodRange(key: PeriodKey, cutoffDay: number): { start: Date; end: Date } {
  const day = normalizeCutoffDay(cutoffDay)
  const { year, monthIndex } = parsePeriodKey(key)
  return {
    start: new Date(year, monthIndex, day, 0, 0, 0, 0),
    end: new Date(year, monthIndex + 1, day, 0, 0, 0, 0),
  }
}

/** Fecha en la que se habilita el corte de un período: el fin de su rango. */
export function nextCutoffDate(key: PeriodKey, cutoffDay: number): Date {
  return periodRange(key, cutoffDay).end
}

/** Etiqueta de rango legible: "01/08/2026 - 31/08/2026" */
export function periodRangeLabel(key: PeriodKey, cutoffDay: number): string {
  const { start, end } = periodRange(key, cutoffDay)
  // El último día incluido es el anterior al fin exclusivo
  const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
  return `${fmt(start)} - ${fmt(lastDay)}`
}

// ── Tipos compartidos cliente/servidor ────────────────────────────────────────

export interface CutoffStatus {
  cutoffDay: number
  /** Período que corresponde cerrar */
  pendingPeriod: PeriodKey
  pendingPeriodLabel: string
  /** Período que quedará abierto tras el corte */
  incomingPeriod: PeriodKey
  incomingPeriodLabel: string
  /** true si ese período todavía no fue cortado */
  available: boolean
  /** Fecha en que se habilitó (o habilitará) el corte pendiente, ISO */
  pendingSince: string
  /** Último corte ejecutado, si existe */
  lastCutoffPeriod?: PeriodKey
  lastCutoffAt?: string
  /** Fecha del próximo corte a futuro, ISO */
  nextCutoffAt: string
  /**
   * Cuántos períodos completos quedaron sin cortar entre el último corte y el
   * pendiente actual (0 = ninguno salteado). Ver CORTE_Y_SNAPSHOTS.md §7: el
   * corte no filtra por fecha, así que si salteás uno, el próximo corte
   * mezcla varios meses sin forma de separarlos después.
   */
  periodsOverdue: number
}

export interface CutoffPreview {
  period: PeriodKey
  periodLabel: string
  incomingPeriod: PeriodKey
  incomingPeriodLabel: string
  /** Ingresos ACTIVE que pasarían a histórico */
  ingresosToArchive: number
  /** Gastos ACTIVE que pasarían a histórico */
  gastosToArchive: number
  /** De los anteriores, cuántos tienen etiqueta */
  markedToArchive: number
  /** Gastos de obligaciones que se activarían */
  gastosToGenerate: number
  /** Ingresos de dividendos que se crearían */
  ingresosToGenerate: number
  /** Etiquetas de activos y obligaciones que se quitarían */
  entityMarkersToClear: number
}

export interface CutoffOptions {
  takeSnapshot: boolean
  keepMarked: boolean
  clearEntityMarkers: boolean
}

export interface CutoffResult {
  period: PeriodKey
  incomingPeriod: PeriodKey
  ingresosArchived: number
  gastosArchived: number
  recordsKept: number
  gastosGenerated: number
  ingresosGenerated: number
  markersCleared: number
  snapshotId?: string
}
