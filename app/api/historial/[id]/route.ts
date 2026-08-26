import { handle, jsonBody } from "@/lib/api-helpers"
import { dbUpdateComment } from "@/lib/actions"

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/historial/:id — comentario de una entrada de auditoría */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ comment?: string }>(req)
    await dbUpdateComment(id, b.comment ?? "")
    return { ok: true }
  })
}
