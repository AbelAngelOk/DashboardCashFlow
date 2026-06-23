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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { currencies, type Currency } from "@/lib/finance"
import { createFreeIngreso, createIngresoFromAsset } from "@/lib/ingreso-actions"
import { useFinance } from "@/components/finance-store"
import type { FinancialRecord } from "@/lib/finance"

type SourceType = "existing-asset" | "auto" | "free"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: () => void
}

export function IngresoFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { records, reload } = useFinance()

  const activos = records.filter(
    (r): r is FinancialRecord => r.type === "activo" && !r.isGroupParent,
  )

  const [sourceType, setSourceType] = useState<SourceType>("free")
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [saving, setSaving] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState("")

  const reset = () => {
    setSourceType("free")
    setName("")
    setAmount("")
    setCurrency("ARS")
    setSelectedAssetId("")
    setSaving(false)
  }

  const selectedAsset = activos.find((a) => a.id === selectedAssetId)

  const suggestedName = () => {
    if (sourceType === "existing-asset" && selectedAsset) {
      return `Venta de ${selectedAsset.name}`
    }
    return ""
  }

  const effectiveName = name.trim() || suggestedName()

  const canSave = (): boolean => {
    if (sourceType === "auto") return false
    if (!effectiveName || !amount || Number(amount) <= 0) return false
    if (sourceType === "existing-asset") {
      if (!selectedAssetId) return false
      if (Number(amount) > (selectedAsset?.amount ?? 0)) return false
    }
    return true
  }

  const handleSave = async () => {
    if (!canSave()) return
    setSaving(true)
    try {
      const amountNum = Number(amount)
      const ingresoName = effectiveName

      if (sourceType === "free") {
        await createFreeIngreso({ name: ingresoName, amount: amountNum, currency })
      } else if (sourceType === "existing-asset") {
        await createIngresoFromAsset(
          { name: ingresoName, amount: amountNum, currency },
          selectedAssetId,
          amountNum,
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
          <DialogTitle className="font-bold italic text-white">Nuevo Ingreso</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Tipo de ingreso */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Origen</Label>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["free", "Ingreso libre", "Salario, alquiler cobrado, etc."],
                  ["existing-asset", "Extracción de activo", "Reduce el valor de un activo y registra el ingreso"],
                  ["auto", "Automático", "Dividendos, plazos fijos y liquidaciones"],
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

          {/* Panel informativo para automático */}
          {sourceType === "auto" && (
            <div className="rounded border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p className="font-semibold text-gray-700">Generación automática</p>
              <p className="mt-1 text-xs leading-relaxed">
                Los ingresos por <strong>dividendos</strong>, <strong>cobro de plazos fijos</strong> y{" "}
                <strong>liquidaciones de activos</strong> se generan automáticamente cuando realizás
                esas acciones desde la sección <strong>Activos</strong>.
              </p>
              <p className="mt-2 text-xs text-gray-400">
                No es necesario registrarlos manualmente.
              </p>
            </div>
          )}

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
                        {a.amount > 0 && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({a.amount.toLocaleString("es-ES")} {a.currency})
                          </span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nombre del ingreso (no para modo automático) */}
          {sourceType !== "auto" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">
                Nombre del ingreso
                {sourceType === "existing-asset" && (
                  <span className="ml-1 font-normal text-gray-400">(auto-sugerido)</span>
                )}
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={suggestedName() || "Ej: Salario julio"}
                className="border-2 border-black"
              />
              {sourceType === "existing-asset" && !name.trim() && suggestedName() && (
                <p className="text-xs text-gray-400">Se usará: "{suggestedName()}"</p>
              )}
            </div>
          )}

          {/* Monto + Moneda (no para modo automático) */}
          {sourceType !== "auto" && (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Monto *</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="border-2 border-black"
                />
                {sourceType === "existing-asset" && selectedAsset && Number(amount) > selectedAsset.amount && (
                  <p className="text-xs text-red-500">
                    Supera el balance del activo ({selectedAsset.amount.toLocaleString("es-ES")} {selectedAsset.currency})
                  </p>
                )}
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
          )}

          {/* Preview */}
          {sourceType === "existing-asset" && selectedAsset && amount && Number(amount) > 0 && Number(amount) <= selectedAsset.amount && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Se registrará el ingreso y el activo{" "}
              <strong>{selectedAsset.name}</strong> pasará de{" "}
              <strong>{selectedAsset.amount.toLocaleString("es-ES")} {selectedAsset.currency}</strong> a{" "}
              <strong>{(selectedAsset.amount - Number(amount)).toLocaleString("es-ES")} {selectedAsset.currency}</strong>.
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
          {sourceType !== "auto" && (
            <Button
              className="bg-black text-white hover:bg-gray-800"
              onClick={handleSave}
              disabled={!canSave() || saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
