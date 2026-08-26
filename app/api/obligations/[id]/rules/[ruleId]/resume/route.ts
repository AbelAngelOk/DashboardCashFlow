import { handle } from "@/lib/api-helpers"
import { resumeObligationRule } from "@/lib/obligation-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; ruleId: string }> }) {
  return handle(async () => {
    const { id, ruleId } = await params
    await resumeObligationRule(ruleId, id)
    return { ok: true }
  })
}
