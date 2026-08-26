import { handle, jsonBody, badRequest, notFound } from "@/lib/api-helpers"
import { loadGasto, editGasto } from "@/lib/gasto-actions"
import { loadLinksForGasto } from "@/lib/link-actions"
import type { Currency } from "@/lib/finance"

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/gastos/:id — detalle + vínculos, en paralelo (evita 2 round-trips) */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const [gasto, links] = await Promise.all([loadGasto(id), loadLinksForGasto(id)])
    if (!gasto) throw notFound("Gasto no encontrado")
    return { ...gasto, links }
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ name?: string; amount?: number; currency?: Currency; effectiveDate?: string }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.amount || b.amount <= 0) throw badRequest("El monto debe ser mayor a 0", "amount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    await editGasto(id, {
      name: b.name.trim(), amount: b.amount, currency: b.currency,
      effectiveDate: b.effectiveDate ? new Date(b.effectiveDate) : undefined,
    })
    return { ok: true }
  })
}
