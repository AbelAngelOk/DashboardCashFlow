// Portado desde components/activos/panels/trading-panel.tsx. Se activa
// cuando metadata.totalObtained está presente.

import { apiPatch } from "../../api.js"
import { el, clear, createDialog } from "../../dom.js"
import { formatAmount } from "../../lib/finance.js"
import { renderGenericPanel } from "./generic-panel.js"

export function renderTradingPanel(asset, onUpdated) {
  const wrap = el("div", { style: "display:flex; flex-direction:column; gap:1.5rem;", "data-testid": "asset-panel-trading" })
  const metadata = asset.metadata ?? { totalInvested: 0, totalObtained: 0, currency: asset.currency }
  const netResult = metadata.totalObtained - metadata.totalInvested
  const roi = metadata.totalInvested > 0 ? (netResult / metadata.totalInvested) * 100 : 0
  const c = metadata.currency ?? asset.currency

  const panel = el("div", { class: "panel" })
  const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
  header.appendChild(el("span", {}, "Cartera de Trading"))
  const editBtn = el("button", { style: "color:var(--white); border:none; background:none; font-size:0.75rem;" }, "Editar")
  editBtn.addEventListener("click", () => openEditDialog(asset, metadata, onUpdated))
  header.appendChild(editBtn)
  panel.appendChild(header)

  const grid = el("div", { class: "asset-tech-grid" })
  grid.appendChild(statCell("Invertido", `${formatAmount(metadata.totalInvested, c)} ${c}`))
  grid.appendChild(statCell("Obtenido", `${formatAmount(metadata.totalObtained, c)} ${c}`))
  grid.appendChild(statCell("Resultado neto", `${netResult >= 0 ? "+" : ""}${formatAmount(netResult, c)} ${c}`, netResult >= 0 ? "#047857" : "#be123c"))
  grid.appendChild(statCell("ROI", `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`, roi >= 0 ? "#047857" : "#be123c"))
  panel.appendChild(grid)
  wrap.appendChild(panel)

  const generic = renderGenericPanel(asset)
  if (generic) wrap.appendChild(generic)

  return wrap
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
  let obtained = String(metadata.totalObtained)
  const c = metadata.currency ?? asset.currency

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Editar totales de cartera"))
    const body = el("div", { class: "modal-body" })
    const investedField = el("div", { class: "field" })
    investedField.appendChild(el("label", {}, `Total invertido (${c})`))
    const investedInput = el("input", { class: "input", value: invested })
    investedInput.addEventListener("input", () => { invested = investedInput.value })
    investedField.appendChild(investedInput)
    body.appendChild(investedField)
    const obtainedField = el("div", { class: "field" })
    obtainedField.appendChild(el("label", {}, `Total obtenido (${c})`))
    const obtainedInput = el("input", { class: "input", value: obtained })
    obtainedInput.addEventListener("input", () => { obtained = obtainedInput.value })
    obtainedField.appendChild(obtainedInput)
    body.appendChild(obtainedField)
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
    await apiPatch(`/api/assets/${asset.id}`, {
      metadata: { totalInvested: Number(invested), totalObtained: Number(obtained), currency: c },
      amount: Number(obtained),
    })
    dialog.close()
    onUpdated()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
