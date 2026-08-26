import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { acceptObligationPayment } from "@/lib/obligation-actions"

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  return handle(async () => {
    const { paymentId } = await params
    const b = await jsonBody<{ gastoName?: string }>(req)
    if (!b.gastoName?.trim()) throw badRequest("Falta gastoName", "gastoName")
    return { gastoId: await acceptObligationPayment(paymentId, b.gastoName.trim()) }
  })
}
