// Portado desde components/activos/boards/custom-board.tsx.
//
// Único componente de todo Activos con edición en borrador local: agregar/
// quitar columnas y filas NO llama a la API de inmediato -- se acumula en
// `config` local (bandera `dirty`) hasta que el usuario aprieta "Guardar" (o
// "Descartar"). Es el comportamiento real del original, no una simplificación
// mía: evitar un POST por cada columna/fila tocada durante la edición.

import { apiPatch } from "../../api.js"
import { el, clear, createDialog, svgIcon } from "../../dom.js"

const COLUMN_TYPE_LABELS = { text: "Texto", number: "Número", date: "Fecha" }

export function renderCustomBoard(asset, board, onUpdated) {
  const panel = el("div", { class: "panel", "data-testid": `asset-board-custom-${board.id}` })

  let config = board.config ?? { columns: [], rows: [] }
  let title = board.title
  let editingTitle = false
  let editingRowId = null
  let editDraft = {}
  let dirty = false
  let saving = false

  function markDirty(newConfig) { config = newConfig; dirty = true; paint() }

  async function persist(updates) {
    const updatedBoards = asset.boards.map((b) => (b.id === board.id ? { ...b, ...updates } : b))
    await apiPatch(`/api/assets/${asset.id}/boards`, { boards: updatedBoards })
  }

  function paint() {
    clear(panel)
    panel.appendChild(paintHeader())
    if (config.columns.length === 0) {
      const empty = el("div", { class: "state-message", style: "display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:2rem 0;" })
      empty.appendChild(el("p", {}, "Sin columnas configuradas."))
      const addBtn = el("button", { class: "btn" })
      addBtn.appendChild(svgIcon("icon-plus", 12))
      addBtn.appendChild(document.createTextNode(" Agregar columna"))
      addBtn.addEventListener("click", () => openAddColumnDialog(handleAddColumn))
      empty.appendChild(addBtn)
      panel.appendChild(empty)
    } else {
      panel.appendChild(paintTable())
    }
  }

  function paintHeader() {
    const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
    if (editingTitle) {
      const input = el("input", {
        value: title,
        style: "width:10rem; border:none; background:rgba(255,255,255,0.1); color:var(--white); font-weight:bold; font-style:italic; outline:none; padding:0.125rem 0.25rem;",
      })
      input.addEventListener("blur", saveTitle)
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveTitle()
        if (e.key === "Escape") { title = board.title; editingTitle = false; paint() }
      })
      header.appendChild(input)
      setTimeout(() => input.focus(), 0)
    } else {
      const btn = el("button", { style: "font-weight:bold; font-style:italic; color:var(--white); border:none; background:none;" }, title)
      btn.addEventListener("click", () => { editingTitle = true; paint() })
      header.appendChild(btn)
    }

    const actions = el("div", { style: "display:flex; align-items:center; gap:0.5rem;" })
    if (dirty) {
      const discardBtn = el("button", { style: "color:var(--gray-400); border:none; background:none;" })
      discardBtn.appendChild(svgIcon("icon-x", 14))
      discardBtn.title = "Descartar cambios"
      discardBtn.addEventListener("click", () => {
        config = board.config ?? { columns: [], rows: [] }
        title = board.title
        dirty = false; editingRowId = null; editDraft = {}
        paint()
      })
      const saveBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; color:var(--white); border:none; background:none; font-size:0.75rem;" })
      saveBtn.appendChild(svgIcon("icon-check", 13))
      saveBtn.appendChild(document.createTextNode(saving ? " Guardando..." : " Guardar"))
      saveBtn.disabled = saving
      saveBtn.addEventListener("click", async () => {
        saving = true; paint()
        await persist({ config, title })
        dirty = false; saving = false
        onUpdated()
      })
      actions.appendChild(discardBtn); actions.appendChild(saveBtn)
    }
    const colBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; color:var(--white); border:none; background:none; font-size:0.75rem;" })
    colBtn.appendChild(svgIcon("icon-settings", 13))
    colBtn.appendChild(document.createTextNode(" Columna"))
    colBtn.addEventListener("click", () => openAddColumnDialog(handleAddColumn))
    actions.appendChild(colBtn)
    if (config.columns.length > 0) {
      const rowBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; color:var(--white); border:none; background:none; font-size:0.75rem;" })
      rowBtn.appendChild(svgIcon("icon-plus", 13))
      rowBtn.appendChild(document.createTextNode(" Fila"))
      rowBtn.addEventListener("click", handleAddRow)
      actions.appendChild(rowBtn)
    }
    header.appendChild(actions)
    return header
  }

  function saveTitle() {
    if (!title.trim()) { title = board.title; editingTitle = false; paint(); return }
    editingTitle = false
    persist({ title: title.trim() }).then(onUpdated)
  }

  function handleAddColumn(col) {
    markDirty({ ...config, columns: [...config.columns, { ...col, id: crypto.randomUUID() }] })
  }

  function handleDeleteColumn(colId) {
    const columns = config.columns.filter((c) => c.id !== colId)
    const rows = config.rows.map((r) => {
      const cells = { ...r.cells }
      delete cells[colId]
      return { ...r, cells }
    })
    markDirty({ columns, rows })
  }

  function handleAddRow() {
    const newRow = { id: crypto.randomUUID(), cells: Object.fromEntries(config.columns.map((c) => [c.id, ""])) }
    config = { ...config, rows: [...config.rows, newRow] }
    dirty = true
    editingRowId = newRow.id
    editDraft = { ...newRow.cells }
    paint()
  }

  function startEditRow(row) { editingRowId = row.id; editDraft = { ...row.cells }; paint() }

  function saveRow() {
    if (!editingRowId) return
    const rows = config.rows.map((r) => (r.id === editingRowId ? { ...r, cells: { ...editDraft } } : r))
    config = { ...config, rows }
    dirty = true
    editingRowId = null; editDraft = {}
    paint()
  }

  function cancelEditRow(rowId) {
    const row = config.rows.find((r) => r.id === rowId)
    if (row && Object.values(row.cells).every((v) => !v)) {
      config = { ...config, rows: config.rows.filter((r) => r.id !== rowId) }
    }
    editingRowId = null; editDraft = {}
    paint()
  }

  function handleDeleteRow(rowId) {
    markDirty({ ...config, rows: config.rows.filter((r) => r.id !== rowId) })
  }

  function paintTable() {
    const wrap = el("div", { style: "overflow-x:auto;" })
    const table = el("table", { style: "width:100%; font-size:0.875rem; border-collapse:collapse;" })
    const thead = el("thead")
    const headRow = el("tr", { style: "background:var(--gray-100);" })
    for (const col of config.columns) {
      const th = el("th", { style: "border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:left; font-size:0.75rem; font-weight:bold;" })
      const topRow = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:0.5rem;" })
      topRow.appendChild(el("span", {}, col.name))
      const delColBtn = el("button", { style: "color:var(--gray-400); border:none; background:none;" })
      delColBtn.appendChild(svgIcon("icon-x", 11))
      delColBtn.addEventListener("click", () => handleDeleteColumn(col.id))
      topRow.appendChild(delColBtn)
      th.appendChild(topRow)
      th.appendChild(el("div", { style: "font-size:0.625rem; font-weight:normal; color:var(--gray-400);" }, COLUMN_TYPE_LABELS[col.type]))
      headRow.appendChild(th)
    }
    headRow.appendChild(el("th", { style: "width:2.5rem; padding:0.5rem 0.25rem;" }))
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = el("tbody")
    if (config.rows.length === 0) {
      const tr = el("tr")
      const td = el("td", { colspan: String(config.columns.length + 1), style: "padding:1rem; text-align:center; color:var(--gray-400);" }, 'Sin filas. Hacé click en "+ Fila" para agregar.')
      tr.appendChild(td)
      tbody.appendChild(tr)
    }
    for (const row of config.rows) tbody.appendChild(editingRowId === row.id ? paintEditRow(row) : paintReadRow(row))
    table.appendChild(tbody)
    wrap.appendChild(table)
    return wrap
  }

  function paintReadRow(row) {
    const tr = el("tr", { style: "border-top:1px solid var(--black); cursor:pointer;" })
    tr.addEventListener("dblclick", () => startEditRow(row))
    for (const col of config.columns) {
      tr.appendChild(el("td", { style: "border-right:1px solid var(--black); padding:0.5rem 0.75rem; color:var(--gray-700);" }, row.cells[col.id] || "—"))
    }
    const actionsTd = el("td", { style: "padding:0.25rem;" })
    const actions = el("div", { style: "display:flex; align-items:center; gap:0.25rem;" })
    const editBtn = el("button", { class: "flow-row-icon-btn" })
    editBtn.appendChild(svgIcon("icon-pencil", 11))
    editBtn.addEventListener("click", () => startEditRow(row))
    const delBtn = el("button", { class: "flow-row-icon-btn" })
    delBtn.appendChild(svgIcon("icon-trash", 12))
    delBtn.addEventListener("click", () => handleDeleteRow(row.id))
    actions.appendChild(editBtn); actions.appendChild(delBtn)
    actionsTd.appendChild(actions)
    tr.appendChild(actionsTd)
    return tr
  }

  function paintEditRow(row) {
    const tr = el("tr", { style: "border-top:1px solid var(--black); background:#fffbeb;" })
    let firstInput = null
    for (const col of config.columns) {
      const td = el("td", { style: "border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
      const type = col.type === "number" ? "number" : col.type === "date" ? "date" : "text"
      const input = el("input", { type, value: editDraft[col.id] ?? "", style: "height:1.75rem; border:none; background:transparent; padding:0; font-size:0.875rem; width:100%;" })
      input.addEventListener("input", () => { editDraft[col.id] = input.value })
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") saveRow() })
      td.appendChild(input)
      tr.appendChild(td)
      if (!firstInput) firstInput = input
    }
    const actionsTd = el("td", { style: "padding:0.25rem;" })
    const actions = el("div", { style: "display:flex; align-items:center; gap:0.25rem;" })
    const okBtn = el("button", { class: "flow-row-icon-btn" })
    okBtn.appendChild(svgIcon("icon-check", 13))
    okBtn.addEventListener("click", saveRow)
    const cancelBtn = el("button", { class: "flow-row-icon-btn" })
    cancelBtn.appendChild(svgIcon("icon-x", 13))
    cancelBtn.addEventListener("click", () => cancelEditRow(row.id))
    actions.appendChild(okBtn); actions.appendChild(cancelBtn)
    actionsTd.appendChild(actions)
    tr.appendChild(actionsTd)
    if (firstInput) setTimeout(() => firstInput.focus(), 0)
    return tr
  }

  paint()
  return panel
}

function openAddColumnDialog(onAdd) {
  const dialog = createDialog()
  let name = "", type = "text"

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Nueva columna"))
    const body = el("div", { class: "modal-body" })
    const nameField = el("div", { class: "field" })
    nameField.appendChild(el("label", {}, "Nombre"))
    const nameInput = el("input", { class: "input", placeholder: "Ej: Precio de compra", value: name })
    nameInput.addEventListener("input", () => { name = nameInput.value; syncSave() })
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAdd() })
    nameField.appendChild(nameInput)
    body.appendChild(nameField)

    const typeField = el("div", { class: "field" })
    typeField.appendChild(el("label", {}, "Tipo"))
    const typeSelect = el("select", { class: "input" })
    for (const [k, v] of Object.entries(COLUMN_TYPE_LABELS)) typeSelect.appendChild(el("option", { value: k }, v))
    typeSelect.value = type
    typeSelect.addEventListener("change", () => { type = typeSelect.value })
    typeField.appendChild(typeSelect)
    body.appendChild(typeField)
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const addBtn = el("button", { class: "btn btn-primary" }, "Agregar")
    addBtn.disabled = !name.trim()
    addBtn.addEventListener("click", handleAdd)
    footer.appendChild(cancelBtn); footer.appendChild(addBtn)
    dialog.appendChild(footer)
    setTimeout(() => nameInput.focus(), 0)

    function syncSave() { addBtn.disabled = !name.trim() }
  }

  function handleAdd() {
    if (!name.trim()) return
    onAdd({ name: name.trim(), type })
    dialog.close()
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
