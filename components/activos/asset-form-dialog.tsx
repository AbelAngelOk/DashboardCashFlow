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
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/assets"
import { currencies, defaultCurrency, type Currency } from "@/lib/finance"
import { createAsset } from "@/lib/assets-actions"
import { useFinance } from "@/components/finance-store"
import { useSettings } from "@/components/settings-store"

interface AssetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: () => void
  parentId?: string
  defaultName?: string
  defaultAssetType?: AssetType
}

export function AssetFormDialog({
  open,
  onOpenChange,
  onCreate,
  parentId,
  defaultName = "",
  defaultAssetType = "STOCK",
}: AssetFormDialogProps) {
  const { reload } = useFinance()
  const { settings } = useSettings()
  const { hiddenAssetTypes = [], customAssetTypes = [] } = settings

  const visibleSystemTypes = (Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).filter(
    ([type]) => type !== "GROUP" && !hiddenAssetTypes.includes(type),
  )

  const [assetType, setAssetType] = useState<AssetType>(defaultAssetType)
  const [name, setName] = useState(defaultName)
  const [ticker, setTicker] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [description, setDescription] = useState("")
  const [qty, setQty] = useState("")
  const [avgPrice, setAvgPrice] = useState("")
  // FIXED_TERM
  const [ftStartDate, setFtStartDate] = useState("")
  const [ftEndDate, setFtEndDate] = useState("")
  const [ftRate, setFtRate] = useState("")
  const [saving, setSaving] = useState(false)

  const hasQtyPrice = ["STOCK", "CRYPTO", "FUTURES", "OPTIONS"].includes(assetType)
  const qtyNum = Number(qty)
  const priceNum = Number(avgPrice)
  const amountNum = Number(amount)
  const calcMismatch =
    hasQtyPrice &&
    qty !== "" &&
    avgPrice !== "" &&
    amount !== "" &&
    Math.abs(qtyNum * priceNum - amountNum) > 0.01

  const handleQtyChange = (v: string) => {
    setQty(v)
    if (v !== "" && avgPrice !== "") {
      setAmount(String(Number(v) * Number(avgPrice)))
    }
  }

  const handlePriceChange = (v: string) => {
    setAvgPrice(v)
    if (v !== "" && qty !== "") {
      setAmount(String(Number(qty) * Number(v)))
    }
  }

  const reset = () => {
    setName(defaultName)
    setTicker("")
    setAmount("")
    setDescription("")
    setQty("")
    setAvgPrice("")
    setFtStartDate("")
    setFtEndDate("")
    setFtRate("")
    setAssetType(defaultAssetType)
  }

  const buildInitialMetadata = (): unknown => {
    switch (assetType) {
      case "STOCK":
        return { dividends: [] }
      case "BOND":
        return { disbursements: [] }
      case "TRADING_BOT":
        return { totalInvested: 0, totalGained: 0, totalLost: 0, totalExtracted: 0, currency }
      case "REBALANCE_BOT":
        return { assets: [] }
      case "TRADING":
        return { totalInvested: 0, totalObtained: 0, currency }
      case "FIXED_TERM":
        return {
          startDate: ftStartDate,
          endDate: ftEndDate,
          rate: Number(ftRate) || 0,
          collected: false,
        }
      default:
        return undefined
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    try {
      const id = await createAsset({
        name: name.trim(),
        assetType,
        ticker: ticker.trim() || undefined,
        amount: Number(amount),
        currency,
        currentQty: qty ? Number(qty) : undefined,
        avgBuyPrice: avgPrice ? Number(avgPrice) : undefined,
        description: description.trim() || undefined,
        parentId,
        metadata: buildInitialMetadata(),
      })

      reload()
      onCreate?.()
      reset()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Nuevo activo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Tipo */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Tipo de activo</Label>
            <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
              <SelectTrigger className="border-2 border-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleSystemTypes.map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
                {customAssetTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Tesla Inc."
              className="border-2 border-black"
            />
          </div>

          {/* Ticker */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Ticker / Identificador</Label>
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Ej: TSLA, BTCUSDT"
              className="border-2 border-black"
            />
          </div>

          {/* Valor inicial + Moneda */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Valor inicial</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cantidad + Precio promedio (para activos con unidades) */}
          {hasQtyPrice && (
            <>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Cantidad inicial</Label>
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    placeholder="0"
                    className={`border-2 ${calcMismatch ? "border-amber-500" : "border-black"}`}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Precio promedio</Label>
                  <Input
                    type="number"
                    value={avgPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="0.00"
                    className={`border-2 ${calcMismatch ? "border-amber-500" : "border-black"}`}
                  />
                </div>
              </div>
              {calcMismatch && (
                <p className="text-xs text-amber-700">
                  El valor ({amount}) no coincide con cantidad × precio ({(qtyNum * priceNum).toFixed(2)}). Corregí uno de los tres campos.
                </p>
              )}
            </>
          )}

          {/* FIXED_TERM extras */}
          {assetType === "FIXED_TERM" && (
            <>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Fecha inicio</Label>
                  <Input
                    type="date"
                    value={ftStartDate}
                    onChange={(e) => setFtStartDate(e.target.value)}
                    className="border-2 border-black"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Fecha vencimiento</Label>
                  <Input
                    type="date"
                    value={ftEndDate}
                    onChange={(e) => setFtEndDate(e.target.value)}
                    className="border-2 border-black"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Tasa anual (%)</Label>
                <Input
                  type="number"
                  value={ftRate}
                  onChange={(e) => setFtRate(e.target.value)}
                  placeholder="0.00"
                  className="border-2 border-black"
                />
              </div>
            </>
          )}

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Descripción (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas adicionales..."
              className="border-2 border-black"
            />
          </div>
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleSave}
            disabled={saving || !name.trim() || !amount || calcMismatch}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
