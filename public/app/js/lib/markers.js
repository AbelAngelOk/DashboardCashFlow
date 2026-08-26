// Wrappers finos sobre /api/markers y /api/markers/entity. La cache TTL de
// /api/markers ya la maneja api.js (ver CACHEABLE) — acá solo se invalida
// después de un CRUD, igual que hacía useMarkers() al recargar el Context.

import { apiGet, apiPost, apiPatch, apiPut, apiDelete, invalidateCache } from "../api.js"

export function fetchMarkers() {
  return apiGet("/api/markers").then((r) => r.markers)
}

export async function createMarker(data) {
  const marker = await apiPost("/api/markers", data)
  invalidateCache("/api/markers")
  return marker
}

export async function updateMarker(id, data) {
  await apiPatch(`/api/markers/${id}`, data)
  invalidateCache("/api/markers")
}

export async function deleteMarker(id) {
  await apiDelete(`/api/markers/${id}`)
  invalidateCache("/api/markers")
}

export async function fetchEntityMarkers(ids, entityType = "RECORD") {
  if (ids.length === 0) return {}
  const r = await apiGet(`/api/markers/entity?ids=${ids.join(",")}&type=${entityType}`, { fresh: true })
  return r.markers
}

export function setEntityMarker(entityId, entityType, markerId) {
  return apiPut("/api/markers/entity", { entityId, entityType, markerId })
}

export function removeEntityMarker(entityId, entityType) {
  return apiDelete(`/api/markers/entity?entityId=${entityId}&type=${entityType}`)
}
