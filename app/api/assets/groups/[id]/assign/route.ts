import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { assignToGroup } from "@/lib/assets-actions"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ childIds?: string[] }>(req)
    if (!b.childIds?.length) throw badRequest("Faltan childIds", "childIds")
    await assignToGroup(id, b.childIds)
    return { ok: true }
  })
}
