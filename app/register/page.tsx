"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { registerUser } from "@/lib/actions"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    setLoading(true)
    setError("")
    try {
      await registerUser({ name, email, password })
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError("Registro exitoso pero el login falló. Intentá iniciar sesión.")
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm border-2 border-black">
        <div className="border-b-2 border-black bg-black px-6 py-3">
          <span className="font-bold text-white">Cash Flow — Crear cuenta</span>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-bold">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-2 border-black px-3 py-2 text-sm outline-none focus:border-gray-500"
              placeholder="Tu nombre"
            />
          </div>
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
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-bold">
              Contraseña
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
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-black py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
          <p className="text-center text-xs text-gray-500">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-bold underline hover:text-black">
              Iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
