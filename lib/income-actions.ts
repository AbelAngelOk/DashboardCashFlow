"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
import { createJournalEntry } from "./journal-actions"
import { addMonths, ruleDatesInWindow, type ObligationRule, type RecurrenceType } from "./obligations"
import {
  computeAnnualProjection,
  occurrenceAmount,
  occurrenceIndexOf,
  valueModeOf,
  type AmountMode,
  type IncomeOccurrence,
  type IncomeOccurrenceStatus,
  type IncomeRule,
  type IncomeRuleStatus,
  type IncomeStreamData,
  type Settlement,
} from "./income-streams"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

function auditDate(): string {
  return new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v
  return (v as { toNumber: () => number }).toNumber()
}

const WINDOW_MONTHS = 12

// ── Mappers ───────────────────────────────────────────────────────────────────

interface RuleRow {
  id: string
  recordId: string
  name: string
  recurrenceType: string
  startDate: Date
  expectedAmount: unknown
  currency: string
  status: string
  reducesPrincipal: boolean
  amountMode: string
  percentage: unknown
  adjustmentPct: unknown
  adjustEveryN: number | null
  settlement: string
  installmentCount: number | null
}

function mapRuleRow(r: RuleRow): IncomeRule {
  return {
    id: r.id,
    recordId: r.recordId,
    name: r.name,
    recurrenceType: r.recurrenceType as RecurrenceType,
    startDate: r.startDate.toISOString(),
    expectedAmount: toNumber(r.expectedAmount),
    currency: r.currency as Currency,
    status: r.status as IncomeRuleStatus,
    reducesPrincipal: r.reducesPrincipal,
    amountMode: r.amountMode as AmountMode,
    percentage: r.percentage != null ? toNumber(r.percentage) : undefined,
    adjustmentPct: r.adjustmentPct != null ? toNumber(r.adjustmentPct) : undefined,
    adjustEveryN: r.adjustEveryN ?? undefined,
    settlement: r.settlement as Settlement,
    installmentCount: r.installmentCount ?? undefined,
  }
}

interface OccurrenceRow {
  id: string
  ruleId: string
  recordId: string
  expectedDate: Date
  expectedAmount: unknown
  actualAmount: unknown
  currency: string
  status: string
  ingresoRecordId: string | null
  comment: string | null
  installmentNumber: number | null
  quantity: unknown
}

function mapOccurrenceRow(
  o: OccurrenceRow,
  rule?: { name: string; reducesPrincipal: boolean; settlement: string } | string,
  ingresoActive = false,
): IncomeOccurrence {
  const r = typeof rule === "string" || rule == null
    ? { name: "", reducesPrincipal: false, settlement: "CASH" }
    : rule
  return {
    id: o.id,
    ruleId: o.ruleId,
    recordId: o.recordId,
    ruleName: r.name,
    expectedDate: o.expectedDate.toISOString(),
    expectedAmount: toNumber(o.expectedAmount),
    actualAmount: o.actualAmount != null ? toNumber(o.actualAmount) : undefined,
    currency: o.currency as Currency,
    status: o.status as IncomeOccurrenceStatus,
    ingresoRecordId: o.ingresoRecordId ?? undefined,
    ingresoActive,
    comment: o.comment ?? undefined,
    reducesPrincipal: r.reducesPrincipal,
    settlement: r.settlement as Settlement,
    installmentNumber: o.installmentNumber ?? undefined,
    quantity: o.quantity != null ? toNumber(o.quantity) : undefined,
  }
}

// ── Ventana de ocurrencias ────────────────────────────────────────────────────

interface RuleShape {
  id: string
  recordId: string
  name: string
  recurrenceType: string
  startDate: Date
  expectedAmount: number
  currency: string
  status: string
  amountMode?: string
  percentage?: unknown
  adjustmentPct?: unknown
  adjustEveryN?: number | null
  installmentCount?: number | null
}

function amountInputOf(rule: RuleShape) {
  return {
    amountMode: (rule.amountMode ?? "FIXED") as AmountMode,
    expectedAmount: rule.expectedAmount,
    percentage: rule.percentage != null ? toNumber(rule.percentage) : undefined,
    adjustmentPct: rule.adjustmentPct != null ? toNumber(rule.adjustmentPct) : undefined,
    adjustEveryN: rule.adjustEveryN ?? undefined,
  }
}

/**
 * Genera las ocurrencias faltantes de una regla, cada una con su ingreso PENDING.
 * Espejo de ensurePaymentWindow() de obligaciones. Nunca duplica: omite las fechas
 * que ya tienen ocurrencia.
 *
 * - Cronograma finito (`installmentCount`): genera las N cuotas completas desde
 *   `startDate`, incluidas las ya vencidas — igual que las cuotas de una obligación.
 * - Recurrente indefinido: ventana móvil de 12 meses desde hoy.
 *
 * El monto de cada ocurrencia sale de `occurrenceAmount()`, que resuelve el modo
 * porcentual y el ajuste periódico según el índice dentro del cronograma.
 */
async function ensureIncomeWindow(userId: string, rule: RuleShape): Promise<void> {
  if (rule.status !== "ACTIVE") return

  const finite = rule.installmentCount != null && rule.installmentCount > 0

  const start = new Date(rule.startDate)
  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const pseudoRule = {
    recurrenceType: rule.recurrenceType as RecurrenceType,
    startDate: rule.startDate.toISOString(),
  } as ObligationRule

  // Finito: desde el inicio y hasta cubrir las N cuotas. Indefinido: 12 meses desde hoy.
  const from = finite ? start : now
  const windowEnd = finite
    ? addMonths(start, RECURRENCE_MONTHS_OF(rule.recurrenceType) * (rule.installmentCount ?? 0))
    : addMonths(now, WINDOW_MONTHS)

  const existing = await prisma.incomeOccurrence.findMany({
    where: { ruleId: rule.id },
    select: { expectedDate: true },
  })
  const existingMs = new Set(
    existing.map((o) => {
      const d = new Date(o.expectedDate)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }),
  )

  // Valor actual del activo — base del modo porcentual
  const asset = await prisma.record.findFirst({
    where: { id: rule.recordId, userId },
    select: { amount: true },
  })
  const assetAmount = asset ? toNumber(asset.amount) : 0
  const amountInput = amountInputOf(rule)

  const candidates = ruleDatesInWindow(pseudoRule, from, windowEnd).filter((d) => {
    d.setHours(0, 0, 0, 0)
    return !existingMs.has(d.getTime())
  })

  const entries = candidates
    .map((date) => {
      const index = occurrenceIndexOf(start, date, rule.recurrenceType as RecurrenceType)
      return { date, index }
    })
    // El cronograma finito no pasa de N cuotas
    .filter(({ index }) => !finite || index < (rule.installmentCount ?? 0))
    .map(({ date, index }) => ({
      occurrenceId: crypto.randomUUID(),
      ingresoId: crypto.randomUUID(),
      date,
      index,
      amount: occurrenceAmount(amountInput, index, assetAmount),
    }))

  if (entries.length === 0) return

  await prisma.record.createMany({
    data: entries.map(({ ingresoId, date, amount }) => ({
      id: ingresoId,
      type: "ingreso",
      name: `[Programado] ${rule.name}`,
      amount,
      currency: rule.currency,
      userId,
      status: "PENDING",
      linkedTo: rule.recordId,
      operationDate: date,
    })),
  })

  await prisma.incomeOccurrence.createMany({
    data: entries.map(({ occurrenceId, ingresoId, date, index, amount }) => ({
      id: occurrenceId,
      userId,
      ruleId: rule.id,
      recordId: rule.recordId,
      expectedDate: date,
      expectedAmount: amount,
      currency: rule.currency,
      status: "PENDING",
      ingresoRecordId: ingresoId,
      installmentNumber: finite ? index + 1 : null,
    })),
  })
}

function RECURRENCE_MONTHS_OF(recurrenceType: string): number {
  switch (recurrenceType) {
    case "QUARTERLY": return 3
    case "SEMI_ANNUAL": return 6
    case "ANNUAL": return 12
    default: return 1
  }
}

/**
 * Marca la regla COMPLETED cuando un cronograma finito agotó sus cuotas.
 * Espejo de recalcularObligation() al completar una obligación por cuotas.
 */
async function completeIfExhausted(ruleId: string, userId: string): Promise<void> {
  const rule = await prisma.incomeRule.findFirst({ where: { id: ruleId, userId } })
  if (!rule || rule.installmentCount == null || rule.installmentCount <= 0) return
  if (rule.status !== "ACTIVE") return

  const settled = await prisma.incomeOccurrence.count({
    where: { ruleId, userId, status: { in: ["COLLECTED", "REJECTED"] } },
  })
  if (settled >= rule.installmentCount) {
    await prisma.incomeRule.update({ where: { id: ruleId }, data: { status: "COMPLETED" } })
  }
}

/**
 * Si el activo vale su proyección anual (preset Salario), recalcula su `amount`.
 * Espejo de recalcularObligation() para obligaciones RECURRING.
 *
 * Solo actúa con metadata.valueMode="PROJECTION": nunca pisa el valor de mercado
 * de un activo que el usuario administra a mano.
 */
async function recalcularIncomeStream(recordId: string, userId: string): Promise<void> {
  const asset = await prisma.record.findFirst({
    where: { id: recordId, userId, type: "activo" },
    select: { currency: true, metadata: true },
  })
  if (!asset) return
  if (valueModeOf(asset.metadata) !== "PROJECTION") return

  const [rules, occurrences] = await Promise.all([
    prisma.incomeRule.findMany({ where: { recordId, userId } }),
    prisma.incomeOccurrence.findMany({ where: { recordId, userId } }),
  ])

  const projection = computeAnnualProjection(
    rules.map(mapRuleRow),
    occurrences.map((o) => mapOccurrenceRow(o)),
  )
  const amount = projection[asset.currency as Currency] ?? 0

  await prisma.record.update({ where: { id: recordId, userId }, data: { amount } })
}

/**
 * Extiende la ventana de todas las reglas activas del usuario de la sesión.
 * Lo usa el Corte Mensual. No recibe userId a propósito: un Server Action que
 * aceptara un userId del cliente permitiría operar sobre datos ajenos.
 */
export async function refreshIncomeWindows(): Promise<void> {
  const userId = await getUserId()
  const rules = await prisma.incomeRule.findMany({ where: { userId, status: "ACTIVE" } })
  for (const r of rules) {
    await ensureIncomeWindow(userId, { ...r, expectedAmount: toNumber(r.expectedAmount) })
  }
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadIncomeRules(recordId: string): Promise<IncomeStreamData> {
  const userId = await getUserId()

  const rules = await prisma.incomeRule.findMany({
    where: { userId, recordId },
    orderBy: { createdAt: "asc" },
  })

  const occurrences = await prisma.incomeOccurrence.findMany({
    where: { userId, recordId },
    orderBy: { expectedDate: "asc" },
    include: { rule: { select: { name: true, reducesPrincipal: true, settlement: true } } },
  })

  // Saber si el corte ya activó el ingreso de cada ocurrencia
  const ingresoIds = occurrences.map((o) => o.ingresoRecordId).filter((v): v is string => !!v)
  const activeIngresos = ingresoIds.length
    ? await prisma.record.findMany({
        where: { id: { in: ingresoIds }, userId, status: "ACTIVE" },
        select: { id: true },
      })
    : []
  const activeSet = new Set(activeIngresos.map((r) => r.id))

  // Avance de los cronogramas finitos
  const settledByRule = new Map<string, number>()
  for (const o of occurrences) {
    if (o.status === "COLLECTED" || o.status === "REJECTED") {
      settledByRule.set(o.ruleId, (settledByRule.get(o.ruleId) ?? 0) + 1)
    }
  }

  const mappedRules: IncomeRule[] = rules.map((r) => ({
    ...mapRuleRow(r),
    settledCount: settledByRule.get(r.id) ?? 0,
  }))

  const mappedOccurrences: IncomeOccurrence[] = occurrences.map((o) =>
    mapOccurrenceRow(o, o.rule, o.ingresoRecordId ? activeSet.has(o.ingresoRecordId) : false),
  )

  const asset = await prisma.record.findFirst({
    where: { id: recordId, userId },
    select: { metadata: true },
  })

  return {
    rules: mappedRules,
    occurrences: mappedOccurrences,
    annualProjection: computeAnnualProjection(mappedRules, mappedOccurrences),
    valueIsProjection: valueModeOf(asset?.metadata) === "PROJECTION",
  }
}

/** Cambia el modo de valuación del activo y recalcula si corresponde. */
export async function setIncomeStreamValueMode(
  recordId: string,
  mode: "PROJECTION" | "MANUAL",
): Promise<void> {
  const userId = await getUserId()
  const asset = await prisma.record.findFirst({
    where: { id: recordId, userId, type: "activo" },
    select: { metadata: true },
  })
  if (!asset) throw new Error("Activo no encontrado")

  const meta = (asset.metadata as Record<string, unknown>) ?? {}
  await prisma.record.update({
    where: { id: recordId, userId },
    data: { metadata: { ...meta, valueMode: mode } },
  })
  if (mode === "PROJECTION") await recalcularIncomeStream(recordId, userId)
}

// ── CRUD de reglas ────────────────────────────────────────────────────────────

export interface IncomeRuleInput {
  name: string
  recurrenceType: RecurrenceType
  startDate: string
  expectedAmount: number
  currency: Currency
  reducesPrincipal: boolean
  amountMode?: AmountMode
  percentage?: number
  adjustmentPct?: number
  adjustEveryN?: number
  settlement?: Settlement
  installmentCount?: number
}

/** Valida la coherencia de los campos según el modo elegido. */
function validateRuleInput(data: IncomeRuleInput): void {
  const mode = data.amountMode ?? "FIXED"
  if (mode === "PERCENTAGE") {
    if (!(data.percentage && data.percentage > 0)) {
      throw new Error("El porcentaje debe ser mayor a 0")
    }
  } else if (!(data.expectedAmount > 0)) {
    throw new Error("El monto esperado debe ser mayor a 0")
  }
  if (data.adjustmentPct != null && data.adjustEveryN != null && data.adjustEveryN <= 0) {
    throw new Error("El ajuste debe aplicarse cada 1 o más ocurrencias")
  }
  if (data.installmentCount != null && data.installmentCount <= 0) {
    throw new Error("La cantidad de cuotas debe ser mayor a 0")
  }
}

function ruleFields(data: IncomeRuleInput) {
  const mode = data.amountMode ?? "FIXED"
  return {
    name: data.name,
    recurrenceType: data.recurrenceType,
    startDate: new Date(data.startDate),
    // En modo porcentual el monto base no se usa; se guarda 0 para no confundir
    expectedAmount: mode === "PERCENTAGE" ? 0 : data.expectedAmount,
    currency: data.currency,
    reducesPrincipal: data.reducesPrincipal,
    amountMode: mode,
    percentage: mode === "PERCENTAGE" ? (data.percentage ?? 0) : null,
    // El ajuste solo tiene sentido en monto fijo: el porcentual ya sigue al activo
    adjustmentPct: mode === "FIXED" ? (data.adjustmentPct ?? null) : null,
    adjustEveryN: mode === "FIXED" ? (data.adjustEveryN ?? null) : null,
    settlement: data.settlement ?? "CASH",
    installmentCount: data.installmentCount ?? null,
  }
}

export async function createIncomeRule(
  recordId: string,
  data: IncomeRuleInput,
): Promise<string> {
  const userId = await getUserId()

  const asset = await prisma.record.findFirst({
    where: { id: recordId, userId, type: "activo" },
    select: { id: true, name: true },
  })
  if (!asset) throw new Error("Activo no encontrado")
  validateRuleInput(data)

  const fields = ruleFields(data)
  const ruleId = crypto.randomUUID()
  await prisma.incomeRule.create({
    data: { id: ruleId, userId, recordId, status: "ACTIVE", ...fields },
  })

  await ensureIncomeWindow(userId, {
    id: ruleId,
    recordId,
    status: "ACTIVE",
    ...fields,
  })
  await recalcularIncomeStream(recordId, userId)

  await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      date: auditDate(),
      action: "creado",
      recordType: "activo",
      recordName: asset.name,
      detail: `Ingreso recurrente "${data.name}": ${data.expectedAmount} ${data.currency}`,
      userId,
      recordId,
    },
  })

  return ruleId
}

/**
 * RB-F04: regenera las ocurrencias PENDING cuyo ingreso siga PENDING.
 * Las ya cobradas, rechazadas, o cuyo ingreso el corte ya activó, no se tocan.
 */
export async function updateIncomeRule(
  ruleId: string,
  data: IncomeRuleInput,
): Promise<void> {
  const userId = await getUserId()
  const rule = await prisma.incomeRule.findFirst({ where: { id: ruleId, userId } })
  if (!rule) throw new Error("Regla no encontrada")
  validateRuleInput(data)

  const fields = ruleFields(data)
  await prisma.incomeRule.update({ where: { id: ruleId }, data: fields })

  // Ocurrencias regenerables: PENDING con ingreso todavía PENDING
  const pending = await prisma.incomeOccurrence.findMany({
    where: { ruleId, userId, status: "PENDING" },
    select: { id: true, ingresoRecordId: true },
  })
  const ingresoIds = pending.map((o) => o.ingresoRecordId).filter((v): v is string => !!v)
  const stillPending = ingresoIds.length
    ? await prisma.record.findMany({
        where: { id: { in: ingresoIds }, userId, status: "PENDING" },
        select: { id: true },
      })
    : []
  const stillPendingSet = new Set(stillPending.map((r) => r.id))

  const regenerable = pending.filter(
    (o) => o.ingresoRecordId && stillPendingSet.has(o.ingresoRecordId),
  )

  if (regenerable.length > 0) {
    await prisma.incomeOccurrence.deleteMany({
      where: { id: { in: regenerable.map((o) => o.id) } },
    })
    await prisma.record.deleteMany({
      where: {
        id: { in: regenerable.map((o) => o.ingresoRecordId!) },
        userId,
        status: "PENDING",
      },
    })
  }

  await ensureIncomeWindow(userId, {
    id: ruleId,
    recordId: rule.recordId,
    status: rule.status,
    ...fields,
  })
  await recalcularIncomeStream(rule.recordId, userId)
}

export async function pauseIncomeRule(ruleId: string): Promise<void> {
  const userId = await getUserId()
  const rule = await prisma.incomeRule.update({
    where: { id: ruleId, userId },
    data: { status: "PAUSED" },
  })
  await recalcularIncomeStream(rule.recordId, userId)
}

export async function resumeIncomeRule(ruleId: string): Promise<void> {
  const userId = await getUserId()
  const rule = await prisma.incomeRule.update({
    where: { id: ruleId, userId },
    data: { status: "ACTIVE" },
  })
  await ensureIncomeWindow(userId, { ...rule, expectedAmount: toNumber(rule.expectedAmount) })
  await recalcularIncomeStream(rule.recordId, userId)
}

/** RB-F09: cancela lo pendiente; los cobros ya confirmados sobreviven. */
export async function deleteIncomeRule(ruleId: string): Promise<void> {
  const userId = await getUserId()
  const rule = await prisma.incomeRule.findFirst({ where: { id: ruleId, userId } })
  if (!rule) return

  const pending = await prisma.incomeOccurrence.findMany({
    where: { ruleId, userId, status: "PENDING" },
    select: { ingresoRecordId: true },
  })
  const ingresoIds = pending.map((o) => o.ingresoRecordId).filter((v): v is string => !!v)

  if (ingresoIds.length > 0) {
    // RB-F10: solo los que siguen PENDING; nunca toca ACTIVE ni HISTORICAL
    await prisma.record.updateMany({
      where: { id: { in: ingresoIds }, userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    })
  }

  await prisma.incomeOccurrence.updateMany({
    where: { ruleId, userId, status: "PENDING" },
    data: { status: "REJECTED" },
  })

  await prisma.incomeRule.delete({ where: { id: ruleId } })
}

// ── Cobro ─────────────────────────────────────────────────────────────────────

export async function collectIncomeOccurrence(
  occurrenceId: string,
  actualAmount: number,
  comment?: string,
  /** Unidades recibidas cuando la regla liquida en especie (staking) */
  quantity?: number,
): Promise<void> {
  const userId = await getUserId()

  const occ = await prisma.incomeOccurrence.findFirst({
    where: { id: occurrenceId, userId, status: "PENDING" },
    include: {
      rule: true,
      record: {
        select: { id: true, name: true, amount: true, parentId: true, currentQty: true },
      },
    },
  })
  if (!occ) throw new Error("Cobro no encontrado o ya procesado")
  if (!(actualAmount > 0)) throw new Error("El monto cobrado debe ser mayor a 0")

  const currency = occ.currency as Currency
  const ruleName = occ.rule.name
  const assetName = occ.record.name
  const inKind = occ.rule.settlement === "IN_KIND"

  // 1. Ingreso al monto real
  let ingresoId = occ.ingresoRecordId
  if (ingresoId) {
    await prisma.record.update({
      where: { id: ingresoId, userId },
      data: { name: ruleName, amount: actualAmount, currency, status: "ACTIVE" },
    })
  } else {
    ingresoId = crypto.randomUUID()
    await prisma.record.create({
      data: {
        id: ingresoId,
        type: "ingreso",
        name: ruleName,
        amount: actualAmount,
        currency,
        userId,
        status: "ACTIVE",
        linkedTo: occ.recordId,
        operationDate: occ.expectedDate,
      },
    })
  }

  // 2. Ocurrencia cobrada
  await prisma.incomeOccurrence.update({
    where: { id: occurrenceId },
    data: {
      status: "COLLECTED",
      actualAmount,
      ingresoRecordId: ingresoId,
      comment: comment ?? null,
      quantity: inKind && quantity != null ? quantity : null,
    },
  })

  // 3. Efecto sobre el activo
  if (occ.rule.reducesPrincipal) {
    // Cuota de capital: el activo baja (RB-F06: piso en 0)
    const current = toNumber(occ.record.amount)
    const next = Math.max(0, current - actualAmount)

    await prisma.record.update({ where: { id: occ.recordId, userId }, data: { amount: next } })
    await prisma.financialMovement.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        recordId: occ.recordId,
        movementType: "EXTRACT",
        amount: current - next,
        currency,
        operationDate: new Date(),
        description: `Cobro de ${ruleName}: ${assetName}`,
        metadata: { relatedIngresoId: ingresoId } as object,
      },
    })

    if (occ.record.parentId) await recalcularGrupo(occ.record.parentId, userId)
  } else if (inKind) {
    // Liquidación en especie (staking): no entra efectivo, crece el propio activo
    const current = toNumber(occ.record.amount)
    const currentQty = occ.record.currentQty != null ? toNumber(occ.record.currentQty) : null

    await prisma.record.update({
      where: { id: occ.recordId, userId },
      data: {
        amount: current + actualAmount,
        ...(quantity != null && quantity > 0
          ? { currentQty: (currentQty ?? 0) + quantity }
          : {}),
      },
    })
    await prisma.financialMovement.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        recordId: occ.recordId,
        movementType: "DIVIDEND",
        amount: actualAmount,
        quantity: quantity != null && quantity > 0 ? quantity : null,
        currency,
        operationDate: new Date(),
        description: `Cobro en especie de ${ruleName}: ${assetName}`,
        metadata: { relatedIngresoId: ingresoId } as object,
      },
    })

    if (occ.record.parentId) await recalcularGrupo(occ.record.parentId, userId)
  }

  // 4. Asiento (RB-F07 / RB-F14)
  //    capital  → efectivo / activos  (conversión de activo)
  //    especie  → activos / ingresos  (renta que no pasa por caja)
  //    efectivo → efectivo / ingresos (renta)
  await createJournalEntry(userId, {
    description: occ.rule.reducesPrincipal
      ? `Cobro de capital: ${ruleName} — ${assetName}`
      : inKind
        ? `Cobro en especie: ${ruleName} — ${assetName}`
        : `Cobro de ${ruleName} — ${assetName}`,
    currency,
    amount: actualAmount,
    debitAccount: inKind && !occ.rule.reducesPrincipal ? "activos" : "efectivo",
    creditAccount: occ.rule.reducesPrincipal ? "activos" : "ingresos",
    sourceEntityId: occ.recordId,
    targetEntityId: ingresoId,
    reference: occurrenceId,
  })

  await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      date: auditDate(),
      action: "creado",
      recordType: "ingreso",
      recordName: ruleName,
      detail:
        `Cobro de "${ruleName}" (${assetName}): ${actualAmount} ${currency}` +
        (Math.abs(actualAmount - toNumber(occ.expectedAmount)) > 0.001
          ? ` — esperado ${toNumber(occ.expectedAmount)}`
          : ""),
      userId,
      recordId: ingresoId,
    },
  })

  // 5. La ventana rueda hacia adelante y el cronograma finito puede cerrarse
  await ensureIncomeWindow(userId, {
    ...occ.rule,
    expectedAmount: toNumber(occ.rule.expectedAmount),
  })
  await completeIfExhausted(occ.ruleId, userId)
  await recalcularIncomeStream(occ.recordId, userId)
}

export async function rejectIncomeOccurrence(occurrenceId: string): Promise<void> {
  const userId = await getUserId()

  const occ = await prisma.incomeOccurrence.findFirst({
    where: { id: occurrenceId, userId, status: "PENDING" },
    select: { id: true, ruleId: true, recordId: true, ingresoRecordId: true },
  })
  if (!occ) throw new Error("Cobro no encontrado o ya procesado")

  if (occ.ingresoRecordId) {
    await prisma.record.updateMany({
      where: { id: occ.ingresoRecordId, userId, status: { in: ["PENDING", "ACTIVE"] } },
      data: { status: "CANCELLED" },
    })
  }

  await prisma.incomeOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "REJECTED" },
  })

  await completeIfExhausted(occ.ruleId, userId)
  await recalcularIncomeStream(occ.recordId, userId)
}

// ── Helper compartido ─────────────────────────────────────────────────────────

/** Recalcula el total de un grupo tras cambiar el valor de un hijo. */
async function recalcularGrupo(parentId: string, userId: string): Promise<void> {
  const children = await prisma.record.findMany({
    where: { parentId, userId, deletedAt: null },
    select: { amount: true, currency: true },
  })
  const group = await prisma.record.findFirst({
    where: { id: parentId, userId },
    select: { currency: true, metadata: true },
  })
  if (!group) return

  const breakdown: Record<string, number> = {}
  let totalSame = 0
  for (const c of children) {
    const amt = toNumber(c.amount)
    breakdown[c.currency] = (breakdown[c.currency] ?? 0) + amt
    if (c.currency === group.currency) totalSame += amt
  }
  const meta = (group.metadata as Record<string, unknown>) ?? {}
  await prisma.record.update({
    where: { id: parentId, userId },
    data: { amount: totalSame, metadata: { ...meta, currencyBreakdown: breakdown } },
  })
}
