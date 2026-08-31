// Rate limiting mínimo, en memoria — no Redis, no infra nueva. Ver
// PRODUCT_REVIEW.md §3/§4: hoy no hay ninguna protección contra fuerza bruta
// en login/registro.
//
// Limitación honesta: esto vive en la memoria del proceso de Node. En
// serverless (Vercel), cada instancia fría tiene su propio contador — no es
// un límite global distribuido. Igual sirve como primera barrera real contra
// el caso común (mismo cliente insistiendo contra la misma instancia tibia),
// que es infinitamente mejor que no tener nada. Si esto crece a más
// usuarios, la solución de fondo es Upstash/Redis — no vale la pena antes.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Poda periódica para no acumular memoria indefinidamente.
setInterval(
  () => {
    const now = Date.now()
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key)
  },
  5 * 60 * 1000,
).unref?.()

/**
 * Devuelve `{ allowed: false }` si `key` superó `max` intentos en la ventana
 * `windowMs`. Cada llamada cuenta como un intento, se haya permitido o no.
 */
export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1 }
  }

  existing.count += 1
  if (existing.count > max) return { allowed: false, remaining: 0 }
  return { allowed: true, remaining: max - existing.count }
}

/** IP del cliente a partir de headers estándar (Vercel/proxies) o "unknown". */
export function clientIpFrom(headers: Headers | Record<string, string | string[] | undefined>): string {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined
    const v = headers[name]
    return Array.isArray(v) ? v[0] : v
  }
  const forwarded = get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return get("x-real-ip") ?? "unknown"
}
