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

export function AssetDetail({ asset }: AssetDetailProps) {
  switch (asset.assetType) {
    case "STOCK":
      return <StockPanel asset={asset} />
    case "FIXED_TERM":
      return <FixedTermPanel asset={asset} />
    case "FUTURES":
      return <FuturesPanel asset={asset} />
    case "TRADING_BOT":
      return <TradingBotPanel asset={asset} />
    case "REBALANCE_BOT":
      return <RebalanceBotPanel asset={asset} />
    case "TRADING":
      return <TradingPanel asset={asset} />
    case "BOND":
      return <BondPanel asset={asset} />
    default:
      return <GenericAssetPanel asset={asset} />
  }
}
