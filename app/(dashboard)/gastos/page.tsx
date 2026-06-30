"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Plus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  loadGastos,
  archiveGasto,
  restoreGasto,
  type GastoWithSource,
} from "@/lib/gasto-actions"
import { loadEntityMarkersForIds } from "@/lib/marker-actions"
import { GastoFormDialog } from "@/components/gastos/gasto-form-dialog"
import { EditOrVersionDialog } from "@/components/shared/edit-or-version-dialog"
import { GastoIngresoLinksPanel } from "@/components/gastos/gasto-ingreso-links-panel"
import { MarkerPicker } from "@/components/markers/marker-picker"
import { formatAmount, type Currency } from "@/lib/finance"
import type { MarkerDefinition } from "@/lib/marker-types"

type StatusFilter = "ACTIVE" | "HISTORICAL" | "ARCHIVED"

function SourceBadge({ source }: { source: GastoWithSource["source"] }) {
  if (source.type === "obligation") {
    return (
      <Link
        href={`/obligaciones/${source.obligationId}`}
        className="flex items-center gap-1 text-xs text-blue-700 hover:underline"
      >
        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold">Obligación</span>
        <span className="hidden sm:inline">{source.obligationName}</span>
        <ExternalLink className="h-3 w-3" />
      </Link>
    )
  }
  if (source.type === "asset") {
    return (
      <Link
        href={`/activos/${source.assetId}`}
        className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
      >
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold">Activo</span>
        <span className="hidden sm:inline">{source.assetName}</span>
        <ExternalLink className="h-3 w-3" />
      </Link>
    )
  }
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-500">
      Libre
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "HISTORICAL") {
    return (
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-500">
        HISTÓRICO
      </span>
    )
  }
  if (status === "ARCHIVED") {
    return (
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-500">
        ARCHIVADO
      </span>
    )
  }
  return null
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function GastosPage() {
  const [gastos, setGastos] = useState<GastoWithSource[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE")
  const [editingGasto, setEditingGasto] = useState<GastoWithSource | null>(null)
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set())
  const [markerMap, setMarkerMap] = useState<Record<string, MarkerDefinition>>({})

  const toggleLinks = (id: string) =>
    setExpandedLinks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const refreshMarkers = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const map = await loadEntityMarkersForIds(ids, "RECORD")
      setMarkerMap(map)
    } catch { /* non-critical */ }
  }, [])

  const fetchGastos = useCallback(async (status: StatusFilter) => {
    setLoading(true)
    try {
      const data = await loadGastos([status])
      setGastos(data)
      refreshMarkers(data.map((g) => g.id))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [refreshMarkers])

  useEffect(() => {
    fetchGastos(statusFilter)
  }, [fetchGastos, statusFilter])

  const handleArchive = async (id: string) => {
    await archiveGasto(id)
    fetchGastos(statusFilter)
  }

  const handleRestore = async (id: string) => {
    await restoreGasto(id)
    fetchGastos(statusFilter)
  }

  const obligationGastos = gastos.filter((g) => g.source.type === "obligation")
  const assetGastos = gastos.filter((g) => g.source.type === "asset")
  const freeGastos = gastos.filter((g) => g.source.type === "free")

  const totalByCurrency = gastos.reduce<Record<string, number>>((acc, g) => {
    acc[g.currency] = (acc[g.currency] ?? 0) + g.amount
    return acc
  }, {})

  const statusButtons: { label: string; value: StatusFilter }[] = [
    { label: "Activos", value: "ACTIVE" },
    { label: "Históricos", value: "HISTORICAL" },
    { label: "Archivados", value: "ARCHIVED" },
  ]

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="inline-block bg-black px-4 py-1 text-white">
          <span className="font-bold">Gastos</span>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-black text-white hover:bg-gray-800"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-1">
        {statusButtons.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`rounded border-2 px-3 py-1 text-xs font-bold transition-colors ${
              statusFilter === value
                ? "border-black bg-black text-white"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
      ) : gastos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-200" />
          <p className="text-sm text-gray-400">
            No hay gastos {statusFilter === "ACTIVE" ? "activos" : statusFilter === "HISTORICAL" ? "históricos" : "archivados"}.
          </p>
          {statusFilter === "ACTIVE" && (
            <Button
              size="sm"
              className="gap-2 bg-black text-white hover:bg-gray-800"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Crear primer gasto
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary */}
          <div className="border-2 border-black bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-xs font-bold uppercase text-gray-500">Total gastos</span>
                <div className="font-bold">{gastos.length}</div>
              </div>
              {Object.entries(totalByCurrency).map(([cur, total]) => (
                <div key={cur}>
                  <span className="text-xs font-bold uppercase text-gray-500">Total {cur}</span>
                  <div className="font-bold">{formatAmount(total, cur as Currency)} {cur}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grouped tables */}
          {[
            { label: "Desde Obligaciones", rows: obligationGastos },
            { label: "Depósitos en Activos", rows: assetGastos },
            { label: "Gastos Libres", rows: freeGastos },
          ]
            .filter(({ rows }) => rows.length > 0)
            .map(({ label, rows }) => (
              <div key={label} className="border-2 border-black">
                <div className="border-b-2 border-black bg-black px-3 py-2">
                  <span className="font-bold italic text-white">{label}</span>
                </div>
                <div className="flex border-b border-black bg-gray-100 text-xs font-bold">
                  <div className="flex-1 px-3 py-1.5">Descripción</div>
                  <div className="w-40 px-3 py-1.5 text-right">Monto</div>
                  <div className="hidden w-48 px-3 py-1.5 sm:block">Fuente</div>
                  <div className="hidden w-28 px-3 py-1.5 lg:block">Fecha</div>
                  <div className="w-28 px-3 py-1.5" />
                </div>
                {rows.map((g) => {
                  const marker = markerMap[g.id] ?? null
                  return (
                  <div key={g.id} className={g.status !== "ACTIVE" ? "opacity-60" : ""}>
                    <div
                      className="flex border-b border-black text-sm"
                      style={marker ? {
                        borderLeft: `4px solid ${marker.color}`,
                        backgroundColor: `${marker.color}18`,
                      } : undefined}
                    >
                      <button
                        onClick={() => toggleLinks(g.id)}
                        className="flex items-center px-2 py-2 text-gray-400 hover:text-black"
                        title="Ver ingresos vinculados"
                      >
                        {expandedLinks.has(g.id)
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex flex-1 flex-col gap-0.5 py-2 pr-3">
                        <span className="font-medium">{g.name}</span>
                        <StatusBadge status={g.status} />
                      </div>
                      <div className="w-40 px-3 py-2 text-right tabular-nums">
                        {formatAmount(g.amount, g.currency)} {g.currency}
                      </div>
                      <div className="hidden w-48 items-center px-3 py-2 sm:flex">
                        <SourceBadge source={g.source} />
                      </div>
                      <div className="hidden w-28 items-center px-3 py-2 text-xs text-gray-400 lg:flex">
                        {formatDate(g.operationDate)}
                      </div>
                      <div className="flex w-28 items-center justify-end gap-2 px-3 py-2">
                        <MarkerPicker
                          entityId={g.id}
                          entityType="RECORD"
                          currentMarker={marker}
                          onChanged={() => refreshMarkers(gastos.map((x) => x.id))}
                        />
                        {g.status === "ACTIVE" ? (
                          <>
                            <button
                              onClick={() => setEditingGasto(g)}
                              className="text-gray-400 hover:text-black"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(g.id)}
                              className="text-xs text-gray-400 hover:text-gray-700"
                            >
                              Archivar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRestore(g.id)}
                            className="text-xs font-semibold text-gray-600 hover:text-black"
                          >
                            Restaurar
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedLinks.has(g.id) && (
                      <GastoIngresoLinksPanel gastoId={g.id} gastoCurrency={g.currency} />
                    )}
                  </div>
                  )
                })}

              </div>
            ))}
        </div>
      )}

      <GastoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => fetchGastos(statusFilter)}
      />

      {editingGasto && (
        <EditOrVersionDialog
          open={!!editingGasto}
          onOpenChange={(v) => { if (!v) setEditingGasto(null) }}
          recordId={editingGasto.id}
          recordType="gasto"
          initialName={editingGasto.name}
          initialAmount={editingGasto.amount}
          initialCurrency={editingGasto.currency}
          onSaved={() => { setEditingGasto(null); fetchGastos(statusFilter) }}
        />
      )}
    </div>
  )
}
