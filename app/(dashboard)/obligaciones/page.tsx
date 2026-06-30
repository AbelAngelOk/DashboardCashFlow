"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useObligations } from "@/components/obligations-store"
import { ObligationFormDialog } from "@/components/obligations/obligation-form-dialog"
import { MarkerPicker } from "@/components/markers/marker-picker"
import { loadEntityMarkersForIds } from "@/lib/marker-actions"
import type { MarkerDefinition } from "@/lib/marker-types"
import {
  type Obligation,
  type ObligationStatus,
  OBLIGATION_TYPE_LABELS,
  OBLIGATION_STATUS_LABELS,
  computeRecurringBreakdown,
  formatObligationDate,
} from "@/lib/obligations"
import { formatAmount, convertAmount } from "@/lib/finance"
import type { Currency } from "@/lib/finance"
import { useSettings } from "@/components/settings-store"

const STATUS_FILTERS: { label: string; value: ObligationStatus | "ALL" }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Activas", value: "ACTIVE" },
  { label: "Pausadas", value: "PAUSED" },
  { label: "Completadas", value: "COMPLETED" },
  { label: "Canceladas", value: "CANCELLED" },
]

function ObligationValueCell({ obligation }: { obligation: Obligation }) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings

  if (obligation.obligationType === "RECURRING") {
    const breakdown = computeRecurringBreakdown(obligation.rules)
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0) as [Currency, number][]
    if (entries.length === 0) return <span className="text-gray-400">Sin reglas</span>

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

const STATUS_COLORS: Record<ObligationStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-rose-100 text-rose-800",
}

export default function ObligacionesPage() {
  const { obligations, reload } = useObligations()
  const router = useRouter()
  const [filter, setFilter] = useState<ObligationStatus | "ALL">("ALL")
  const [formOpen, setFormOpen] = useState(false)
  const [markerMap, setMarkerMap] = useState<Record<string, MarkerDefinition>>({})

  const refreshMarkers = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const map = await loadEntityMarkersForIds(ids, "OBLIGATION")
      setMarkerMap(map)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    refreshMarkers(obligations.map((o) => o.id))
  }, [obligations, refreshMarkers])

  const filtered = filter === "ALL" ? obligations : obligations.filter((o) => o.status === filter)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="inline-block bg-black px-4 py-1 text-white">
          <span className="font-bold">Obligaciones</span>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-black text-white hover:bg-gray-800"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nueva
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`border-2 border-black px-3 py-1 text-xs font-bold ${filter === value ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtered.map((o) => {
          const marker = markerMap[o.id] ?? null
          return (
          <Link
            key={o.id}
            href={`/obligaciones/${o.id}`}
            className="block border-2 border-black p-4 hover:bg-gray-50 active:bg-gray-100"
            style={marker ? {
              borderLeft: `4px solid ${marker.color}`,
              backgroundColor: `${marker.color}18`,
            } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold leading-snug">{o.name}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[o.status]}`}>
                {OBLIGATION_STATUS_LABELS[o.status]}
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-xs text-gray-500">{OBLIGATION_TYPE_LABELS[o.obligationType]}</span>
              <div className="text-right text-sm">
                <ObligationValueCell obligation={o} />
              </div>
            </div>
            {o.nextDueDate && (
              <div className="mt-1.5 text-xs text-gray-400">
                Próx. venc.: {formatObligationDate(o.nextDueDate)}
              </div>
            )}
          </Link>
          )
        })}

        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">
            {filter === "ALL"
              ? "No hay obligaciones. Creá la primera con el botón de arriba."
              : `No hay obligaciones con estado "${OBLIGATION_STATUS_LABELS[filter as ObligationStatus]}".`}
          </p>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden border-2 border-black md:block">
        <div className="flex bg-black text-xs font-bold text-white">
          <div className="flex-1 px-3 py-2">Nombre</div>
          <div className="w-28 px-3 py-2">Tipo</div>
          <div className="w-44 px-3 py-2 text-right">Valor</div>
          <div className="w-28 px-3 py-2 text-center">Próx. venc.</div>
          <div className="w-24 px-3 py-2 text-center">Estado</div>
          <div className="w-10 px-1 py-2" />
        </div>

        {filtered.map((o) => {
          const marker = markerMap[o.id] ?? null
          return (
            <div
              key={o.id}
              className="relative flex items-center border-b border-black text-sm hover:bg-gray-50"
              style={marker ? {
                borderLeft: `4px solid ${marker.color}`,
                backgroundColor: `${marker.color}18`,
              } : undefined}
            >
              <Link
                href={`/obligaciones/${o.id}`}
                className="flex flex-1 items-center"
              >
                <div className="flex-1 px-3 py-2 font-medium">{o.name}</div>
                <div className="w-28 px-3 py-2 text-xs text-gray-500">
                  {OBLIGATION_TYPE_LABELS[o.obligationType]}
                </div>
                <div className="w-44 px-3 py-2 text-right">
                  <ObligationValueCell obligation={o} />
                </div>
                <div className="w-28 px-3 py-2 text-center text-xs text-gray-600">
                  {o.nextDueDate ? formatObligationDate(o.nextDueDate) : "—"}
                </div>
                <div className="w-24 px-3 py-2 text-center">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[o.status]}`}>
                    {OBLIGATION_STATUS_LABELS[o.status]}
                  </span>
                </div>
              </Link>
              <div className="flex w-10 items-center justify-center px-1 py-2 text-center text-gray-400">
                <MarkerPicker
                  entityId={o.id}
                  entityType="OBLIGATION"
                  currentMarker={marker}
                  onChanged={() => refreshMarkers(obligations.map((x) => x.id))}
                />
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {filter === "ALL"
              ? "No hay obligaciones. Creá la primera con el botón de arriba."
              : `No hay obligaciones con estado "${OBLIGATION_STATUS_LABELS[filter as ObligationStatus]}".`}
          </div>
        )}
      </div>

      <ObligationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(id) => {
          reload()
          router.push(`/obligaciones/${id}`)
        }}
      />
    </div>
  )
}
