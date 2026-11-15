"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import { extractBoards } from "./assets"
import type { Currency } from "./finance"
import { collectDividend } from "./assets-actions"
import { collectIncomeOccurrence } from "./income-actions"
import { acceptInstallmentPayment, acceptObligationPayment } from "./obligation-actions"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

/**
 * Valida un registro "Por revisar" sin pagarlo ni cobrarlo: pasa a "Pendiente"
 * (gasto) / "Por cobrar" (ingreso). Pagar o cobrar es un paso aparte.
 */
export async function validateReviewRecord(recordId: string): Promise<void> {
  const userId = await getUserId()
  const result = await prisma.record.updateMany({
    where: { id: recordId, userId, status: "REVIEW" },
    data: { status: "CONFIRMED" },
  })
  if (result.count === 0) throw new Error("El registro ya no está por revisar")
}

/**
 * Paga o cobra un ingreso/gasto pendiente (Por revisar o Pendiente) con el monto real: paga la cuota o el
 * pago de la obligación, cobra la ocurrencia de la regla o el dividendo. Cada
 * origen tiene su propia contabilidad; acá solo se elige cuál aplicar.
 */
export async function confirmReviewRecord(recordId: string, amount: number): Promise<void> {
  const userId = await getUserId()
  if (!(amount > 0)) throw new Error("El monto debe ser mayor a 0")

  const record = await prisma.record.findFirst({
    where: { id: recordId, userId, status: { in: ["REVIEW", "CONFIRMED"] } },
    select: { id: true, type: true, name: true, currency: true },
  })
  if (!record) throw new Error("El registro ya fue pagado, cobrado o cancelado")

  if (record.type === "gasto") {
    const inst = await prisma.obligationInstallment.findFirst({
      where: { gastoRecordId: recordId, obligation: { userId }, status: { in: ["PENDING", "OVERDUE"] } },
      select: { id: true },
    })
    if (inst) {
      await acceptInstallmentPayment(inst.id, record.name, amount)
      return
    }
    const payment = await prisma.obligationPayment.findFirst({
      where: { gastoRecordId: recordId, userId, status: "PENDING" },
      select: { id: true },
    })
    if (payment) {
      await acceptObligationPayment(payment.id, record.name, amount)
      return
    }
  } else if (record.type === "ingreso") {
    const occ = await prisma.incomeOccurrence.findFirst({
      where: { ingresoRecordId: recordId, userId, status: "PENDING" },
      select: { id: true },
    })
    if (occ) {
      await collectIncomeOccurrence(occ.id, amount)
      return
    }
    const dividend = await findDividendByIngreso(userId, recordId)
    if (dividend) {
      await collectDividend(
        dividend.assetId,
        dividend.dividendId,
        dividend.boardId,
        amount,
        record.currency as Currency,
        dividend.assetName,
      )
      await prisma.record.update({ where: { id: recordId, userId }, data: { status: "ACTIVE" } })
      return
    }
  }

  // Un origen que ya no está pendiente (pagado/rechazado/cobrado por otro lado)
  // no se puede volver a confirmar: hacerlo saltearía su asiento contable.
  const linked =
    (await prisma.obligationInstallment.count({ where: { gastoRecordId: recordId, obligation: { userId } } })) +
    (await prisma.obligationPayment.count({ where: { gastoRecordId: recordId, userId } })) +
    (await prisma.incomeOccurrence.count({ where: { ingresoRecordId: recordId, userId } }))
  if (linked > 0) throw new Error("Este registro ya fue pagado, cobrado o rechazado desde su origen")

  // Sin origen (el origen se borró): se confirma el registro solo
  await prisma.record.update({ where: { id: recordId, userId }, data: { amount, status: "ACTIVE" } })
}

async function findDividendByIngreso(userId: string, ingresoId: string) {
  const assets = await prisma.record.findMany({
    where: { userId, type: "activo", deletedAt: null },
    select: { id: true, name: true, metadata: true },
  })
  for (const a of assets) {
    if (!a.metadata) continue
    for (const board of extractBoards(a.metadata as Record<string, unknown>)) {
      const d = (board.dividends ?? []).find((x) => x.ingresoRecordId === ingresoId && x.actualGain === undefined)
      if (d) return { assetId: a.id, assetName: a.name, boardId: board.id, dividendId: d.id }
    }
  }
  return null
}
