import { handle, jsonBody, badRequest, conflict } from "@/lib/api-helpers"
import {
  getCutoffStatus,
  getCutoffPreview,
  executeCutoff,
  setCutoffDay,
  listCutoffs,
} from "@/lib/cutoff-actions"
import { isValidCutoffDay, type CutoffOptions } from "@/lib/cutoff"

/**
 * GET /api/cutoff            -> estado (día, período pendiente, disponibilidad)
 * GET /api/cutoff?preview=1  -> + impacto del corte, sin ejecutar nada
 * GET /api/cutoff?history=1  -> + cortes ya ejecutados
 *
 * Se paralelizan: el diálogo necesita estado y vista previa a la vez.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams
    const wantPreview = sp.get("preview") === "1"
    const wantHistory = sp.get("history") === "1"
    const [status, preview, history] = await Promise.all([
      getCutoffStatus(),
      wantPreview ? getCutoffPreview() : Promise.resolve(null),
      wantHistory ? listCutoffs() : Promise.resolve(null),
    ])
    return {
      status,
      ...(preview ? { preview } : {}),
      ...(history ? { history } : {}),
    }
  })
}

/** POST /api/cutoff — ejecuta el corte. Revalida elegibilidad en servidor. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<Partial<CutoffOptions>>(req)
    try {
      return await executeCutoff({
        takeSnapshot: b.takeSnapshot ?? true,
        keepMarked: b.keepMarked ?? false,
        clearEntityMarkers: b.clearEntityMarkers ?? false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      // "El corte de X ya fue realizado" es un conflicto de estado, no un 500
      if (/ya fue realizado/i.test(msg)) throw conflict(msg)
      throw e
    }
  })
}

/** PATCH /api/cutoff — cambia el día de corte (1-28) */
export async function PATCH(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ cutoffDay?: number }>(req)
    if (b.cutoffDay == null || !isValidCutoffDay(b.cutoffDay))
      throw badRequest("El día de corte debe estar entre 1 y 28", "cutoffDay")
    await setCutoffDay(b.cutoffDay)
    return { ok: true }
  })
}
