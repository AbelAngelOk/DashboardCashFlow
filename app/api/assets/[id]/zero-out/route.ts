import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { zeroOutAsset } from "@/lib/assets-actions"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{
      previousAmount?: number; currency?: Currency; assetName?: string
      description?: string; createIngreso?: boolean
    }>(req)
    if (b.previousAmount == null) throw badRequest("Falta previousAmount", "previousAmount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    if (!b.assetName?.trim()) throw badRequest("Falta assetName", "assetName")
    return { ingresoId: await zeroOutAsset(id, b.previousAmount, b.currency, b.assetName, b.description, b.createIngreso) }
  })
}
