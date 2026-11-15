"use server"

import { getServerSession } from "next-auth"
import { headers } from "next/headers"
import { hash } from "bcryptjs"
import { authOptions } from "./auth"
import { prisma } from "./db"
import { getAccountBalances } from "./journal-actions"
import { extractBoards } from "./assets"
import { syncGastoAmount } from "./obligation-actions"
import { syncIngresoAmount } from "./income-actions"
import { checkRateLimit, clientIpFrom } from "./rate-limit"
import {
  plainTextDescription,
  type Currency,
  type FinancialRecord,
  type Movement,
  type MovementAction,
  type RecordStatus,
  type RecordType,
  type Snapshot,
} from "./finance"

// ── Auth helper ─────────────────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

// ── Register ─────────────────────────────────────────────────────────────────

export async function registerUser({
  name,
  email,
  password,
}: {
  name: string
  email: string
  password: string
}) {
  const ip = clientIpFrom(await headers())
  const { allowed } = checkRateLimit(`register:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!allowed) {
    throw new Error("Demasiados registros desde esta conexión. Esperá un rato y volvé a intentar.")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error("Ya existe una cuenta con ese email")
  const passwordHash = await hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  })

  // Claim existing orphaned data (records/snapshots/movements without userId)
  await Promise.all([
    prisma.record.updateMany({ where: { userId: null }, data: { userId: user.id } }),
    prisma.snapshot.updateMany({ where: { userId: null }, data: { userId: user.id } }),
    prisma.auditLog.updateMany({ where: { userId: null }, data: { userId: user.id } }),
  ])

  return { id: user.id }
}

// ── Load ─────────────────────────────────────────────────────────────────────
//
// Separado a propósito en dos funciones independientes (antes era un solo
// `loadData()` con Promise.all de las tres). El dashboard y la mayoría de las
// pantallas solo necesitan `records`/`snapshots` — el audit log completo
// (`movements`, sin límite, solo lo usa /movimientos y el badge del sidebar)
// no tiene por qué bloquear ese render. Ver `components/finance-store.tsx`,
// que dispara ambas cargas en paralelo, sin esperar una a la otra.

export async function loadFinanceCore(): Promise<{
  records: FinancialRecord[]
  snapshots: Snapshot[]
}> {
  const userId = await getUserId()

  const [dbRecords, dbSnapshots] = await Promise.all([
    prisma.record.findMany({
      where: {
        userId,
        deletedAt: null,
        // PENDING = pre-generados que todavía no entraron al período; HISTORICAL y
        // ARCHIVED ya salieron. El dashboard muestra ACTIVE, REVIEW y CONFIRMED.
        OR: [
          { type: { not: { in: ["gasto", "ingreso"] } } },
          { type: { in: ["gasto", "ingreso"] }, status: { in: ["ACTIVE", "REVIEW", "CONFIRMED"] } },
        ],
      },
      include: { _count: { select: { children: true } } },
    }),
    prisma.snapshot.findMany({
      where: { userId },
      include: { snapshotRecords: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  // Registros que no se cargaron a mano: sirven para rotular "Pagado" / "Cobrado"
  const flowIds = dbRecords.filter((r) => r.type === "gasto" || r.type === "ingreso").map((r) => r.id)
  const generatedIds = new Set<string>()
  if (flowIds.length > 0) {
    const [inst, pays, occs] = await Promise.all([
      prisma.obligationInstallment.findMany({ where: { gastoRecordId: { in: flowIds } }, select: { gastoRecordId: true } }),
      prisma.obligationPayment.findMany({ where: { userId, gastoRecordId: { in: flowIds } }, select: { gastoRecordId: true } }),
      prisma.incomeOccurrence.findMany({ where: { userId, ingresoRecordId: { in: flowIds } }, select: { ingresoRecordId: true } }),
    ])
    for (const i of inst) if (i.gastoRecordId) generatedIds.add(i.gastoRecordId)
    for (const p of pays) if (p.gastoRecordId) generatedIds.add(p.gastoRecordId)
    for (const o of occs) if (o.ingresoRecordId) generatedIds.add(o.ingresoRecordId)
    for (const a of dbRecords) {
      if (a.type !== "activo" || !a.metadata) continue
      for (const b of extractBoards(a.metadata as Record<string, unknown>)) {
        for (const d of b.dividends ?? []) if (d.ingresoRecordId) generatedIds.add(d.ingresoRecordId)
      }
    }
  }

  return {
    records: dbRecords.map((r) => ({
      id: r.id,
      type: r.type as RecordType,
      name: r.name,
      amount: Number(r.amount),
      currency: r.currency as Currency,
      ...(r.linkedTo ? { linkedTo: r.linkedTo } : {}),
      ...(r.parentId ? { parentId: r.parentId } : {}),
      ...(r.assetType ? { assetType: r.assetType } : {}),
      ...("_count" in r && r._count.children > 0 ? { isGroupParent: true } : {}),
      status: r.status as RecordStatus,
      ...(generatedIds.has(r.id) ? { generated: true } : {}),
      ...(r.type === "activo" && r.generatesIncome ? { generatesIncome: true } : {}),
      ...(plainTextDescription(r.description) ? { description: plainTextDescription(r.description) } : {}),
    })),
    snapshots: dbSnapshots.map((s) => ({
      id: s.id,
      name: s.name,
      period: s.period,
      createdAt: s.createdAt,
      data: (s.data as Record<string, unknown>) ?? undefined,
      records: s.snapshotRecords.map((sr) => ({
        id: sr.id,
        type: sr.type as RecordType,
        name: sr.name,
        amount: Number(sr.amount),
        currency: sr.currency as Currency,
        ...(sr.linkedTo ? { linkedTo: sr.linkedTo } : {}),
      })),
    })),
  }
}

export async function loadMovements(): Promise<Movement[]> {
  const userId = await getUserId()

  const dbMovements = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  })

  return dbMovements.map((m) => ({
    id: m.id,
    date: m.date,
    action: m.action as MovementAction,
    recordType: m.recordType as RecordType,
    recordName: m.recordName,
    detail: m.detail,
    comment: m.comment,
  }))
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function dbCreateRecord(
  record: FinancialRecord,
  movement: Movement,
) {
  const userId = await getUserId()
  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: record.id,
        type: record.type,
        name: record.name,
        amount: record.amount,
        currency: record.currency,
        linkedTo: record.linkedTo ?? null,
        parentId: record.parentId ?? null,
        assetType: record.assetType ?? null,
        description: record.description?.trim() || null,
        userId,
        status: "ACTIVE",
      },
    }),
    prisma.auditLog.create({
      data: {
        id: movement.id,
        date: movement.date,
        action: movement.action,
        recordType: movement.recordType,
        recordName: movement.recordName,
        detail: movement.detail,
        comment: movement.comment,
        userId,
        recordId: record.id,
      },
    }),
  ])
}

export async function dbEditRecord(
  record: FinancialRecord,
  movement: Movement,
) {
  const userId = await getUserId()
  const before = await prisma.record.findFirst({
    where: { id: record.id, userId },
    select: { amount: true },
  })

  await prisma.$transaction([
    prisma.record.update({
      where: { id: record.id, userId },
      data: {
        type: record.type,
        name: record.name,
        amount: record.amount,
        currency: record.currency,
        linkedTo: record.linkedTo ?? null,
        parentId: record.parentId ?? null,
        assetType: record.assetType ?? null,
        // La descripción de un activo es JSON del editor rico: acá solo llega
        // su texto plano, así que nunca se escribe desde este camino.
        ...(record.type !== "activo" && record.description !== undefined
          ? { description: record.description.trim() || null }
          : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        id: movement.id,
        date: movement.date,
        action: movement.action,
        recordType: movement.recordType,
        recordName: movement.recordName,
        detail: movement.detail,
        comment: movement.comment,
        userId,
        recordId: record.id,
      },
    }),
  ])

  // Un ingreso/gasto generado por una regla u obligación lleva el monto a su origen
  if (before && Number(before.amount) !== record.amount) {
    if (record.type === "ingreso") await syncIngresoAmount(record.id, record.amount)
    if (record.type === "gasto") await syncGastoAmount(record.id, record.amount)
  }
}

/** Descripción de texto de un ingreso, gasto o pasivo (los activos usan su editor rico). */
export async function setRecordDescription(recordId: string, description: string): Promise<void> {
  const userId = await getUserId()
  await prisma.record.updateMany({
    where: { id: recordId, userId, type: { in: ["ingreso", "gasto", "pasivo"] } },
    data: { description: description.trim() || null },
  })
}

export async function dbDeleteRecord(
  record: FinancialRecord,
  movement: Movement,
) {
  const userId = await getUserId()
  const isFlowRecord = record.type === "ingreso" || record.type === "gasto"
  await prisma.$transaction([
    prisma.record.update({
      where: { id: record.id, userId },
      data: isFlowRecord ? { status: "HISTORICAL" } : { deletedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        id: movement.id,
        date: movement.date,
        action: movement.action,
        recordType: movement.recordType,
        recordName: movement.recordName,
        detail: movement.detail,
        comment: movement.comment,
        userId,
        recordId: record.id,
      },
    }),
  ])
}

export async function dbTakeSnapshot(snapshot: Snapshot) {
  const userId = await getUserId()
  const accountBalances = await getAccountBalances(new Date())
  await prisma.$transaction(async (tx) => {
    await tx.snapshot.create({
      data: {
        id: snapshot.id,
        name: snapshot.name,
        period: snapshot.period,
        createdAt: snapshot.createdAt,
        userId,
        data: { accountBalances } as object,
      },
    })
    if (snapshot.records.length > 0) {
      await tx.snapshotRecord.createMany({
        data: snapshot.records.map((r) => ({
          id: crypto.randomUUID(),
          snapshotId: snapshot.id,
          type: r.type,
          name: r.name,
          amount: r.amount,
          currency: r.currency,
          linkedTo: r.linkedTo ?? null,
        })),
      })
    }
  })
}

export async function dbUpdateComment(id: string, comment: string) {
  const userId = await getUserId()
  await prisma.auditLog.update({
    where: { id, userId },
    data: { comment },
  })
}

// ── Historial paginado ────────────────────────────────────────────────────────

export type HistorialParams = {
  page: number
  pageSize: number
  action?: string
  recordType?: string
  search?: string
  dateFrom?: string  // "YYYY-MM-DD"
  dateTo?: string    // "YYYY-MM-DD"
}

export type HistorialResult = {
  items: Movement[]
  total: number
}

export async function loadHistorial(params: HistorialParams): Promise<HistorialResult> {
  const userId = await getUserId()
  const { page, pageSize, action, recordType, search, dateFrom, dateTo } = params

  const safePageSize = [10, 25, 50, 100].includes(pageSize) ? pageSize : 25
  const safePage = Math.max(1, page)
  const term = search?.trim()

  const where = {
    userId,
    ...(action ? { action } : {}),
    ...(recordType ? { recordType } : {}),
    ...(term
      ? {
          OR: [
            { recordName: { contains: term, mode: "insensitive" as const } },
            { detail: { contains: term, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }

  const [total, dbItems] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ])

  return {
    total,
    items: dbItems.map((m) => ({
      id: m.id,
      date: m.date,
      action: m.action as MovementAction,
      recordType: m.recordType as RecordType,
      recordName: m.recordName,
      detail: m.detail,
      comment: m.comment,
    })),
  }
}
