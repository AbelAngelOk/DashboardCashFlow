import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import {
  loadAssetCategories,
  createAssetCategory,
  ensureAssetCategories,
  assetCountByCategory,
} from "@/lib/asset-category-actions"

/** GET /api/categories?counts=1 — categorías, opcionalmente con uso por categoría */
export async function GET(req: Request) {
  return handle(async () => {
    const withCounts = new URL(req.url).searchParams.get("counts") === "1"
    if (!withCounts) return { categories: await loadAssetCategories() }
    const [categories, counts] = await Promise.all([
      loadAssetCategories(),
      assetCountByCategory(),
    ])
    return { categories, counts }
  })
}

/** POST /api/categories — crea una categoría, o siembra las legadas con ?seed=1 */
export async function POST(req: Request) {
  return handle(async () => {
    if (new URL(req.url).searchParams.get("seed") === "1") {
      const b = await jsonBody<{ extra?: { id: string; name: string }[] }>(req)
      return { categories: await ensureAssetCategories(b.extra ?? []) }
    }
    const b = await jsonBody<{ name?: string }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre no puede estar vacío", "name")
    return await createAssetCategory(b.name.trim())
  })
}
