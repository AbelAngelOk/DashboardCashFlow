// Autenticación contra NextAuth v4 (credentials + JWT), sin next-auth/react.
//
// Contrato verificado contra el servidor real (ver MIGRATION_PLAN.md):
//   login OK      → POST /api/auth/callback/credentials  → 200, set-cookie HttpOnly
//   login fallido → mismo endpoint                         → 401, sin cookie
//   sesión        → GET  /api/auth/session                 → {} o { user, expires }
//   logout        → POST /api/auth/signout                 → 200, borra cookie
//
// La cookie es HttpOnly: JS no puede leerla ni necesita hacerlo. El navegador
// la manda solo con `credentials: "same-origin"`.

async function getCsrfToken() {
  const res = await fetch("/api/auth/csrf", { credentials: "same-origin" })
  if (!res.ok) throw new Error("No se pudo iniciar el login")
  const { csrfToken } = await res.json()
  return csrfToken
}

/** true/false — nunca lanza. Para chequeos donde un fallo de red es "no hay sesión". */
export async function getSession() {
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin" })
    if (!res.ok) return null
    const body = await res.json()
    return body && body.user ? body : null
  } catch {
    return null
  }
}

/**
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 * Nunca lanza por credenciales inválidas — eso es un resultado esperado, no
 * una excepción. Solo lanza si la red falla.
 */
export async function login(email, password) {
  const csrfToken = await getCsrfToken()
  const res = await fetch("/api/auth/callback/credentials", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
  })
  if (res.status === 401) return { ok: false, error: "Email o contraseña incorrectos" }
  if (!res.ok) return { ok: false, error: "No se pudo iniciar sesión" }
  return { ok: true }
}

export async function logout() {
  const csrfToken = await getCsrfToken()
  await fetch("/api/auth/signout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, json: "true" }),
  })
}
