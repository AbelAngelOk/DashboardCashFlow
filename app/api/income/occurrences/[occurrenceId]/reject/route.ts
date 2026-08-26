import { handle } from "@/lib/api-helpers"
import { rejectIncomeOccurrence } from "@/lib/income-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ occurrenceId: string }> }) {
  return handle(async () => {
    const { occurrenceId } = await params
    await rejectIncomeOccurrence(occurrenceId)
    return { ok: true }
  })
}
