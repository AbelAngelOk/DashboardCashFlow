"use client"

import { useState } from "react"
import { Settings2, RefreshCw, Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from "lucide-react"
import { currencies, type Currency } from "@/lib/finance"
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/assets"
import { useSettings } from "@/components/settings-store"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { MarkerManagerDialog } from "@/components/markers/marker-manager-dialog"

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

// System asset types (excluding GROUP, which is internal)
const SYSTEM_TYPES = (Object.keys(ASSET_TYPE_LABELS) as AssetType[]).filter(
  (t) => t !== "GROUP",
)

export default function ConfiguracionPage() {
  const {
    settings,
    updateSettings,
    updateRate,
    fetchExchangeRates,
    fetchingRates,
    toggleHideAssetType,
    addCustomAssetType,
    renameCustomAssetType,
    removeCustomAssetType,
  } = useSettings()

  const {
    convertCurrencies,
    baseCurrency,
    showConvertedAmounts,
    exchangeRates,
    ratesLastUpdated,
    hiddenAssetTypes,
    customAssetTypes,
  } = settings

  const otherCurrencies = currencies.filter((c) => c !== baseCurrency)

  // Custom type UI state
  const [newTypeName, setNewTypeName] = useState("")
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editingTypeName, setEditingTypeName] = useState("")
  const [markerManagerOpen, setMarkerManagerOpen] = useState(false)

  const handleAddCustomType = () => {
    if (!newTypeName.trim()) return
    addCustomAssetType(newTypeName.trim())
    setNewTypeName("")
  }

  const startRenameCustom = (id: string, name: string) => {
    setEditingTypeId(id)
    setEditingTypeName(name)
  }

  const saveRenameCustom = () => {
    if (editingTypeId && editingTypeName.trim()) {
      renameCustomAssetType(editingTypeId, editingTypeName.trim())
    }
    setEditingTypeId(null)
  }

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

                {ratesLastUpdated && (
                  <p className="text-xs text-gray-400">
                    Última actualización: {ratesLastUpdated}
                  </p>
                )}
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

      {/* ── Tipos de Activo section ───────────────────────────────── */}
      <div className="mt-8 border-2 border-black">
        <div className="border-b-2 border-black bg-black px-4 py-2">
          <span className="text-sm font-bold uppercase tracking-wide text-white">
            Tipos de Activo
          </span>
        </div>

        <div className="p-4">
          <p className="mb-4 text-xs text-gray-500">
            Los tipos ocultos no aparecen en los selectores de la app. No se pueden eliminar los tipos del sistema.
          </p>

          {/* System types */}
          <div className="mb-4 flex flex-col gap-1">
            <p className="mb-2 text-xs font-bold uppercase text-gray-400">Tipos del sistema</p>
            {SYSTEM_TYPES.map((type) => {
              const isHidden = (hiddenAssetTypes ?? []).includes(type)
              return (
                <div
                  key={type}
                  className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${isHidden ? "border-gray-200 bg-gray-50 text-gray-400" : "border-gray-300"}`}
                >
                  <span className={isHidden ? "line-through" : ""}>{ASSET_TYPE_LABELS[type]}</span>
                  <button
                    onClick={() => toggleHideAssetType(type)}
                    className="text-gray-400 hover:text-black"
                    title={isHidden ? "Mostrar tipo" : "Ocultar tipo"}
                  >
                    {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Custom types */}
          <div className="flex flex-col gap-1">
            <p className="mb-2 text-xs font-bold uppercase text-gray-400">Tipos personalizados</p>
            {(customAssetTypes ?? []).map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {editingTypeId === ct.id ? (
                  <>
                    <Input
                      value={editingTypeName}
                      onChange={(e) => setEditingTypeName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRenameCustom(); if (e.key === "Escape") setEditingTypeId(null) }}
                      className="h-6 flex-1 border border-gray-300 text-sm focus-visible:ring-0"
                      autoFocus
                    />
                    <button onClick={saveRenameCustom} className="text-emerald-700 hover:text-emerald-900"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingTypeId(null)} className="text-gray-400 hover:text-black"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{ct.name}</span>
                    <button onClick={() => startRenameCustom(ct.id, ct.name)} className="text-gray-400 hover:text-black"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeCustomAssetType(ct.id)} className="text-gray-400 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                  </>
                )}
              </div>
            ))}

            {/* Add custom type */}
            <div className="mt-2 flex gap-2">
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomType()}
                placeholder="Nombre del nuevo tipo..."
                className="h-8 flex-1 border-2 border-black text-sm focus-visible:ring-0"
              />
              <button
                onClick={handleAddCustomType}
                disabled={!newTypeName.trim()}
                className="flex items-center gap-1 border-2 border-black bg-black px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>
          </div>
        </div>
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

      <MarkerManagerDialog open={markerManagerOpen} onOpenChange={setMarkerManagerOpen} />
    </div>
  )
}
