import { handle } from "@/lib/api-helpers"
import { physicalDeleteAsset } from "@/lib/assets-actions"

/** Guarda de seguridad server-side: solo elimina si amount sigue en 0. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    await physicalDeleteAsset(id)
    return { ok: true }
  })
}
