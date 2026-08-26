import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { addObligationRule } from "@/lib/obligation-actions"
import type { RecurrenceType } from "@/lib/obligations"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{
      name?: string; recurrenceType?: RecurrenceType; startDate?: string
      expectedAmount?: number; currency?: Currency
    }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.recurrenceType) throw badRequest("Falta recurrenceType", "recurrenceType")
    if (!b.startDate) throw badRequest("Falta startDate", "startDate")
    if (!b.expectedAmount || b.expectedAmount <= 0)
      throw badRequest("El monto debe ser mayor a 0", "expectedAmount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return {
      id: await addObligationRule(id, {
        name: b.name.trim(), recurrenceType: b.recurrenceType, startDate: b.startDate,
        expectedAmount: b.expectedAmount, currency: b.currency,
      }),
    }
  })
}
