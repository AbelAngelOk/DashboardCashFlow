import { handle } from "@/lib/api-helpers"
import { deleteGroup } from "@/lib/assets-actions"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await deleteGroup(id)
    return { ok: true }
  })
}
