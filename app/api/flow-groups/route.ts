import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { loadGastoGroups, loadIngresoGroups, createFlowGroup } from "@/lib/flow-group-actions"

/** GET /api/flow-groups?type=EXPENSE|INCOME — ambos en paralelo si no se especifica */
export async function GET(req: Request) {
  return handle(async () => {
    const type = new URL(req.url).searchParams.get("type")
    if (type === "EXPENSE") return { groups: await loadGastoGroups() }
    if (type === "INCOME") return { groups: await loadIngresoGroups() }
    const [gastoGroups, ingresoGroups] = await Promise.all([loadGastoGroups(), loadIngresoGroups()])
    return { gastoGroups, ingresoGroups }
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ name?: string; groupType?: "EXPENSE" | "INCOME"; recordIds?: string[] }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (b.groupType !== "EXPENSE" && b.groupType !== "INCOME")
      throw badRequest("groupType inválido", "groupType")
    return { id: await createFlowGroup(b.name.trim(), b.groupType, b.recordIds ?? []) }
  })
}
