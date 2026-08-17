"use client"

import type { Asset } from "@/lib/assets"
import { StockPanel } from "./panels/stock-panel"
import { FixedTermPanel } from "./panels/fixed-term-panel"
import { FuturesPanel } from "./panels/futures-panel"
import { TradingBotPanel } from "./panels/trading-bot-panel"
import { RebalanceBotPanel } from "./panels/rebalance-bot-panel"
import { TradingPanel } from "./panels/trading-panel"
import { BondPanel } from "./panels/bond-panel"
import { GenericAssetPanel } from "./panels/generic-asset-panel"

interface AssetDetailProps {
  asset: Asset
}

/**
 * Elige el panel operativo del activo.
 *
 * Desde v2.5.0 **no rutea por tipo** — el tipo es solo una etiqueta. Rutea por lo
 * que el activo realmente tiene: si lleva un cronograma de bono muestra el panel de
 * bono, si lleva sub-activos el de rebalanceo, y así. Eso mantiene funcionando a los
 * activos creados con el modelo viejo sin migrar sus datos, y deja que un activo
 * nuevo obtenga el mismo comportamiento con solo tener los mismos datos.
 */
export function AssetDetail({ asset }: AssetDetailProps) {
  const meta = (asset.metadata ?? {}) as Record<string, unknown>

  // Paneles especializados: se activan por la forma de la metadata
  if (Array.isArray(meta.assets)) return <RebalanceBotPanel asset={asset} />
  if (Array.isArray(meta.disbursements)) return <BondPanel asset={asset} />
  if (meta.rate != null && meta.endDate != null) return <FixedTermPanel asset={asset} />
  if (meta.totalGained != null || meta.totalLost != null) return <TradingBotPanel asset={asset} />
  if (meta.totalObtained != null) return <TradingPanel asset={asset} />
  if (meta.positionTracking === true || meta.liquidated != null) return <FuturesPanel asset={asset} />

  // Capacidad "unidades": compra con precio promedio ponderado
  if (asset.tracksQuantity) return <StockPanel asset={asset} />

  return <GenericAssetPanel asset={asset} />
}
