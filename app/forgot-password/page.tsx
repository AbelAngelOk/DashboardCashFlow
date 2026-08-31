"use client"

import { useState } from "react"
import Link from "next/link"
import { requestPasswordReset } from "@/lib/password-reset-actions"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await requestPasswordReset(email)
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm border-2 border-black">
        <div className="border-b-2 border-black bg-black px-6 py-3">
          <span className="font-bold text-white">Cash Flow — Recuperar acceso</span>
        </div>
        {sent ? (
          <div className="flex flex-col gap-4 p-6">
            <p className="text-sm">
              Si <strong>{email}</strong> tiene una cuenta, se generó un link de recuperación válido
              por 1 hora.
            </p>
            <p className="text-xs text-gray-500">
              Pedíselo a quien administra el servidor — todavía no está conectado un envío de email
              automático.
            </p>
            <Link href="/login" className="text-center text-xs font-bold underline hover:text-black">
              Volver a Ingresar
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
            <p className="text-xs text-gray-500">
              Ingresá tu email. Si tiene una cuenta asociada, se genera un link para elegir una
              contraseña nueva.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-bold">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-2 border-black px-3 py-2 text-sm outline-none focus:border-gray-500"
                placeholder="tu@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-black py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Pedir link de recuperación"}
            </button>
            <Link href="/login" className="text-center text-xs text-gray-500 underline hover:text-black">
              Volver a Ingresar
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
