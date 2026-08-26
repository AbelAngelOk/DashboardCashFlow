import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import {
  setEntityMarker,
  removeEntityMarker,
  loadEntityMarkersForIds,
} from "@/lib/marker-actions"
import type { EntityType } from "@/lib/marker-types"

/** POST /api/markers/entity/lookup se resuelve acá con ?ids= para no crear otra ruta */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams
    const ids = (sp.get("ids") ?? "").split(",").filter(Boolean)
    const entityType = (sp.get("type") ?? "RECORD") as EntityType
    return { markers: await loadEntityMarkersForIds(ids, entityType) }
  })
}

/** Asigna un marcador. Uno por entidad: hace upsert, no acumula. */
export async function PUT(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ entityId?: string; entityType?: EntityType; markerId?: string }>(req)
    if (!b.entityId) throw badRequest("Falta entityId", "entityId")
    if (!b.markerId) throw badRequest("Falta markerId", "markerId")
    await setEntityMarker(b.entityId, b.entityType ?? "RECORD", b.markerId)
    return { ok: true }
  })
}

/** Quita la asignación. Nunca elimina la entidad marcada. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams
    const entityId = sp.get("entityId")
    if (!entityId) throw badRequest("Falta entityId", "entityId")
    await removeEntityMarker(entityId, (sp.get("type") ?? "RECORD") as EntityType)
    return { ok: true }
  })
}
