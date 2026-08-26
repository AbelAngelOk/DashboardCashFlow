import { handle, jsonBody } from "@/lib/api-helpers"
import { updateBoards } from "@/lib/assets-actions"
import type { BoardConfig } from "@/lib/assets"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ boards?: BoardConfig[] }>(req)
    await updateBoards(id, b.boards ?? [])
    return { ok: true }
  })
}
