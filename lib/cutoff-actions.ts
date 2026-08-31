"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import { createJournalEntry, getAccountBalances } from "./journal-actions"
import {
  extendRecurringDividends,
  extractBoards,
  type BoardConfig,
  type DividendEntry,
} from "./assets"
import { refreshIncomeWindows } from "./income-actions"
import { formatOccurrenceName } from "./income-streams"
import type { Currency } from "./finance"
import {
  currentOpenPeriod,
  isValidCutoffDay,
  nextCutoffDate,
  normalizeCutoffDay,
  pendingCutoffPeriod,
  periodLabel,
  periodsBetween,
  periodRange,
  periodRangeLabel,
  type CutoffOptions,
  type CutoffPreview,
  type CutoffResult,
  type CutoffStatus,
  type PeriodKey,
} from "./cutoff"

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

async function getCutoffDay(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cutoffDay: true },
  })
  return normalizeCutoffDay(user?.cutoffDay)
}

/** IDs de los activos del usuario — usados para limpiar marcadores de tipo RECORD. */
async function assetIdsOf(userId: string): Promise<string[]> {
  const assets = await prisma.record.findMany({
    where: { userId, type: "activo" },
    select: { id: true },
  })
  return assets.map((a) => a.id)
}

// ── Configuración ─────────────────────────────────────────────────────────────

export async function setCutoffDay(day: number): Promise<void> {
  const userId = await getUserId()
  if (!isValidCutoffDay(day)) {
    throw new Error("El día de corte debe estar entre 1 y 28")
  }
  await prisma.user.update({ where: { id: userId }, data: { cutoffDay: day } })
}

// ── Estado ────────────────────────────────────────────────────────────────────

export async function getCutoffStatus(): Promise<CutoffStatus> {
  const userId = await getUserId()
  const cutoffDay = await getCutoffDay(userId)
  const today = new Date()

  const pendingPeriod = pendingCutoffPeriod(today, cutoffDay)
  const incomingPeriod = currentOpenPeriod(today, cutoffDay)

  const [alreadyCut, lastCutoff] = await Promise.all([
    prisma.monthlyCutoff.findUnique({
      where: { userId_period: { userId, period: pendingPeriod } },
      select: { id: true },
    }),
    prisma.monthlyCutoff.findFirst({
      where: { userId },
      orderBy: { executedAt: "desc" },
      select: { period: true, executedAt: true },
    }),
  ])

  // Si el último corte fue, por ejemplo, "2026-06" y el pendiente ahora es
  // "2026-08", periodsBetween da 2: hay un mes en el medio ("2026-07") que
  // nunca se cortó por separado — se va a mezclar con el que se corte ahora.
  const periodsOverdue = lastCutoff
    ? Math.max(0, periodsBetween(lastCutoff.period, pendingPeriod) - 1)
    : 0

  return {
    cutoffDay,
    pendingPeriod,
    pendingPeriodLabel: periodLabel(pendingPeriod),
    incomingPeriod,
    incomingPeriodLabel: periodLabel(incomingPeriod),
    available: !alreadyCut,
    pendingSince: nextCutoffDate(pendingPeriod, cutoffDay).toISOString(),
    lastCutoffPeriod: lastCutoff?.period,
    lastCutoffAt: lastCutoff?.executedAt.toISOString(),
    nextCutoffAt: nextCutoffDate(incomingPeriod, cutoffDay).toISOString(),
    periodsOverdue,
  }
}

export async function listCutoffs(limit = 12): Promise<
  Array<{
    id: string
    period: string
    periodLabel: string
    executedAt: string
    ingresosArchived: number
    gastosArchived: number
    recordsKept: number
    gastosGenerated: number
    ingresosGenerated: number
    markersCleared: number
    snapshotId?: string
  }>
> {
  const userId = await getUserId()
  const rows = await prisma.monthlyCutoff.findMany({
    where: { userId },
    orderBy: { executedAt: "desc" },
    take: limit,
  })
  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    periodLabel: periodLabel(r.period),
    executedAt: r.executedAt.toISOString(),
    ingresosArchived: r.ingresosArchived,
    gastosArchived: r.gastosArchived,
    recordsKept: r.recordsKept,
    gastosGenerated: r.gastosGenerated,
    ingresosGenerated: r.ingresosGenerated,
    markersCleared: r.markersCleared,
    snapshotId: r.snapshotId ?? undefined,
  }))
}

// ── Recolección de lo que el corte va a tocar ─────────────────────────────────

interface PendingDividendGroup {
  assetId: string
  assetName: string
  currency: Currency
  boards: BoardConfig[]
  rawMeta: Record<string, unknown>
  entries: DividendEntry[]
}

/**
 * Dividendos del período entrante que todavía no generaron ingreso.
 *
 * RB-F12: antes de buscar, extiende las series recurrentes hasta el período entrante.
 * Sin esto la serie se agota a los 12 meses y el corte no encuentra nada que cobrar.
 * Con `persist` en true, las entradas nuevas se guardan en el activo.
 */
async function collectPendingDividends(
  userId: string,
  incomingPeriod: PeriodKey,
  persist = false,
): Promise<PendingDividendGroup[]> {
  const assets = await prisma.record.findMany({
    where: { userId, type: "activo", deletedAt: null },
    select: { id: true, name: true, currency: true, metadata: true },
  })

  const result: PendingDividendGroup[] = []

  for (const asset of assets) {
    const rawMeta = (asset.metadata as Record<string, unknown>) ?? {}
    let boards = extractBoards(rawMeta)
    let extended = false

    // Empuja las series recurrentes hasta cubrir el período entrante
    boards = boards.map((b) => {
      if (b.type !== "dividends") return b
      const current = b.dividends ?? []
      const added = extendRecurringDividends(current, incomingPeriod)
      if (added.length === 0) return b
      extended = true
      return { ...b, dividends: [...current, ...added] }
    })

    if (extended && persist) {
      await prisma.record.update({
        where: { id: asset.id, userId },
        data: { metadata: { ...rawMeta, boards: boards as unknown as object } },
      })
    }

    const entries: DividendEntry[] = []
    for (const board of boards) {
      if (board.type !== "dividends") continue
      for (const d of board.dividends ?? []) {
        if (d.month !== incomingPeriod) continue
        if (d.ingresoRecordId) continue
        if (!(d.estimatedGain > 0)) continue
        entries.push(d)
      }
    }

    if (entries.length > 0) {
      result.push({
        assetId: asset.id,
        assetName: asset.name,
        currency: asset.currency as Currency,
        boards,
        rawMeta,
        entries,
      })
    }
  }

  return result
}

/** Ocurrencias de ingresos recurrentes que vencen en el período entrante. */
async function collectIncomeDues(userId: string, incomingPeriod: PeriodKey, cutoffDay: number) {
  const { start, end } = periodRange(incomingPeriod, cutoffDay)
  return prisma.incomeOccurrence.findMany({
    where: {
      userId,
      status: "PENDING",
      expectedDate: { gte: start, lt: end },
      rule: { status: "ACTIVE" },
    },
    include: { rule: { select: { name: true, installmentCount: true } } },
  })
}

/** Pagos y cuotas de obligaciones activas cuyo vencimiento cae en el período entrante. */
async function collectObligationDues(userId: string, incomingPeriod: PeriodKey, cutoffDay: number) {
  const { start, end } = periodRange(incomingPeriod, cutoffDay)

  const [payments, installments] = await Promise.all([
    prisma.obligationPayment.findMany({
      where: {
        userId,
        status: "PENDING",
        expectedDate: { gte: start, lt: end },
        obligation: { status: "ACTIVE" },
      },
      include: { obligation: { select: { name: true, currency: true } } },
    }),
    prisma.obligationInstallment.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: start, lt: end },
        obligation: { userId, status: "ACTIVE" },
      },
      include: { obligation: { select: { name: true, currency: true } } },
    }),
  ])

  return { payments, installments }
}

// ── Vista previa ──────────────────────────────────────────────────────────────

export async function getCutoffPreview(): Promise<CutoffPreview> {
  const userId = await getUserId()
  const cutoffDay = await getCutoffDay(userId)
  const today = new Date()
  const period = pendingCutoffPeriod(today, cutoffDay)
  const incomingPeriod = currentOpenPeriod(today, cutoffDay)

  const flowRecords = await prisma.record.findMany({
    where: {
      userId,
      type: { in: ["ingreso", "gasto"] },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true, type: true },
  })

  const flowIds = flowRecords.map((r) => r.id)
  const markedFlowIds =
    flowIds.length > 0
      ? await prisma.entityMarker.findMany({
          where: { userId, entityType: "RECORD", entityId: { in: flowIds } },
          select: { entityId: true },
        })
      : []
  const markedSet = new Set(markedFlowIds.map((m) => m.entityId))

  const { payments, installments } = await collectObligationDues(userId, incomingPeriod, cutoffDay)
  // persist=false: la vista previa no debe escribir nada
  const dividendGroups = await collectPendingDividends(userId, incomingPeriod, false)
  const incomeDues = await collectIncomeDues(userId, incomingPeriod, cutoffDay)

  const assetIds = await assetIdsOf(userId)
  const entityMarkersToClear = await prisma.entityMarker.count({
    where: {
      userId,
      OR: [
        { entityType: "OBLIGATION" },
        ...(assetIds.length > 0
          ? [{ entityType: "RECORD", entityId: { in: assetIds } }]
          : []),
      ],
    },
  })

  return {
    period,
    periodLabel: periodLabel(period),
    incomingPeriod,
    incomingPeriodLabel: periodLabel(incomingPeriod),
    ingresosToArchive: flowRecords.filter((r) => r.type === "ingreso").length,
    gastosToArchive: flowRecords.filter((r) => r.type === "gasto").length,
    markedToArchive: markedSet.size,
    gastosToGenerate: payments.length + installments.length,
    ingresosToGenerate:
      dividendGroups.reduce((s, g) => s + g.entries.length, 0) + incomeDues.length,
    entityMarkersToClear,
  }
}

// ── Ejecución ─────────────────────────────────────────────────────────────────

export async function executeCutoff(options: CutoffOptions): Promise<CutoffResult> {
  const userId = await getUserId()
  const cutoffDay = await getCutoffDay(userId)
  const today = new Date()

  const period = pendingCutoffPeriod(today, cutoffDay)
  const incomingPeriod = currentOpenPeriod(today, cutoffDay)

  // RB-C03: la elegibilidad se revalida en servidor; nunca se confía en el cliente
  const already = await prisma.monthlyCutoff.findUnique({
    where: { userId_period: { userId, period } },
    select: { id: true },
  })
  if (already) {
    throw new Error(`El corte de ${periodLabel(period)} ya fue realizado`)
  }

  let snapshotId: string | undefined

  // ── 1. Snapshot del estado previo (RB-C12: antes de archivar) ───────────────
  if (options.takeSnapshot) {
    snapshotId = await createCutoffSnapshot(userId, period, cutoffDay)
  }

  // ── 2. Archivar ingresos y gastos activos ──────────────────────────────────
  const flowRecords = await prisma.record.findMany({
    where: {
      userId,
      type: { in: ["ingreso", "gasto"] },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true, type: true },
  })

  let keptIds = new Set<string>()
  if (options.keepMarked && flowRecords.length > 0) {
    const marked = await prisma.entityMarker.findMany({
      where: {
        userId,
        entityType: "RECORD",
        entityId: { in: flowRecords.map((r) => r.id) },
      },
      select: { entityId: true },
    })
    keptIds = new Set(marked.map((m) => m.entityId))
  }

  const toArchive = flowRecords.filter((r) => !keptIds.has(r.id))
  const ingresosArchived = toArchive.filter((r) => r.type === "ingreso").length
  const gastosArchived = toArchive.filter((r) => r.type === "gasto").length

  if (toArchive.length > 0) {
    await prisma.record.updateMany({
      where: { id: { in: toArchive.map((r) => r.id) }, userId },
      data: { status: "HISTORICAL" },
    })
  }

  // ── 3. Activar gastos de obligaciones del período entrante ─────────────────
  const gastosGenerated = await activateObligationGastos(userId, incomingPeriod, cutoffDay)

  // ── 4. Ingresos del período entrante: dividendos + flujos recurrentes ──────
  const dividendIngresos = await generateDividendIngresos(userId, incomingPeriod)
  const streamIngresos = await activateIncomeOccurrences(userId, incomingPeriod, cutoffDay)
  const ingresosGenerated = dividendIngresos + streamIngresos

  // La ventana de 12 meses rueda hacia adelante en cada corte
  await refreshIncomeWindows()

  // ── 5. Limpiar etiquetas de activos y obligaciones ─────────────────────────
  let markersCleared = 0
  if (options.clearEntityMarkers) {
    const assetIds = await assetIdsOf(userId)
    const deleted = await prisma.entityMarker.deleteMany({
      where: {
        userId,
        OR: [
          { entityType: "OBLIGATION" },
          ...(assetIds.length > 0
            ? [{ entityType: "RECORD", entityId: { in: assetIds } }]
            : []),
        ],
      },
    })
    markersCleared = deleted.count
  }

  // ── 6. Registrar el corte + auditoría ──────────────────────────────────────
  await prisma.monthlyCutoff.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      period,
      cutoffDay,
      keptMarked: options.keepMarked,
      clearedEntityMarkers: options.clearEntityMarkers,
      snapshotId: snapshotId ?? null,
      ingresosArchived,
      gastosArchived,
      recordsKept: keptIds.size,
      gastosGenerated,
      ingresosGenerated,
      markersCleared,
    },
  })

  await prisma.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      date: auditDate(),
      action: "editado",
      recordType: "gasto",
      recordName: `Corte de mes — ${periodLabel(period)}`,
      detail:
        `Corte de ${periodLabel(period)}: ` +
        `${ingresosArchived} ingresos y ${gastosArchived} gastos a histórico` +
        (keptIds.size > 0 ? `, ${keptIds.size} conservados por etiqueta` : "") +
        `; ${gastosGenerated} gastos y ${ingresosGenerated} ingresos generados para ${periodLabel(incomingPeriod)}` +
        (markersCleared > 0 ? `; ${markersCleared} etiquetas quitadas` : ""),
      userId,
    },
  })

  return {
    period,
    incomingPeriod,
    ingresosArchived,
    gastosArchived,
    recordsKept: keptIds.size,
    gastosGenerated,
    ingresosGenerated,
    markersCleared,
    snapshotId,
  }
}

// ── Pasos internos ────────────────────────────────────────────────────────────

async function createCutoffSnapshot(
  userId: string,
  period: PeriodKey,
  cutoffDay: number,
): Promise<string> {
  const records = await prisma.record.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        { type: { not: { in: ["gasto", "ingreso"] } } },
        { type: "gasto", status: "ACTIVE" },
        { type: "ingreso", status: "ACTIVE" },
      ],
    },
    select: { id: true, type: true, name: true, amount: true, currency: true, linkedTo: true },
  })

  const accountBalances = await getAccountBalances(new Date())
  const snapshotId = crypto.randomUUID()

  await prisma.$transaction(async (tx) => {
    await tx.snapshot.create({
      data: {
        id: snapshotId,
        name: `Cierre ${periodLabel(period)}`,
        period: periodRangeLabel(period, cutoffDay),
        createdAt: auditDate(),
        userId,
        data: { accountBalances, cutoffPeriod: period } as object,
      },
    })
    if (records.length > 0) {
      await tx.snapshotRecord.createMany({
        data: records.map((r) => ({
          id: crypto.randomUUID(),
          snapshotId,
          type: r.type,
          name: r.name,
          amount: r.amount,
          currency: r.currency,
          linkedTo: r.linkedTo ?? null,
        })),
      })
    }
  })

  return snapshotId
}

/**
 * Activa los gastos PENDING pre-generados por las obligaciones cuyo vencimiento
 * cae en el período entrante. RB-C08: no marca el pago/cuota como pagado.
 */
async function activateObligationGastos(
  userId: string,
  incomingPeriod: PeriodKey,
  cutoffDay: number,
): Promise<number> {
  const { payments, installments } = await collectObligationDues(userId, incomingPeriod, cutoffDay)
  let generated = 0

  for (const payment of payments) {
    const amount = payment.expectedAmount != null ? toNumber(payment.expectedAmount) : 0
    const name = payment.obligation.name
    const currency = payment.currency
    let gastoId = payment.gastoRecordId

    if (gastoId) {
      // Solo si sigue PENDING — si el usuario ya lo aceptó o rechazó, no se toca
      const updated = await prisma.record.updateMany({
        where: { id: gastoId, userId, status: "PENDING" },
        data: { name, status: "ACTIVE" },
      })
      if (updated.count === 0) continue
    } else {
      gastoId = crypto.randomUUID()
      await prisma.record.create({
        data: {
          id: gastoId,
          type: "gasto",
          name,
          amount,
          currency,
          userId,
          status: "ACTIVE",
          operationDate: payment.expectedDate ?? new Date(),
        },
      })
      await prisma.obligationPayment.update({
        where: { id: payment.id },
        data: { gastoRecordId: gastoId },
      })
    }

    generated++
    if (amount > 0) {
      await createJournalEntry(userId, {
        description: `Corte de mes — gasto de obligación: ${name}`,
        currency,
        amount,
        debitAccount: "gastos",
        creditAccount: "efectivo",
        sourceEntityId: gastoId,
        reference: payment.id,
      })
    }
  }

  for (const inst of installments) {
    const amount = toNumber(inst.expectedAmount)
    const currency = inst.obligation.currency
    const name = `Cuota ${inst.installmentNumber} — ${inst.obligation.name}`
    let gastoId = inst.gastoRecordId

    if (gastoId) {
      const updated = await prisma.record.updateMany({
        where: { id: gastoId, userId, status: "PENDING" },
        data: { status: "ACTIVE" },
      })
      if (updated.count === 0) continue
    } else {
      gastoId = crypto.randomUUID()
      await prisma.record.create({
        data: {
          id: gastoId,
          type: "gasto",
          name,
          amount,
          currency,
          userId,
          status: "ACTIVE",
          operationDate: inst.dueDate,
        },
      })
      await prisma.obligationInstallment.update({
        where: { id: inst.id },
        data: { gastoRecordId: gastoId },
      })
    }

    generated++
    if (amount > 0) {
      await createJournalEntry(userId, {
        description: `Corte de mes — cuota de obligación: ${name}`,
        currency,
        amount,
        debitAccount: "gastos",
        creditAccount: "efectivo",
        sourceEntityId: gastoId,
        reference: inst.id,
      })
    }
  }

  return generated
}

/**
 * Crea un ingreso ACTIVE por la ganancia estimada de cada dividendo del período
 * entrante que todavía no tenga ingreso. RB-C09: idempotente vía ingresoRecordId.
 */
async function generateDividendIngresos(
  userId: string,
  incomingPeriod: PeriodKey,
): Promise<number> {
  // persist=true: acá sí se guardan las entradas nuevas de las series recurrentes
  const groups = await collectPendingDividends(userId, incomingPeriod, true)
  let generated = 0

  for (const group of groups) {
    const createdFor = new Map<string, string>() // dividendId → ingresoId

    for (const entry of group.entries) {
      const ingresoId = crypto.randomUUID()
      await prisma.record.create({
        data: {
          id: ingresoId,
          type: "ingreso",
          name: `Dividendo estimado ${group.assetName}`,
          amount: entry.estimatedGain,
          currency: group.currency,
          userId,
          status: "ACTIVE",
          linkedTo: group.assetId,
          operationDate: new Date(),
        },
      })
      createdFor.set(entry.id, ingresoId)

      await createJournalEntry(userId, {
        description: `Corte de mes — dividendo estimado ${group.assetName}`,
        currency: group.currency,
        amount: entry.estimatedGain,
        debitAccount: "efectivo",
        creditAccount: "ingresos",
        targetEntityId: ingresoId,
        reference: entry.id,
      })
      generated++
    }

    // Escribe los ingresoRecordId de vuelta en los tableros del activo
    const updatedBoards = group.boards.map((b) => {
      if (b.type !== "dividends") return b
      return {
        ...b,
        dividends: (b.dividends ?? []).map((d) =>
          createdFor.has(d.id) ? { ...d, ingresoRecordId: createdFor.get(d.id) } : d,
        ),
      }
    })

    await prisma.record.update({
      where: { id: group.assetId, userId },
      data: { metadata: { ...group.rawMeta, boards: updatedBoards as unknown as object } },
    })
  }

  return generated
}

/**
 * Activa los ingresos PENDING de las ocurrencias que vencen en el período entrante.
 *
 * Espejo de activateObligationGastos(): la ocurrencia sigue PENDING hasta que el
 * usuario confirme el monto real desde el detalle del activo. El asiento contable
 * se emite recién al confirmar, porque hasta entonces no se sabe si es capital o renta
 * por el monto efectivamente cobrado.
 */
async function activateIncomeOccurrences(
  userId: string,
  incomingPeriod: PeriodKey,
  cutoffDay: number,
): Promise<number> {
  const dues = await collectIncomeDues(userId, incomingPeriod, cutoffDay)
  let generated = 0

  for (const occ of dues) {
    if (!occ.ingresoRecordId) continue
    const name = formatOccurrenceName(occ.rule.name, occ.installmentNumber, occ.rule.installmentCount)
    const updated = await prisma.record.updateMany({
      where: { id: occ.ingresoRecordId, userId, status: "PENDING" },
      data: { name, status: "ACTIVE" },
    })
    if (updated.count > 0) generated++
  }

  return generated
}
