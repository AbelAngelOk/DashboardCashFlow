"use client"

import { formatAmount } from "@/lib/finance"
import type { Asset } from "@/lib/assets"

interface GenericAssetPanelProps {
  asset: Asset
}

export function GenericAssetPanel({ asset }: GenericAssetPanelProps) {
  const hasTechnicalInfo =
    asset.ticker !== undefined ||
    asset.currentQty !== undefined ||
    asset.avgBuyPrice !== undefined

  if (!hasTechnicalInfo) return null

  return (
    <div data-testid="asset-panel-generic" className="border-2 border-black">
      <div className="border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Detalles técnicos</span>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
        {asset.ticker && (
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Ticker</div>
            <div className="font-mono font-bold">{asset.ticker}</div>
          </div>
        )}
        <div>
          <div className="text-xs font-bold uppercase text-gray-500">Valor actual</div>
          <div className="font-bold">
            {formatAmount(asset.amount, asset.currency)} {asset.currency}
          </div>
        </div>
        {asset.currentQty !== undefined && (
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Cantidad</div>
            <div className="font-mono">{asset.currentQty}</div>
          </div>
        )}
        {asset.avgBuyPrice !== undefined && (
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Precio promedio</div>
            <div className="font-mono">
              {formatAmount(asset.avgBuyPrice, asset.currency)} {asset.currency}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
