import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { assignToFlowGroup, removeFromFlowGroup } from "@/lib/flow-group-actions"

type Ctx = { params: Promise<{ id: string }> }

/** PUT: agrega (upsert, sin duplicar — RB-G07) */
export async function PUT(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ recordId?: string }>(req)
    if (!b.recordId) throw badRequest("Falta recordId", "recordId")
    await assignToFlowGroup(id, b.recordId)
    return { ok: true }
  })
}

export async function DELETE(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const recordId = new URL(req.url).searchParams.get("recordId")
    if (!recordId) throw badRequest("Falta recordId", "recordId")
    await removeFromFlowGroup(id, recordId)
    return { ok: true }
  })
}
