import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { addMovement } from "@/lib/assets-actions"
import type { MovementType } from "@/lib/assets"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{
      movementType?: MovementType; amount?: number; quantity?: number; unitPrice?: number
      currency?: Currency; exchangeRate?: number; description?: string
      operationDate?: string; metadata?: unknown; skipJournalEntry?: boolean
    }>(req)
    if (!b.movementType) throw badRequest("Falta movementType", "movementType")
    if (b.amount == null) throw badRequest("Falta amount", "amount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return {
      id: await addMovement({
        ...b, recordId: id, movementType: b.movementType, amount: b.amount, currency: b.currency,
        operationDate: b.operationDate ? new Date(b.operationDate) : undefined,
      }),
    }
  })
}
