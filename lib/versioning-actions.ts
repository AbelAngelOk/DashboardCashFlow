"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
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

export async function editOrVersionRecord(
  id: string,
  data: { name: string; amount: number; currency: Currency; effectiveDate?: Date },
  mode: "edit" | "new-period",
  recordType: "ingreso" | "gasto",
): Promise<{ id: string }> {
  const userId = await getUserId()

  if (mode === "edit") {
    await prisma.$transaction([
      prisma.record.update({
        where: { id, userId, type: recordType },
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
          recordType,
          recordName: data.name,
          detail: `${recordType === "ingreso" ? "Ingreso" : "Gasto"} editado: "${data.name}" por ${data.amount} ${data.currency}`,
          userId,
          recordId: id,
        },
      }),
    ])
    return { id }
  }

  // mode === "new-period": mark old record HISTORICAL, create new ACTIVE record
  const newId = crypto.randomUUID()
  await prisma.$transaction([
    prisma.record.update({
      where: { id, userId, type: recordType },
      data: { status: "HISTORICAL" },
    }),
    prisma.record.create({
      data: {
        id: newId,
        type: recordType,
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        userId,
        status: "ACTIVE",
        operationDate: new Date(),
        ...(data.effectiveDate ? { effectiveDate: data.effectiveDate } : {}),
        previousVersionId: id,
      },
    }),
    prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        date: auditDate(),
        action: "creado",
        recordType,
        recordName: data.name,
        detail: `Nuevo período de "${data.name}" (reemplaza versión anterior)`,
        userId,
        recordId: newId,
      },
    }),
  ])

  const debitAccount = recordType === "ingreso" ? "efectivo" : "gastos"
  const creditAccount = recordType === "ingreso" ? "ingresos" : "efectivo"
  await createJournalEntry(userId, {
    description: `Nuevo período: ${data.name}`,
    currency: data.currency,
    amount: data.amount,
    debitAccount,
    creditAccount,
    targetEntityId: newId,
  })

  return { id: newId }
}
