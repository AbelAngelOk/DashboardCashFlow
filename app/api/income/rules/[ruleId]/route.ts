import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { updateIncomeRule, deleteIncomeRule, type IncomeRuleInput } from "@/lib/income-actions"

type Ctx = { params: Promise<{ ruleId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { ruleId } = await params
    const b = await jsonBody<Partial<IncomeRuleInput>>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    await updateIncomeRule(ruleId, { ...b, name: b.name.trim() } as IncomeRuleInput)
    return { ok: true }
  })
}

/** RB-F09: cancela lo pendiente; los cobros ya confirmados sobreviven */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { ruleId } = await params
    await deleteIncomeRule(ruleId)
    return { ok: true }
  })
}
