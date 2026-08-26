import { handle, jsonBody, badRequest, notFound } from "@/lib/api-helpers"
import { loadIngreso, editIngreso } from "@/lib/ingreso-actions"
import { loadLinksForIngreso } from "@/lib/link-actions"
import type { Currency } from "@/lib/finance"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const [ingreso, links] = await Promise.all([loadIngreso(id), loadLinksForIngreso(id)])
    if (!ingreso) throw notFound("Ingreso no encontrado")
    return { ...ingreso, links }
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ name?: string; amount?: number; currency?: Currency; effectiveDate?: string }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.amount || b.amount <= 0) throw badRequest("El monto debe ser mayor a 0", "amount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    await editIngreso(id, {
      name: b.name.trim(), amount: b.amount, currency: b.currency,
      effectiveDate: b.effectiveDate ? new Date(b.effectiveDate) : undefined,
    })
    return { ok: true }
  })
}
