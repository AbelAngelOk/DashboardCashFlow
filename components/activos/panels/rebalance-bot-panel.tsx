"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAmount, currencies, defaultCurrency, type Currency } from "@/lib/finance"
import {
  type Asset,
  type RebalanceBotMetadata,
  type RebalanceBotAsset,
  calcWeightedAvgPrice,
} from "@/lib/assets"
import { updateAsset } from "@/lib/assets-actions"

interface RebalanceBotPanelProps {
  asset: Asset
}

export function RebalanceBotPanel({ asset }: RebalanceBotPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [showExtraction, setShowExtraction] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)

  // Add asset form state
  const [addName, setAddName] = useState("")
  const [addTicker, setAddTicker] = useState("")
  const [addInvested, setAddInvested] = useState("")
  const [addPrice, setAddPrice] = useState("")
  const [addQty, setAddQty] = useState("")
  const [addCurrency, setAddCurrency] = useState<Currency>(asset.currency ?? defaultCurrency)

  // Extraction / deposit
  const [operationAmount, setOperationAmount] = useState("")

  const metadata = (asset.metadata as RebalanceBotMetadata | null) ?? { assets: [] }
  const assets = metadata.assets ?? []

  const totalInvested = assets.reduce((s, a) => s + a.invested, 0)

  const saveMetadata = (updatedAssets: RebalanceBotAsset[]) => {
    startTransition(async () => {
      const currentTotal = updatedAssets.reduce((s, a) => s + a.invested, 0)
      const totalValue = updatedAssets.reduce((s, a) => s + a.currentPrice * a.currentQty, 0)
      await updateAsset(asset.id, {
        metadata: { assets: updatedAssets, totalInvested: currentTotal },
        amount: Math.max(currentTotal, totalValue),
      })
      router.refresh()
    })
  }

  const handleAddAsset = () => {
    if (!addName || !addPrice || !addQty) return
    const newAsset: RebalanceBotAsset = {
      id: crypto.randomUUID(),
      name: addName,
      ticker: addTicker || undefined,
      invested: Number(addInvested) || Number(addPrice) * Number(addQty),
      currentPrice: Number(addPrice),
      initialQty: Number(addQty),
      currentQty: Number(addQty),
      currency: addCurrency,
    }
    saveMetadata([...assets, newAsset])
    setShowAdd(false)
    setAddName("")
    setAddTicker("")
    setAddInvested("")
    setAddPrice("")
    setAddQty("")
  }

  const handleRemoveAsset = (id: string) => {
    saveMetadata(assets.filter((a) => a.id !== id))
  }

  // Partial extraction: distribute proportionally
  const handleExtraction = () => {
    const total = assets.reduce((s, a) => s + a.currentPrice * a.currentQty, 0)
    if (total === 0) return
    const extractAmt = Number(operationAmount)
    const ratio = extractAmt / total
    const updated = assets.map((a) => ({
      ...a,
      currentQty: Math.max(0, a.currentQty * (1 - ratio)),
    }))
    saveMetadata(updated)
    setShowExtraction(false)
    setOperationAmount("")
  }

  // New deposit: distribute proportionally, average qty and price
  const handleDeposit = () => {
    const total = assets.reduce((s, a) => s + a.invested, 0)
    if (total === 0 || assets.length === 0) return
    const depositAmt = Number(operationAmount)
    const updated = assets.map((a) => {
      const share = a.invested / total
      const depositForAsset = depositAmt * share
      const newQty = depositForAsset / a.currentPrice
      const newTotalQty = a.currentQty + newQty
      const newAvgPrice = calcWeightedAvgPrice(a.currentQty, a.currentPrice, newQty, a.currentPrice)
      return {
        ...a,
        invested: a.invested + depositForAsset,
        currentQty: newTotalQty,
        currentPrice: newAvgPrice,
      }
    })
    saveMetadata(updated)
    setShowDeposit(false)
    setOperationAmount("")
  }

  return (
    <div data-testid="asset-panel-rebalance-bot" className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-2 border-black">
        <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Bot de Rebalanceo</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-6 text-xs text-white hover:bg-white/20" onClick={() => setShowDeposit(true)}>
              Nuevo aporte
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs text-white hover:bg-white/20" onClick={() => setShowExtraction(true)}>
              Extracción parcial
            </Button>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs text-white hover:bg-white/20" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />
              Activo
            </Button>
          </div>
        </div>

        <div className="p-3 text-sm">
          <span className="font-bold text-gray-500">Total invertido:</span>{" "}
          <span className="font-bold">{formatAmount(totalInvested, asset.currency)} {asset.currency}</span>
        </div>
      </div>

      {/* Assets table */}
      <div className="border-2 border-black">
        <div className="flex bg-gray-100 text-xs font-bold">
          <div className="flex-1 border-r border-black px-3 py-2">Activo</div>
          <div className="w-28 border-r border-black px-3 py-2 text-right">Invertido</div>
          <div className="w-28 border-r border-black px-3 py-2 text-right">Precio prom.</div>
          <div className="w-24 border-r border-black px-3 py-2 text-right">Qty inicial</div>
          <div className="w-24 border-r border-black px-3 py-2 text-right">Qty actual</div>
          <div className="w-10 px-1 py-2" />
        </div>

        {assets.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            Sin activos en el bot. Agregá el primero.
          </div>
        )}

        {assets.map((a) => (
          <div key={a.id} className="group flex border-b border-black text-sm">
            <div className="flex-1 border-r border-black px-3 py-2">
              <div className="font-medium">{a.name}</div>
              {a.ticker && <div className="text-xs text-gray-500">{a.ticker}</div>}
            </div>
            <div className="w-28 border-r border-black px-3 py-2 text-right font-mono text-xs">
              {formatAmount(a.invested, a.currency)}
            </div>
            <div className="w-28 border-r border-black px-3 py-2 text-right font-mono text-xs">
              {formatAmount(a.currentPrice, a.currency)}
            </div>
            <div className="w-24 border-r border-black px-3 py-2 text-right font-mono text-xs">
              {a.initialQty.toFixed(4)}
            </div>
            <div className="w-24 border-r border-black px-3 py-2 text-right font-mono text-xs">
              {a.currentQty.toFixed(4)}
            </div>
            <div className="flex w-10 items-center justify-center px-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => handleRemoveAsset(a.id)}
                disabled={isPending}
                className="text-gray-400 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add asset dialog */}
      {showAdd && (
        <Dialog open onOpenChange={(o) => !o && setShowAdd(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Agregar activo al bot</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Nombre</Label>
                  <Input value={addName} onChange={(e) => setAddName(e.target.value)} className="border-2 border-black" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Ticker</Label>
                  <Input value={addTicker} onChange={(e) => setAddTicker(e.target.value)} className="border-2 border-black" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Precio inicial</Label>
                  <NumericInput value={addPrice} onChange={setAddPrice} placeholder="0.00" className="border-2 border-black" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Cantidad</Label>
                  <NumericInput value={addQty} onChange={setAddQty} placeholder="0" className="border-2 border-black" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Monto invertido</Label>
                  <NumericInput value={addInvested} onChange={setAddInvested} placeholder="Auto (precio×qty)" className="border-2 border-black" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Moneda</Label>
                  <Select value={addCurrency} onValueChange={(v) => setAddCurrency(v as Currency)}>
                    <SelectTrigger className="w-24 border-2 border-black"><SelectValue /></SelectTrigger>
                    <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="border-2 border-black">Cancelar</Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={handleAddAsset} disabled={isPending || !addName || !addPrice || !addQty}>
                {isPending ? "Guardando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Extraction dialog */}
      {showExtraction && (
        <Dialog open onOpenChange={(o) => !o && setShowExtraction(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Extracción parcial</DialogTitle>
            </DialogHeader>
            <div className="px-4 py-4">
              <Label className="text-xs font-bold uppercase">Monto total a extraer ({asset.currency})</Label>
              <NumericInput value={operationAmount} onChange={setOperationAmount} placeholder="0.00" className="mt-1 border-2 border-black" autoFocus />
              <p className="mt-2 text-xs text-gray-500">
                Se reducirá la cantidad de cada activo proporcionalmente al valor de mercado actual.
              </p>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setShowExtraction(false)} className="border-2 border-black">Cancelar</Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={handleExtraction} disabled={isPending || !operationAmount}>
                {isPending ? "Procesando..." : "Confirmar extracción"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Deposit dialog */}
      {showDeposit && (
        <Dialog open onOpenChange={(o) => !o && setShowDeposit(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Nuevo aporte</DialogTitle>
            </DialogHeader>
            <div className="px-4 py-4">
              <Label className="text-xs font-bold uppercase">Monto del aporte ({asset.currency})</Label>
              <NumericInput value={operationAmount} onChange={setOperationAmount} placeholder="0.00" className="mt-1 border-2 border-black" autoFocus />
              <p className="mt-2 text-xs text-gray-500">
                Se distribuirá el aporte proporcionalmente entre los activos según su inversión inicial y se actualizará el precio promedio.
              </p>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setShowDeposit(false)} className="border-2 border-black">Cancelar</Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={handleDeposit} disabled={isPending || !operationAmount}>
                {isPending ? "Procesando..." : "Confirmar aporte"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
