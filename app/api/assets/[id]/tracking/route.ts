import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { updateTracking } from "@/lib/assets-actions"
import type { TrackingConfig } from "@/lib/assets"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ tracking?: TrackingConfig }>(req)
    if (!b.tracking) throw badRequest("Falta tracking", "tracking")
    await updateTracking(id, b.tracking)
    return { ok: true }
  })
}
