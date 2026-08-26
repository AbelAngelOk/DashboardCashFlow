import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { renameAssetCategory, deleteAssetCategory } from "@/lib/asset-category-actions"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ name?: string }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre no puede estar vacío", "name")
    await renameAssetCategory(id, b.name.trim())
    return { ok: true }
  })
}

/** Los activos que la usaban quedan sin etiqueta; nunca se eliminan activos. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    return { orphaned: await deleteAssetCategory(id) }
  })
}
