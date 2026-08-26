import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { updateObligationStatus } from "@/lib/obligation-actions"
import type { ObligationStatus } from "@/lib/obligations"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ status?: ObligationStatus }>(req)
    if (!b.status) throw badRequest("Falta status", "status")
    await updateObligationStatus(id, b.status)
    return { ok: true }
  })
}
