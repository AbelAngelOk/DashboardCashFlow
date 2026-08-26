import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { collectDividend } from "@/lib/assets-actions"
import type { Currency } from "@/lib/finance"

type Ctx = { params: Promise<{ id: string; dividendId: string }> }

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id, dividendId } = await params
    const b = await jsonBody<{ boardId?: string; actualGain?: number; currency?: Currency; assetName?: string }>(req)
    if (!b.boardId) throw badRequest("Falta boardId", "boardId")
    if (!b.actualGain || b.actualGain <= 0) throw badRequest("actualGain debe ser mayor a 0", "actualGain")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    if (!b.assetName?.trim()) throw badRequest("Falta assetName", "assetName")
    return { ingresoId: await collectDividend(id, dividendId, b.boardId, b.actualGain, b.currency, b.assetName) }
  })
}
