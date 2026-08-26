import { handle } from "@/lib/api-helpers"
import {
  loadJournalEntries,
  getAccountBalances,
  initializeAccountBalances,
} from "@/lib/journal-actions"

/**
 * GET /api/journal — asientos + saldos por cuenta en una sola request.
 * Hoy /libro-contable los pide por separado; son independientes, así que van
 * en paralelo.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams
    const asOf = sp.get("asOf")
    const [entries, balances] = await Promise.all([
      loadJournalEntries({
        fromDate: sp.get("fromDate") ?? undefined,
        toDate: sp.get("toDate") ?? undefined,
        account: sp.get("account") ?? undefined,
        currency: sp.get("currency") ?? undefined,
      }),
      getAccountBalances(asOf ? new Date(asOf) : undefined),
    ])
    return { entries, balances }
  })
}

/** POST /api/journal — siembra los saldos de apertura. Idempotente. */
export async function POST() {
  return handle(async () => {
    await initializeAccountBalances()
    return { ok: true }
  })
}
