"use server"

import { randomBytes, createHash } from "crypto"
import { headers } from "next/headers"
import { hash as hashPassword } from "bcryptjs"
import { prisma } from "./db"
import { checkRateLimit, clientIpFrom } from "./rate-limit"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Pide un reset de contraseña. Siempre devuelve éxito genérico, exista o no
 * el email — no hay forma de que alguien de afuera confirme qué emails están
 * registrados.
 *
 * LIMITACIÓN HONESTA (ver PRODUCT_REVIEW.md §3.4 y §6): no hay proveedor de
 * email configurado todavía. El link de reset se loguea en la consola del
 * servidor en vez de mandarse por mail — funciona hoy porque quien necesita
 * recuperar acceso puede pedirle el link a quien tenga acceso a esos logs
 * (vos). Cuando este proyecto tenga usuarios que no sean de tu confianza
 * directa, el siguiente paso real es conectar un proveedor (Resend, SES,
 * etc.) acá mismo — la función ya deja el punto exacto marcado abajo.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const ip = clientIpFrom(await headers())
  const { allowed } = checkRateLimit(`reset-request:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!allowed) return { ok: true } // no revelar rate limiting tampoco

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    const token = randomBytes(32).toString("hex")
    await prisma.passwordResetToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })

    const h = await headers()
    const origin = h.get("origin") ?? `https://${h.get("host")}`
    const resetUrl = `${origin}/reset-password?token=${token}`

    // TODO(email): reemplazar este console.log por el envío real cuando haya
    // un proveedor configurado. Hasta entonces, este link solo es visible en
    // los logs del servidor (Vercel: pestaña Logs de la función; local: esta
    // misma terminal).
    console.log(`[password-reset] Link para ${email}: ${resetUrl} (expira en 1h)`)
  }

  return { ok: true }
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const ip = clientIpFrom(await headers())
  const { allowed } = checkRateLimit(`reset-confirm:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!allowed) return { ok: false, error: "Demasiados intentos. Esperá un rato y volvé a intentar." }

  if (newPassword.length < 8) {
    return { ok: false, error: "La contraseña tiene que tener al menos 8 caracteres." }
  }

  const tokenHash = hashToken(token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "El link es inválido o ya venció. Pedí uno nuevo." }
  }

  const passwordHash = await hashPassword(newPassword, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Invalidar cualquier otro link pendiente para ese usuario.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ])

  return { ok: true }
}
