// Portado desde components/activos/boards/dividends-board.tsx.

import { apiPatch, apiPost } from "../../api.js"
import { el, clear, createDialog, svgIcon } from "../../dom.js"
import { formatAmount } from "../../lib/finance.js"
import { RECURRING_TYPE_LABELS, generateRecurringDividends } from "../../lib/dividends.js"

export function renderDividendsBoard(asset, board, onUpdated) {
  const panel = el("div", { class: "panel", "data-testid": "asset-board-dividends" })
  const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
  header.appendChild(el("span", {}, board.title))
  const addBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; border:none; background:none; color:var(--white); font-size:0.75rem; font-weight:bold;" })
  addBtn.appendChild(svgIcon("icon-plus", 13))
  addBtn.appendChild(document.createTextNode(" Agregar"))
  addBtn.addEventListener("click", () => openAddDividendDialog(asset, board, onUpdated))
  header.appendChild(addBtn)
  panel.appendChild(header)

  const head = el("div", { style: "display:flex; background:var(--gray-100); font-size:0.75rem; font-weight:bold;" })
  head.appendChild(el("div", { style: "width:7rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, "Mes"))
  head.appendChild(el("div", { style: "width:5rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "%"))
  head.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Est."))
  head.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Obtenida"))
  head.appendChild(el("div", { style: "width:6rem; padding:0.5rem 0.75rem; text-align:center;" }, "Acción"))
  panel.appendChild(head)

  const dividends = board.dividends ?? []
  if (dividends.length === 0) {
    panel.appendChild(el("div", { class: "state-message" }, "Sin dividendos configurados."))
  }
  for (const d of dividends) {
    const row = el("div", { style: `display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;${d.recurring?.isGenerated ? " opacity:0.6;" : ""}` })
    const monthCell = el("div", { style: "width:7rem; display:flex; align-items:center; gap:0.25rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; font-size:0.75rem;" })
    monthCell.appendChild(document.createTextNode(d.month))
    if (d.recurring) {
      const icon = svgIcon("icon-history", 10)
      icon.setAttribute("title", RECURRING_TYPE_LABELS[d.recurring.type])
      monthCell.appendChild(icon)
    }
    row.appendChild(monthCell)
    row.appendChild(el("div", { style: "width:5rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-size:0.75rem;" }, d.percentage ? `${d.percentage}%` : "—"))
    row.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-size:0.75rem;" }, d.estimatedGain ? `${formatAmount(d.estimatedGain, asset.currency)} ${asset.currency}` : "—"))
    const obtainedCell = el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-size:0.75rem;" })
    if (d.actualGain !== undefined) obtainedCell.appendChild(el("span", { style: "font-weight:bold; color:#047857;" }, `${formatAmount(d.actualGain, asset.currency)} ${asset.currency}`))
    else obtainedCell.appendChild(document.createTextNode("—"))
    row.appendChild(obtainedCell)
    const actionCell = el("div", { style: "width:6rem; display:flex; align-items:center; justify-content:center; padding:0.5rem 0.75rem;" })
    if (d.actualGain === undefined) {
      const collectBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; font-size:0.75rem; font-weight:bold; border:none; background:none;" })
      collectBtn.appendChild(svgIcon("icon-check", 13))
      collectBtn.appendChild(document.createTextNode(" Cobrar"))
      collectBtn.addEventListener("click", () => openCollectDividendDialog(asset, board, d.id, onUpdated))
      actionCell.appendChild(collectBtn)
    } else {
      actionCell.appendChild(el("span", { style: "font-size:0.75rem; color:#059669;" }, "✓ Cobrado"))
    }
    row.appendChild(actionCell)
    panel.appendChild(row)
  }

  return panel
}

function openAddDividendDialog(asset, board, onUpdated) {
  const dialog = createDialog()
  let month = "", percentage = "", estimatedGain = "", recurring = false, recurringType = "monthly", saving = false

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Agregar dividendo"))
    const body = el("div", { class: "modal-body" })

    const monthField = el("div", { class: "field" })
    monthField.appendChild(el("label", {}, "Mes de cobro"))
    const monthInput = el("input", { class: "input", type: "month", value: month })
    monthInput.addEventListener("input", () => { month = monthInput.value; syncSave() })
    monthField.appendChild(monthInput)
    body.appendChild(monthField)

    const row = el("div", { style: "display:flex; gap:0.75rem;" })
    const pctField = el("div", { class: "field", style: "flex:1;" })
    pctField.appendChild(el("label", {}, "Porcentaje (%)"))
    const pctInput = el("input", { class: "input", placeholder: "0.00", value: percentage })
    pctInput.addEventListener("input", () => { percentage = pctInput.value })
    pctField.appendChild(pctInput)
    const gainField = el("div", { class: "field", style: "flex:1;" })
    gainField.appendChild(el("label", {}, "Ganancia estimada"))
    const gainInput = el("input", { class: "input", placeholder: "0.00", value: estimatedGain })
    gainInput.addEventListener("input", () => { estimatedGain = gainInput.value })
    gainField.appendChild(gainInput)
    row.appendChild(pctField); row.appendChild(gainField)
    body.appendChild(row)

    const recBox = el("div", { style: "display:flex; flex-direction:column; gap:0.5rem; border:1px solid var(--gray-200); padding:0.75rem;" })
    const recLabel = el("label", { style: "display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:bold; text-transform:uppercase; cursor:pointer;" })
    const recCb = el("input", { type: "checkbox", checked: recurring })
    recCb.addEventListener("change", () => { recurring = recCb.checked; paint() })
    recLabel.appendChild(recCb)
    recLabel.appendChild(svgIcon("icon-history", 13))
    recLabel.appendChild(document.createTextNode("Dividendo recurrente"))
    recBox.appendChild(recLabel)
    if (recurring) {
      const freqField = el("div", { class: "field", style: "padding-left:1.25rem;" })
      freqField.appendChild(el("label", { style: "color:var(--gray-500);" }, "Frecuencia"))
      const freqSelect = el("select", { class: "input" })
      for (const [k, v] of Object.entries(RECURRING_TYPE_LABELS)) freqSelect.appendChild(el("option", { value: k }, v))
      freqSelect.value = recurringType
      freqSelect.addEventListener("change", () => { recurringType = freqSelect.value })
      freqField.appendChild(freqSelect)
      freqField.appendChild(el("p", { class: "hint-text" }, "Se generarán 12 entradas futuras automáticamente."))
      recBox.appendChild(freqField)
    }
    body.appendChild(recBox)
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Guardar")
    saveBtn.disabled = !month || saving
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSave() { saveBtn.disabled = !month || saving }
  }

  async function handleSave() {
    if (!month) return
    saving = true
    paint()
    const seed = {
      id: crypto.randomUUID(),
      month,
      percentage: Number(percentage) || 0,
      estimatedGain: Number(estimatedGain) || 0,
      ...(recurring ? { recurring: { type: recurringType, expectedAmount: Number(estimatedGain) || undefined, isGenerated: false, seriesId: crypto.randomUUID() } } : {}),
    }
    const generated = recurring ? generateRecurringDividends(seed, 12) : []
    const newDividends = [...(board.dividends ?? []), seed, ...generated]
    const updatedBoards = asset.boards.map((b) => (b.id === board.id ? { ...b, dividends: newDividends } : b))
    await apiPatch(`/api/assets/${asset.id}/boards`, { boards: updatedBoards })
    dialog.close()
    onUpdated()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}

function openCollectDividendDialog(asset, board, dividendId, onUpdated) {
  const dialog = createDialog()
  let actualGain = "", saving = false

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Cobrar dividendo"))
    const body = el("div", { class: "modal-body" })
    const field = el("div", { class: "field" })
    field.appendChild(el("label", {}, `Ganancia obtenida (${asset.currency})`))
    const input = el("input", { class: "input", placeholder: "0.00", value: actualGain })
    input.addEventListener("input", () => { actualGain = input.value; syncSave() })
    field.appendChild(input)
    body.appendChild(field)
    body.appendChild(el("p", { class: "hint-text" }, `Se creará un ingreso "Ganancia dividendos ${asset.name}" en el dashboard.`))
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Procesando..." : "Confirmar cobro")
    saveBtn.disabled = !actualGain || saving
    saveBtn.addEventListener("click", handleCollect)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)
    setTimeout(() => input.focus(), 0)

    function syncSave() { saveBtn.disabled = !actualGain || saving }
  }

  async function handleCollect() {
    if (!actualGain) return
    saving = true
    paint()
    await apiPost(`/api/assets/${asset.id}/dividends/${dividendId}/collect`, {
      boardId: board.id, actualGain: Number(actualGain), currency: asset.currency, assetName: asset.name,
    })
    dialog.close()
    onUpdated()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
