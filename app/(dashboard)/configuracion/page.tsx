"use client"

import { useState } from "react"
import { Settings2, RefreshCw, Download } from "lucide-react"
import { currencies, type Currency, ratesAgeDays, formatRatesAge, RATES_STALE_AFTER_DAYS } from "@/lib/finance"
import { useSettings } from "@/components/settings-store"
import { useFinance } from "@/components/finance-store"
import { toCSV, downloadTextFile } from "@/lib/csv-export"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { MarkerManagerDialog } from "@/components/markers/marker-manager-dialog"
import { AssetCategoriesSettings } from "@/components/activos/asset-categories-settings"
import { CutoffSettings } from "@/components/cutoff/cutoff-settings"

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors ${
          checked ? "border-black bg-black" : "border-gray-400 bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}

export default function ConfiguracionPage() {
  const {
    settings,
    updateSettings,
    updateRate,
    fetchExchangeRates,
    fetchingRates,
  } = useSettings()

  const {
    convertCurrencies,
    baseCurrency,
    showConvertedAmounts,
    exchangeRates,
    ratesLastUpdated,
  } = settings

  const { records, movements } = useFinance()

  const otherCurrencies = currencies.filter((c) => c !== baseCurrency)

  const today = new Date().toISOString().slice(0, 10)

  const exportRecords = () => {
    const csv = toCSV(records, ["id", "type", "name", "amount", "currency", "status", "assetType", "linkedTo", "parentId"])
    downloadTextFile(`cashflow-registros-${today}.csv`, csv)
  }

  const exportMovements = () => {
    const csv = toCSV(movements, ["date", "action", "recordType", "recordName", "detail", "comment"])
    downloadTextFile(`cashflow-movimientos-${today}.csv`, csv)
  }

  // Custom type UI state
  const [markerManagerOpen, setMarkerManagerOpen] = useState(false)

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <Settings2 className="h-5 w-5" />
        <span className="text-lg font-bold">Personalización</span>
      </div>

      {/* ── Dashboard section ─────────────────────────────────────── */}
      <div className="mb-6 border-2 border-black">
        <div className="border-b-2 border-black bg-black px-4 py-2">
          <span className="text-sm font-bold uppercase tracking-wide text-white">
            Dashboard
          </span>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <SwitchRow
            label="Convertir divisas al calcular"
            description="Consolida totales en una moneda base usando tasas de cambio."
            checked={convertCurrencies}
            onCheckedChange={(v) => updateSettings({ convertCurrencies: v })}
          />

          {convertCurrencies && (
            <div className="flex flex-col gap-4 border-l-2 border-gray-200 pl-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold">Moneda base</p>
                <Select
                  value={baseCurrency}
                  onValueChange={(v) =>
                    updateSettings({ baseCurrency: v as Currency })
                  }
                >
                  <SelectTrigger className="h-8 w-28 border-2 border-black text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    Tasas de cambio (relativas a {baseCurrency})
                  </p>
                  <button
                    onClick={fetchExchangeRates}
                    disabled={fetchingRates}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-black disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${fetchingRates ? "animate-spin" : ""}`}
                    />
                    Actualizar
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="w-12 font-mono font-bold">{baseCurrency}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={1}
                        disabled
                        className="w-24 border border-gray-200 bg-gray-100 px-2 py-1 text-right text-sm text-gray-400"
                      />
                      <span className="w-12 text-xs text-gray-400">{baseCurrency}</span>
                    </div>
                  </div>

                  {otherCurrencies.map((c) => (
                    <div
                      key={c}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="w-12 font-mono font-bold">{c}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={exchangeRates[c] ?? ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v > 0) updateRate(c, v)
                          }}
                          className="w-24 border-2 border-black px-2 py-1 text-right text-sm outline-none focus:border-gray-500"
                        />
                        <span className="w-12 text-xs text-gray-500">{baseCurrency}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {(() => {
                  const days = ratesAgeDays(ratesLastUpdated)
                  const stale = days === null || days > RATES_STALE_AFTER_DAYS
                  return (
                    <p className={`text-xs ${stale ? "font-semibold text-amber-700" : "text-gray-400"}`}>
                      Última actualización: {formatRatesAge(ratesLastUpdated)}
                      {stale && ratesLastUpdated && " — el patrimonio convertido puede estar desactualizado"}
                    </p>
                  )
                })()}
              </div>

              <SwitchRow
                label="Convertir montos a moneda base"
                description="Muestra cada registro en la moneda base (solo visual, no modifica los datos)."
                checked={showConvertedAmounts}
                onCheckedChange={(v) => updateSettings({ showConvertedAmounts: v })}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Categorías de Activo ─────────────────────────────────── */}
      <div className="mt-8">
        <AssetCategoriesSettings />
      </div>

      {/* Marcadores */}
      <div className="mt-8 border-2 border-black">
        <div className="border-b-2 border-black bg-black px-4 py-2">
          <h2 className="font-bold italic text-white">Marcadores Visuales</h2>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-gray-600">
            Crea marcadores de colores para resaltar entidades importantes.
          </p>
          <button
            onClick={() => setMarkerManagerOpen(true)}
            className="shrink-0 border-2 border-black bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800"
          >
            Gestionar marcadores
          </button>
        </div>
      </div>

      {/* Exportar Datos */}
      <div className="mt-8 border-2 border-black">
        <div className="border-b-2 border-black bg-black px-4 py-2">
          <h2 className="font-bold italic text-white">Exportar Datos</h2>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="text-sm text-gray-600">
            Tus datos financieros son tuyos — descargalos cuando quieras, sin depender de esta app.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportRecords}
              className="flex items-center gap-2 border-2 border-black bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800"
            >
              <Download className="h-3.5 w-3.5" />
              Registros actuales (CSV)
            </button>
            <button
              onClick={exportMovements}
              className="flex items-center gap-2 border-2 border-black px-3 py-1.5 text-xs font-bold hover:bg-gray-100"
            >
              <Download className="h-3.5 w-3.5" />
              Historial de movimientos (CSV)
            </button>
          </div>
        </div>
      </div>

      <CutoffSettings />

      <MarkerManagerDialog open={markerManagerOpen} onOpenChange={setMarkerManagerOpen} />
    </div>
  )
}
