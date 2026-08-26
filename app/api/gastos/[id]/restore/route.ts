import { handle } from "@/lib/api-helpers"
import { restoreGasto } from "@/lib/gasto-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await restoreGasto(id)
    return { ok: true }
  })
}
