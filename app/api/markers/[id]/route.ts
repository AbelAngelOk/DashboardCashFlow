import { handle, jsonBody } from "@/lib/api-helpers"
import { updateMarker, deleteMarker } from "@/lib/marker-actions"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ name?: string; color?: string; order?: number }>(req)
    await updateMarker(id, b)
    return { ok: true }
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    await deleteMarker(id)
    return { ok: true }
  })
}
