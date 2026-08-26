// Portado desde panels/generic-asset-panel.tsx + panels/stock-panel.tsx.
// StockPanel.tsx en el original SOLO renderiza <GenericAssetPanel/> — su
// función `handleBuyFromHistory` nunca se conecta a ningún botón (queda
// muerta, silenciada con `void handleBuyFromHistory`). Portar dos módulos
// idénticos en comportamiento sería duplicar sin motivo; un único renderer
// cubre ambos casos del dispatcher en asset-detail.js.

import { el } from "../../dom.js"
import { formatAmount } from "../../lib/finance.js"

export function renderGenericPanel(asset) {
  const hasTechnicalInfo = asset.ticker !== undefined || asset.currentQty !== undefined || asset.avgBuyPrice !== undefined
  if (!hasTechnicalInfo) return null

  const panel = el("div", { class: "panel", "data-testid": "asset-panel-generic" })
  panel.appendChild(el("div", { class: "panel-header" }, "Detalles técnicos"))
  const grid = el("div", { class: "asset-tech-grid" })

  if (asset.ticker) {
    const cell = el("div")
    cell.appendChild(el("div", { class: "obl-info-label" }, "Ticker"))
    cell.appendChild(el("div", { style: "font-family:monospace; font-weight:bold;" }, asset.ticker))
    grid.appendChild(cell)
  }

  const valueCell = el("div")
  valueCell.appendChild(el("div", { class: "obl-info-label" }, "Valor actual"))
  valueCell.appendChild(el("div", { style: "font-weight:bold;" }, `${formatAmount(asset.amount, asset.currency)} ${asset.currency}`))
  grid.appendChild(valueCell)

  if (asset.currentQty !== undefined) {
    const cell = el("div")
    cell.appendChild(el("div", { class: "obl-info-label" }, "Cantidad"))
    cell.appendChild(el("div", { style: "font-family:monospace;" }, String(asset.currentQty)))
    grid.appendChild(cell)
  }

  if (asset.avgBuyPrice !== undefined) {
    const cell = el("div")
    cell.appendChild(el("div", { class: "obl-info-label" }, "Precio promedio"))
    cell.appendChild(el("div", { style: "font-family:monospace;" }, `${formatAmount(asset.avgBuyPrice, asset.currency)} ${asset.currency}`))
    grid.appendChild(cell)
  }

  panel.appendChild(grid)
  return panel
}
