import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { dbCreateRecord, dbEditRecord, dbDeleteRecord } from "@/lib/actions"
import { editOrVersionRecord } from "@/lib/versioning-actions"
import type { FinancialRecord, Movement, Currency } from "@/lib/finance"

/**
 * CRUD genérico de Record (activos, pasivos, ingresos, gastos libres).
 *
 * Mantiene el mismo payload que usa hoy `FinanceProvider`: el cliente arma tanto
 * el `record` como la entrada de auditoría `movement` y los manda juntos. Se
 * conserva así a propósito (ver plan: no cambiar contratos salvo necesidad real).
 */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ record?: FinancialRecord; movement?: Movement }>(req)
    if (!b.record || !b.movement) throw badRequest("Faltan record o movement")
    await dbCreateRecord(b.record, b.movement)
    return { ok: true }
  })
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ record?: FinancialRecord; movement?: Movement }>(req)
    if (!b.record || !b.movement) throw badRequest("Faltan record o movement")
    await dbEditRecord(b.record, b.movement)
    return { ok: true }
  })
}

/** DELETE con body: mismo patrón que las otras dos, para no romper el contrato */
export async function DELETE(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ record?: FinancialRecord; movement?: Movement }>(req)
    if (!b.record || !b.movement) throw badRequest("Faltan record o movement")
    await dbDeleteRecord(b.record, b.movement)
    return { ok: true }
  })
}
