import { handle } from "@/lib/api-helpers"
import { pauseIncomeRule } from "@/lib/income-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  return handle(async () => {
    const { ruleId } = await params
    await pauseIncomeRule(ruleId)
    return { ok: true }
  })
}
