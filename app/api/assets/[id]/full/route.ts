import { handle, notFound } from "@/lib/api-helpers"
import { loadAsset } from "@/lib/assets-actions"
import { loadIncomeRules } from "@/lib/income-actions"

/**
 * GET /api/assets/:id/full — detalle del activo + sus reglas de ingreso, en una
 * request. Evita los 2 round-trips que hoy hace `/activos/[id]` (loadAsset +
 * loadIncomeRules por separado).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const [asset, income] = await Promise.all([loadAsset(id), loadIncomeRules(id)])
    if (!asset) throw notFound("Activo no encontrado")
    return { asset, income }
  })
}
