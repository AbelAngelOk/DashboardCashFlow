"use server"

import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { Currency } from "./finance"
import type { AccountType, AccountBalances, JournalEntryRecord } from "./journal-internal"

// Los tipos NO se reexportan desde acá: Next.js emite el re-export en runtime y
// rompe el build de un archivo "use server". Los consumidores importan los tipos
// directamente de ./journal-internal.

// `createJournalEntry` vive en ./journal-internal a propósito. Recibe `userId` del
// llamador, y todo export de un archivo "use server" es invocable desde el navegador:
// acá habría permitido escribir asientos en el libro de cualquier usuario.
// NO la reexportes desde este archivo.

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

// ── Load: paginated/filtered journal entries ──────────────────────────────────

export async function loadJournalEntries(filters?: {
  fromDate?: string
  toDate?: string
  account?: string
  currency?: string
}): Promise<JournalEntryRecord[]> {
  const userId = await getUserId()

  const where: Prisma.JournalEntryWhereInput = { userId }

  if (filters?.fromDate) {
    where.date = { ...((where.date as object) ?? {}), gte: new Date(filters.fromDate) }
  }
  if (filters?.toDate) {
    where.date = { ...((where.date as object) ?? {}), lte: new Date(filters.toDate + "T23:59:59") }
  }
  if (filters?.account) {
    where.OR = [
      { debitAccount: filters.account },
      { creditAccount: filters.account },
    ]
  }
  if (filters?.currency) {
    where.currency = filters.currency
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: { date: "desc" },
    take: 500,
  })

  return entries.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    description: e.description,
    currency: e.currency as Currency,
    amount: typeof e.amount === "number" ? e.amount : (e.amount as { toNumber: () => number }).toNumber(),
    debitAccount: e.debitAccount as AccountType,
    creditAccount: e.creditAccount as AccountType,
    sourceEntityId: e.sourceEntityId ?? undefined,
    targetEntityId: e.targetEntityId ?? undefined,
    reference: e.reference ?? undefined,
    notes: e.notes ?? undefined,
  }))
}

// ── Account balances as of a date ─────────────────────────────────────────────

export async function getAccountBalances(asOfDate?: Date): Promise<AccountBalances> {
  const userId = await getUserId()

  const where: Prisma.JournalEntryWhereInput = { userId }
  if (asOfDate) {
    where.date = { lte: asOfDate }
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    select: { debitAccount: true, creditAccount: true, amount: true, currency: true },
  })

  const balances: AccountBalances = {
    activos: {},
    pasivos: {},
    ingresos: {},
    gastos: {},
    efectivo: {},
    obligaciones: {},
  }

  for (const e of entries) {
    const amt = typeof e.amount === "number" ? e.amount : (e.amount as { toNumber: () => number }).toNumber()
    const cur = e.currency
    const debit = e.debitAccount as AccountType
    const credit = e.creditAccount as AccountType

    // DEBIT increases the debit account
    balances[debit][cur] = (balances[debit][cur] ?? 0) + amt
    // CREDIT decreases the credit account (or increases it depending on account type)
    // For simplicity: we track net flow per account (debit adds, credit subtracts)
    balances[credit][cur] = (balances[credit][cur] ?? 0) - amt
  }

  return balances
}

// ── Initialize account balances from existing Records ────────────────────────
// Creates an opening journal entry for each account based on current Record state.
// Call once after deploying the Libro Contable for the first time.

export async function initializeAccountBalances(): Promise<void> {
  const userId = await getUserId()

  const existing = await prisma.journalEntry.findFirst({
    where: { userId, notes: "saldo-inicial" },
  })
  if (existing) return // Already initialized

  const records = await prisma.record.findMany({
    where: { userId, deletedAt: null, status: "ACTIVE" },
    select: { type: true, amount: true, currency: true },
  })

  const totals: Partial<Record<string, Record<string, number>>> = {}

  for (const r of records) {
    const account =
      r.type === "activo" ? "activos"
      : r.type === "pasivo" ? "pasivos"
      : r.type === "ingreso" ? "ingresos"
      : "gastos"

    if (!totals[account]) totals[account] = {}
    const amt = typeof r.amount === "number" ? r.amount : (r.amount as { toNumber: () => number }).toNumber()
    totals[account]![r.currency] = (totals[account]![r.currency] ?? 0) + amt
  }

  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  for (const [account, currencies] of Object.entries(totals)) {
    if (!currencies) continue
    for (const [currency, amount] of Object.entries(currencies)) {
      if (amount <= 0) continue
      await prisma.journalEntry.create({
        data: {
          id: crypto.randomUUID(),
          description: `Saldo inicial — ${today}`,
          currency,
          amount,
          debitAccount: account,
          creditAccount: "efectivo",
          userId,
          notes: "saldo-inicial",
        },
      })
    }
  }
}
