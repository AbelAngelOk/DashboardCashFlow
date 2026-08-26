// Utilidades compartidas por las route handlers de /api.
//
// Sin "use server": es un módulo normal que solo importan las rutas del servidor.

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "./auth"

// ── Contrato de errores ───────────────────────────────────────────────────────
//
// El cliente distingue estos casos igual que hoy los distingue React:
//   400 validación · 401 sesión · 403 permisos · 404 no existe
//   409 conflicto  · 500 servidor
// Un fallo de red no llega acá: es una excepción de fetch en el cliente.

export type ApiErrorKind =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVER"

const STATUS: Record<ApiErrorKind, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER: 500,
}

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const badRequest = (msg: string, field?: string) =>
  new ApiError("VALIDATION", msg, field)
export const notFound = (msg = "No encontrado") => new ApiError("NOT_FOUND", msg)
export const conflict = (msg: string) => new ApiError("CONFLICT", msg)

// ── Sesión ────────────────────────────────────────────────────────────────────

/**
 * Deriva el userId de la sesión, igual que hacen las 110 acciones existentes.
 * Es el único origen aceptable del userId: nunca se toma del request.
 */
export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new ApiError("UNAUTHENTICATED", "No autorizado")
  return session.user.id
}

// ── Envoltorio de handler ─────────────────────────────────────────────────────

/**
 * Ejecuta el handler y traduce cualquier excepción al contrato de errores.
 *
 * Las acciones existentes lanzan `new Error("No autorizado")` como texto plano;
 * se mapea a 401 para que el cliente pueda redirigir al login sin adivinar.
 */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn())
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json(
        { error: e.message, ...(e.field ? { field: e.field } : {}) },
        { status: STATUS[e.kind] },
      )
    }
    const msg = e instanceof Error ? e.message : "Error desconocido"
    if (msg === "No autorizado") {
      return NextResponse.json({ error: msg }, { status: 401 })
    }
    // Los mensajes de validación de las acciones existentes son legibles para el
    // usuario, así que se devuelven tal cual en vez de esconderlos tras un 500.
    if (/no encontrad|no existe/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    if (/ya (fue|existe)|debe ser|no puede/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    console.error("[api]", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Lee y valida el body JSON de un request. */
export async function jsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw badRequest("Body JSON inválido")
  }
}
