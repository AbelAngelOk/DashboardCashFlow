"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Asset, AssetFinancialMovement, AssetType, MovementType, TrackingConfig } from "./assets"
import type { Currency } from "./finance"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadAssets(): Promise<Asset[]> {
  const userId = await getUserId()
  const records = await prisma.record.findMany({
    where: { userId, type: "activo", deletedAt: null, parentId: null },
    include: {
      financialMovements: { orderBy: { operationDate: "asc" } },
      children: {
        where: { deletedAt: null },
        include: { financialMovements: { orderBy: { operationDate: "asc" } } },
      },
    },
    orderBy: { operationDate: "desc" },
  })
  return records.map(mapToAsset)
}

export async function loadAsset(id: string): Promise<Asset | null> {
  const userId = await getUserId()
  const record = await prisma.record.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      financialMovements: { orderBy: { operationDate: "asc" } },
      children: {
        where: { deletedAt: null },
        include: { financialMovements: { orderBy: { operationDate: "asc" } } },
      },
    },
  })
  if (!record) return null
  return mapToAsset(record)
}

// ── Create / Update / Delete ──────────────────────────────────────────────────

export async function createAsset(data: {
  name: string
  assetType: AssetType
  ticker?: string
  amount: number
  currency: Currency
  currentQty?: number
  avgBuyPrice?: number
  description?: string
  parentId?: string
  metadata?: unknown
}): Promise<string> {
  const userId = await getUserId()
  const id = crypto.randomUUID()
  await prisma.record.create({
    data: {
      id,
      type: "activo",
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      assetType: data.assetType,
      ticker: data.ticker ?? null,
      currentQty: data.currentQty ?? null,
      avgBuyPrice: data.avgBuyPrice ?? null,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      ...(data.metadata != null ? { metadata: data.metadata as object } : {}),
      userId,
    },
  })
  // First movement: initial deposit
  await prisma.financialMovement.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      recordId: id,
      movementType: "DEPOSIT",
      amount: data.amount,
      currency: data.currency,
      description: "Inversión inicial",
      operationDate: new Date(),
    },
  })
  return id
}

export async function updateAsset(
  id: string,
  data: {
    name?: string
    amount?: number
    currency?: Currency
    ticker?: string
    currentQty?: number
    avgBuyPrice?: number
    description?: string
    metadata?: unknown
  },
): Promise<void> {
  const userId = await getUserId()
  await prisma.record.update({
    where: { id, userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.ticker !== undefined && { ticker: data.ticker }),
      ...(data.currentQty !== undefined && { currentQty: data.currentQty }),
      ...(data.avgBuyPrice !== undefined && { avgBuyPrice: data.avgBuyPrice }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.metadata != null ? { metadata: data.metadata as object } : {}),
    },
  })
}

export async function deleteAsset(id: string): Promise<void> {
  const userId = await getUserId()
  await prisma.record.update({
    where: { id, userId },
    data: { deletedAt: new Date() },
  })
}

// ── Movements ─────────────────────────────────────────────────────────────────

export async function addMovement(data: {
  recordId: string
  movementType: MovementType
  amount: number
  quantity?: number
  unitPrice?: number
  currency: Currency
  exchangeRate?: number
  description?: string
  operationDate?: Date
  metadata?: unknown
}): Promise<string> {
  const userId = await getUserId()
  const id = crypto.randomUUID()
  await prisma.financialMovement.create({
    data: {
      id,
      userId,
      recordId: data.recordId,
      movementType: data.movementType,
      amount: data.amount,
      quantity: data.quantity ?? null,
      unitPrice: data.unitPrice ?? null,
      currency: data.currency,
      exchangeRate: data.exchangeRate ?? null,
      description: data.description ?? null,
      operationDate: data.operationDate ?? new Date(),
      ...(data.metadata != null ? { metadata: data.metadata as object } : {}),
    },
  })
  return id
}

export async function updateMovement(
  id: string,
  data: {
    amount?: number
    quantity?: number
    unitPrice?: number
    description?: string
    operationDate?: Date
    metadata?: unknown
  },
): Promise<void> {
  const userId = await getUserId()
  await prisma.financialMovement.update({
    where: { id, userId },
    data: {
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.operationDate !== undefined && { operationDate: data.operationDate }),
      ...(data.metadata != null ? { metadata: data.metadata as object } : {}),
    },
  })
}

export async function deleteMovement(id: string): Promise<void> {
  const userId = await getUserId()
  await prisma.financialMovement.delete({ where: { id, userId } })
}

// ── Domain operations ─────────────────────────────────────────────────────────

export async function collectDividend(
  assetId: string,
  dividendId: string,
  actualGain: number,
  currency: Currency,
  assetName: string,
  currentMetadata: unknown,
): Promise<string> {
  const userId = await getUserId()
  const ingresoId = crypto.randomUUID()

  const meta = currentMetadata as { dividends: Array<{ id: string; actualGain?: number; ingresoRecordId?: string }> }
  const updatedDividends = meta.dividends.map((d) =>
    d.id === dividendId ? { ...d, actualGain, ingresoRecordId: ingresoId } : d,
  )

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: ingresoId,
        type: "ingreso",
        name: `Ganancia dividendos ${assetName}`,
        amount: actualGain,
        currency,
        userId,
      },
    }),
    prisma.record.update({
      where: { id: assetId, userId },
      data: { metadata: { ...meta, dividends: updatedDividends } },
    }),
  ])
  return ingresoId
}

export async function collectFixedTerm(
  assetId: string,
  collectedAmount: number,
  currency: Currency,
  assetName: string,
): Promise<string> {
  const userId = await getUserId()
  const ingresoId = crypto.randomUUID()

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: ingresoId,
        type: "ingreso",
        name: `Cobro plazo fijo: ${assetName}`,
        amount: collectedAmount,
        currency,
        userId,
      },
    }),
    prisma.record.update({
      where: { id: assetId, userId },
      data: { deletedAt: new Date() },
    }),
  ])
  return ingresoId
}

export async function createAdjustmentMovement(
  recordId: string,
  difference: number,
  currency: Currency,
  description?: string,
): Promise<void> {
  const userId = await getUserId()
  await prisma.financialMovement.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      recordId,
      movementType: "ADJUSTMENT",
      amount: difference,
      currency,
      operationDate: new Date(),
      description: description ?? `Ajuste manual desde dashboard: ${difference > 0 ? "+" : ""}${difference.toFixed(2)}`,
    },
  })
}

export async function updateTracking(assetId: string, tracking: TrackingConfig): Promise<void> {
  const userId = await getUserId()
  const record = await prisma.record.findFirst({
    where: { id: assetId, userId },
    select: { metadata: true },
  })
  const current = (record?.metadata as Record<string, unknown>) ?? {}
  await prisma.record.update({
    where: { id: assetId },
    data: { metadata: { ...current, tracking: tracking as unknown as object } },
  })
}

export async function groupAssets(parentId: string, childIds: string[]): Promise<void> {
  const userId = await getUserId()
  await prisma.record.updateMany({
    where: { id: { in: childIds }, userId },
    data: { parentId },
  })
}

// ── Internal mapping ──────────────────────────────────────────────────────────

type DbRecord = {
  id: string
  name: string
  assetType: string | null
  ticker: string | null
  amount: { toNumber: () => number } | number
  currency: string
  currentQty: { toNumber: () => number } | number | null
  avgBuyPrice: { toNumber: () => number } | number | null
  description: string | null
  parentId: string | null
  metadata: unknown
  financialMovements: DbMovement[]
  children?: DbRecord[]
}

type DbMovement = {
  id: string
  recordId: string
  movementType: string
  amount: { toNumber: () => number } | number
  quantity: { toNumber: () => number } | number | null
  unitPrice: { toNumber: () => number } | number | null
  currency: string
  exchangeRate: { toNumber: () => number } | number | null
  description: string | null
  operationDate: Date
  metadata: unknown
}

function toNum(v: { toNumber: () => number } | number | null | undefined): number | undefined {
  if (v == null) return undefined
  return typeof v === "number" ? v : v.toNumber()
}

function mapMovement(m: DbMovement): AssetFinancialMovement {
  return {
    id: m.id,
    recordId: m.recordId,
    movementType: m.movementType as MovementType,
    amount: toNum(m.amount) ?? 0,
    quantity: toNum(m.quantity),
    unitPrice: toNum(m.unitPrice),
    currency: m.currency as Currency,
    exchangeRate: toNum(m.exchangeRate),
    description: m.description ?? undefined,
    operationDate: m.operationDate.toISOString(),
    metadata: m.metadata as AssetFinancialMovement["metadata"],
  }
}

function mapToAsset(r: DbRecord): Asset {
  return {
    id: r.id,
    name: r.name,
    assetType: (r.assetType ?? "STOCK") as AssetType,
    ticker: r.ticker ?? undefined,
    amount: toNum(r.amount) ?? 0,
    currency: r.currency as Currency,
    currentQty: toNum(r.currentQty),
    avgBuyPrice: toNum(r.avgBuyPrice),
    description: r.description ?? undefined,
    parentId: r.parentId ?? undefined,
    isGroupParent: (r.children?.length ?? 0) > 0,
    metadata: r.metadata as Asset["metadata"],
    tracking: ((r.metadata as Record<string, unknown> | null)?.tracking) as TrackingConfig | undefined,
    movements: r.financialMovements.map(mapMovement),
    children: r.children?.map(mapToAsset),
  }
}
