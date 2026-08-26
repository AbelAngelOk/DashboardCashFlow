import { handle } from "@/lib/api-helpers"
import { resumeIncomeRule } from "@/lib/income-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  return handle(async () => {
    const { ruleId } = await params
    await resumeIncomeRule(ruleId)
    return { ok: true }
  })
}
