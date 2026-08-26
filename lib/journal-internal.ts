// Libro contable — tipos y escritura interna.
//
// IMPORTANTE: este módulo NO lleva "use server" a propósito.
//
// En Next.js, *todo* export de un archivo "use server" queda expuesto como un
// endpoint RPC invocable desde el navegador. `createJournalEntry` recibe `userId`
// como parámetro (a diferencia de las otras 109 acciones, que lo derivan de la
// sesión), así que estando en un archivo "use server" un cliente autenticado podía
// escribir asientos en el libro contable de CUALQUIER usuario.
//
// Al vivir en un módulo normal, la función solo es alcanzable desde código de
// servidor. No la reexportes desde un archivo "use server".

import { prisma } from "./db"
import type { Currency } from "./finance"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AccountType =
  | "activos"
  | "pasivos"
  | "ingresos"
  | "gastos"
  | "efectivo"
  | "obligaciones"

export interface JournalEntryRecord {
  id: string
  date: string
  description: string
  currency: Currency
  amount: number
  debitAccount: AccountType
  creditAccount: AccountType
  sourceEntityId?: string
  targetEntityId?: string
  reference?: string
  notes?: string
}

export interface AccountBalances {
  activos: Record<string, number>
  pasivos: Record<string, number>
  ingresos: Record<string, number>
  gastos: Record<string, number>
  efectivo: Record<string, number>
  obligaciones: Record<string, number>
}

// ── Escritura ─────────────────────────────────────────────────────────────────

/**
 * Crea un asiento contable. Uso exclusivamente interno: `userId` viene del
 * llamador, que ya lo derivó de la sesión.
 */
export async function createJournalEntry(
  userId: string,
  data: {
    description: string
    currency: string
    amount: number
    debitAccount: AccountType
    creditAccount: AccountType
    sourceEntityId?: string
    targetEntityId?: string
    reference?: string
    notes?: string
  },
): Promise<string> {
  const id = crypto.randomUUID()
  await prisma.journalEntry.create({
    data: {
      id,
      description: data.description,
      currency: data.currency,
      amount: data.amount,
      debitAccount: data.debitAccount,
      creditAccount: data.creditAccount,
      sourceEntityId: data.sourceEntityId ?? null,
      targetEntityId: data.targetEntityId ?? null,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      userId,
    },
  })
  return id
}
