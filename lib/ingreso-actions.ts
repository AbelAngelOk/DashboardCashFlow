"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
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

export type IngresoSourceType = "dividend" | "fixed-term" | "liquidation" | "extraction" | "manual"

export type IngresoSource =
  | { type: "asset"; assetId: string; assetName: string; sourceType: IngresoSourceType }
  | { type: "free" }

export interface IngresoWithSource {
  id: string
  name: string
  amount: number
  currency: Currency
  status: string
  operationDate?: string
  source: IngresoSource
}

function guessSourceType(name: string): IngresoSourceType {
  if (name.startsWith("Ganancia dividendos")) return "dividend"
  if (name.startsWith("Cobro plazo fijo")) return "fixed-term"
  if (name.startsWith("Liquidación")) return "liquidation"
  if (name.startsWith("Venta de")) return "extraction"
  return "manual"
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadIngresos(): Promise<IngresoWithSource[]> {
  const userId = await getUserId()

  const ingresos = await prisma.record.findMany({
    where: { userId, type: "ingreso", status: "ACTIVE", deletedAt: null },
    orderBy: { operationDate: "desc" },
  })

  if (ingresos.length === 0) return []

  // Bulk query asset names for those with linkedTo
  const assetIds = [...new Set(ingresos.filter((i) => i.linkedTo).map((i) => i.linkedTo!))]

  const assetNameById = new Map<string, string>()
  if (assetIds.length > 0) {
    const assets = await prisma.record.findMany({
      where: { id: { in: assetIds }, userId, type: "activo" },
      select: { id: true, name: true },
    })
    for (const a of assets) {
      assetNameById.set(a.id, a.name)
    }
  }

  return ingresos.map((i) => {
    const amount =
      typeof i.amount === "number" ? i.amount : (i.amount as { toNumber: () => number }).toNumber()

    let source: IngresoSource
    if (i.linkedTo && assetNameById.has(i.linkedTo)) {
      source = {
        type: "asset",
        assetId: i.linkedTo,
        assetName: assetNameById.get(i.linkedTo)!,
        sourceType: guessSourceType(i.name),
      }
    } else {
      source = { type: "free" }
    }

    return {
      id: i.id,
      name: i.name,
      amount,
      currency: i.currency as Currency,
      status: i.status,
      operationDate: i.operationDate?.toISOString(),
      source,
    }
  })
}

// ── Create: free ingreso ──────────────────────────────────────────────────────

export async function createFreeIngreso(data: {
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
        type: "ingreso",
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
        recordType: "ingreso",
        recordName: data.name,
        detail: `Ingreso "${data.name}" por ${data.amount} ${data.currency}`,
        userId,
        recordId: id,
      },
    }),
  ])
  await createJournalEntry(userId, {
    description: data.name,
    currency: data.currency,
    amount: data.amount,
    debitAccount: "efectivo",
    creditAccount: "ingresos",
    targetEntityId: id,
  })

  return id
}

// ── Create: ingreso from existing asset (partial extraction) ──────────────────

export async function createIngresoFromAsset(
  ingresoData: { name: string; amount: number; currency: Currency },
  assetId: string,
  egressAmount: number,
): Promise<string> {
  const userId = await getUserId()

  const asset = await prisma.record.findFirst({
    where: { id: assetId, userId, type: "activo", deletedAt: null },
    select: { id: true, amount: true, parentId: true },
  })
  if (!asset) throw new Error("Activo no encontrado")

  const currentAmount =
    typeof asset.amount === "number"
      ? asset.amount
      : (asset.amount as { toNumber: () => number }).toNumber()

  if (egressAmount > currentAmount) throw new Error("El monto a extraer supera el balance del activo")

  const ingresoId = crypto.randomUUID()
  const newAssetAmount = currentAmount - egressAmount

  await prisma.$transaction([
    prisma.record.create({
      data: {
        id: ingresoId,
        type: "ingreso",
        name: ingresoData.name,
        amount: ingresoData.amount,
        currency: ingresoData.currency,
        linkedTo: assetId,
        userId,
        status: "ACTIVE",
        operationDate: new Date(),
      },
    }),
    prisma.record.update({
      where: { id: assetId, userId },
      data: { amount: newAssetAmount },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "creado",
        recordType: "ingreso",
        recordName: ingresoData.name,
        detail: `Ingreso "${ingresoData.name}" por ${ingresoData.amount} ${ingresoData.currency} → extracción de activo`,
        userId,
        recordId: ingresoId,
      },
    }),
  ])

  // Create EXTRACT movement (skipJournalEntry because JE is created below)
  await addMovement({
    recordId: assetId,
    movementType: "EXTRACT",
    amount: egressAmount,
    currency: ingresoData.currency,
    description: `Extracción desde ingreso: ${ingresoData.name}`,
    skipJournalEntry: true,
  })
  // Asset decreases → cash received → registered as ingreso
  await createJournalEntry(userId, {
    description: `${ingresoData.name} → extracción de activo`,
    currency: ingresoData.currency,
    amount: egressAmount,
    debitAccount: "efectivo",
    creditAccount: "activos",
    sourceEntityId: assetId,
    targetEntityId: ingresoId,
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
        const amt =
          typeof c.amount === "number" ? c.amount : (c.amount as { toNumber: () => number }).toNumber()
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

  return ingresoId
}
