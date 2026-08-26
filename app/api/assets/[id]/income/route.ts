import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { loadIncomeRules, createIncomeRule, type IncomeRuleInput } from "@/lib/income-actions"

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/assets/:id/income — reglas + ocurrencias + proyección anual */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    return loadIncomeRules(id)
  })
}

export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<Partial<IncomeRuleInput>>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.recurrenceType) throw badRequest("Falta recurrenceType", "recurrenceType")
    if (!b.startDate) throw badRequest("Falta startDate", "startDate")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    return { id: await createIncomeRule(id, { ...b, name: b.name.trim() } as IncomeRuleInput) }
  })
}
