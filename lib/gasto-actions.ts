"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
import type { AssetType } from "./assets"
import type { GastoIngresoLink } from "./link-types"
import { addMovement } from "./assets-actions"
import { createJournalEntry } from "./journal-actions"

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type GastoSource =
  | { type: "obligation"; obligationId: string; obligationName: string }
  | { type: "asset"; assetId: string; assetName: string }
  | { type: "free" }

export interface GastoWithSource {
  id: string
  name: string
  amount: number
  currency: Currency
  status: string
  operationDate?: string
  createdAt?: string
  effectiveDate?: string
  previousVersionId?: string
  nextVersionId?: string
  source: GastoSource
  links?: GastoIngresoLink[]
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadGastos(statuses: string[] = ["ACTIVE"]): Promise<GastoWithSource[]> {
  const userId = await getUserId()

  const gastos = await prisma.record.findMany({
    where: { userId, type: "gasto", status: { in: statuses }, deletedAt: null },
    orderBy: { operationDate: "desc" },
  })

  if (gastos.length === 0) return []

  const gastoIds = gastos.map((g) => g.id)

  // Resolve obligation links via ObligationPayment
  const payments = await prisma.obligationPayment.findMany({
    where: { gastoRecordId: { in: gastoIds } },
    include: { obligation: { select: { id: true, name: true } } },
  })

  // Resolve obligation links via ObligationInstallment
  const installments = await prisma.obligationInstallment.findMany({
    where: { gastoRecordId: { in: gastoIds } },
    include: { obligation: { select: { id: true, name: true } } },
  })

  // Map gastoId → obligation info
  const obligationByGastoId = new Map<string, { obligationId: string; obligationName: string }>()
  for (const p of payments) {
    if (p.gastoRecordId) {
      obligationByGastoId.set(p.gastoRecordId, {
        obligationId: p.obligationId,
        obligationName: p.obligation.name,
      })
    }
  }
  for (const inst of installments) {
    if (inst.gastoRecordId && !obligationByGastoId.has(inst.gastoRecordId)) {
      obligationByGastoId.set(inst.gastoRecordId, {
        obligationId: inst.obligationId,
        obligationName: inst.obligation.name,
      })
    }
  }

  // Resolve asset links via linkedTo
  const assetIds = gastos
    .filter((g) => g.linkedTo && !obligationByGastoId.has(g.id))
    .map((g) => g.linkedTo!)

  const assetNameById = new Map<string, string>()
  if (assetIds.length > 0) {
    const assets = await prisma.record.findMany({
      where: { id: { in: assetIds }, userId, type: "activo", deletedAt: null },
      select: { id: true, name: true },
    })
    for (const a of assets) {
      assetNameById.set(a.id, a.name)
    }
  }

  // Build nextVersionId map: previousVersionId → id
  const nextVersionMap = new Map<string, string>()
  for (const g of gastos) {
    if (g.previousVersionId) nextVersionMap.set(g.previousVersionId, g.id)
  }

  return gastos.map((g) => {
    const obligationInfo = obligationByGastoId.get(g.id)
    let source: GastoSource

    if (obligationInfo) {
      source = { type: "obligation", ...obligationInfo }
    } else if (g.linkedTo && assetNameById.has(g.linkedTo)) {
      source = { type: "asset", assetId: g.linkedTo, assetName: assetNameById.get(g.linkedTo)! }
    } else {
      source = { type: "free" }
    }

    return {
      id: g.id,
      name: g.name,
      amount: typeof g.amount === "number" ? g.amount : (g.amount as { toNumber: () => number }).toNumber(),
      currency: g.currency as Currency,
      status: g.status,
      operationDate: g.operationDate?.toISOString(),
      createdAt: g.createdAt?.toISOString(),
      previousVersionId: g.previousVersionId ?? undefined,
      nextVersionId: nextVersionMap.get(g.id),
      source,
    }
  })
}

export async function loadGasto(id: string): Promise<GastoWithSource | null> {
  const userId = await getUserId()
  const g = await prisma.record.findFirst({ where: { id, userId, type: "gasto" } })
  if (!g) return null

  const [payments, installments] = await Promise.all([
    prisma.obligationPayment.findMany({
      where: { gastoRecordId: id },
      include: { obligation: { select: { id: true, name: true } } },
    }),
    prisma.obligationInstallment.findMany({
      where: { gastoRecordId: id },
      include: { obligation: { select: { id: true, name: true } } },
    }),
  ])

  let source: GastoSource = { type: "free" }
  if (payments.length > 0) {
    source = { type: "obligation", obligationId: payments[0].obligationId, obligationName: payments[0].obligation.name }
  } else if (installments.length > 0) {
    source = { type: "obligation", obligationId: installments[0].obligationId, obligationName: installments[0].obligation.name }
  } else if (g.linkedTo) {
    const asset = await prisma.record.findFirst({
      where: { id: g.linkedTo, userId, type: "activo", deletedAt: null },
      select: { id: true, name: true },
    })
    if (asset) source = { type: "asset", assetId: asset.id, assetName: asset.name }
  }

  const nextVersion = await prisma.record.findFirst({
    where: { previousVersionId: id, userId },
    select: { id: true },
  })

  return {
    id: g.id,
    name: g.name,
    amount: typeof g.amount === "number" ? g.amount : (g.amount as { toNumber: () => number }).toNumber(),
    currency: g.currency as Currency,
    status: g.status,
    operationDate: g.operationDate?.toISOString(),
    createdAt: g.createdAt?.toISOString(),
    previousVersionId: g.previousVersionId ?? undefined,
    nextVersionId: nextVersion?.id,
    source,
  }
}

// ── Status mutations ──────────────────────────────────────────────────────────

export async function archiveGasto(id: string): Promise<void> {
  const userId = await getUserId()
  await prisma.record.update({
    where: { id, userId, type: "gasto" },
    data: { status: "ARCHIVED" },
  })
}

export async function restoreGasto(id: string): Promise<void> {
  const userId = await getUserId()
  await prisma.record.update({
    where: { id, userId, type: "gasto" },
    data: { status: "ACTIVE" },
  })
}

export async function editGasto(
  id: string,
  data: { name: string; amount: number; currency: Currency; effectiveDate?: Date },
): Promise<void> {
  const userId = await getUserId()
  await prisma.$transaction([
    prisma.record.update({
      where: { id, userId, type: "gasto" },
      data: {
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        ...(data.effectiveDate ? { effectiveDate: data.effectiveDate } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "editado",
        recordType: "gasto",
        recordName: data.name,
        detail: `Gasto editado: "${data.name}" por ${data.amount} ${data.currency}`,
        userId,
        recordId: id,
      },
    }),
  ])
}

// ── Create: free gasto ────────────────────────────────────────────────────────

export async function createFreeGasto(data: {
  name: string
  amount: number
  currency: Currency
}): Promise<string> {
  const userId = await getUserId()
  const id = crypto.randomUUID()

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id,
        type: "gasto",
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        userId,
        status: "ACTIVE",
        operationDate: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "creado",
        recordType: "gasto",
        recordName: data.name,
        detail: `Gasto "${data.name}" por ${data.amount} ${data.currency}`,
        userId,
        recordId: id,
      },
    }),
  ])
  await createJournalEntry(userId, {
    description: data.name,
    currency: data.currency,
    amount: data.amount,
    debitAccount: "gastos",
    creditAccount: "efectivo",
    sourceEntityId: id,
  })

  return id
}

// ── Create: gasto linked to an asset (no side effects on asset amount) ────────
// Used when the asset is already created at the correct amount (e.g. AssetFormDialog checkbox).

export async function createLinkedGasto(data: {
  name: string
  amount: number
  currency: Currency
  linkedTo: string
}): Promise<string> {
  const userId = await getUserId()
  const id = crypto.randomUUID()

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id,
        type: "gasto",
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        linkedTo: data.linkedTo,
        userId,
        status: "ACTIVE",
        operationDate: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "creado",
        recordType: "gasto",
        recordName: data.name,
        detail: `Gasto "${data.name}" por ${data.amount} ${data.currency} vinculado a activo`,
        userId,
        recordId: id,
      },
    }),
  ])

  return id
}

// ── Create: gasto + deposit on existing asset ─────────────────────────────────

export async function createGastoForExistingAsset(
  gastoData: { name: string; amount: number; currency: Currency },
  assetId: string,
): Promise<string> {
  const userId = await getUserId()

  const asset = await prisma.record.findFirst({
    where: { id: assetId, userId, type: "activo", deletedAt: null },
    select: { id: true, amount: true, parentId: true },
  })
  if (!asset) throw new Error("Activo no encontrado")

  const currentAmount =
    typeof asset.amount === "number" ? asset.amount : (asset.amount as { toNumber: () => number }).toNumber()

  const gastoId = crypto.randomUUID()

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: gastoId,
        type: "gasto",
        name: gastoData.name,
        amount: gastoData.amount,
        currency: gastoData.currency,
        linkedTo: assetId,
        userId,
        status: "ACTIVE",
        operationDate: new Date(),
      },
    }),
    prisma.record.update({
      where: { id: assetId, userId },
      data: { amount: currentAmount + gastoData.amount },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "creado",
        recordType: "gasto",
        recordName: gastoData.name,
        detail: `Gasto "${gastoData.name}" por ${gastoData.amount} ${gastoData.currency} → depósito en activo`,
        userId,
        recordId: gastoId,
      },
    }),
  ])

  // Create DEPOSIT movement (outside transaction to reuse addMovement logic)
  // skipJournalEntry: true because createJournalEntry is handled below
  await addMovement({
    recordId: assetId,
    movementType: "DEPOSIT",
    amount: gastoData.amount,
    currency: gastoData.currency,
    description: `Depósito desde gasto: ${gastoData.name}`,
    skipJournalEntry: true,
  })
  // Gasto: cash went out; asset deposit: cash converted to asset
  await createJournalEntry(userId, {
    description: `${gastoData.name} → gasto`,
    currency: gastoData.currency,
    amount: gastoData.amount,
    debitAccount: "gastos",
    creditAccount: "efectivo",
    sourceEntityId: gastoId,
  })
  await createJournalEntry(userId, {
    description: `${gastoData.name} → depósito en activo`,
    currency: gastoData.currency,
    amount: gastoData.amount,
    debitAccount: "activos",
    creditAccount: "efectivo",
    sourceEntityId: assetId,
    reference: gastoId,
  })

  // Recalculate parent group if needed
  if (asset.parentId) {
    const children = await prisma.record.findMany({
      where: { parentId: asset.parentId, userId, deletedAt: null },
      select: { amount: true, currency: true },
    })
    const group = await prisma.record.findFirst({
      where: { id: asset.parentId, userId },
      select: { currency: true, metadata: true },
    })
    if (group) {
      const breakdown: Record<string, number> = {}
      let totalSame = 0
      for (const c of children) {
        const amt = typeof c.amount === "number" ? c.amount : (c.amount as { toNumber: () => number }).toNumber()
        breakdown[c.currency] = (breakdown[c.currency] ?? 0) + amt
        if (c.currency === group.currency) totalSame += amt
      }
      const meta = (group.metadata as Record<string, unknown>) ?? {}
      await prisma.record.update({
        where: { id: asset.parentId, userId },
        data: { amount: totalSame, metadata: { ...meta, currencyBreakdown: breakdown } },
      })
    }
  }

  return gastoId
}

// ── Create: gasto + new asset ─────────────────────────────────────────────────

export async function createGastoAndNewAsset(
  gastoData: { name: string; amount: number; currency: Currency },
  assetData: {
    name: string
    assetType?: AssetType | null
    amount: number
    currency: Currency
    description?: string
  },
): Promise<{ gastoId: string; assetId: string }> {
  const userId = await getUserId()
  const assetId = crypto.randomUUID()
  const gastoId = crypto.randomUUID()

  // Create asset + initial DEPOSIT movement
  await prisma.record.create({
    data: {
      id: assetId,
      type: "activo",
      name: assetData.name,
      amount: assetData.amount,
      currency: assetData.currency,
      assetType: assetData.assetType ?? null,
      description: assetData.description ?? null,
      userId,
      status: "ACTIVE",
    },
  })

  await prisma.financialMovement.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      recordId: assetId,
      movementType: "DEPOSIT",
      amount: assetData.amount,
      currency: assetData.currency,
      description: "Inversión inicial",
      operationDate: new Date(),
    },
  })

  // Create gasto linked to the new asset
  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: gastoId,
        type: "gasto",
        name: gastoData.name,
        amount: gastoData.amount,
        currency: gastoData.currency,
        linkedTo: assetId,
        userId,
        status: "ACTIVE",
        operationDate: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "creado",
        recordType: "gasto",
        recordName: gastoData.name,
        detail: `Gasto "${gastoData.name}" por ${gastoData.amount} ${gastoData.currency} → nuevo activo "${assetData.name}"`,
        userId,
        recordId: gastoId,
      },
    }),
  ])
  await createJournalEntry(userId, {
    description: `${gastoData.name} → nuevo activo`,
    currency: gastoData.currency,
    amount: gastoData.amount,
    debitAccount: "gastos",
    creditAccount: "efectivo",
    sourceEntityId: gastoId,
  })
  await createJournalEntry(userId, {
    description: `Inversión inicial: ${assetData.name}`,
    currency: assetData.currency,
    amount: assetData.amount,
    debitAccount: "activos",
    creditAccount: "efectivo",
    sourceEntityId: assetId,
    reference: gastoId,
  })

  return { gastoId, assetId }
}
