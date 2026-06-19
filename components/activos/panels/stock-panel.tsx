"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAmount, type Currency } from "@/lib/finance"
import {
  type Asset,
  type StockMetadata,
  type DividendEntry,
  calcWeightedAvgPrice,
} from "@/lib/assets"
import { collectDividend, updateAsset, addMovement } from "@/lib/assets-actions"
import { GenericAssetPanel } from "./generic-asset-panel"

interface CollectDividendDialogProps {
  assetId: string
  dividendId: string
  assetName: string
  currency: Currency
  currentMetadata: StockMetadata
  onClose: () => void
}

function CollectDividendDialog({
  assetId,
  dividendId,
  assetName,
  currency,
  currentMetadata,
  onClose,
}: CollectDividendDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actualGain, setActualGain] = useState("")

  const handleCollect = () => {
    if (!actualGain) return
    startTransition(async () => {
      await collectDividend(
        assetId,
        dividendId,
        Number(actualGain),
        currency,
        assetName,
        currentMetadata,
      )
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Cobrar dividendo</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-4">
          <Label className="text-xs font-bold uppercase">Ganancia obtenida ({currency})</Label>
          <Input
            type="number"
            value={actualGain}
            onChange={(e) => setActualGain(e.target.value)}
            placeholder="0.00"
            className="mt-1 border-2 border-black"
            autoFocus
          />
          <p className="mt-2 text-xs text-gray-500">
            Se creará un ingreso &quot;Ganancia dividendos {assetName}&quot; en el dashboard.
          </p>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleCollect}
            disabled={isPending || !actualGain}
          >
            {isPending ? "Procesando..." : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddDividendDialogProps {
  asset: Asset
  metadata: StockMetadata
  onClose: () => void
}

function AddDividendDialog({ asset, metadata, onClose }: AddDividendDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [month, setMonth] = useState("")
  const [percentage, setPercentage] = useState("")
  const [estimatedGain, setEstimatedGain] = useState("")

  const handleSave = () => {
    if (!month) return
    startTransition(async () => {
      const newEntry: DividendEntry = {
        id: crypto.randomUUID(),
        month,
        percentage: Number(percentage) || 0,
        estimatedGain: Number(estimatedGain) || 0,
      }
      const updatedMeta: StockMetadata = {
        dividends: [...metadata.dividends, newEntry],
      }
      await updateAsset(asset.id, { metadata: updatedMeta })
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Agregar dividendo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Mes de cobro</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-2 border-black"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Porcentaje (%)</Label>
              <Input
                type="number"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="0.00"
                className="border-2 border-black"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Ganancia estimada</Label>
              <Input
                type="number"
                value={estimatedGain}
                onChange={(e) => setEstimatedGain(e.target.value)}
                placeholder="0.00"
                className="border-2 border-black"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleSave}
            disabled={isPending || !month}
          >
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface StockPanelProps {
  asset: Asset
}

export function StockPanel({ asset }: StockPanelProps) {
  const router = useRouter()
  const [collectingDividendId, setCollectingDividendId] = useState<string | null>(null)
  const [showAddDividend, setShowAddDividend] = useState(false)
  const [isPending, startTransition] = useTransition()

  const metadata = (asset.metadata as StockMetadata | null) ?? { dividends: [] }
  const dividends = metadata.dividends ?? []

  // Add BUY movement and update avgBuyPrice/currentQty
  const handleBuyFromHistory = (amount: number, qty: number, unitPrice: number, currency: typeof asset.currency) => {
    startTransition(async () => {
      const newQty = (asset.currentQty ?? 0) + qty
      const newAvg = calcWeightedAvgPrice(asset.currentQty ?? 0, asset.avgBuyPrice ?? 0, qty, unitPrice)
      await addMovement({
        recordId: asset.id,
        movementType: "BUY",
        amount,
        quantity: qty,
        unitPrice,
        currency,
        operationDate: new Date(),
      })
      await updateAsset(asset.id, { currentQty: newQty, avgBuyPrice: newAvg, amount })
      router.refresh()
    })
  }
  void handleBuyFromHistory // suppress unused warning — used conceptually via GenericAssetPanel

  return (
    <div className="flex flex-col gap-6">
      {/* Generic info + movements panel */}
      <GenericAssetPanel asset={asset} />

      {/* Dividends table */}
      <div className="border-2 border-black">
        <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Dividendos</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-xs text-white hover:bg-white/20"
            onClick={() => setShowAddDividend(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        <div className="flex bg-gray-100 text-xs font-bold">
          <div className="w-28 border-r border-black px-3 py-2">Mes</div>
          <div className="w-20 border-r border-black px-3 py-2 text-right">%</div>
          <div className="flex-1 border-r border-black px-3 py-2 text-right">Est.</div>
          <div className="flex-1 border-r border-black px-3 py-2 text-right">Obtenida</div>
          <div className="w-24 px-3 py-2 text-center">Acción</div>
        </div>

        {dividends.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            Sin dividendos configurados.
          </div>
        )}

        {dividends.map((d) => (
          <div key={d.id} className="flex border-b border-black text-sm">
            <div className="w-28 border-r border-black px-3 py-2 text-xs">
              {d.month}
            </div>
            <div className="w-20 border-r border-black px-3 py-2 text-right text-xs">
              {d.percentage ? `${d.percentage}%` : "—"}
            </div>
            <div className="flex-1 border-r border-black px-3 py-2 text-right text-xs">
              {d.estimatedGain
                ? `${formatAmount(d.estimatedGain, asset.currency)} ${asset.currency}`
                : "—"}
            </div>
            <div className="flex-1 border-r border-black px-3 py-2 text-right text-xs">
              {d.actualGain !== undefined ? (
                <span className="font-bold text-emerald-700">
                  {formatAmount(d.actualGain, asset.currency)} {asset.currency}
                </span>
              ) : (
                "—"
              )}
            </div>
            <div className="flex w-24 items-center justify-center px-3 py-2">
              {d.actualGain === undefined ? (
                <button
                  className="flex items-center gap-1 text-xs font-bold hover:text-emerald-700"
                  onClick={() => setCollectingDividendId(d.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Cobrar
                </button>
              ) : (
                <span className="text-xs text-emerald-600">✓ Cobrado</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {collectingDividendId && (
        <CollectDividendDialog
          assetId={asset.id}
          dividendId={collectingDividendId}
          assetName={asset.name}
          currency={asset.currency}
          currentMetadata={metadata}
          onClose={() => setCollectingDividendId(null)}
        />
      )}

      {showAddDividend && (
        <AddDividendDialog
          asset={asset}
          metadata={metadata}
          onClose={() => setShowAddDividend(false)}
        />
      )}
    </div>
  )
}
