import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { collectFixedTerm } from "@/lib/assets-actions"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ collectedAmount?: number; currency?: Currency; assetName?: string }>(req)
    if (!b.collectedAmount || b.collectedAmount <= 0)
      throw badRequest("collectedAmount debe ser mayor a 0", "collectedAmount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    if (!b.assetName?.trim()) throw badRequest("Falta assetName", "assetName")
    return { ingresoId: await collectFixedTerm(id, b.collectedAmount, b.currency, b.assetName) }
  })
}
