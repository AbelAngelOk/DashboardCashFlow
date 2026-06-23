"use server"

import { getServerSession } from "next-auth"
import { hash } from "bcryptjs"
import { authOptions } from "./auth"
import { prisma } from "./db"
import { getAccountBalances } from "./journal-actions"
import type {
  Currency,
  FinancialRecord,
  Movement,
  MovementAction,
  RecordType,
  Snapshot,
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

export async function loadData(): Promise<{
  records: FinancialRecord[]
  snapshots: Snapshot[]
  movements: Movement[]
}> {
  const userId = await getUserId()

  const [dbRecords, dbSnapshots, dbMovements] = await Promise.all([
    prisma.record.findMany({
      where: {
        userId,
        deletedAt: null,
        // Gastos PENDING son internos del módulo Obligaciones; no aparecen en dashboard
        OR: [
          { type: { not: "gasto" } },
          { type: "gasto", status: "ACTIVE" },
        ],
      },
      include: { _count: { select: { children: true } } },
    }),
    prisma.snapshot.findMany({
      where: { userId },
      include: { snapshotRecords: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
  ])

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
    movements: dbMovements.map((m) => ({
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

export async function dbDeleteRecord(
  record: FinancialRecord,
  movement: Movement,
) {
  const userId = await getUserId()
  await prisma.$transaction([
    // Soft delete
    prisma.record.update({
      where: { id: record.id, userId },
      data: { deletedAt: new Date() },
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
