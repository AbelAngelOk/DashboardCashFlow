import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { setIncomeStreamValueMode } from "@/lib/income-actions"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ mode?: "PROJECTION" | "MANUAL" }>(req)
    if (b.mode !== "PROJECTION" && b.mode !== "MANUAL") throw badRequest("mode inválido", "mode")
    await setIncomeStreamValueMode(id, b.mode)
    return { ok: true }
  })
}
