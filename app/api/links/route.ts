import { handle, jsonBody, badRequest, requireUserId } from "@/lib/api-helpers"
import {
  createGastoIngresoLink,
  loadLinksForGasto,
  loadLinksForIngreso,
} from "@/lib/link-actions"
import type { Currency } from "@/lib/finance"

/** GET /api/links?gastoId=X  o  ?ingresoId=X */
export async function GET(req: Request) {
  return handle(async () => {
    // La sesión se valida antes que los parámetros: un cliente sin sesión debe
    // recibir 401, no una pista de qué parámetros espera el endpoint.
    await requireUserId()
    const sp = new URL(req.url).searchParams
    const gastoId = sp.get("gastoId")
    const ingresoId = sp.get("ingresoId")
    if (gastoId) return { links: await loadLinksForGasto(gastoId) }
    if (ingresoId) return { links: await loadLinksForIngreso(ingresoId) }
    throw badRequest("Falta gastoId o ingresoId")
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{
      gastoId?: string; ingresoId?: string; attributedAmount?: number; currency?: Currency
    }>(req)
    if (!b.gastoId) throw badRequest("Falta gastoId", "gastoId")
    if (!b.ingresoId) throw badRequest("Falta ingresoId", "ingresoId")
    if (!b.attributedAmount || b.attributedAmount <= 0)
      throw badRequest("El monto atribuido debe ser mayor a 0", "attributedAmount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return {
      id: await createGastoIngresoLink({
        gastoId: b.gastoId, ingresoId: b.ingresoId,
        attributedAmount: b.attributedAmount, currency: b.currency,
      }),
    }
  })
}
