"use client"

import { useEffect, useState } from "react"
import { LineChart } from "@/components/charts/line-chart"
import { useSettings } from "@/components/settings-store"
import { loadFlowSchedule, type FlowSchedule } from "@/lib/chart-actions"
import { monthKeyOf, monthLabel, monthRange, peakIndex, totalsByMonth } from "@/lib/charts"
import { formatAmount, type Currency } from "@/lib/finance"

/** Carga una vez lo que tiene fecha en activos y obligaciones (6 meses atrás, 11 adelante). */
export function useFlowSchedule(enabled = true): { schedule: FlowSchedule | null; error: boolean } {
  const [schedule, setSchedule] = useState<FlowSchedule | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadFlowSchedule()
      .then((s) => { if (!cancelled) setSchedule(s) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [enabled])
  return { schedule, error }
}

export function useMoneyFormat() {
  const { settings } = useSettings()
  const base = settings.baseCurrency as Currency
  return {
    base,
    rates: settings.exchangeRates,
    format: (v: number) => `${formatAmount(v, base)} ${base}`,
  }
}

export function ChartCard({
  title,
  subtitle,
  children,
  testId,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <section data-testid={testId} className="border-2 border-black">
      <header className="border-b-2 border-black bg-black px-3 py-2">
        <h3 className="font-bold italic text-white">{title}</h3>
      </header>
      <div className="px-3 py-3">
        {subtitle && <p className="mb-2 text-xs text-gray-500">{subtitle}</p>}
        {children}
      </div>
    </section>
  )
}

/** Versión que carga sus propios datos, para las páginas de un solo módulo. */
export function FlowProjectionPanel({ kind }: { kind: "income" | "expense" }) {
  const { schedule, error } = useFlowSchedule()
  return (
    <div className="mb-4">
      <FlowProjectionChart kind={kind} schedule={schedule} error={error} />
    </div>
  )
}

interface FlowProjectionChartProps {
  kind: "income" | "expense"
  schedule: FlowSchedule | null
  error?: boolean
}

/**
 * Próximos 12 meses de ingresos (reglas + dividendos) o de gastos (vencimientos
 * de obligaciones). El mes más alto se marca: bonanza para ingresos, dolor para gastos.
 */
export function FlowProjectionChart({ kind, schedule, error }: FlowProjectionChartProps) {
  const { base, rates, format } = useMoneyFormat()
  const months = monthRange(monthKeyOf(new Date()), 12)
  const values = schedule
    ? totalsByMonth(kind === "income" ? schedule.income : schedule.obligations, months, base, rates)
    : []
  const points = months.map((m, i) => ({ label: monthLabel(m), value: values[i] ?? 0 }))
  const isIncome = kind === "income"

  return (
    <ChartCard
      testId={isIncome ? "chart-income-projection" : "chart-expense-projection"}
      title={isIncome ? "Ingresos proyectados" : "Gastos proyectados"}
      subtitle={
        isIncome
          ? `Próximos 12 meses, en ${base}. Suma los cobros de las reglas de ingreso y los dividendos de tus activos; el pico es tu mes de bonanza.`
          : `Próximos 12 meses, en ${base}. Suma las cuotas y pagos de tus obligaciones; el pico es tu mes más pesado.`
      }
    >
      {error ? (
        <p className="py-6 text-center text-xs text-rose-700">No se pudo cargar la proyección.</p>
      ) : !schedule ? (
        <div className="h-[200px] animate-pulse bg-gray-50" />
      ) : (
        <LineChart
          points={points}
          formatValue={format}
          peak={{ index: peakIndex(values), tone: isIncome ? "good" : "bad" }}
          emptyText={
            isIncome
              ? "No hay ingresos con fecha: agregá reglas de ingreso o dividendos a tus activos."
              : "No hay vencimientos: tus obligaciones no tienen cuotas ni pagos programados."
          }
        />
      )}
    </ChartCard>
  )
}
