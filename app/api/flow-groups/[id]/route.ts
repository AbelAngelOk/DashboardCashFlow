import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { renameFlowGroup, deleteFlowGroup } from "@/lib/flow-group-actions"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ name?: string }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre no puede estar vacío", "name")
    await renameFlowGroup(id, b.name.trim())
    return { ok: true }
  })
}

/** No elimina los miembros: solo el grupo (RB-G06) */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    await deleteFlowGroup(id)
    return { ok: true }
  })
}
