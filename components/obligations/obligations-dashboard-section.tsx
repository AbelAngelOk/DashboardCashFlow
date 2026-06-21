"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { useObligations } from "@/components/obligations-store"
import { useSettings } from "@/components/settings-store"
import {
  type Obligation,
  OBLIGATION_TYPE_LABELS,
  OBLIGATION_STATUS_LABELS,
  computeRecurringBreakdown,
  formatObligationDate,
} from "@/lib/obligations"
import { formatAmount, convertAmount } from "@/lib/finance"
import type { Currency } from "@/lib/finance"

function ObligationValue({ obligation }: { obligation: Obligation }) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings

  if (obligation.obligationType === "RECURRING") {
    const breakdown = computeRecurringBreakdown(obligation.rules)
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0) as [Currency, number][]

    if (entries.length === 0) return <span className="text-gray-400">—</span>

    if (convertCurrencies) {
      const total = entries.reduce(
        (s, [cur, val]) => s + convertAmount(val, cur, baseCurrency as Currency, exchangeRates),
        0,
      )
      return (
        <div className="flex flex-col items-end leading-tight">
          <span>{formatAmount(total, baseCurrency as Currency)} {baseCurrency}</span>
          <span className="text-[10px] text-gray-400">anual</span>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-end gap-0.5 leading-tight">
        {entries.map(([cur, val]) => (
          <span key={cur}>{formatAmount(val, cur)} {cur}</span>
        ))}
        <span className="text-[10px] text-gray-400">anual</span>
      </div>
    )
  }

  return (
    <span>
      {formatAmount(obligation.amount, obligation.currency)} {obligation.currency}
    </span>
  )
}

function StatusBadge({ status }: { status: Obligation["status"] }) {
  const colors: Record<Obligation["status"], string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    PAUSED: "bg-amber-100 text-amber-800",
    COMPLETED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-rose-100 text-rose-800",
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors[status]}`}>
      {OBLIGATION_STATUS_LABELS[status]}
    </span>
  )
}

export function ObligationsDashboardSection() {
  const { obligations } = useObligations()

  const active = obligations.filter((o) => o.status === "ACTIVE" || o.status === "PAUSED")

  if (active.length === 0) return null

  return (
    <div data-testid="dashboard-obligations-table" className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
        <span className="font-bold italic text-white">Compromisos</span>
        <Link
          href="/obligaciones"
          className="flex items-center gap-1 text-xs text-gray-300 hover:text-white"
        >
          <ExternalLink className="h-3 w-3" />
          Ver todos
        </Link>
      </div>

      {/* Column headers */}
      <div className="flex border-b border-black bg-gray-100 text-xs font-bold">
        <div className="flex-1 border-r border-black px-2 py-1">Descripción</div>
        <div className="w-24 border-r border-black px-2 py-1">Tipo</div>
        <div className="w-40 border-r border-black px-2 py-1 text-right">Valor</div>
        <div className="w-28 px-2 py-1 text-center">Próx. venc.</div>
      </div>

      {active.map((o) => (
        <div key={o.id} className="group flex border-b border-black text-sm hover:bg-gray-50">
          <div className="flex flex-1 items-center gap-2 border-r border-black px-2 py-1">
            <Link href={`/obligaciones/${o.id}`} className="font-medium hover:underline">
              {o.name}
            </Link>
            {o.status === "PAUSED" && <StatusBadge status={o.status} />}
          </div>
          <div className="w-24 border-r border-black px-2 py-1 text-xs text-gray-500">
            {OBLIGATION_TYPE_LABELS[o.obligationType]}
          </div>
          <div className="w-40 border-r border-black px-2 py-1 text-right text-sm">
            <ObligationValue obligation={o} />
          </div>
          <div className="w-28 px-2 py-1 text-center text-xs text-gray-600">
            {o.nextDueDate ? formatObligationDate(o.nextDueDate) : "—"}
          </div>
        </div>
      ))}
    </div>
  )
}
