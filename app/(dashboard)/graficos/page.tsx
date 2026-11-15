"use client"

import { BarChart3 } from "lucide-react"
import { AssetChartsSection, groupParentNamesOf } from "@/components/charts/asset-charts"
import { ChartCard, FlowProjectionChart, useFlowSchedule, useMoneyFormat } from "@/components/charts/flow-charts"
import { LineChart } from "@/components/charts/line-chart"
import { ObligationChartsSection } from "@/components/charts/obligation-charts"
import { useFinance } from "@/components/finance-store"
import { useObligations } from "@/components/obligations-store"
import { snapshotAssetsTotal } from "@/lib/charts"
import { calculateTotalsConverted } from "@/lib/finance"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-8 text-center text-xl font-bold first:mt-0">{children}</h2>
}

export default function GraficosPage() {
  const { schedule, error } = useFlowSchedule()
  const { obligations } = useObligations()
  const { records, snapshots, loading } = useFinance()
  const { base, rates, format } = useMoneyFormat()

  const parentNames = groupParentNamesOf(records)
  const chronological = [...snapshots].reverse()
  const label = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name)
  const netWorth = chronological.map((s) => ({
    label: label(s.name),
    value:
      snapshotAssetsTotal(s, parentNames, base, rates) -
      calculateTotalsConverted(s.records.filter((r) => r.type === "pasivo"), base, rates),
  }))
  const cashFlow = chronological.map((s) => ({
    label: label(s.name),
    value:
      calculateTotalsConverted(s.records.filter((r) => r.type === "ingreso"), base, rates) -
      calculateTotalsConverted(s.records.filter((r) => r.type === "gasto"), base, rates),
  }))

  return (
    <div data-testid="graficos-page" className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <BarChart3 className="h-5 w-5" />
        <span className="text-lg font-bold">Gráficos</span>
        <span className="ml-auto text-xs text-gray-500">Montos convertidos a {base}</span>
      </div>

      <SectionTitle>Flujo proyectado</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <FlowProjectionChart kind="income" schedule={schedule} error={error} />
        <FlowProjectionChart kind="expense" schedule={schedule} error={error} />
      </div>

      <SectionTitle>Obligaciones</SectionTitle>
      <ObligationChartsSection obligations={obligations} schedule={schedule} />

      <SectionTitle>Activos</SectionTitle>
      <AssetChartsSection />

      <SectionTitle>Historia</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Patrimonio neto" subtitle={`Activos menos pasivos en cada snapshot, en ${base}.`}>
          {loading ? (
            <div className="h-[200px] animate-pulse bg-gray-50" />
          ) : (
            <LineChart points={netWorth} formatValue={format} emptyText="Hacen falta al menos 2 snapshots." />
          )}
        </ChartCard>
        <ChartCard title="Flujo de caja" subtitle={`Ingresos menos gastos del período de cada snapshot, en ${base}.`}>
          {loading ? (
            <div className="h-[200px] animate-pulse bg-gray-50" />
          ) : (
            <LineChart points={cashFlow} formatValue={format} emptyText="Hacen falta al menos 2 snapshots." />
          )}
        </ChartCard>
      </div>
    </div>
  )
}
