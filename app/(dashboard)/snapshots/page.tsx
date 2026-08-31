"use client"

import Link from "next/link"
import { Camera, ArrowRight } from "lucide-react"
import { useFinance } from "@/components/finance-store"
import { useSettings } from "@/components/settings-store"
import { calculateTotalsConverted, formatAmount } from "@/lib/finance"
import { TrendChart } from "@/components/ui/trend-chart"

export default function SnapshotsPage() {
  const { snapshots, loading } = useFinance()
  const { settings } = useSettings()
  const { baseCurrency, exchangeRates } = settings

  // Orden cronológico (la lista viene más-reciente-primero desde la DB).
  const chronological = [...snapshots].reverse()
  const netWorthPoints = chronological.map((s) => {
    const activos = s.records.filter((r) => r.type === "activo" && r.amount !== 0)
    const pasivos = s.records.filter((r) => r.type === "pasivo")
    const netWorth =
      calculateTotalsConverted(activos, baseCurrency, exchangeRates) -
      calculateTotalsConverted(pasivos, baseCurrency, exchangeRates)
    return { label: s.name, value: netWorth }
  })
  const cashFlowPoints = chronological.map((s) => {
    const ingresos = s.records.filter((r) => r.type === "ingreso")
    const gastos = s.records.filter((r) => r.type === "gasto")
    const flujo =
      calculateTotalsConverted(ingresos, baseCurrency, exchangeRates) -
      calculateTotalsConverted(gastos, baseCurrency, exchangeRates)
    return { label: s.name, value: flujo }
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <Camera className="h-5 w-5" />
        <span className="text-lg font-bold">Snapshots</span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aún no hay snapshots guardados. Tomá uno desde el Dashboard.
        </p>
      ) : (
        <>
          {snapshots.length >= 2 && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div data-testid="snapshots-trend-networth" className="border-2 border-black p-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
                  Patrimonio neto (activos − pasivos)
                </p>
                <TrendChart points={netWorthPoints} formatValue={(v) => `${formatAmount(v, baseCurrency)} ${baseCurrency}`} />
              </div>
              <div data-testid="snapshots-trend-cashflow" className="border-2 border-black p-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-600">
                  Flujo de caja (ingresos − gastos)
                </p>
                <TrendChart points={cashFlowPoints} formatValue={(v) => `${formatAmount(v, baseCurrency)} ${baseCurrency}`} />
              </div>
              <p className="text-[11px] text-gray-400 sm:col-span-2">
                Convertido a {baseCurrency} con las tasas de cambio actuales — los snapshots viejos
                no guardan las tasas que regían en ese momento.
              </p>
            </div>
          )}

          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {snapshots.map((snap) => (
              <Link
                key={snap.id}
                href={`/snapshots/${snap.id}`}
                className="flex items-center justify-between border-2 border-black p-4 hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="min-w-0">
                  <div className="font-semibold leading-snug">{snap.name}</div>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{snap.period}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{snap.createdAt}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden border-2 border-black md:block">
            <div className="flex border-b-2 border-black bg-gray-100 text-sm font-bold">
              <div className="flex-1 border-r border-black px-3 py-2">Nombre</div>
              <div className="w-40 border-r border-black px-3 py-2">Período</div>
              <div className="w-44 border-r border-black px-3 py-2">Fecha de creación</div>
              <div className="w-16 px-3 py-2 text-center">Acción</div>
            </div>

            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="group flex border-b border-black text-sm last:border-b-0 hover:bg-gray-50"
              >
                <div className="flex-1 border-r border-black px-3 py-2 font-medium">
                  {snap.name}
                </div>
                <div className="w-40 border-r border-black px-3 py-2 capitalize text-gray-600">
                  {snap.period}
                </div>
                <div className="w-44 border-r border-black px-3 py-2 text-gray-500">
                  {snap.createdAt}
                </div>
                <div className="flex w-16 items-center justify-center px-3 py-2">
                  <Link
                    href={`/snapshots/${snap.id}`}
                    className="text-gray-400 transition-colors hover:text-black"
                    aria-label={`Ver snapshot ${snap.name}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
