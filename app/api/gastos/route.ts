import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import {
  loadGastos,
  createFreeGasto,
  createLinkedGasto,
  createGastoForExistingAsset,
  createGastoAndNewAsset,
} from "@/lib/gasto-actions"
import type { Currency } from "@/lib/finance"
import type { AssetType } from "@/lib/assets"

/** GET /api/gastos?status=ACTIVE,HISTORICAL,ARCHIVED (coma-separado) */
export async function GET(req: Request) {
  return handle(async () => {
    const raw = new URL(req.url).searchParams.get("status")
    const statuses = raw ? raw.split(",").filter(Boolean) : ["ACTIVE"]
    return { gastos: await loadGastos(statuses) }
  })
}

type GastoData = { name: string; amount: number; currency: Currency }

/**
 * POST /api/gastos — 4 modos de creación, igual que hoy elige el cliente:
 *   free              gasto autónomo
 *   linked            vinculado a un activo existente, sin tocar su monto
 *   existing-asset    gasto + depósito en un activo existente
 *   new-asset         gasto + activo nuevo
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{
      mode?: "free" | "linked" | "existing-asset" | "new-asset"
      gasto?: GastoData
      linkedTo?: string
      assetId?: string
      asset?: { name: string; assetType?: AssetType | null; amount: number; currency: Currency; description?: string }
    }>(req)

    if (!b.gasto?.name?.trim()) throw badRequest("El nombre es obligatorio", "gasto.name")
    if (!b.gasto.amount || b.gasto.amount <= 0) throw badRequest("El monto debe ser mayor a 0", "gasto.amount")

    switch (b.mode) {
      case "linked": {
        if (!b.linkedTo) throw badRequest("Falta linkedTo", "linkedTo")
        return { id: await createLinkedGasto({ ...b.gasto, linkedTo: b.linkedTo }) }
      }
      case "existing-asset": {
        if (!b.assetId) throw badRequest("Falta assetId", "assetId")
        return { id: await createGastoForExistingAsset(b.gasto, b.assetId) }
      }
      case "new-asset": {
        if (!b.asset?.name?.trim()) throw badRequest("Falta el nombre del activo", "asset.name")
        return await createGastoAndNewAsset(b.gasto, b.asset)
      }
      case "free":
      default:
        return { id: await createFreeGasto(b.gasto) }
    }
  })
}
