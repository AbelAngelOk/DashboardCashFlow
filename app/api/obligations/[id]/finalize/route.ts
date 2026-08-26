import { handle, jsonBody } from "@/lib/api-helpers"
import { finalizeObligation } from "@/lib/obligation-actions"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params
    const b = await jsonBody<{ generateExpenses?: boolean }>(req)
    await finalizeObligation(id, b.generateExpenses ?? false)
    return { ok: true }
  })
}
