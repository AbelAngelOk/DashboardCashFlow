import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { createAdjustmentMovement } from "@/lib/assets-actions"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ difference?: number; currency?: Currency; description?: string }>(req)
    if (b.difference == null) throw badRequest("Falta difference", "difference")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    await createAdjustmentMovement(id, b.difference, b.currency, b.description)
    return { ok: true }
  })
}
