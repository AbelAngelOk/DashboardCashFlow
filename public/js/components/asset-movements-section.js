// Portado desde components/activos/asset-movements-section.tsx.

import { apiPatch, apiDelete } from "../api.js"
import { el, clear } from "../dom.js"
import { formatAmount } from "../lib/finance.js"

const MOVEMENT_TYPE_LABELS = {
  BUY: "Compra", SELL: "Venta", DIVIDEND: "Dividendo", FEE: "Comisión",
  COLLECT: "Cobro", ADJUSTMENT: "Ajuste", EXTRACT: "Extracción", DEPOSIT: "Depósito",
}
const EDITABLE_MOVEMENT_TYPES = ["DEPOSIT", "ADJUSTMENT", "EXTRACT", "BUY", "SELL", "DIVIDEND", "FEE", "COLLECT"]

export function renderAssetMovementsSection(asset, onUpdated) {
  const panel = el("div", { class: "panel", "data-testid": "asset-movements-section" })
  panel.appendChild(el("div", { class: "panel-header" }, "Movimientos"))

  const head = el("div", { class: "asset-mov-row asset-mov-head" })
  head.appendChild(el("div", { class: "asset-mov-type" }, "Tipo"))
  head.appendChild(el("div", { style: "flex:1;" }, "Comentario"))
  head.appendChild(el("div", { class: "asset-mov-date" }, "Fecha"))
  head.appendChild(el("div", { class: "asset-mov-amount" }, "Monto"))
  head.appendChild(el("div", { class: "asset-mov-actions" }))
  panel.appendChild(head)

  if (asset.movements.length === 0) {
    panel.appendChild(el("div", { class: "state-message" }, "Sin movimientos registrados."))
    return panel
  }

  let deletingId = null
  let editingId = null

  for (const m of asset.movements) panel.appendChild(paintRow(m))

  function paintRow(m) {
    if (editingId === m.id) return paintEditRow(m)

    const row = el("div", { class: "asset-mov-row" })
    row.appendChild(el("div", { class: "asset-mov-type" }, MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType))
    row.appendChild(el("div", { style: "flex:1; color:var(--gray-600);" }, m.description ?? "—"))
    row.appendChild(el("div", { class: "asset-mov-date" }, new Date(m.operationDate).toLocaleDateString("es-ES")))
    row.appendChild(el("div", { class: "asset-mov-amount" }, `${formatAmount(m.amount, m.currency)} ${m.currency}`))

    const actions = el("div", { class: "asset-mov-actions" })
    const editBtn = el("button", { class: "flow-row-icon-btn" }, "✎")
    editBtn.title = "Editar movimiento"
    editBtn.addEventListener("click", () => { editingId = m.id; replaceRow(row, paintRow(m)) })
    const delBtn = el("button", { class: "flow-row-icon-btn" }, "✕")
    delBtn.title = "Eliminar movimiento"
    delBtn.disabled = deletingId === m.id
    delBtn.addEventListener("click", async () => {
      deletingId = m.id
      delBtn.disabled = true
      await apiDelete(`/api/assets/movements/${m.id}`)
      onUpdated()
    })
    actions.appendChild(editBtn); actions.appendChild(delBtn)
    row.appendChild(actions)
    return row
  }

  function paintEditRow(m) {
    const row = el("div", { class: "asset-mov-row", style: "background:var(--gray-50);" })

    const typeSelect = el("select", { class: "input", style: "height:1.75rem; font-size:0.75rem;" })
    for (const t of EDITABLE_MOVEMENT_TYPES) typeSelect.appendChild(el("option", { value: t }, MOVEMENT_TYPE_LABELS[t]))
    typeSelect.value = m.movementType
    const typeWrap = el("div", { class: "asset-mov-type" }); typeWrap.appendChild(typeSelect)
    row.appendChild(typeWrap)

    const commentInput = el("input", { class: "input", style: "height:1.75rem; font-size:0.75rem;", value: m.description ?? "" })
    const commentWrap = el("div", { style: "flex:1;" }); commentWrap.appendChild(commentInput)
    row.appendChild(commentWrap)

    row.appendChild(el("div", { class: "asset-mov-date" }, new Date(m.operationDate).toLocaleDateString("es-ES")))
    row.appendChild(el("div", { class: "asset-mov-amount" }, `${formatAmount(m.amount, m.currency)} ${m.currency}`))

    const actions = el("div", { class: "asset-mov-actions" })
    let saving = false
    const saveBtn = el("button", { class: "flow-row-icon-btn" }, "✓")
    saveBtn.addEventListener("click", async () => {
      if (saving) return
      saving = true
      await apiPatch(`/api/assets/movements/${m.id}`, { movementType: typeSelect.value, description: commentInput.value })
      editingId = null
      onUpdated()
    })
    const cancelBtn = el("button", { class: "flow-row-icon-btn" }, "✕")
    cancelBtn.addEventListener("click", () => { editingId = null; replaceRow(row, paintRow(m)) })
    actions.appendChild(saveBtn); actions.appendChild(cancelBtn)
    row.appendChild(actions)

    commentInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveBtn.click()
      if (e.key === "Escape") cancelBtn.click()
    })
    setTimeout(() => commentInput.focus(), 0)
    return row
  }

  function replaceRow(oldRow, newRow) { oldRow.replaceWith(newRow) }

  return panel
}
