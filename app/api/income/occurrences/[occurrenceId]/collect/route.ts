import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { collectIncomeOccurrence } from "@/lib/income-actions"

export async function POST(req: Request, { params }: { params: Promise<{ occurrenceId: string }> }) {
  return handle(async () => {
    const { occurrenceId } = await params
    const b = await jsonBody<{ actualAmount?: number; comment?: string; quantity?: number }>(req)
    if (!b.actualAmount || b.actualAmount <= 0)
      throw badRequest("El monto cobrado debe ser mayor a 0", "actualAmount")
    await collectIncomeOccurrence(occurrenceId, b.actualAmount, b.comment, b.quantity)
    return { ok: true }
  })
}
