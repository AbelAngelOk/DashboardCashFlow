// Cliente HTTP. Único punto de contacto con /api/**.
//
// Responsabilidades: enviar la cookie de sesión, distinguir tipos de error
// (network/auth/validation/server), deduplicar requests en vuelo, y cachear
// SOLO lo que tiene evidencia de reuso (categorías, marcadores). Los datos
// financieros nunca se cachean: son justamente lo que cambia.

/** Error de red: el fetch nunca llegó a completarse (offline, DNS, CORS). */
export class NetworkError extends Error {
  constructor(cause) {
    super("No se pudo conectar con el servidor")
    this.name = "NetworkError"
    this.cause = cause
  }
}

/** Error de API: el servidor respondió, pero con un código de error. */
export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `Error ${status}`)
    this.name = "ApiError"
    this.status = status
    this.field = body && body.field
  }
  get isAuth() { return this.status === 401 }
  get isValidation() { return this.status === 400 }
  get isNotFound() { return this.status === 404 }
  get isConflict() { return this.status === 409 }
}

// ── Deduplicación de requests en vuelo ──────────────────────────────────────
// Dos módulos pidiendo el mismo GET al mismo tiempo disparan UNA sola request.
const inFlight = new Map()

// ── Cache con TTL ────────────────────────────────────────────────────────────
// Solo para datos con evidencia de reuso entre pantallas (ver MIGRATION_PLAN.md §3).
const cache = new Map() // key -> { value, expiresAt }
const CACHEABLE = new Set(["/api/categories", "/api/markers"])
const CACHE_TTL_MS = 5 * 60 * 1000

function cacheKeyOf(path) {
  // Solo cachea el endpoint base sin querystring (?counts=1 etc. no se cachea)
  const [base] = path.split("?")
  return CACHEABLE.has(base) ? base : null
}

/** Invalida entradas de cache. Se llama tras cualquier mutación relevante. */
export function invalidateCache(...bases) {
  for (const b of bases) cache.delete(b)
}

async function doFetch(path, options) {
  let res
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers: options.body
        ? { "Content-Type": "application/json", ...(options.headers || {}) }
        : options.headers,
      ...options,
    })
  } catch (cause) {
    throw new NetworkError(cause)
  }

  let body = null
  const ctype = res.headers.get("content-type") || ""
  if (ctype.includes("application/json")) {
    try { body = await res.json() } catch { /* respuesta vacía */ }
  }

  if (!res.ok) {
    const err = new ApiError(res.status, body)
    if (err.isAuth && !path.startsWith("/api/auth")) {
      // Sesión vencida: al no haber SPA con estado global, la forma más simple
      // y correcta de "reautenticar" es volver al login.
      window.location.href = "/app/login.html"
    }
    throw err
  }
  return body
}

/**
 * GET con dedup + cache opcional.
 * `fresh: true` fuerza a ignorar la cache (usado tras invalidar).
 */
export async function apiGet(path, { fresh = false } = {}) {
  const key = cacheKeyOf(path)

  if (key && !fresh) {
    const hit = cache.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.value
  }

  if (inFlight.has(path)) return inFlight.get(path)

  const promise = doFetch(path, { method: "GET" }).finally(() => inFlight.delete(path))
  inFlight.set(path, promise)

  const value = await promise
  if (key) cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}

export function apiPost(path, body) {
  return doFetch(path, { method: "POST", body: body != null ? JSON.stringify(body) : undefined })
}
export function apiPatch(path, body) {
  return doFetch(path, { method: "PATCH", body: body != null ? JSON.stringify(body) : undefined })
}
export function apiPut(path, body) {
  return doFetch(path, { method: "PUT", body: body != null ? JSON.stringify(body) : undefined })
}
export function apiDelete(path, body) {
  return doFetch(path, { method: "DELETE", body: body != null ? JSON.stringify(body) : undefined })
}
