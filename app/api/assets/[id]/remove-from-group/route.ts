import { handle } from "@/lib/api-helpers"
import { removeFromGroup } from "@/lib/assets-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await removeFromGroup(id)
    return { ok: true }
  })
}
