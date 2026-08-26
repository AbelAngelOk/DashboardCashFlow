import { handle } from "@/lib/api-helpers"
import { ungroupAssets } from "@/lib/assets-actions"

/** POST /api/assets/:id/ungroup — :id es el grupo. Desvincula hijos y da de baja el grupo. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await ungroupAssets(id)
    return { ok: true }
  })
}
