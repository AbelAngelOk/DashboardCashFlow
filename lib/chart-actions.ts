"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import { extractBoards } from "./assets"
import type { Currency } from "./finance"
import type { MonthKey, MonthlyAmount } from "./charts"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

function toNumber(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  return (v as { toNumber: () => number }).toNumber()
}

// Las fechas programadas se guardan a medianoche UTC: se agrupan por mes UTC
function monthUTC(d: Date): MonthKey {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export interface FlowSchedule {
  /** Ingresos con fecha: cobros de reglas (real si ya se cobró) y dividendos */
  income: MonthlyAmount[]
  /** Vencimientos de obligaciones: pagos (pagados o pendientes) y cuotas pendientes */
  obligations: (MonthlyAmount & { obligationId: string })[]
}

/**
 * Todo lo que tiene fecha en activos y obligaciones, entre `monthsBack` meses
 * atrás y `monthsAhead` adelante. Lo que se carga a mano sin fecha no entra.
 */
export async function loadFlowSchedule(monthsBack = 6, monthsAhead = 11): Promise<FlowSchedule> {
  const userId = await getUserId()
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead + 1, 1))
  const inWindow = (m: MonthKey) => m >= monthUTC(from) && m < monthUTC(to)

  const [occurrences, assets, payments, installments] = await Promise.all([
    prisma.incomeOccurrence.findMany({
      where: { userId, status: { in: ["PENDING", "COLLECTED"] }, expectedDate: { gte: from, lt: to } },
      select: { expectedDate: true, expectedAmount: true, actualAmount: true, status: true, currency: true },
    }),
    prisma.record.findMany({
      where: { userId, type: "activo", deletedAt: null },
      select: { currency: true, metadata: true },
    }),
    prisma.obligationPayment.findMany({
      where: { userId, status: { in: ["PAID", "PENDING"] }, expectedDate: { gte: from, lt: to } },
      select: { obligationId: true, expectedDate: true, expectedAmount: true, currency: true },
    }),
    prisma.obligationInstallment.findMany({
      where: { obligation: { userId }, status: { in: ["PENDING", "OVERDUE"] }, dueDate: { gte: from, lt: to } },
      select: { obligationId: true, dueDate: true, expectedAmount: true, obligation: { select: { currency: true } } },
    }),
  ])

  const income: MonthlyAmount[] = occurrences.map((o) => ({
    month: monthUTC(o.expectedDate),
    currency: o.currency as Currency,
    amount: o.status === "COLLECTED" ? toNumber(o.actualAmount) : toNumber(o.expectedAmount),
  }))

  for (const a of assets) {
    if (!a.metadata) continue
    for (const board of extractBoards(a.metadata as Record<string, unknown>)) {
      for (const d of board.dividends ?? []) {
        if (!inWindow(d.month)) continue
        income.push({ month: d.month, currency: a.currency as Currency, amount: d.actualGain ?? d.estimatedGain })
      }
    }
  }

  const obligations: FlowSchedule["obligations"] = [
    ...payments
      .filter((p) => p.expectedDate)
      .map((p) => ({
        obligationId: p.obligationId,
        month: monthUTC(p.expectedDate!),
        currency: p.currency as Currency,
        amount: toNumber(p.expectedAmount),
      })),
    ...installments.map((i) => ({
      obligationId: i.obligationId,
      month: monthUTC(i.dueDate),
      currency: i.obligation.currency as Currency,
      amount: toNumber(i.expectedAmount),
    })),
  ]

  return { income: income.filter((i) => i.amount > 0), obligations: obligations.filter((o) => o.amount > 0) }
}
