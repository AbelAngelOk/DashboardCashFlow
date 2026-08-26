import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { loadObligations, createObligation } from "@/lib/obligation-actions"
import type { ObligationType } from "@/lib/obligations"
import type { Currency } from "@/lib/finance"

export async function GET() {
  return handle(async () => ({ obligations: await loadObligations() }))
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{
      name?: string; description?: string; obligationType?: ObligationType; currency?: Currency
      fixedAmount?: number; installmentCount?: number; installmentAmount?: number; firstDueDate?: string
    }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.obligationType) throw badRequest("Falta obligationType", "obligationType")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return { id: await createObligation({ ...b, name: b.name.trim(), obligationType: b.obligationType, currency: b.currency }) }
  })
}
