// Portado desde components/activos/panels/trading-bot-panel.tsx. Se activa
// cuando metadata.totalGained o metadata.totalLost están presentes.

import { apiPatch } from "../../api.js"
import { el, clear, createDialog } from "../../dom.js"
import { formatAmount } from "../../lib/finance.js"

export function renderTradingBotPanel(asset, onUpdated) {
  const metadata = asset.metadata ?? { totalInvested: 0, totalGained: 0, totalLost: 0, totalExtracted: 0, currency: asset.currency }
  const netResult = metadata.totalGained - metadata.totalLost - metadata.totalExtracted
  const roi = metadata.totalInvested > 0 ? ((metadata.totalGained - metadata.totalLost) / metadata.totalInvested) * 100 : 0
  const c = metadata.currency ?? asset.currency

  const panel = el("div", { class: "panel", "data-testid": "asset-panel-trading-bot" })
  const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
  header.appendChild(el("span", {}, "Bot de Trading — Agregados"))
  const editBtn = el("button", { style: "color:var(--white); border:none; background:none; font-size:0.75rem;" }, "Editar")
  editBtn.addEventListener("click", () => openEditDialog(asset, metadata, onUpdated))
  header.appendChild(editBtn)
  panel.appendChild(header)

  const grid = el("div", { class: "asset-tech-grid" })
  grid.appendChild(statCell("Total invertido", `${formatAmount(metadata.totalInvested, c)} ${c}`))
  grid.appendChild(statCell("Total ganado", `+${formatAmount(metadata.totalGained, c)} ${c}`, "#047857"))
  grid.appendChild(statCell("Total perdido", `-${formatAmount(metadata.totalLost, c)} ${c}`, "#be123c"))
  grid.appendChild(statCell("Total extraído", `${formatAmount(metadata.totalExtracted, c)} ${c}`))
  panel.appendChild(grid)

  const footer = el("div", { style: "display:flex; gap:1.5rem; border-top:2px solid var(--black); background:var(--gray-100); padding:1rem;" })
  const netCell = el("div")
  netCell.appendChild(el("div", { class: "obl-info-label" }, "Resultado neto"))
  netCell.appendChild(el("div", { style: `font-size:1.25rem; font-weight:bold; color:${netResult >= 0 ? "#047857" : "#be123c"};` }, `${netResult >= 0 ? "+" : ""}${formatAmount(netResult, c)} ${c}`))
  footer.appendChild(netCell)
  const roiCell = el("div")
  roiCell.appendChild(el("div", { class: "obl-info-label" }, "ROI"))
  roiCell.appendChild(el("div", { style: `font-size:1.25rem; font-weight:bold; color:${roi >= 0 ? "#047857" : "#be123c"};` }, `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`))
  footer.appendChild(roiCell)
  panel.appendChild(footer)

  return panel
}

function statCell(label, value, color) {
  const cell = el("div", { style: "border:var(--border); padding:0.75rem;" })
  cell.appendChild(el("div", { class: "obl-info-label" }, label))
  cell.appendChild(el("div", { style: `font-size:1.125rem; font-weight:bold;${color ? ` color:${color};` : ""}` }, value))
  return cell
}

function openEditDialog(asset, metadata, onUpdated) {
  const dialog = createDialog()
  let invested = String(metadata.totalInvested)
  let gained = String(metadata.totalGained)
  let lost = String(metadata.totalLost)
  let extracted = String(metadata.totalExtracted)

  function field(label, value, onInput) {
    const f = el("div", { class: "field" })
    f.appendChild(el("label", {}, label))
    const input = el("input", { class: "input", value })
    input.addEventListener("input", () => onInput(input.value))
    f.appendChild(input)
    return f
  }

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Editar agregados del bot"))
    const body = el("div", { class: "modal-body", style: "display:grid; grid-template-columns:1fr 1fr; gap:1rem;" })
    body.appendChild(field("Total invertido", invested, (v) => { invested = v }))
    body.appendChild(field("Total ganado", gained, (v) => { gained = v }))
    body.appendChild(field("Total perdido", lost, (v) => { lost = v }))
    body.appendChild(field("Total extraído", extracted, (v) => { extracted = v }))
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, "Guardar")
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)
  }

  async function handleSave() {
    const newAmount = Number(invested) - Number(lost) + Number(gained) - Number(extracted)
    await apiPatch(`/api/assets/${asset.id}`, {
      metadata: { totalInvested: Number(invested), totalGained: Number(gained), totalLost: Number(lost), totalExtracted: Number(extracted), currency: metadata.currency },
      amount: Math.max(0, newAmount),
    })
    dialog.close()
    onUpdated()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
