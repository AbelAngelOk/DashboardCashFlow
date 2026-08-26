import { handle, jsonBody, badRequest } from "@/lib/api-helpers"
import { registerUser } from "@/lib/actions"

/** POST /api/auth/register — alta de usuario. Único endpoint público. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<{ name?: string; email?: string; password?: string }>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    if (!b.email?.trim()) throw badRequest("El email es obligatorio", "email")
    if (!b.password || b.password.length < 8)
      throw badRequest("La contraseña debe tener al menos 8 caracteres", "password")
    return registerUser({ name: b.name.trim(), email: b.email.trim(), password: b.password })
  })
}
