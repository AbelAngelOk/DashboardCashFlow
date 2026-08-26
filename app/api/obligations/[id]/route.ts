import { handle, jsonBody, notFound } from "@/lib/api-helpers"
import { loadObligation, updateObligationInfo, deleteObligation } from "@/lib/obligation-actions"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const o = await loadObligation(id)
    if (!o) throw notFound("Obligación no encontrada")
    return o
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ name?: string; description?: string }>(req)
    await updateObligationInfo(id, b)
    return { ok: true }
  })
}

/** Cascade elimina reglas, cuotas y pagos (definido en el schema) */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    await deleteObligation(id)
    return { ok: true }
  })
}
