import { handle } from "@/lib/api-helpers"
import { rejectObligationPayment } from "@/lib/obligation-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  return handle(async () => {
    const { paymentId } = await params
    await rejectObligationPayment(paymentId)
    return { ok: true }
  })
}
