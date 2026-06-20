"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  type Asset,
  calcWeightedAvgPrice,
} from "@/lib/assets"
import { updateAsset, addMovement } from "@/lib/assets-actions"
import { GenericAssetPanel } from "./generic-asset-panel"

interface StockPanelProps {
  asset: Asset
}

export function StockPanel({ asset }: StockPanelProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

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
  void handleBuyFromHistory

  return (
    <div data-testid="asset-panel-stock">
      <GenericAssetPanel asset={asset} />
    </div>
  )
}
