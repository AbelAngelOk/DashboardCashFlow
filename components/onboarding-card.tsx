"use client"

import { useState } from "react"
import { X, TrendingUp, FileText, TrendingDown, ShoppingCart } from "lucide-react"

const DISMISS_KEY = "cashflow:onboarding-dismissed"

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1")
  } catch {}
}

/**
 * Explicación de una pantalla del modelo activo/pasivo/flujo de caja, para
 * quien nunca usó el formato CASHFLOW de Kiyosaki en el que se basa este
 * dashboard. Se muestra solo mientras el dashboard está genuinamente vacío
 * (ver PRODUCT_REVIEW.md §4 — "sin onboarding" era el hueco).
 */
export function OnboardingCard() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  const close = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div data-testid="onboarding-card" className="relative mb-6 border-2 border-black bg-gray-50 p-4">
      <button
        onClick={close}
        aria-label="Cerrar"
        className="absolute right-3 top-3 text-gray-400 hover:text-black"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className="pr-6 text-sm font-bold">Antes de arrancar: 4 conceptos, no una planilla de gastos</h2>
      <p className="mt-1 text-xs text-gray-600">
        Este dashboard no es para categorizar gastos contra un presupuesto — es para ver qué de tu
        plata trabaja para vos (activos) y qué te cuesta plata (pasivos), con el{" "}
        <strong>Flujo de Caja</strong> como el número que más importa.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-emerald-700" />
          <div>
            <p className="text-xs font-bold">Activo</p>
            <p className="text-xs text-gray-500">Pone plata en tu bolsillo: un plazo fijo, un alquiler, acciones que pagan dividendo.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <FileText className="h-4 w-4 shrink-0 text-rose-700" />
          <div>
            <p className="text-xs font-bold">Pasivo / Obligación</p>
            <p className="text-xs text-gray-500">Saca plata de tu bolsillo: un préstamo, una tarjeta, una deuda.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <TrendingDown className="h-4 w-4 shrink-0 text-gray-600" />
          <div>
            <p className="text-xs font-bold">Ingreso</p>
            <p className="text-xs text-gray-500">Sueldo, o lo que generan tus activos — esto último es lo que hace crecer tu "Libertad Financiera".</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ShoppingCart className="h-4 w-4 shrink-0 text-gray-600" />
          <div>
            <p className="text-xs font-bold">Gasto</p>
            <p className="text-xs text-gray-500">Lo que sale de tu bolsillo cada mes, sin importar en qué.</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Empezá cargando algo en cualquiera de las 4 tablas de abajo — no hay un orden obligatorio.
      </p>
    </div>
  )
}
