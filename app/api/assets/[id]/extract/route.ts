import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { createExtractFromDashboard } from "@/lib/assets-actions"
import type { Currency } from "@/lib/finance"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{
      newAmount?: number; egressAmount?: number; currency?: Currency
      assetName?: string; description?: string; createIngreso?: boolean
    }>(req)
    if (b.newAmount == null) throw badRequest("Falta newAmount", "newAmount")
    if (b.egressAmount == null) throw badRequest("Falta egressAmount", "egressAmount")
    if (!b.currency) throw badRequest("Falta currency", "currency")
    if (!b.assetName?.trim()) throw badRequest("Falta assetName", "assetName")
    return {
      ingresoId: await createExtractFromDashboard(
        id, b.newAmount, b.egressAmount, b.currency, b.assetName, b.description, b.createIngreso,
      ),
    }
  })
}
