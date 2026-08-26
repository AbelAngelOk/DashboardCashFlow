import { handle } from "@/lib/api-helpers"
import { archiveIngreso } from "@/lib/ingreso-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await archiveIngreso(id)
    return { ok: true }
  })
}
