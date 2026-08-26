import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { editOrVersionRecord } from "@/lib/versioning-actions"
import type { Currency } from "@/lib/finance"

/** POST /api/records/version — editar in situ o crear nuevo período (RB-G03) */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{
      id?: string
      data?: { name: string; amount: number; currency: Currency; effectiveDate?: string }
      mode?: "edit" | "new-period"
      recordType?: "ingreso" | "gasto"
    }>(req)
    if (!b.id) throw badRequest("Falta id", "id")
    if (!b.data) throw badRequest("Falta data", "data")
    if (b.mode !== "edit" && b.mode !== "new-period") throw badRequest("mode inválido", "mode")
    if (b.recordType !== "ingreso" && b.recordType !== "gasto")
      throw badRequest("recordType inválido", "recordType")
    return editOrVersionRecord(
      b.id,
      { ...b.data, effectiveDate: b.data.effectiveDate ? new Date(b.data.effectiveDate) : undefined },
      b.mode,
      b.recordType,
    )
  })
}
