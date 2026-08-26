import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { registerManualPayment } from "@/lib/obligation-actions"
import type { PaymentType } from "@/lib/obligations"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ amount?: number; paymentType?: PaymentType; comment?: string; gastoName?: string }>(req)
    if (!b.amount || b.amount <= 0) throw badRequest("El monto debe ser mayor a 0", "amount")
    if (!b.paymentType) throw badRequest("Falta paymentType", "paymentType")
    if (!b.gastoName?.trim()) throw badRequest("Falta gastoName", "gastoName")
    return { id: await registerManualPayment(id, { amount: b.amount, paymentType: b.paymentType, comment: b.comment, gastoName: b.gastoName.trim() }) }
  })
}
