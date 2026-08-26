import { handle } from "@/lib/api-helpers"
import { loadHistorial } from "@/lib/actions"

/**
 * GET /api/historial — auditoría paginada en servidor.
 * Mantiene los mismos filtros que /historial usa hoy vía URL.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams
    return loadHistorial({
      page: Number(sp.get("page") ?? 1),
      pageSize: Number(sp.get("pageSize") ?? 25),
      action: sp.get("action") ?? undefined,
      recordType: sp.get("recordType") ?? undefined,
      search: sp.get("search") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    })
  })
}
