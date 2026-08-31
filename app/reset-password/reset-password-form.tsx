"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { resetPassword } from "@/lib/password-reset-actions"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <p className="p-6 text-sm text-rose-700">
        Falta el token en el link. Pedí uno nuevo desde{" "}
        <Link href="/forgot-password" className="underline">
          Recuperar acceso
        </Link>
        .
      </p>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p className="text-sm">Contraseña actualizada.</p>
        <Link href="/login" className="text-center text-xs font-bold underline hover:text-black">
          Ir a Ingresar
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    const result = await resetPassword(token, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar la contraseña.")
      return
    }
    setDone(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-bold">
          Contraseña nueva
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border-2 border-black px-3 py-2 text-sm outline-none focus:border-gray-500"
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-bold">
          Repetí la contraseña
        </label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="border-2 border-black px-3 py-2 text-sm outline-none focus:border-gray-500"
        />
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-black py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  )
}
