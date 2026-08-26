import { handle } from "@/lib/api-helpers"
import { archiveGasto } from "@/lib/gasto-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await archiveGasto(id)
    return { ok: true }
  })
}
