// Portado desde components/activos/panels/bond-panel.tsx. Se activa cuando
// metadata.disbursements es un array (ver pickPanel en activo-detail.js).

import { apiPatch } from "../../api.js"
import { el, clear, createDialog, svgIcon } from "../../dom.js"
import { formatAmount, currencies, defaultCurrency } from "../../lib/finance.js"

export function renderBondPanel(asset, onUpdated) {
  const wrap = el("div", { style: "display:flex; flex-direction:column; gap:1.5rem;", "data-testid": "asset-panel-bond" })
  const metadata = asset.metadata ?? { disbursements: [] }
  const disbursements = metadata.disbursements ?? []

  const totalPending = disbursements.filter((d) => !d.collected && d.currency === asset.currency).reduce((s, d) => s + d.amount, 0)

  const infoPanel = el("div", { class: "panel" })
  infoPanel.appendChild(el("div", { class: "panel-header" }, `Bonos — ${asset.ticker ?? asset.name}`))
  const grid = el("div", { class: "asset-tech-grid" })
  const valueCell = el("div")
  valueCell.appendChild(el("div", { class: "obl-info-label" }, "Valor actual"))
  valueCell.appendChild(el("div", { style: "font-weight:bold;" }, `${formatAmount(asset.amount, asset.currency)} ${asset.currency}`))
  grid.appendChild(valueCell)
  const pendingCell = el("div")
  pendingCell.appendChild(el("div", { class: "obl-info-label" }, "Desembolsos pendientes"))
  pendingCell.appendChild(el("div", { style: "font-weight:bold; color:#92400e;" }, `${formatAmount(totalPending, asset.currency)} ${asset.currency}`))
  grid.appendChild(pendingCell)
  if (asset.description) {
    const descCell = el("div", { style: "grid-column:1 / -1;" })
    descCell.appendChild(el("div", { class: "obl-info-label" }, "Descripción"))
    descCell.appendChild(el("div", { style: "color:var(--gray-700);" }, asset.description))
    grid.appendChild(descCell)
  }
  infoPanel.appendChild(grid)
  wrap.appendChild(infoPanel)

  const schedPanel = el("div", { class: "panel" })
  const schedHeader = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
  schedHeader.appendChild(el("span", {}, "Cronograma de desembolsos"))
  const addBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; border:none; background:none; color:var(--white); font-size:0.75rem; font-weight:bold;" })
  addBtn.appendChild(svgIcon("icon-plus", 13))
  addBtn.appendChild(document.createTextNode(" Agregar"))
  addBtn.addEventListener("click", () => openAddDisbursementDialog(asset, disbursements, onUpdated))
  schedHeader.appendChild(addBtn)
  schedPanel.appendChild(schedHeader)

  const head = el("div", { style: "display:flex; background:var(--gray-100); font-size:0.75rem; font-weight:bold;" })
  head.appendChild(el("div", { style: "width:9rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, "Fecha"))
  head.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Monto"))
  head.appendChild(el("div", { style: "width:7rem; padding:0.5rem 0.75rem; text-align:center;" }, "Estado"))
  schedPanel.appendChild(head)

  if (disbursements.length === 0) {
    schedPanel.appendChild(el("div", { class: "state-message" }, "Sin desembolsos configurados."))
  }
  const sorted = [...disbursements].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  for (const d of sorted) {
    const row = el("div", { style: `display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;${d.collected ? " background:var(--gray-50); opacity:0.6;" : ""}` })
    row.appendChild(el("div", { style: "width:9rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, new Date(d.dueDate + "T12:00:00").toLocaleDateString("es-ES")))
    row.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace;" }, `${formatAmount(d.amount, d.currency)} ${d.currency}`))
    const statusCell = el("div", { style: "width:7rem; display:flex; align-items:center; justify-content:center; padding:0.5rem 0.75rem;" })
    const toggleBtn = el("button", { style: `font-size:0.75rem; font-weight:bold; border:none; background:none; color:${d.collected ? "#059669" : "inherit"};` }, d.collected ? "✓ Cobrado" : "Marcar cobrado")
    toggleBtn.addEventListener("click", async () => {
      const updated = disbursements.map((x) => (x.id === d.id ? { ...x, collected: !x.collected } : x))
      await apiPatch(`/api/assets/${asset.id}`, { metadata: { disbursements: updated } })
      onUpdated()
    })
    statusCell.appendChild(toggleBtn)
    row.appendChild(statusCell)
    schedPanel.appendChild(row)
  }
  wrap.appendChild(schedPanel)

  return wrap
}

function openAddDisbursementDialog(asset, disbursements, onUpdated) {
  const dialog = createDialog()
  let addDate = "", addAmount = "", addCurrency = asset.currency ?? defaultCurrency

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Agregar desembolso"))
    const body = el("div", { class: "modal-body" })

    const dateField = el("div", { class: "field" })
    dateField.appendChild(el("label", {}, "Fecha de pago"))
    const dateInput = el("input", { class: "input", type: "date", value: addDate })
    dateInput.addEventListener("change", () => { addDate = dateInput.value; syncSave() })
    dateField.appendChild(dateInput)
    body.appendChild(dateField)

    const row = el("div", { style: "display:flex; gap:0.75rem;" })
    const amountField = el("div", { class: "field", style: "flex:1;" })
    amountField.appendChild(el("label", {}, "Monto"))
    const amountInput = el("input", { class: "input", placeholder: "0.00", value: addAmount })
    amountInput.addEventListener("input", () => { addAmount = amountInput.value; syncSave() })
    amountField.appendChild(amountInput)
    const curField = el("div", { class: "field", style: "width:6rem;" })
    curField.appendChild(el("label", {}, "Moneda"))
    const curSelect = el("select", { class: "input" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = addCurrency
    curSelect.addEventListener("change", () => { addCurrency = curSelect.value })
    curField.appendChild(curSelect)
    row.appendChild(amountField); row.appendChild(curField)
    body.appendChild(row)
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, "Guardar")
    saveBtn.disabled = !addDate || !addAmount
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSave() { saveBtn.disabled = !addDate || !addAmount }
  }

  async function handleSave() {
    if (!addDate || !addAmount) return
    const newEntry = { id: crypto.randomUUID(), dueDate: addDate, amount: Number(addAmount), currency: addCurrency, collected: false }
    await apiPatch(`/api/assets/${asset.id}`, { metadata: { disbursements: [...disbursements, newEntry] } })
    dialog.close()
    onUpdated()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
