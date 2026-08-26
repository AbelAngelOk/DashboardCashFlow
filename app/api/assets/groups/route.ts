import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { createGroup } from "@/lib/assets-actions"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ name?: string; childIds?: string[]; currency?: Currency }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.childIds?.length) throw badRequest("Seleccioná al menos un activo", "childIds")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return { id: await createGroup(b.name.trim(), b.childIds, b.currency) }
  })
}
