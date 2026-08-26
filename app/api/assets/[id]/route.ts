import { handle, jsonBody, notFound } from "@/lib/api-helpers"
import { loadAsset, updateAsset, deleteAsset } from "@/lib/assets-actions"
import type { AssetType } from "@/lib/assets"
import type { Currency } from "@/lib/finance"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const asset = await loadAsset(id)
    if (!asset) throw notFound("Activo no encontrado")
    return asset
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{
      name?: string; amount?: number; currency?: Currency; ticker?: string
      assetType?: AssetType | null; tracksQuantity?: boolean; currentQty?: number
      avgBuyPrice?: number; description?: string; metadata?: unknown
    }>(req)
    await updateAsset(id, b)
    return { ok: true }
  })
}

/** Baja lógica (deletedAt). La eliminación física es un endpoint aparte. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    await deleteAsset(id)
    return { ok: true }
  })
}
