import { handle } from "@/lib/api-helpers"
import { deleteGastoIngresoLink } from "@/lib/link-actions"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await deleteGastoIngresoLink(id)
    return { ok: true }
  })
}
