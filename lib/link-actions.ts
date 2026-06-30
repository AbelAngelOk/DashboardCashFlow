"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
import type { GastoIngresoLink } from "./link-types"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

function toLink(row: {
  id: string
  gastoId: string
  ingresoId: string
  attributedAmount: unknown
  currency: string
  createdAt: Date
}): GastoIngresoLink {
  return {
    id: row.id,
    gastoId: row.gastoId,
    ingresoId: row.ingresoId,
    attributedAmount:
      typeof row.attributedAmount === "number"
        ? row.attributedAmount
        : (row.attributedAmount as { toNumber: () => number }).toNumber(),
    currency: row.currency as Currency,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createGastoIngresoLink(data: {
  gastoId: string
  ingresoId: string
  attributedAmount: number
  currency: Currency
}): Promise<string> {
  const userId = await getUserId()

  if (data.attributedAmount <= 0) throw new Error("El monto atribuido debe ser mayor a 0")

  // Verify ownership
  const [gasto, ingreso] = await Promise.all([
    prisma.record.findFirst({ where: { id: data.gastoId, userId, type: "gasto" } }),
    prisma.record.findFirst({ where: { id: data.ingresoId, userId, type: "ingreso" } }),
  ])
  if (!gasto) throw new Error("Gasto no encontrado")
  if (!ingreso) throw new Error("Ingreso no encontrado")

  const link = await prisma.gastoIngresoLink.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      gastoId: data.gastoId,
      ingresoId: data.ingresoId,
      attributedAmount: data.attributedAmount,
      currency: data.currency,
    },
  })

  return link.id
}

export async function deleteGastoIngresoLink(id: string): Promise<void> {
  const userId = await getUserId()
  await prisma.gastoIngresoLink.delete({
    where: { id, userId },
  })
}

export async function loadLinksForGasto(gastoId: string): Promise<GastoIngresoLink[]> {
  const userId = await getUserId()
  const links = await prisma.gastoIngresoLink.findMany({
    where: { gastoId, userId },
    include: { ingreso: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  return links.map((l) => ({ ...toLink(l), ingresoName: l.ingreso.name }))
}

export async function loadLinksForIngreso(ingresoId: string): Promise<GastoIngresoLink[]> {
  const userId = await getUserId()
  const links = await prisma.gastoIngresoLink.findMany({
    where: { ingresoId, userId },
    include: { gasto: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })
  return links.map((l) => ({ ...toLink(l), gastoName: l.gasto.name }))
}

export async function loadIngresoOptions(): Promise<
  { id: string; name: string; amount: number; currency: string }[]
> {
  const userId = await getUserId()
  const ingresos = await prisma.record.findMany({
    where: { userId, type: "ingreso", status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, amount: true, currency: true },
    orderBy: { operationDate: "desc" },
  })
  return ingresos.map((i) => ({
    id: i.id,
    name: i.name,
    amount:
      typeof i.amount === "number" ? i.amount : (i.amount as { toNumber: () => number }).toNumber(),
    currency: i.currency,
  }))
}

export async function loadGastoOptions(): Promise<
  { id: string; name: string; amount: number; currency: string }[]
> {
  const userId = await getUserId()
  const gastos = await prisma.record.findMany({
    where: { userId, type: "gasto", status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, amount: true, currency: true },
    orderBy: { operationDate: "desc" },
  })
  return gastos.map((g) => ({
    id: g.id,
    name: g.name,
    amount:
      typeof g.amount === "number" ? g.amount : (g.amount as { toNumber: () => number }).toNumber(),
    currency: g.currency,
  }))
}
