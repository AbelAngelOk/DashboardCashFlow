import { handle } from "@/lib/api-helpers"
import { rejectInstallmentPayment } from "@/lib/obligation-actions"

export async function POST(_req: Request, { params }: { params: Promise<{ installmentId: string }> }) {
  return handle(async () => {
    const { installmentId } = await params
    await rejectInstallmentPayment(installmentId)
    return { ok: true }
  })
}
