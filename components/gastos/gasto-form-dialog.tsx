"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { currencies, type Currency } from "@/lib/finance"
import { useAssetCategories } from "@/components/activos/asset-categories-store"
import { createFreeGasto, createGastoForExistingAsset, createGastoAndNewAsset } from "@/lib/gasto-actions"
import { useFinance } from "@/components/finance-store"
import { useSettings } from "@/components/settings-store"
import type { FinancialRecord } from "@/lib/finance"

type SourceType = "free" | "existing-asset" | "new-asset"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: () => void
}

export function GastoFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { records, reload } = useFinance()
  const { settings } = useSettings()


  const activos = records.filter(
    (r): r is FinancialRecord => r.type === "activo" && !r.isGroupParent,
  )

  const { categories } = useAssetCategories()

  // ── Shared state ──────────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<SourceType>("free")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [saving, setSaving] = useState(false)

  // ── Asset existente ───────────────────────────────────────────────────────
  const [selectedAssetId, setSelectedAssetId] = useState("")

  // ── Asset nuevo ───────────────────────────────────────────────────────────
  const [assetName, setAssetName] = useState("")
  const [assetType, setAssetType] = useState<string>("")

  const reset = () => {
    setSourceType("free")
    setName("")
    setAmount("")
    setCurrency("ARS")
    setSelectedAssetId("")
    setAssetName("")
    setAssetType("STOCK")
    setSaving(false)
  }

  const suggestedGastoName = () => {
    if (sourceType === "existing-asset" && selectedAssetId) {
      const a = activos.find((r) => r.id === selectedAssetId)
      return a ? `Inversión en ${a.name}` : ""
    }
    if (sourceType === "new-asset" && assetName.trim()) {
      return `Inversión en ${assetName.trim()}`
    }
    return ""
  }

  const effectiveName = name.trim() || suggestedGastoName()

  const canSave = (): boolean => {
    if (!effectiveName || !amount || Number(amount) <= 0) return false
    if (sourceType === "existing-asset" && !selectedAssetId) return false
    if (sourceType === "new-asset" && !assetName.trim()) return false
    return true
  }

  const handleSave = async () => {
    if (!canSave()) return
    setSaving(true)
    try {
      const amountNum = Number(amount)
      const gastoName = effectiveName

      if (sourceType === "free") {
        await createFreeGasto({ name: gastoName, amount: amountNum, currency })
      } else if (sourceType === "existing-asset") {
        await createGastoForExistingAsset(
          { name: gastoName, amount: amountNum, currency },
          selectedAssetId,
        )
      } else {
        await createGastoAndNewAsset(
          { name: gastoName, amount: amountNum, currency },
          { name: assetName.trim(), assetType: assetType || null, amount: amountNum, currency },
        )
      }

      await reload()
      onCreated?.()
      reset()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Nuevo Gasto</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Tipo de gasto */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Tipo</Label>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["free", "Gasto libre", "Sin asociación a ningún activo"],
                  ["existing-asset", "Depósito en activo existente", "Aumenta el valor de un activo"],
                  ["new-asset", "Crear activo nuevo", "Crea un gasto y un nuevo activo"],
                ] as [SourceType, string, string][]
              ).map(([value, label, desc]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2 rounded border-2 p-3 text-sm transition-colors ${
                    sourceType === value ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="sourceType"
                    value={value}
                    checked={sourceType === value}
                    onChange={() => setSourceType(value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold">{label}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Activo existente selector */}
          {sourceType === "existing-asset" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Activo *</Label>
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue placeholder="Seleccionar activo..." />
                </SelectTrigger>
                <SelectContent>
                  {activos.length === 0 ? (
                    <SelectItem value="_none" disabled>Sin activos disponibles</SelectItem>
                  ) : (
                    activos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nuevo activo fields */}
          {sourceType === "new-asset" && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Nombre del activo *</Label>
                <Input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Ej: Tesla Inc."
                  className="border-2 border-black"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">
                  Categoría <span className="font-normal text-gray-400">(opcional)</span>
                </Label>
                <Select value={assetType} onValueChange={setAssetType}>
                  <SelectTrigger className="border-2 border-black">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Nombre del gasto */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">
              Nombre del gasto
              {sourceType !== "free" && <span className="ml-1 font-normal text-gray-400">(auto-sugerido)</span>}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedGastoName() || "Ej: Supermercado"}
              className="border-2 border-black"
            />
            {sourceType !== "free" && !name.trim() && suggestedGastoName() && (
              <p className="text-xs text-gray-400">Se usará: "{suggestedGastoName()}"</p>
            )}
          </div>

          {/* Monto + Moneda */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Monto *</Label>
              <NumericInput
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                className="border-2 border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-24 border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview of what will happen */}
          {sourceType === "existing-asset" && selectedAssetId && amount && Number(amount) > 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Se creará un gasto y se incrementará el valor del activo en{" "}
              <strong>{Number(amount).toLocaleString("es-ES")} {currency}</strong>.
            </div>
          )}
          {sourceType === "new-asset" && assetName.trim() && amount && Number(amount) > 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Se creará el activo <strong>"{assetName.trim()}"</strong> y un gasto vinculado por{" "}
              <strong>{Number(amount).toLocaleString("es-ES")} {currency}</strong>.
            </div>
          )}
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button
            variant="outline"
            className="border-2 border-black"
            onClick={() => { reset(); onOpenChange(false) }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleSave}
            disabled={!canSave() || saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
