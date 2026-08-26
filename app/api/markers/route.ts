import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { loadMarkers, createMarker } from "@/lib/marker-actions"

export async function GET() {
  return handle(async () => ({ markers: await loadMarkers() }))
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ name?: string; color?: string; order?: number }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.color?.trim()) throw badRequest("El color es obligatorio", "color")
    return createMarker({ name: b.name.trim(), color: b.color, order: b.order })
  })
}
