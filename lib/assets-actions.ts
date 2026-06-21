"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Asset, AssetFinancialMovement, AssetType, MovementType, TrackingConfig, BoardConfig } from "./assets"
import { extractBoards } from "./assets"
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
    assetType?: AssetType
    currentQty?: number
    avgBuyPrice?: number
    description?: string
    metadata?: unknown
  },
): Promise<void> {
  const userId = await getUserId()

  let parentId: string | null = null
  if (data.amount !== undefined) {
    const current = await prisma.record.findFirst({ where: { id, userId }, select: { parentId: true } })
    parentId = current?.parentId ?? null
  }

  await prisma.record.update({
    where: { id, userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.ticker !== undefined && { ticker: data.ticker }),
      ...(data.assetType !== undefined && { assetType: data.assetType }),
      ...(data.currentQty !== undefined && { currentQty: data.currentQty }),
      ...(data.avgBuyPrice !== undefined && { avgBuyPrice: data.avgBuyPrice }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.metadata != null ? { metadata: data.metadata as object } : {}),
    },
  })

  if (parentId && data.amount !== undefined) {
    await recalcularGrupo(parentId, userId)
  }
}

/** Persist the boards array for an asset, merging with existing metadata */
export async function updateBoards(id: string, boards: BoardConfig[]): Promise<void> {
  const userId = await getUserId()
  const record = await prisma.record.findFirst({ where: { id, userId }, select: { metadata: true } })
  const current = (record?.metadata as Record<string, unknown>) ?? {}
  await prisma.record.update({
    where: { id, userId },
    data: { metadata: { ...current, boards: boards as unknown as object } },
  })
}

/** Ungroup: detach all children and soft-delete the parent group record */
export async function ungroupAssets(parentId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.$transaction([
    prisma.record.updateMany({
      where: { parentId, userId },
      data: { parentId: null },
    }),
    prisma.record.update({
      where: { id: parentId, userId },
      data: { deletedAt: new Date() },
    }),
  ])
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
    movementType?: MovementType
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
      ...(data.movementType !== undefined && { movementType: data.movementType }),
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

/**
 * Collect a dividend from a boards-based DividendsBoard.
 * boardId: the id of the BoardConfig that holds this dividend.
 */
export async function collectDividend(
  assetId: string,
  dividendId: string,
  boardId: string,
  actualGain: number,
  currency: Currency,
  assetName: string,
): Promise<string> {
  const userId = await getUserId()
  const ingresoId = crypto.randomUUID()

  const record = await prisma.record.findFirst({ where: { id: assetId, userId }, select: { metadata: true } })
  const rawMeta = (record?.metadata as Record<string, unknown>) ?? {}
  const boards = extractBoards(rawMeta)

  const updatedBoards = boards.map((b) => {
    if (b.id !== boardId) return b
    return {
      ...b,
      dividends: (b.dividends ?? []).map((d) =>
        d.id === dividendId ? { ...d, actualGain, ingresoRecordId: ingresoId } : d,
      ),
    }
  })

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
      data: { metadata: { ...rawMeta, boards: updatedBoards as unknown as object } },
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

/**
 * Set an asset's amount to 0 (logical delete) + create an EXTRACT movement.
 * Optionally creates an ingreso record for the asset's previous value.
 * Returns the ingreso record id if created, otherwise null.
 */
export async function zeroOutAsset(
  recordId: string,
  previousAmount: number,
  currency: Currency,
  assetName: string,
  description?: string,
  createIngreso?: boolean,
): Promise<string | null> {
  const userId = await getUserId()
  const ingresoId = createIngreso ? crypto.randomUUID() : null

  await prisma.$transaction(async (tx) => {
    await tx.record.update({
      where: { id: recordId, userId },
      data: { amount: 0 },
    })
    await tx.financialMovement.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        recordId,
        movementType: "EXTRACT",
        amount: previousAmount,
        currency,
        operationDate: new Date(),
        description: description ?? `Egreso (valor puesto en 0): ${assetName}`,
      },
    })
    if (ingresoId) {
      await tx.record.create({
        data: {
          id: ingresoId,
          type: "ingreso",
          name: `Liquidación ${assetName}`,
          amount: previousAmount,
          currency,
          userId,
        },
      })
    }
  })
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

/**
 * Create a new GROUP record and attach childIds as children.
 * Returns the new group record id.
 */
export async function createGroup(
  name: string,
  childIds: string[],
  currency: Currency,
): Promise<string> {
  const userId = await getUserId()
  const groupId = crypto.randomUUID()

  // Sum child amounts to set group amount
  const children = await prisma.record.findMany({
    where: { id: { in: childIds }, userId, deletedAt: null },
    select: { amount: true },
  })
  const totalAmount = children.reduce((s, c) => {
    const v = typeof c.amount === "number" ? c.amount : (c.amount as { toNumber: () => number }).toNumber()
    return s + v
  }, 0)

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: groupId,
        type: "activo",
        name,
        amount: totalAmount,
        currency,
        assetType: "GROUP",
        userId,
      },
    }),
    prisma.record.updateMany({
      where: { id: { in: childIds }, userId },
      data: { parentId: groupId },
    }),
  ])
  return groupId
}

/** Remove a single child asset from its group (set parentId = null) */
export async function removeFromGroup(assetId: string): Promise<void> {
  const userId = await getUserId()
  const child = await prisma.record.findFirst({ where: { id: assetId, userId }, select: { parentId: true } })
  await prisma.record.update({ where: { id: assetId, userId }, data: { parentId: null } })
  if (child?.parentId) {
    await recalcularGrupo(child.parentId, userId)
  }
}

/**
 * Delete a group: detach all children (parentId → null) and soft-delete the group parent.
 * Children are NOT deleted — they become standalone assets.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.$transaction([
    prisma.record.updateMany({
      where: { parentId: groupId, userId },
      data: { parentId: null },
    }),
    prisma.record.update({
      where: { id: groupId, userId },
      data: { deletedAt: new Date() },
    }),
  ])
}

/**
 * Assign a list of assets to an existing group (set their parentId).
 * Assets already in another group are moved to the new one.
 */
export async function assignToGroup(groupId: string, childIds: string[]): Promise<void> {
  const userId = await getUserId()
  await prisma.record.updateMany({
    where: { id: { in: childIds }, userId },
    data: { parentId: groupId },
  })
}

/** Legacy: attach children to an existing parent record */
export async function groupAssets(parentId: string, childIds: string[]): Promise<void> {
  const userId = await getUserId()
  await prisma.record.updateMany({
    where: { id: { in: childIds }, userId },
    data: { parentId },
  })
}

// ── Group recalculation ───────────────────────────────────────────────────────

async function recalcularGrupo(groupId: string, userId: string): Promise<void> {
  const children = await prisma.record.findMany({
    where: { parentId: groupId, userId, deletedAt: null },
    select: { amount: true, currency: true },
  })

  const breakdown: Record<string, number> = {}
  let totalSameCurrency = 0
  const group = await prisma.record.findFirst({
    where: { id: groupId, userId },
    select: { currency: true, metadata: true },
  })
  const groupCurrency = group?.currency ?? "USD"

  for (const child of children) {
    const amt = typeof child.amount === "number" ? child.amount : (child.amount as { toNumber: () => number }).toNumber()
    breakdown[child.currency] = (breakdown[child.currency] ?? 0) + amt
    if (child.currency === groupCurrency) totalSameCurrency += amt
  }

  const currentMeta = (group?.metadata as Record<string, unknown>) ?? {}
  await prisma.record.update({
    where: { id: groupId, userId },
    data: {
      amount: totalSameCurrency,
      metadata: { ...currentMeta, currencyBreakdown: breakdown },
    },
  })
}

// ── Liquidar / eliminar activos ───────────────────────────────────────────────

/**
 * Liquidar un activo: pone amount=0, crea movimiento EXTRACT, opcionalmente crea ingreso.
 * Recalcula el grupo padre si existe.
 */
export async function liquidarActivo(
  recordId: string,
  previousAmount: number,
  currency: Currency,
  assetName: string,
  description?: string,
  createIngreso?: boolean,
): Promise<string | null> {
  const userId = await getUserId()
  const ingresoId = createIngreso ? crypto.randomUUID() : null
  const movementId = crypto.randomUUID()

  const record = await prisma.record.findFirst({
    where: { id: recordId, userId },
    select: { parentId: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.record.update({ where: { id: recordId, userId }, data: { amount: 0 } })

    await tx.financialMovement.create({
      data: {
        id: movementId,
        userId,
        recordId,
        movementType: "EXTRACT",
        amount: previousAmount,
        currency,
        operationDate: new Date(),
        description: description ?? `Liquidación: ${assetName}`,
        ...(ingresoId ? { metadata: { relatedIngresoId: ingresoId } as object } : {}),
      },
    })

    if (ingresoId) {
      await tx.record.create({
        data: {
          id: ingresoId,
          type: "ingreso",
          name: `Liquidación de ${assetName}`,
          amount: previousAmount,
          currency,
          userId,
        },
      })
    }
  })

  if (record?.parentId) {
    await recalcularGrupo(record.parentId, userId)
  }

  return ingresoId
}

/**
 * Eliminar físicamente un activo con balance = 0.
 * Elimina sus movimientos financieros y desvincula el audit log antes de borrar el record.
 * Guard: solo elimina si amount sigue siendo 0.
 */
export async function physicalDeleteAsset(recordId: string): Promise<void> {
  const userId = await getUserId()

  const record = await prisma.record.findFirst({
    where: { id: recordId, userId, deletedAt: null },
    select: { amount: true, parentId: true },
  })
  if (!record) return

  const amount = typeof record.amount === "number" ? record.amount : (record.amount as { toNumber: () => number }).toNumber()
  if (amount !== 0) return // guard de seguridad

  const parentId = record.parentId

  await prisma.$transaction(async (tx) => {
    // Desvincular audit log (movements tabla) para evitar FK violation
    await tx.auditLog.updateMany({
      where: { recordId, userId },
      data: { recordId: null },
    })
    // Eliminar movimientos financieros del activo
    await tx.financialMovement.deleteMany({ where: { recordId, userId } })
    // Eliminar el record físicamente
    await tx.record.delete({ where: { id: recordId, userId } })
  })

  if (parentId) {
    await recalcularGrupo(parentId, userId)
  }
}

/**
 * Crear un movimiento EXTRACT parcial desde el dashboard (Egreso).
 * Actualiza el amount del activo, crea movimiento EXTRACT, opcionalmente crea ingreso.
 */
export async function createExtractFromDashboard(
  recordId: string,
  newAmount: number,
  egressAmount: number,
  currency: Currency,
  assetName: string,
  description?: string,
  createIngreso?: boolean,
): Promise<string | null> {
  const userId = await getUserId()
  const ingresoId = createIngreso ? crypto.randomUUID() : null
  const movementId = crypto.randomUUID()

  const record = await prisma.record.findFirst({
    where: { id: recordId, userId },
    select: { parentId: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.record.update({ where: { id: recordId, userId }, data: { amount: newAmount } })

    await tx.financialMovement.create({
      data: {
        id: movementId,
        userId,
        recordId,
        movementType: "EXTRACT",
        amount: egressAmount,
        currency,
        operationDate: new Date(),
        description: description ?? `Egreso: ${assetName}`,
        ...(ingresoId ? { metadata: { relatedIngresoId: ingresoId } as object } : {}),
      },
    })

    if (ingresoId) {
      await tx.record.create({
        data: {
          id: ingresoId,
          type: "ingreso",
          name: `Venta de ${assetName}`,
          amount: egressAmount,
          currency,
          userId,
        },
      })
    }
  })

  if (record?.parentId) {
    await recalcularGrupo(record.parentId, userId)
  }

  return ingresoId
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
  const rawMeta = r.metadata as Record<string, unknown> | null
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
    boards: extractBoards(rawMeta),
    tracking: (rawMeta?.tracking) as TrackingConfig | undefined,
    movements: r.financialMovements.map(mapMovement),
    children: r.children?.map(mapToAsset),
  }
}
