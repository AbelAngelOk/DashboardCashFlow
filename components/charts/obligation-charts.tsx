"use client"

import { BarList } from "@/components/charts/bar-list"
import { ChartCard, useFlowSchedule, useMoneyFormat } from "@/components/charts/flow-charts"
import { LineChart } from "@/components/charts/line-chart"
import type { FlowSchedule } from "@/lib/chart-actions"
import { addMonthKey, monthKeyOf, monthLabel, monthRange, totalsByMonth } from "@/lib/charts"
import { convertAmount, type Currency } from "@/lib/finance"
import { computeRecurringBreakdown, type Obligation } from "@/lib/obligations"

const MONTHS_BACK = 6

/** Promedio mensual de los 6 meses próximos vs los 6 anteriores: ¿las obligaciones pesan más o menos? */
function TrendReadout({ past, future, format }: { past: number[]; future: number[]; format: (v: number) => string }) {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0)
  const before = avg(past)
  const after = avg(future)
  if (before === 0 && after === 0) return null
  const change = before > 0 ? ((after - before) / before) * 100 : null
  const direction = after < before ? "bajando" : after > before ? "subiendo" : "estable"
  return (
    <p className="mb-2 text-xs text-gray-700">
      Promedio mensual: <b>{format(before)}</b> los últimos 6 meses → <b>{format(after)}</b> los próximos 6.{" "}
      <span className="font-bold">
        {direction === "bajando" ? "▼" : direction === "subiendo" ? "▲" : "■"} {direction}
        {change !== null && direction !== "estable" ? ` ${Math.abs(change).toFixed(0)}%` : ""}
      </span>
    </p>
  )
}

export function ObligationChartsSection({
  obligations,
  schedule: provided,
}: {
  obligations: Obligation[]
  schedule?: FlowSchedule | null
}) {
  const loaded = useFlowSchedule(provided === undefined)
  const schedule = provided !== undefined ? provided : loaded.schedule
  const { base, rates, format } = useMoneyFormat()

  const current = monthKeyOf(new Date())
  const months = monthRange(addMonthKey(current, -MONTHS_BACK), MONTHS_BACK + 12)
  const values = schedule ? totalsByMonth(schedule.obligations, months, base, rates) : []
  const points = months.map((m, i) => ({ label: monthLabel(m), value: values[i] ?? 0 }))

  const live = obligations.filter((o) => o.status === "ACTIVE" || o.status === "PAUSED")
  const weights = live.map((o) => {
    const byCurrency = o.obligationType === "RECURRING" ? computeRecurringBreakdown(o.rules) : { [o.currency]: o.amount }
    const value = (Object.entries(byCurrency) as [Currency, number][]).reduce(
      (s, [cur, v]) => s + convertAmount(v, cur, base, rates),
      0,
    )
    return { id: o.id, label: o.name, value, href: `/obligaciones/${o.id}` }
  })

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <ChartCard
        testId="chart-obligations-trend"
        title="Peso mensual de las obligaciones"
        subtitle={`Lo que vence cada mes, en ${base}: pagado hacia atrás, programado hacia adelante (punteado). Las obligaciones fijas sin cronograma no entran.`}
      >
        {!schedule ? (
          <div className="h-[200px] animate-pulse bg-gray-50" />
        ) : (
          <>
            <TrendReadout
              past={values.slice(0, MONTHS_BACK)}
              future={values.slice(MONTHS_BACK + 1, MONTHS_BACK + 7)}
              format={format}
            />
            <LineChart
              points={points}
              formatValue={format}
              todayIndex={MONTHS_BACK}
              emptyText="Tus obligaciones no tienen cuotas ni pagos con fecha."
            />
          </>
        )}
      </ChartCard>
      <ChartCard
        testId="chart-obligations-weight"
        title="Las obligaciones más pesadas"
        subtitle={`Valor de cada obligación activa, en ${base}: costo anual si es recurrente, saldo si es en cuotas o fija.`}
      >
        <BarList items={weights} formatValue={format} emptyText="No hay obligaciones activas." />
      </ChartCard>
    </div>
  )
}
