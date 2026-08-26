import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { loadAssets, createAsset } from "@/lib/assets-actions"
import type { AssetType } from "@/lib/assets"
import type { Currency } from "@/lib/finance"

export async function GET() {
  return handle(async () => ({ assets: await loadAssets() }))
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{
      name?: string; assetType?: AssetType | null; ticker?: string; amount?: number
      currency?: Currency; tracksQuantity?: boolean; currentQty?: number; avgBuyPrice?: number
      description?: string; parentId?: string; metadata?: unknown
    }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (b.amount == null || b.amount < 0) throw badRequest("El monto es inválido", "amount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return { id: await createAsset({ ...b, name: b.name.trim(), amount: b.amount, currency: b.currency }) }
  })
}
