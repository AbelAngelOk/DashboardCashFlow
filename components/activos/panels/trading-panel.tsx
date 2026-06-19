"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { formatAmount } from "@/lib/finance"
import { type Asset, type TradingMetadata } from "@/lib/assets"
import { updateAsset } from "@/lib/assets-actions"
import { GenericAssetPanel } from "./generic-asset-panel"

interface TradingPanelProps {
  asset: Asset
}

export function TradingPanel({ asset }: TradingPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)

  const metadata = (asset.metadata as TradingMetadata | null) ?? {
    totalInvested: 0,
    totalObtained: 0,
    currency: asset.currency,
  }

  const [invested, setInvested] = useState(String(metadata.totalInvested))
  const [obtained, setObtained] = useState(String(metadata.totalObtained))

  const netResult = metadata.totalObtained - metadata.totalInvested
  const roi =
    metadata.totalInvested > 0
      ? (netResult / metadata.totalInvested) * 100
      : 0

  const c = metadata.currency ?? asset.currency

  const handleSave = () => {
    startTransition(async () => {
      await updateAsset(asset.id, {
        metadata: {
          totalInvested: Number(invested),
          totalObtained: Number(obtained),
          currency: c,
        },
        amount: Number(obtained),
      })
      router.refresh()
      setShowEdit(false)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="border-2 border-black">
        <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Cartera de Trading</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-white hover:bg-white/20"
            onClick={() => setShowEdit(true)}
          >
            Editar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
          <div className="border-2 border-black p-3 text-sm">
            <div className="text-xs font-bold uppercase text-gray-500">Invertido</div>
            <div className="text-lg font-bold">{formatAmount(metadata.totalInvested, c)} {c}</div>
          </div>
          <div className="border-2 border-black p-3 text-sm">
            <div className="text-xs font-bold uppercase text-gray-500">Obtenido</div>
            <div className="text-lg font-bold">{formatAmount(metadata.totalObtained, c)} {c}</div>
          </div>
          <div className="border-2 border-black p-3 text-sm">
            <div className="text-xs font-bold uppercase text-gray-500">Resultado neto</div>
            <div className={`text-lg font-bold ${netResult >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netResult >= 0 ? "+" : ""}{formatAmount(netResult, c)} {c}
            </div>
          </div>
          <div className="border-2 border-black p-3 text-sm">
            <div className="text-xs font-bold uppercase text-gray-500">ROI</div>
            <div className={`text-lg font-bold ${roi >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Optional operations log */}
      <GenericAssetPanel asset={asset} />

      {showEdit && (
        <Dialog open onOpenChange={(o) => !o && setShowEdit(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Editar totales de cartera</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Total invertido ({c})</Label>
                <Input type="number" value={invested} onChange={(e) => setInvested(e.target.value)} className="border-2 border-black" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Total obtenido ({c})</Label>
                <Input type="number" value={obtained} onChange={(e) => setObtained(e.target.value)} className="border-2 border-black" />
              </div>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setShowEdit(false)} className="border-2 border-black">Cancelar</Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={handleSave} disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
