"use client"

import { BarList } from "@/components/charts/bar-list"
import { ChartCard, useMoneyFormat } from "@/components/charts/flow-charts"
import { LineChart } from "@/components/charts/line-chart"
import { useFinance } from "@/components/finance-store"
import { snapshotAssetsTotal } from "@/lib/charts"
import { convertAmount, type FinancialRecord } from "@/lib/finance"

/** Nombres de los grupos de activos actuales: sirven para no contarlos dos veces en snapshots viejos. */
export function groupParentNamesOf(records: FinancialRecord[]): Set<string> {
  return new Set(records.filter((r) => r.type === "activo" && r.isGroupParent).map((r) => r.name))
}

export function AssetChartsSection() {
  const { records, snapshots, loading } = useFinance()
  const { base, rates, format } = useMoneyFormat()

  const activos = records.filter((r) => r.type === "activo")
  const parentNames = groupParentNamesOf(records)
  // Hijos y activos sueltos: cada valor contado una sola vez
  const currentTotal = activos
    .filter((r) => !r.isGroupParent)
    .reduce((s, r) => s + convertAmount(r.amount, r.currency, base, rates), 0)

  const history = [...snapshots].reverse().map((s) => ({
    label: s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name,
    value: snapshotAssetsTotal(s, parentNames, base, rates),
  }))
  const points = [...history, { label: "Hoy", value: currentTotal }]

  // Un grupo pesa como una unidad: la suma de sus hijos, convertida
  const weights = activos
    .filter((r) => !r.parentId)
    .map((r) => {
      const members = r.isGroupParent ? activos.filter((c) => c.parentId === r.id) : [r]
      const value = members.reduce((s, m) => s + convertAmount(m.amount, m.currency, base, rates), 0)
      return { id: r.id, label: r.name, value, href: `/activos/${r.id}` }
    })

  const first = history[0]?.value
  const change = first && first > 0 ? ((currentTotal - first) / first) * 100 : null

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <ChartCard
        testId="chart-assets-trend"
        title="Evolución de los activos"
        subtitle={`Valor total de tus activos en cada snapshot y hoy, en ${base}.`}
      >
        {loading ? (
          <div className="h-[200px] animate-pulse bg-gray-50" />
        ) : (
          <>
            {change !== null && (
              <p className="mb-2 text-xs text-gray-700">
                Desde el primer snapshot:{" "}
                <span className="font-bold">
                  {Math.abs(change) < 0.5
                    ? "■ sin cambios"
                    : `${change > 0 ? "▲ creciendo" : "▼ bajando"} ${Math.abs(change).toFixed(0)}%`}
                </span>
              </p>
            )}
            <LineChart
              points={points}
              formatValue={format}
              emptyText="Hacen falta snapshots para ver la evolución (se crean con cada corte de mes)."
            />
          </>
        )}
      </ChartCard>
      <ChartCard
        testId="chart-assets-weight"
        title="Los activos más pesados"
        subtitle={`Valor actual de cada activo, en ${base}. Un grupo cuenta como la suma de sus activos.`}
      >
        <BarList items={weights} formatValue={format} emptyText="No hay activos con valor." />
      </ChartCard>
    </div>
  )
}
