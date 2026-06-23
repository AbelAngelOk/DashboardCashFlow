"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ExternalLink, Plus, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadIngresos, type IngresoWithSource, type IngresoSourceType } from "@/lib/ingreso-actions"
import { IngresoFormDialog } from "@/components/ingresos/ingreso-form-dialog"
import { formatAmount, type Currency } from "@/lib/finance"

const SOURCE_TYPE_LABELS: Record<IngresoSourceType, string> = {
  dividend: "Dividendo",
  "fixed-term": "Plazo Fijo",
  liquidation: "Liquidación",
  extraction: "Extracción",
  manual: "Manual",
}

function SourceBadge({ source }: { source: IngresoWithSource["source"] }) {
  if (source.type === "asset") {
    return (
      <Link
        href={`/activos/${source.assetId}`}
        className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
      >
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold">
          {SOURCE_TYPE_LABELS[source.sourceType]}
        </span>
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

function formatDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function IngresosPage() {
  const [ingresos, setIngresos] = useState<IngresoWithSource[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  const fetchIngresos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadIngresos()
      setIngresos(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIngresos()
  }, [fetchIngresos])

  const assetIngresos = ingresos.filter((i) => i.source.type === "asset")
  const freeIngresos = ingresos.filter((i) => i.source.type === "free")

  const totalByCurrency = ingresos.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.amount
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="inline-block bg-black px-4 py-1 text-white">
          <span className="font-bold">Ingresos</span>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-black text-white hover:bg-gray-800"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nuevo Ingreso
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
      ) : ingresos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <TrendingDown className="h-12 w-12 text-gray-200" />
          <p className="text-sm text-gray-400">No hay ingresos registrados.</p>
          <Button
            size="sm"
            className="gap-2 bg-black text-white hover:bg-gray-800"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Registrar ingreso
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary */}
          <div className="border-2 border-black bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-xs font-bold uppercase text-gray-500">Total ingresos</span>
                <div className="font-bold">{ingresos.length}</div>
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
            { label: "Desde Activos", rows: assetIngresos },
            { label: "Ingresos Libres", rows: freeIngresos },
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
                </div>
                {rows.map((i) => (
                  <div key={i.id} className="flex border-b border-black text-sm last:border-b-0">
                    <div className="flex-1 px-3 py-2 font-medium">{i.name}</div>
                    <div className="w-40 px-3 py-2 text-right tabular-nums">
                      {formatAmount(i.amount, i.currency)} {i.currency}
                    </div>
                    <div className="hidden w-48 items-center px-3 py-2 sm:flex">
                      <SourceBadge source={i.source} />
                    </div>
                    <div className="hidden w-28 items-center px-3 py-2 text-xs text-gray-400 lg:flex">
                      {formatDate(i.operationDate)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      <IngresoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={fetchIngresos}
      />
    </div>
  )
}
