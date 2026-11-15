"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
import { createJournalEntry } from "./journal-actions"
import {
  type Obligation,
  type ObligationInstallment,
  type ObligationPayment,
  type ObligationRule,
  type ObligationStatus,
  type ObligationType,
  type InstallmentStatus,
  type PaymentStatus,
  type PaymentType,
  type ObligationRecurrence,
  OBLIGATION_OCCURRENCES_PER_YEAR,
  RECURRENCE_MONTHS,
  addMonths,
  ruleDatesInWindow,
} from "./obligations"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapRule(r: {
  id: string
  obligationId: string
  name: string
  recurrenceType: string
  startDate: Date
  expectedAmount: { toNumber: () => number } | number
  currency: string
  status: string
}): ObligationRule {
  return {
    id: r.id,
    obligationId: r.obligationId,
    name: r.name,
    recurrenceType: r.recurrenceType as ObligationRecurrence,
    startDate: r.startDate.toISOString(),
    expectedAmount: typeof r.expectedAmount === "number" ? r.expectedAmount : r.expectedAmount.toNumber(),
    currency: r.currency as Currency,
    status: r.status as "ACTIVE" | "PAUSED",
  }
}

function mapInstallment(i: {
  id: string
  obligationId: string
  installmentNumber: number
  dueDate: Date
  expectedAmount: { toNumber: () => number } | number
  status: string
  gastoRecordId: string | null
}): ObligationInstallment {
  return {
    id: i.id,
    obligationId: i.obligationId,
    installmentNumber: i.installmentNumber,
    dueDate: i.dueDate.toISOString(),
    expectedAmount: typeof i.expectedAmount === "number" ? i.expectedAmount : i.expectedAmount.toNumber(),
    status: i.status as InstallmentStatus,
    gastoRecordId: i.gastoRecordId ?? undefined,
  }
}

function mapPayment(
  p: {
    id: string
    obligationId: string
    ruleId: string | null
    paymentType: string
    expectedDate: Date | null
    expectedAmount: { toNumber: () => number } | number | null
    currency: string
    gastoRecordId: string | null
    status: string
    comment: string | null
    createdAt: Date
  },
  gastoAmounts: Map<string, number> = new Map(),
): ObligationPayment {
  return {
    id: p.id,
    obligationId: p.obligationId,
    ruleId: p.ruleId ?? undefined,
    paymentType: p.paymentType as PaymentType,
    expectedDate: p.expectedDate?.toISOString(),
    expectedAmount: p.expectedAmount != null
      ? typeof p.expectedAmount === "number" ? p.expectedAmount : p.expectedAmount.toNumber()
      : undefined,
    currency: p.currency as Currency,
    gastoRecordId: p.gastoRecordId ?? undefined,
    status: p.status as PaymentStatus,
    comment: p.comment ?? undefined,
    createdAt: p.createdAt.toISOString(),
    actualAmount: p.gastoRecordId ? gastoAmounts.get(p.gastoRecordId) : undefined,
  }
}

function mapObligation(
  o: {
    id: string
    userId: string
    obligationType: string
    name: string
    description: string | null
    currency: string
    amount: { toNumber: () => number } | number
    status: string
    nextDueDate: Date | null
    createdAt: Date
    groupId?: string | null
    group?: { name: string } | null
    rules: Parameters<typeof mapRule>[0][]
    installments: Parameters<typeof mapInstallment>[0][]
    payments: Parameters<typeof mapPayment>[0][]
  },
  gastoAmounts: Map<string, number> = new Map(),
): Obligation {
  return {
    ...(o.groupId ? { groupId: o.groupId, groupName: o.group?.name } : {}),
    id: o.id,
    userId: o.userId,
    obligationType: o.obligationType as ObligationType,
    name: o.name,
    description: o.description ?? undefined,
    currency: o.currency as Currency,
    amount: typeof o.amount === "number" ? o.amount : o.amount.toNumber(),
    status: o.status as ObligationStatus,
    nextDueDate: o.nextDueDate?.toISOString(),
    createdAt: o.createdAt.toISOString(),
    rules: o.rules.map(mapRule),
    installments: o.installments.map(mapInstallment),
    payments: o.payments.map((p) => mapPayment(p, gastoAmounts)),
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

async function recalcularObligation(obligationId: string, userId: string): Promise<void> {
  const o = await prisma.obligation.findFirst({
    where: { id: obligationId, userId },
    include: {
      rules: true,
      installments: true,
      payments: { where: { status: "PENDING" }, orderBy: { expectedDate: "asc" } },
    },
  })
  if (!o) return

  let amount = 0
  let nextDueDate: Date | null = null
  const metadata: Record<string, unknown> = (o.metadata as Record<string, unknown>) ?? {}

  if (o.obligationType === "RECURRING") {
    const breakdown: Record<string, number> = {}
    for (const rule of o.rules) {
      if (rule.status !== "ACTIVE") continue
      const perYear = rule.expectedAmount.toNumber() * OBLIGATION_OCCURRENCES_PER_YEAR[rule.recurrenceType as ObligationRecurrence]
      breakdown[rule.currency] = (breakdown[rule.currency] ?? 0) + perYear
      if (rule.currency === o.currency) amount += perYear
    }
    metadata.currencyBreakdown = breakdown
    // nextDueDate = earliest pending payment
    if (o.payments.length > 0 && o.payments[0].expectedDate) {
      nextDueDate = o.payments[0].expectedDate
    }
  } else if (o.obligationType === "INSTALLMENT") {
    const pending = o.installments.filter(
      (i) => i.status === "PENDING" || i.status === "OVERDUE",
    )
    amount = pending.reduce((s, i) => s + i.expectedAmount.toNumber(), 0)
    const earliest = pending.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]
    if (earliest) nextDueDate = earliest.dueDate
    // Check if all paid
    const allDone = o.installments.every((i) => i.status === "PAID" || i.status === "REJECTED")
    if (allDone && o.installments.length > 0) {
      await prisma.obligation.update({
        where: { id: obligationId, userId },
        data: { amount, nextDueDate, status: "COMPLETED", metadata: metadata as object },
      })
      return
    }
  }
  // FIXED: amount is managed per-payment; no auto-recalc except nextDueDate

  await prisma.obligation.update({
    where: { id: obligationId, userId },
    data: {
      ...(o.obligationType !== "FIXED" ? { amount } : {}),
      nextDueDate,
      metadata: metadata as object,
    },
  })
}

/**
 * Generate upcoming payment entries for a rule in the 12-month window.
 * Skips dates that already have a payment entry (PENDING or otherwise).
 */
async function ensurePaymentWindow(
  obligationId: string,
  userId: string,
  ruleId: string,
  rule: { recurrenceType: string; startDate: Date; expectedAmount: number; currency: string },
): Promise<void> {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const windowEnd = addMonths(now, 12)

  // Existing payment dates for this rule
  const existing = await prisma.obligationPayment.findMany({
    where: { ruleId, obligationId },
    select: { expectedDate: true },
  })
  const existingMs = new Set(
    existing
      .filter((p) => p.expectedDate)
      .map((p) => {
        const d = new Date(p.expectedDate!)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      }),
  )

  const pseudoRule = {
    recurrenceType: rule.recurrenceType as ObligationRecurrence,
    startDate: rule.startDate.toISOString(),
  } as ObligationRule

  const dates = ruleDatesInWindow(pseudoRule, now, windowEnd)
  const toCreate = dates.filter((d) => {
    d.setHours(0, 0, 0, 0)
    return !existingMs.has(d.getTime())
  })

  if (toCreate.length === 0) return

  // Fetch obligation name for gasto names
  const obligation = await prisma.obligation.findUnique({
    where: { id: obligationId },
    select: { name: true },
  })
  const obligationName = obligation?.name ?? "Obligación"

  const paymentEntries = toCreate.map((d) => ({
    paymentId: crypto.randomUUID(),
    gastoId: crypto.randomUUID(),
    date: d,
  }))

  await prisma.obligationPayment.createMany({
    data: paymentEntries.map(({ paymentId, gastoId, date }) => ({
      id: paymentId,
      obligationId,
      userId,
      ruleId,
      paymentType: "PAYMENT",
      expectedDate: date,
      expectedAmount: rule.expectedAmount,
      currency: rule.currency,
      status: "PENDING",
      gastoRecordId: gastoId,
    })),
  })

  await prisma.record.createMany({
    data: paymentEntries.map(({ gastoId, date }) => ({
      id: gastoId,
      type: "gasto",
      name: `[Programado] ${obligationName}`,
      amount: rule.expectedAmount,
      currency: rule.currency,
      userId,
      status: "PENDING",
      operationDate: date,
    })),
  })
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadObligations(): Promise<Obligation[]> {
  const userId = await getUserId()
  const obligations = await prisma.obligation.findMany({
    where: { userId },
    include: {
      group: { select: { name: true } },
      rules: { orderBy: { startDate: "asc" } },
      installments: { orderBy: { installmentNumber: "asc" } },
      payments: { orderBy: { expectedDate: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  })
  return obligations.map((o) => mapObligation(o))
}

// ── Grupos (solo visuales: agrupan en la lista y en el dashboard) ────────────

export async function createObligationGroup(name: string, obligationIds: string[]): Promise<string> {
  const userId = await getUserId()
  if (!name.trim()) throw new Error("El grupo necesita un nombre")
  const group = await prisma.group.create({
    data: { userId, name: name.trim(), groupType: "LIABILITY" },
  })
  await prisma.obligation.updateMany({
    where: { id: { in: obligationIds }, userId },
    data: { groupId: group.id },
  })
  return group.id
}

export async function assignObligationsToGroup(groupId: string, obligationIds: string[]): Promise<void> {
  const userId = await getUserId()
  await prisma.group.findFirstOrThrow({ where: { id: groupId, userId, groupType: "LIABILITY" } })
  await prisma.obligation.updateMany({
    where: { id: { in: obligationIds }, userId },
    data: { groupId },
  })
}

/** Saca una obligación de su grupo; un grupo que queda vacío se borra. */
export async function removeObligationFromGroup(obligationId: string): Promise<void> {
  const userId = await getUserId()
  const o = await prisma.obligation.findFirst({ where: { id: obligationId, userId }, select: { groupId: true } })
  if (!o?.groupId) return
  await prisma.obligation.update({ where: { id: obligationId }, data: { groupId: null } })
  const left = await prisma.obligation.count({ where: { groupId: o.groupId, userId } })
  if (left === 0) await prisma.group.delete({ where: { id: o.groupId, userId } })
}

/** Desagrupa: las obligaciones quedan sueltas y el grupo se borra. */
export async function ungroupObligations(groupId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.obligation.updateMany({ where: { groupId, userId }, data: { groupId: null } })
  await prisma.group.deleteMany({ where: { id: groupId, userId, groupType: "LIABILITY" } })
}

export async function loadObligation(id: string): Promise<Obligation | null> {
  const userId = await getUserId()
  const o = await prisma.obligation.findFirst({
    where: { id, userId },
    include: {
      group: { select: { name: true } },
      rules: { orderBy: { startDate: "asc" } },
      installments: { orderBy: { installmentNumber: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!o) return null

  // Collect all gastoRecordIds to fetch actual amounts
  const gastoIds = [
    ...o.payments.filter((p) => p.gastoRecordId).map((p) => p.gastoRecordId!),
    ...o.installments.filter((i) => i.gastoRecordId).map((i) => i.gastoRecordId!),
  ]

  let gastoAmounts = new Map<string, number>()
  if (gastoIds.length > 0) {
    const gastos = await prisma.record.findMany({
      where: { id: { in: gastoIds }, userId, deletedAt: null },
      select: { id: true, amount: true },
    })
    gastoAmounts = new Map(gastos.map((g) => [g.id, g.amount.toNumber()]))
  }

  return mapObligation(o, gastoAmounts)
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createObligation(data: {
  name: string
  description?: string
  obligationType: ObligationType
  currency: Currency
  // FIXED
  fixedAmount?: number
  // RECURRING: rules added separately via addObligationRule
  // INSTALLMENT
  installmentCount?: number
  installmentAmount?: number
  firstDueDate?: string
}): Promise<string> {
  const userId = await getUserId()
  const id = crypto.randomUUID()

  await prisma.obligation.create({
    data: {
      id,
      userId,
      obligationType: data.obligationType,
      name: data.name,
      description: data.description ?? null,
      currency: data.currency,
      amount: 0,
      status: "ACTIVE",
    },
  })

  if (data.obligationType === "FIXED" && data.fixedAmount) {
    await prisma.obligation.update({
      where: { id, userId },
      data: { amount: data.fixedAmount },
    })
  }

  if (
    data.obligationType === "INSTALLMENT" &&
    data.installmentCount &&
    data.installmentAmount &&
    data.firstDueDate
  ) {
    let dueDate = new Date(data.firstDueDate)
    const installments = []
    const gastoRecords = []

    for (let i = 1; i <= data.installmentCount; i++) {
      const gastoId = crypto.randomUUID()
      installments.push({
        id: crypto.randomUUID(),
        obligationId: id,
        installmentNumber: i,
        dueDate: new Date(dueDate),
        expectedAmount: data.installmentAmount,
        status: "PENDING",
        gastoRecordId: gastoId,
      })
      gastoRecords.push({
        id: gastoId,
        type: "gasto",
        name: `Cuota ${i} — ${data.name}`,
        amount: data.installmentAmount,
        currency: data.currency,
        userId,
        status: "PENDING",
        operationDate: new Date(dueDate),
      })
      dueDate = addMonths(dueDate, 1)
    }

    await prisma.obligationInstallment.createMany({ data: installments })
    await prisma.record.createMany({ data: gastoRecords })
    await prisma.obligation.update({
      where: { id, userId },
      data: {
        amount: data.installmentCount * data.installmentAmount,
        nextDueDate: new Date(data.firstDueDate),
      },
    })
  }

  return id
}

// ── Rules (RECURRING) ─────────────────────────────────────────────────────────

export async function addObligationRule(
  obligationId: string,
  data: {
    name: string
    recurrenceType: ObligationRecurrence
    startDate: string
    expectedAmount: number
    currency: Currency
  },
): Promise<string> {
  const userId = await getUserId()
  const ruleId = crypto.randomUUID()

  await prisma.obligationRule.create({
    data: {
      id: ruleId,
      obligationId,
      name: data.name,
      recurrenceType: data.recurrenceType,
      startDate: new Date(data.startDate),
      expectedAmount: data.expectedAmount,
      currency: data.currency,
      status: "ACTIVE",
    },
  })

  await ensurePaymentWindow(obligationId, userId, ruleId, {
    recurrenceType: data.recurrenceType,
    startDate: new Date(data.startDate),
    expectedAmount: data.expectedAmount,
    currency: data.currency,
  })

  await recalcularObligation(obligationId, userId)
  return ruleId
}

/**
 * Corrige la fecha de inicio de una regla y regenera sus pagos futuros.
 * Solo se regeneran los pagos cuyo gasto todavía no entró al dashboard (PENDING):
 * lo que el corte ya trajo, o ya se pagó, no se mueve debajo de los pies del usuario.
 */
export async function updateObligationRuleStartDate(
  ruleId: string,
  obligationId: string,
  startDate: string,
): Promise<void> {
  const userId = await getUserId()
  const rule = await prisma.obligationRule.findFirst({
    where: { id: ruleId, obligationId, obligation: { userId } },
  })
  if (!rule) throw new Error("Regla no encontrada")
  const newStart = new Date(startDate)
  if (Number.isNaN(newStart.getTime())) throw new Error("Fecha inválida")

  await prisma.obligationRule.update({ where: { id: ruleId }, data: { startDate: newStart } })

  const pending = await prisma.obligationPayment.findMany({
    where: { ruleId, obligationId, userId, status: "PENDING" },
    select: { id: true, gastoRecordId: true },
  })
  const gastoIds = pending.map((p) => p.gastoRecordId).filter((v): v is string => !!v)
  const stillPending = gastoIds.length
    ? await prisma.record.findMany({
        where: { id: { in: gastoIds }, userId, status: "PENDING" },
        select: { id: true },
      })
    : []
  const stillPendingSet = new Set(stillPending.map((g) => g.id))
  const regenerable = pending.filter((p) => !p.gastoRecordId || stillPendingSet.has(p.gastoRecordId))

  if (regenerable.length > 0) {
    await prisma.obligationPayment.deleteMany({ where: { id: { in: regenerable.map((p) => p.id) } } })
    const regenerableGastos = regenerable.map((p) => p.gastoRecordId).filter((v): v is string => !!v)
    if (regenerableGastos.length > 0) {
      await prisma.record.deleteMany({ where: { id: { in: regenerableGastos }, userId, status: "PENDING" } })
    }
  }

  if (rule.status === "ACTIVE") {
    await ensurePaymentWindow(obligationId, userId, ruleId, {
      recurrenceType: rule.recurrenceType,
      startDate: newStart,
      expectedAmount: rule.expectedAmount.toNumber(),
      currency: rule.currency,
    })
  }
  await recalcularObligation(obligationId, userId)
}

/**
 * Corrige la fecha de la primera cuota: las cuotas que todavía no entraron al
 * dashboard se re-fechan (cuota N = primera + N-1 meses). Las pagadas y las que
 * ya están en el dashboard conservan su fecha.
 */
export async function updateInstallmentsFirstDueDate(
  obligationId: string,
  firstDueDate: string,
): Promise<void> {
  const userId = await getUserId()
  const obligation = await prisma.obligation.findFirst({
    where: { id: obligationId, userId, obligationType: "INSTALLMENT" },
    include: { installments: true },
  })
  if (!obligation) throw new Error("Obligación no encontrada")
  const first = new Date(firstDueDate)
  if (Number.isNaN(first.getTime())) throw new Error("Fecha inválida")

  const open = obligation.installments.filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
  const gastoIds = open.map((i) => i.gastoRecordId).filter((v): v is string => !!v)
  const stillPending = gastoIds.length
    ? await prisma.record.findMany({
        where: { id: { in: gastoIds }, userId, status: "PENDING" },
        select: { id: true },
      })
    : []
  const stillPendingSet = new Set(stillPending.map((g) => g.id))

  const movable = open.filter((i) => !i.gastoRecordId || stillPendingSet.has(i.gastoRecordId))
  await prisma.$transaction(
    movable.flatMap((i) => {
      const dueDate = addMonths(first, i.installmentNumber - 1)
      return [
        prisma.obligationInstallment.update({ where: { id: i.id }, data: { dueDate } }),
        ...(i.gastoRecordId
          ? [prisma.record.updateMany({ where: { id: i.gastoRecordId, userId }, data: { operationDate: dueDate } })]
          : []),
      ]
    }),
  )
  await recalcularObligation(obligationId, userId)
}

export async function deleteObligationRule(ruleId: string, obligationId: string): Promise<void> {
  const userId = await getUserId()
  // Cancel pending payments from this rule
  await prisma.obligationPayment.updateMany({
    where: { ruleId, obligationId, status: "PENDING" },
    data: { status: "REJECTED" },
  })
  await prisma.obligationRule.delete({ where: { id: ruleId } })
  await recalcularObligation(obligationId, userId)
}

export async function pauseObligationRule(ruleId: string, obligationId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.obligationRule.update({ where: { id: ruleId }, data: { status: "PAUSED" } })
  await recalcularObligation(obligationId, userId)
}

export async function resumeObligationRule(ruleId: string, obligationId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.obligationRule.update({ where: { id: ruleId }, data: { status: "ACTIVE" } })
  await ensurePaymentWindow(obligationId, userId, ruleId, {
    recurrenceType: (await prisma.obligationRule.findUnique({ where: { id: ruleId }, select: { recurrenceType: true, startDate: true, expectedAmount: true, currency: true } }))!.recurrenceType,
    startDate: (await prisma.obligationRule.findUnique({ where: { id: ruleId }, select: { startDate: true } }))!.startDate,
    expectedAmount: (await prisma.obligationRule.findUnique({ where: { id: ruleId }, select: { expectedAmount: true } }))!.expectedAmount.toNumber(),
    currency: (await prisma.obligationRule.findUnique({ where: { id: ruleId }, select: { currency: true } }))!.currency,
  })
  await recalcularObligation(obligationId, userId)
}

// ── Payments — RECURRING ──────────────────────────────────────────────────────

/** `actualAmount` = lo que realmente se pagó; si se omite, se paga lo esperado. */
export async function acceptObligationPayment(
  paymentId: string,
  gastoName: string,
  actualAmount?: number,
): Promise<string> {
  const userId = await getUserId()
  const payment = await prisma.obligationPayment.findFirst({
    where: { id: paymentId, userId, status: "PENDING" },
    include: { obligation: { select: { name: true } } },
  })
  if (!payment) throw new Error("Pago no encontrado")
  const paidAmount = actualAmount ?? payment.expectedAmount?.toNumber() ?? 0

  let gastoId: string

  if (payment.gastoRecordId) {
    await prisma.record.update({
      where: { id: payment.gastoRecordId, userId },
      data: { name: gastoName, amount: paidAmount, status: "ACTIVE" },
    })
    gastoId = payment.gastoRecordId
  } else {
    // Backwards compat: crear gasto nuevo (para pagos sin gasto upfront)
    gastoId = crypto.randomUUID()
    await prisma.record.create({
      data: {
        id: gastoId,
        type: "gasto",
        name: gastoName,
        amount: paidAmount,
        currency: payment.currency,
        userId,
        status: "ACTIVE",
      },
    })
    await prisma.obligationPayment.update({
      where: { id: paymentId },
      data: { gastoRecordId: gastoId },
    })
  }

  await prisma.obligationPayment.update({
    where: { id: paymentId },
    data: { status: "PAID", expectedAmount: paidAmount },
  })

  // Extend window if needed (ensure next 12 months are covered)
  if (payment.ruleId) {
    const rule = await prisma.obligationRule.findUnique({ where: { id: payment.ruleId } })
    if (rule && rule.status === "ACTIVE") {
      await ensurePaymentWindow(payment.obligationId, userId, payment.ruleId, {
        recurrenceType: rule.recurrenceType,
        startDate: rule.startDate,
        expectedAmount: rule.expectedAmount.toNumber(),
        currency: rule.currency,
      })
    }
  }

  if (paidAmount > 0) {
    await createJournalEntry(userId, {
      description: `Pago obligación: ${gastoName}`,
      currency: payment.currency,
      amount: paidAmount,
      debitAccount: "gastos",
      creditAccount: "efectivo",
      sourceEntityId: gastoId,
      reference: paymentId,
    })
  }

  await recalcularObligation(payment.obligationId, userId)
  return gastoId
}

export async function rejectObligationPayment(paymentId: string): Promise<void> {
  const userId = await getUserId()
  const payment = await prisma.obligationPayment.findFirst({
    where: { id: paymentId, userId, status: "PENDING" },
  })
  if (!payment) throw new Error("Pago no encontrado")

  await prisma.obligationPayment.update({
    where: { id: paymentId },
    data: { status: "REJECTED" },
  })

  // Cancelar el gasto PENDING vinculado (si existe)
  if (payment.gastoRecordId) {
    await prisma.record.update({
      where: { id: payment.gastoRecordId, userId },
      data: { status: "CANCELLED" },
    })
  }

  await recalcularObligation(payment.obligationId, userId)
}

// ── Payments — INSTALLMENT ────────────────────────────────────────────────────

/** `actualAmount` = lo que realmente se pagó; si se omite, se paga lo esperado. */
export async function acceptInstallmentPayment(
  installmentId: string,
  gastoName: string,
  actualAmount?: number,
): Promise<string> {
  const userId = await getUserId()
  const inst = await prisma.obligationInstallment.findFirst({
    where: { id: installmentId, obligation: { userId } },
    include: { obligation: true },
  })
  if (!inst) throw new Error("Cuota no encontrada")
  const paidAmount = actualAmount ?? inst.expectedAmount.toNumber()

  let gastoId: string

  if (inst.gastoRecordId) {
    await prisma.record.update({
      where: { id: inst.gastoRecordId, userId },
      data: { name: gastoName, amount: paidAmount, status: "ACTIVE" },
    })
    gastoId = inst.gastoRecordId
  } else {
    // Backwards compat: crear gasto nuevo
    gastoId = crypto.randomUUID()
    await prisma.record.create({
      data: {
        id: gastoId,
        type: "gasto",
        name: gastoName,
        amount: paidAmount,
        currency: inst.obligation.currency,
        userId,
        status: "ACTIVE",
      },
    })
    await prisma.obligationInstallment.update({
      where: { id: installmentId },
      data: { gastoRecordId: gastoId },
    })
  }

  await prisma.obligationInstallment.update({
    where: { id: installmentId },
    data: { status: "PAID" },
  })

  // Create payment record for history
  await prisma.obligationPayment.create({
    data: {
      id: crypto.randomUUID(),
      obligationId: inst.obligationId,
      userId,
      paymentType: "PAYMENT",
      expectedDate: inst.dueDate,
      expectedAmount: paidAmount,
      currency: inst.obligation.currency,
      gastoRecordId: gastoId,
      status: "PAID",
    },
  })

  if (paidAmount > 0) {
    await createJournalEntry(userId, {
      description: `Cuota pagada: ${gastoName}`,
      currency: inst.obligation.currency,
      amount: paidAmount,
      debitAccount: "gastos",
      creditAccount: "efectivo",
      sourceEntityId: gastoId,
      reference: installmentId,
    })
  }

  await recalcularObligation(inst.obligationId, userId)
  return gastoId
}

export async function rejectInstallmentPayment(installmentId: string): Promise<void> {
  const userId = await getUserId()
  const inst = await prisma.obligationInstallment.findFirst({
    where: { id: installmentId, obligation: { userId } },
  })
  if (!inst) throw new Error("Cuota no encontrada")

  await prisma.obligationInstallment.update({
    where: { id: installmentId },
    data: { status: "REJECTED" },
  })

  // Igual que rejectObligationPayment: el gasto vinculado deja el dashboard
  if (inst.gastoRecordId) {
    await prisma.record.updateMany({
      where: { id: inst.gastoRecordId, userId, status: { in: ["PENDING", "REVIEW", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    })
  }

  await recalcularObligation(inst.obligationId, userId)
}

// ── Payments — FIXED (manual) ─────────────────────────────────────────────────

/**
 * El monto de un gasto generado por una obligación se editó en el dashboard.
 * Pendiente: el esperado pasa a ser el nuevo (pagar desde el detalle o desde el
 * dashboard da lo mismo). Ya pagado: se corrige el pago y se asienta la diferencia.
 */
export async function syncGastoAmount(gastoId: string, newAmount: number): Promise<void> {
  const userId = await getUserId()

  const inst = await prisma.obligationInstallment.findFirst({
    where: { gastoRecordId: gastoId, obligation: { userId } },
    select: { id: true, obligationId: true, status: true },
  })
  const payment = await prisma.obligationPayment.findFirst({
    where: { gastoRecordId: gastoId, userId },
    select: { id: true, obligationId: true, status: true, expectedAmount: true, currency: true },
  })
  const obligationId = inst?.obligationId ?? payment?.obligationId
  if (!obligationId) return

  if (inst && (inst.status === "PENDING" || inst.status === "OVERDUE")) {
    await prisma.obligationInstallment.update({ where: { id: inst.id }, data: { expectedAmount: newAmount } })
  } else if (payment?.status === "PENDING") {
    await prisma.obligationPayment.update({ where: { id: payment.id }, data: { expectedAmount: newAmount } })
  } else if (payment?.status === "PAID") {
    const delta = newAmount - (payment.expectedAmount?.toNumber() ?? 0)
    if (Math.abs(delta) < 0.0001) return
    await prisma.obligationPayment.update({ where: { id: payment.id }, data: { expectedAmount: newAmount } })
    await createJournalEntry(userId, {
      description: "Ajuste de pago de obligación (monto editado)",
      currency: payment.currency,
      amount: Math.abs(delta),
      debitAccount: delta > 0 ? "gastos" : "efectivo",
      creditAccount: delta > 0 ? "efectivo" : "gastos",
      sourceEntityId: gastoId,
      reference: payment.id,
    })
  } else {
    return
  }

  await recalcularObligation(obligationId, userId)
}

export async function registerManualPayment(
  obligationId: string,
  data: {
    amount: number
    paymentType: PaymentType
    comment?: string
    gastoName: string
  },
): Promise<string> {
  const userId = await getUserId()
  const obligation = await prisma.obligation.findFirst({
    where: { id: obligationId, userId },
  })
  if (!obligation) throw new Error("Obligación no encontrada")

  const gastoId = crypto.randomUUID()
  await prisma.record.create({
    data: {
      id: gastoId,
      type: "gasto",
      name: data.gastoName,
      amount: data.amount,
      currency: obligation.currency,
      userId,
    },
  })

  await prisma.obligationPayment.create({
    data: {
      id: crypto.randomUUID(),
      obligationId,
      userId,
      paymentType: data.paymentType,
      expectedAmount: data.amount,
      currency: obligation.currency,
      gastoRecordId: gastoId,
      status: "PAID",
      comment: data.comment ?? null,
    },
  })

  await createJournalEntry(userId, {
    description: `Pago manual: ${data.gastoName}`,
    currency: obligation.currency,
    amount: data.amount,
    debitAccount: "gastos",
    creditAccount: "efectivo",
    sourceEntityId: gastoId,
  })

  // Reduce pending amount (only for PAYMENT type, not INTEREST)
  if (data.paymentType === "PAYMENT") {
    const newAmount = Math.max(0, obligation.amount.toNumber() - data.amount)
    await prisma.obligation.update({
      where: { id: obligationId, userId },
      data: {
        amount: newAmount,
        ...(newAmount === 0 ? { status: "COMPLETED" } : {}),
      },
    })
  }

  return gastoId
}

// ── Status management ─────────────────────────────────────────────────────────

export async function updateObligationStatus(
  obligationId: string,
  status: ObligationStatus,
): Promise<void> {
  const userId = await getUserId()
  await prisma.obligation.update({
    where: { id: obligationId, userId },
    data: { status },
  })
}

export async function updateObligationInfo(
  obligationId: string,
  data: { name?: string; description?: string },
): Promise<void> {
  const userId = await getUserId()
  await prisma.obligation.update({
    where: { id: obligationId, userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  })
}

export async function deleteObligation(obligationId: string): Promise<void> {
  const userId = await getUserId()
  // Cascade deletes rules, installments, payments via onDelete: Cascade in schema
  await prisma.obligation.delete({ where: { id: obligationId, userId } })
}

/**
 * Finaliza una obligación sin eliminar físicamente ningún registro.
 *
 * INSTALLMENT + generateExpenses=true  → crea gastos por cuotas pendientes → COMPLETED
 * INSTALLMENT + generateExpenses=false → marca cuotas pendientes como REJECTED → CANCELLED
 * RECURRING / FIXED                    → rechaza pagos PENDING → CANCELLED
 */
export async function finalizeObligation(
  obligationId: string,
  generateExpenses: boolean,
): Promise<void> {
  const userId = await getUserId()
  const obligation = await prisma.obligation.findFirst({
    where: { id: obligationId, userId },
    include: {
      installments: { where: { status: { in: ["PENDING", "OVERDUE"] } } },
      payments: { where: { status: "PENDING" } },
    },
  })
  if (!obligation) throw new Error("Obligación no encontrada")

  if (obligation.obligationType === "INSTALLMENT") {
    if (generateExpenses) {
      for (const inst of obligation.installments) {
        let gastoId: string
        if (inst.gastoRecordId) {
          // Activar gasto PENDING preexistente
          await prisma.record.update({
            where: { id: inst.gastoRecordId, userId },
            data: {
              name: `Cuota ${inst.installmentNumber} — ${obligation.name}`,
              status: "ACTIVE",
            },
          })
          gastoId = inst.gastoRecordId
        } else {
          // Backwards compat: crear gasto
          gastoId = crypto.randomUUID()
          await prisma.record.create({
            data: {
              id: gastoId,
              type: "gasto",
              name: `Cuota ${inst.installmentNumber} — ${obligation.name}`,
              amount: inst.expectedAmount,
              currency: obligation.currency,
              userId,
              status: "ACTIVE",
            },
          })
        }
        await prisma.obligationInstallment.update({
          where: { id: inst.id },
          data: { status: "PAID", gastoRecordId: gastoId },
        })
        await prisma.obligationPayment.create({
          data: {
            id: crypto.randomUUID(),
            obligationId,
            userId,
            paymentType: "PAYMENT",
            expectedDate: inst.dueDate,
            expectedAmount: inst.expectedAmount,
            currency: obligation.currency,
            gastoRecordId: gastoId,
            status: "PAID",
          },
        })
      }
      await prisma.obligation.update({
        where: { id: obligationId, userId },
        data: { status: "COMPLETED", amount: 0, nextDueDate: null },
      })
    } else {
      if (obligation.installments.length > 0) {
        await prisma.obligationInstallment.updateMany({
          where: { id: { in: obligation.installments.map((i) => i.id) } },
          data: { status: "REJECTED" },
        })
      }
      await prisma.obligation.update({
        where: { id: obligationId, userId },
        data: { status: "CANCELLED", amount: 0, nextDueDate: null },
      })
    }
  } else {
    // RECURRING / FIXED: reject pending payments, set CANCELLED
    if (obligation.payments.length > 0) {
      await prisma.obligationPayment.updateMany({
        where: { obligationId, status: "PENDING" },
        data: { status: "REJECTED" },
      })
    }
    await prisma.obligation.update({
      where: { id: obligationId, userId },
      data: { status: "CANCELLED", amount: 0, nextDueDate: null },
    })
  }
}
