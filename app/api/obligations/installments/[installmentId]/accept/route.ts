import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { acceptInstallmentPayment } from "@/lib/obligation-actions"

export async function POST(req: Request, { params }: { params: Promise<{ installmentId: string }> }) {
  return handle(async () => {
    const { installmentId } = await params
    const b = await jsonBody<{ gastoName?: string }>(req)
    if (!b.gastoName?.trim()) throw badRequest("Falta gastoName", "gastoName")
    return { gastoId: await acceptInstallmentPayment(installmentId, b.gastoName.trim()) }
  })
}
