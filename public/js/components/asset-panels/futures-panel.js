// Portado desde components/activos/panels/futures-panel.tsx. Se activa
// cuando metadata.positionTracking === true o metadata.liquidated !== undefined.

import { apiPost, apiPatch } from "../../api.js"
import { el, clear, createDialog, svgIcon } from "../../dom.js"
import { formatAmount, currencies, defaultCurrency } from "../../lib/finance.js"
import { openAssetFormDialog } from "../asset-form-dialog.js"

export function renderFuturesPanel(asset, onUpdated) {
  const wrap = el("div", { style: "display:flex; flex-direction:column; gap:1.5rem;", "data-testid": "asset-panel-futures" })
  const metadata = asset.metadata
  const isLiquidated = metadata?.liquidated === true

  const longPositions = asset.movements.filter((m) => m.metadata?.positionType === "LONG")
  const shortPositions = asset.movements.filter((m) => m.metadata?.positionType === "SHORT")
  const otherMovements = asset.movements.filter((m) => !m.metadata?.positionType)

  function avgEntry(positions) {
    if (positions.length === 0) return 0
    const totalQty = positions.reduce((s, p) => s + (p.quantity ?? 0), 0)
    if (totalQty === 0) return 0
    return positions.reduce((s, p) => s + (p.unitPrice ?? 0) * (p.quantity ?? 0), 0) / totalQty
  }

  const suggestedName = `${asset.ticker ?? asset.name} (${metadata?.liquidationSuffix ?? 2})`

  const infoPanel = el("div", { class: "panel" })
  infoPanel.appendChild(el("div", { class: "panel-header" }, `Futuros — ${asset.ticker ?? asset.name}`))
  const grid = el("div", { class: "asset-tech-grid" })
  grid.appendChild(statCell("Valor actual", `${formatAmount(asset.amount, asset.currency)} ${asset.currency}`))

  const longCell = statCell("Posiciones LONG", String(longPositions.length), "#047857")
  if (longPositions.length > 0) longCell.appendChild(el("div", { class: "hint-text" }, `Precio prom. entrada: ${formatAmount(avgEntry(longPositions), asset.currency)}`))
  grid.appendChild(longCell)

  const shortCell = statCell("Posiciones SHORT", String(shortPositions.length), "#be123c")
  if (shortPositions.length > 0) shortCell.appendChild(el("div", { class: "hint-text" }, `Precio prom. entrada: ${formatAmount(avgEntry(shortPositions), asset.currency)}`))
  grid.appendChild(shortCell)

  grid.appendChild(statCell("Estado", isLiquidated ? "Liquidado" : "Activo", isLiquidated ? "#be123c" : "#047857"))
  infoPanel.appendChild(grid)

  const actionsRow = el("div", { style: "display:flex; gap:0.5rem; border-top:2px solid var(--black); padding:0.75rem 1rem;" })
  if (!isLiquidated) {
    const addBtn = el("button", { class: "btn btn-primary" })
    addBtn.appendChild(svgIcon("icon-plus", 12))
    addBtn.appendChild(document.createTextNode(" Nueva posición"))
    addBtn.addEventListener("click", () => openAddPositionDialog(asset, onUpdated))
    actionsRow.appendChild(addBtn)

    const liquidateBtn = el("button", { class: "btn" }, "Liquidar")
    liquidateBtn.addEventListener("click", async () => {
      liquidateBtn.disabled = true
      liquidateBtn.textContent = "Procesando..."
      const current = asset.metadata ?? {}
      const nextSuffix = (current.liquidationSuffix ?? 1) + 1
      await apiPatch(`/api/assets/${asset.id}`, { metadata: { ...current, liquidated: true, liquidationSuffix: nextSuffix } })
      onUpdated()
    })
    actionsRow.appendChild(liquidateBtn)
  } else {
    const newOpBtn = el("button", { class: "btn btn-primary" })
    newOpBtn.appendChild(svgIcon("icon-plus", 12))
    newOpBtn.appendChild(document.createTextNode(` Nueva operación en ${asset.ticker ?? asset.name}`))
    newOpBtn.addEventListener("click", () => openAssetFormDialog({ defaultName: suggestedName, onCreate: onUpdated }))
    actionsRow.appendChild(newOpBtn)
  }
  infoPanel.appendChild(actionsRow)
  wrap.appendChild(infoPanel)

  if (longPositions.length > 0 || shortPositions.length > 0) {
    const posPanel = el("div", { class: "panel" })
    posPanel.appendChild(el("div", { class: "panel-header" }, "Historial de posiciones"))
    const head = el("div", { style: "display:flex; background:var(--gray-100); font-size:0.75rem; font-weight:bold;" })
    head.appendChild(el("div", { style: "width:5rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, "Tipo"))
    head.appendChild(el("div", { style: "width:8rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, "Fecha"))
    head.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, "Descripción"))
    head.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Precio"))
    head.appendChild(el("div", { style: "width:5rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Qty"))
    head.appendChild(el("div", { style: "width:9rem; padding:0.5rem 0.75rem; text-align:right;" }, "Monto"))
    posPanel.appendChild(head)

    const merged = [...longPositions, ...shortPositions].sort((a, b) => new Date(a.operationDate) - new Date(b.operationDate))
    for (const m of merged) {
      const meta = m.metadata
      const row = el("div", { style: "display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;" })
      row.appendChild(el("div", { style: `width:5rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; font-size:0.75rem; font-weight:bold; color:${meta?.positionType === "LONG" ? "#047857" : "#be123c"};` }, meta?.positionType ?? "—"))
      row.appendChild(el("div", { style: "width:8rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; font-size:0.75rem; color:var(--gray-500);" }, new Date(m.operationDate).toLocaleDateString("es-ES")))
      row.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; color:var(--gray-600);" }, m.description ?? "—"))
      row.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace; font-size:0.75rem;" }, m.unitPrice ? formatAmount(m.unitPrice, m.currency) : "—"))
      row.appendChild(el("div", { style: "width:5rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace; font-size:0.75rem;" }, m.quantity ?? "—"))
      row.appendChild(el("div", { style: "width:9rem; padding:0.5rem 0.75rem; text-align:right; font-family:monospace;" }, `${formatAmount(m.amount, m.currency)} ${m.currency}`))
      posPanel.appendChild(row)
    }
    wrap.appendChild(posPanel)
  }

  if (otherMovements.length > 0) {
    const otherPanel = el("div", { class: "panel" })
    otherPanel.appendChild(el("div", { class: "panel-header" }, "Otros movimientos"))
    for (const m of otherMovements) {
      const row = el("div", { style: "display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;" })
      row.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; font-size:0.75rem;" }, m.movementType))
      row.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; color:var(--gray-600);" }, m.description ?? "—"))
      row.appendChild(el("div", { style: "width:9rem; padding:0.5rem 0.75rem; text-align:right; font-family:monospace;" }, `${formatAmount(m.amount, m.currency)} ${m.currency}`))
      otherPanel.appendChild(row)
    }
    wrap.appendChild(otherPanel)
  }

  return wrap
}

function statCell(label, value, color) {
  const cell = el("div")
  cell.appendChild(el("div", { class: "obl-info-label" }, label))
  cell.appendChild(el("div", { style: `font-weight:bold;${color ? ` color:${color};` : ""}` }, value))
  return cell
}

function openAddPositionDialog(asset, onUpdated) {
  const dialog = createDialog()
  let positionType = "LONG", amount = "", qty = "", unitPrice = ""
  let currency = asset.currency, description = "", date = new Date().toISOString().slice(0, 10)

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Nueva posición"))
    const body = el("div", { class: "modal-body" })

    const typeField = el("div", { class: "field" })
    typeField.appendChild(el("label", {}, "Tipo de posición"))
    const typeSelect = el("select", { class: "input" })
    typeSelect.appendChild(el("option", { value: "LONG" }, "LONG"))
    typeSelect.appendChild(el("option", { value: "SHORT" }, "SHORT"))
    typeSelect.value = positionType
    typeSelect.addEventListener("change", () => { positionType = typeSelect.value })
    typeField.appendChild(typeSelect)
    body.appendChild(typeField)

    const row1 = el("div", { style: "display:flex; gap:0.75rem;" })
    const amountField = el("div", { class: "field", style: "flex:1;" })
    amountField.appendChild(el("label", {}, "Monto"))
    const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
    amountInput.addEventListener("input", () => { amount = amountInput.value; syncSave() })
    amountField.appendChild(amountInput)
    const curField = el("div", { class: "field", style: "width:6rem;" })
    curField.appendChild(el("label", {}, "Moneda"))
    const curSelect = el("select", { class: "input" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = currency
    curSelect.addEventListener("change", () => { currency = curSelect.value })
    curField.appendChild(curSelect)
    row1.appendChild(amountField); row1.appendChild(curField)
    body.appendChild(row1)

    const row2 = el("div", { style: "display:flex; gap:0.75rem;" })
    const qtyField = el("div", { class: "field", style: "flex:1;" })
    qtyField.appendChild(el("label", {}, "Cantidad"))
    const qtyInput = el("input", { class: "input", placeholder: "0", value: qty })
    qtyInput.addEventListener("input", () => { qty = qtyInput.value })
    qtyField.appendChild(qtyInput)
    const priceField = el("div", { class: "field", style: "flex:1;" })
    priceField.appendChild(el("label", {}, "Precio entrada"))
    const priceInput = el("input", { class: "input", placeholder: "0.00", value: unitPrice })
    priceInput.addEventListener("input", () => { unitPrice = priceInput.value })
    priceField.appendChild(priceInput)
    row2.appendChild(qtyField); row2.appendChild(priceField)
    body.appendChild(row2)

    const dateField = el("div", { class: "field" })
    dateField.appendChild(el("label", {}, "Fecha"))
    const dateInput = el("input", { class: "input", type: "date", value: date })
    dateInput.addEventListener("change", () => { date = dateInput.value })
    dateField.appendChild(dateInput)
    body.appendChild(dateField)

    const descField = el("div", { class: "field" })
    descField.appendChild(el("label", {}, "Descripción"))
    const descInput = el("input", { class: "input", placeholder: "Notas...", value: description })
    descInput.addEventListener("input", () => { description = descInput.value })
    descField.appendChild(descInput)
    body.appendChild(descField)
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, "Guardar")
    saveBtn.disabled = !amount
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSave() { saveBtn.disabled = !amount }
  }

  async function handleSave() {
    if (!amount) return
    await apiPost(`/api/assets/${asset.id}/movements`, {
      movementType: "BUY", amount: Number(amount),
      quantity: qty ? Number(qty) : undefined, unitPrice: unitPrice ? Number(unitPrice) : undefined,
      currency, description: description || `Posición ${positionType}`,
      operationDate: `${date}T12:00:00`, metadata: { positionType },
    })
    await apiPatch(`/api/assets/${asset.id}`, { amount: asset.amount + Number(amount) })
    dialog.close()
    onUpdated()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
