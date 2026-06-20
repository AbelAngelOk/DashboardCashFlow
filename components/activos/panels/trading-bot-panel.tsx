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
import { type Asset, type TradingBotMetadata } from "@/lib/assets"
import { updateAsset } from "@/lib/assets-actions"

interface TradingBotPanelProps {
  asset: Asset
}

export function TradingBotPanel({ asset }: TradingBotPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)

  const metadata = (asset.metadata as TradingBotMetadata | null) ?? {
    totalInvested: 0,
    totalGained: 0,
    totalLost: 0,
    totalExtracted: 0,
    currency: asset.currency,
  }

  const [invested, setInvested] = useState(String(metadata.totalInvested))
  const [gained, setGained] = useState(String(metadata.totalGained))
  const [lost, setLost] = useState(String(metadata.totalLost))
  const [extracted, setExtracted] = useState(String(metadata.totalExtracted))

  const netResult = metadata.totalGained - metadata.totalLost - metadata.totalExtracted
  const roi =
    metadata.totalInvested > 0
      ? ((metadata.totalGained - metadata.totalLost) / metadata.totalInvested) * 100
      : 0

  const handleSave = () => {
    startTransition(async () => {
      const updatedMeta: TradingBotMetadata = {
        totalInvested: Number(invested),
        totalGained: Number(gained),
        totalLost: Number(lost),
        totalExtracted: Number(extracted),
        currency: metadata.currency,
      }
      const newAmount = Number(invested) - Number(lost) + Number(gained) - Number(extracted)
      await updateAsset(asset.id, { metadata: updatedMeta, amount: Math.max(0, newAmount) })
      router.refresh()
      setShowEdit(false)
    })
  }

  const c = metadata.currency ?? asset.currency

  return (
    <div data-testid="asset-panel-trading-bot" className="flex flex-col gap-6">
      {/* Aggregates panel */}
      <div className="border-2 border-black">
        <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Bot de Trading — Agregados</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-white hover:bg-white/20"
            onClick={() => setShowEdit(true)}
          >
            Editar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
          <div className="border-2 border-black p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Total invertido</div>
            <div className="text-lg font-bold">
              {formatAmount(metadata.totalInvested, c)} {c}
            </div>
          </div>
          <div className="border-2 border-black p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Total ganado</div>
            <div className="text-lg font-bold text-emerald-700">
              +{formatAmount(metadata.totalGained, c)} {c}
            </div>
          </div>
          <div className="border-2 border-black p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Total perdido</div>
            <div className="text-lg font-bold text-rose-700">
              -{formatAmount(metadata.totalLost, c)} {c}
            </div>
          </div>
          <div className="border-2 border-black p-3">
            <div className="text-xs font-bold uppercase text-gray-500">Total extraído</div>
            <div className="text-lg font-bold">
              {formatAmount(metadata.totalExtracted, c)} {c}
            </div>
          </div>
        </div>

        <div className="flex gap-6 border-t-2 border-black bg-gray-100 p-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Resultado neto</div>
            <div className={`text-xl font-bold ${netResult >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netResult >= 0 ? "+" : ""}{formatAmount(netResult, c)} {c}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">ROI</div>
            <div className={`text-xl font-bold ${roi >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <Dialog open onOpenChange={(o) => !o && setShowEdit(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Editar agregados del bot</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 px-4 py-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Total invertido</Label>
                <Input type="number" value={invested} onChange={(e) => setInvested(e.target.value)} className="border-2 border-black" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Total ganado</Label>
                <Input type="number" value={gained} onChange={(e) => setGained(e.target.value)} className="border-2 border-black" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Total perdido</Label>
                <Input type="number" value={lost} onChange={(e) => setLost(e.target.value)} className="border-2 border-black" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Total extraído</Label>
                <Input type="number" value={extracted} onChange={(e) => setExtracted(e.target.value)} className="border-2 border-black" />
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
