import { handle, jsonBody } from "@/lib/api-helpers"
import { updateMovement, deleteMovement } from "@/lib/assets-actions"
import type { MovementType } from "@/lib/assets"

type Ctx = { params: Promise<{ movementId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { movementId } = await params
    const b = await jsonBody<{
      movementType?: MovementType; amount?: number; quantity?: number; unitPrice?: number
      description?: string; operationDate?: string; metadata?: unknown
    }>(req)
    await updateMovement(movementId, {
      ...b, operationDate: b.operationDate ? new Date(b.operationDate) : undefined,
    })
    return { ok: true }
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { movementId } = await params
    await deleteMovement(movementId)
    return { ok: true }
  })
}
