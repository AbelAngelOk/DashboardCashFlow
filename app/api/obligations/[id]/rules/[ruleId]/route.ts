import { handle } from "@/lib/api-helpers"
import { deleteObligationRule } from "@/lib/obligation-actions"

type Ctx = { params: Promise<{ id: string; ruleId: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id, ruleId } = await params
    await deleteObligationRule(ruleId, id)
    return { ok: true }
  })
}
