import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { loadIngresos, createFreeIngreso, createIngresoFromAsset } from "@/lib/ingreso-actions"
import type { Currency } from "@/lib/finance"

export async function GET(req: Request) {
  return handle(async () => {
    const raw = new URL(req.url).searchParams.get("status")
    const statuses = raw ? raw.split(",").filter(Boolean) : ["ACTIVE"]
    return { ingresos: await loadIngresos(statuses) }
  })
}

/**
 * POST /api/ingresos — 2 modos:
 *   free   ingreso autónomo
 *   asset  extracción parcial de un activo (baja su monto)
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{
      mode?: "free" | "asset"
      ingreso?: { name: string; amount: number; currency: Currency }
      assetId?: string
      egressAmount?: number
    }>(req)
    if (!b.ingreso?.name?.trim()) throw badRequest("El nombre es obligatorio", "ingreso.name")
    if (!b.ingreso.amount || b.ingreso.amount <= 0)
      throw badRequest("El monto debe ser mayor a 0", "ingreso.amount")

    if (b.mode === "asset") {
      if (!b.assetId) throw badRequest("Falta assetId", "assetId")
      if (!b.egressAmount || b.egressAmount <= 0)
        throw badRequest("egressAmount debe ser mayor a 0", "egressAmount")
      return { id: await createIngresoFromAsset(b.ingreso, b.assetId, b.egressAmount) }
    }
    return { id: await createFreeIngreso(b.ingreso) }
  })
}
