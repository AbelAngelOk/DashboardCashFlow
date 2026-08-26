// Portado desde components/activos/panels/fixed-term-panel.tsx. Se activa
// cuando metadata.rate y metadata.endDate están presentes (ver pickPanel en
// activo-detail.js).

import { apiPost } from "../../api.js"
import { el, clear, createDialog } from "../../dom.js"
import { formatAmount } from "../../lib/finance.js"
import { calcFixedTermReturn } from "../../lib/assets-calc.js"
import { navigate } from "../../router.js"

export function renderFixedTermPanel(asset, onUpdated) {
  const metadata = asset.metadata
  const expectedReturn = metadata ? calcFixedTermReturn(metadata, asset.amount) : 0

  const panel = el("div", { class: "panel", "data-testid": "asset-panel-fixed-term" })
  panel.appendChild(el("div", { class: "panel-header" }, "Detalle del plazo fijo"))
  const grid = el("div", { class: "asset-tech-grid" })

  const capCell = el("div")
  capCell.appendChild(el("div", { class: "obl-info-label" }, "Capital invertido"))
  capCell.appendChild(el("div", { style: "font-size:1.125rem; font-weight:bold;" }, `${formatAmount(asset.amount, asset.currency)} ${asset.currency}`))
  grid.appendChild(capCell)

  if (metadata) {
    const startCell = el("div")
    startCell.appendChild(el("div", { class: "obl-info-label" }, "Fecha inicio"))
    startCell.appendChild(el("div", {}, new Date(metadata.startDate + "T12:00:00").toLocaleDateString("es-ES")))
    grid.appendChild(startCell)

    const endCell = el("div")
    endCell.appendChild(el("div", { class: "obl-info-label" }, "Fecha vencimiento"))
    endCell.appendChild(el("div", {}, new Date(metadata.endDate + "T12:00:00").toLocaleDateString("es-ES")))
    grid.appendChild(endCell)

    const rateCell = el("div")
    rateCell.appendChild(el("div", { class: "obl-info-label" }, "Tasa anual"))
    rateCell.appendChild(el("div", { style: "font-weight:bold;" }, `${metadata.rate}%`))
    grid.appendChild(rateCell)

    const returnCell = el("div")
    returnCell.appendChild(el("div", { class: "obl-info-label" }, "Retorno estimado"))
    returnCell.appendChild(el("div", { style: "font-weight:bold; color:#047857;" }, `+${formatAmount(expectedReturn, asset.currency)} ${asset.currency}`))
    grid.appendChild(returnCell)

    const totalCell = el("div")
    totalCell.appendChild(el("div", { class: "obl-info-label" }, "Total esperado"))
    totalCell.appendChild(el("div", { style: "font-size:1.125rem; font-weight:bold;" }, `${formatAmount(asset.amount + expectedReturn, asset.currency)} ${asset.currency}`))
    grid.appendChild(totalCell)
  }

  if (asset.description) {
    const descCell = el("div", { style: "grid-column:1 / -1;" })
    descCell.appendChild(el("div", { class: "obl-info-label" }, "Descripción"))
    descCell.appendChild(el("div", { style: "color:var(--gray-700);" }, asset.description))
    grid.appendChild(descCell)
  }
  panel.appendChild(grid)

  if (metadata) {
    const footer = el("div", { style: "border-top:2px solid var(--black); padding:0.75rem 1rem;" })
    const collectBtn = el("button", { class: "btn btn-primary", style: "width:100%;" }, "Cobrar plazo fijo")
    collectBtn.addEventListener("click", () => openCollectDialog(asset, expectedReturn))
    footer.appendChild(collectBtn)
    panel.appendChild(footer)
  }

  return panel
}

function openCollectDialog(asset, expectedReturn) {
  const dialog = createDialog()
  let collectedAmount = (asset.amount + expectedReturn).toFixed(2)
  let saving = false

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Cobrar plazo fijo"))
    const body = el("div", { class: "modal-body" })
    const field = el("div", { class: "field" })
    field.appendChild(el("label", {}, `Monto cobrado (${asset.currency})`))
    const input = el("input", { class: "input", value: collectedAmount })
    input.addEventListener("input", () => { collectedAmount = input.value; syncSave() })
    field.appendChild(input)
    body.appendChild(field)
    body.appendChild(el("p", { class: "hint-text" }, `Se creará un ingreso "Cobro plazo fijo: ${asset.name}" en el dashboard y el activo será eliminado.`))
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Procesando..." : "Confirmar cobro")
    saveBtn.disabled = !collectedAmount || saving
    saveBtn.addEventListener("click", handleCollect)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)
    setTimeout(() => input.focus(), 0)

    function syncSave() { saveBtn.disabled = !collectedAmount || saving }
  }

  async function handleCollect() {
    saving = true
    paint()
    await apiPost(`/api/assets/${asset.id}/fixed-term/collect`, {
      collectedAmount: Number(collectedAmount) || asset.amount + expectedReturn,
      currency: asset.currency, assetName: asset.name,
    })
    dialog.close()
    navigate("/app/activos")
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
