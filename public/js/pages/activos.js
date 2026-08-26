// Portado desde app/(dashboard)/activos/page.tsx + components/activos/asset-list.tsx.
// Combinados en un solo módulo: AssetList no se reusa en ningún otro lado del
// original, así que separarlo en "página" + "componente" sería una capa sin
// necesidad real (ver CLAUDE.md: cuestionar cada abstracción).

import { apiGet, apiPost, apiDelete } from "../api.js"
import { el, clear, mount, svgIcon, createDialog, createSwitch } from "../dom.js"
import { formatAmount, computeGroupValue } from "../lib/finance.js"
import { categoryName } from "../lib/asset-categories.js"
import { fetchEntityMarkers } from "../lib/markers.js"
import { openMarkerPicker } from "../components/marker-picker.js"
import { openAssetFormDialog } from "../components/asset-form-dialog.js"
import { getSettings } from "../settings.js"

function groupValueNode(children) {
  const { convertCurrencies, baseCurrency, exchangeRates } = getSettings()
  const result = computeGroupValue(children, convertCurrencies, baseCurrency, exchangeRates)
  if (result.type === "single") {
    const span = el("span", {}, `${formatAmount(result.value, result.currency)} `)
    span.appendChild(el("span", { class: "hint-text" }, result.currency))
    return span
  }
  const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; gap:0.125rem;" })
  for (const { currency, value } of result.entries) {
    const line = el("span", { style: "font-size:0.75rem;" }, `${formatAmount(value, currency)} `)
    line.appendChild(el("span", { class: "hint-text" }, currency))
    wrap.appendChild(line)
  }
  return wrap
}

/** Diálogo genérico de confirmación con comentario opcional (reemplaza ConfirmWithCommentDialog). */
function confirmWithComment({ title, description, confirmLabel = "Confirmar", danger = false, onConfirm }) {
  const dialog = createDialog()
  dialog.appendChild(el("div", { class: "modal-header" }, title))
  const body = el("div", { class: "modal-body" })
  if (description) body.appendChild(el("p", { style: "font-size:0.875rem; color:var(--gray-600);" }, description))
  const field = el("div", { class: "field" })
  field.appendChild(el("label", {}, "Comentario (opcional)"))
  const textarea = el("textarea", { class: "input", rows: 3, style: "resize:none;", placeholder: "¿Por qué realizás este cambio?" })
  field.appendChild(textarea)
  body.appendChild(field)
  dialog.appendChild(body)

  const footer = el("div", { class: "modal-footer" })
  const cancelBtn = el("button", { class: "btn" }, "Cancelar")
  cancelBtn.addEventListener("click", () => dialog.close())
  const confirmBtn = el("button", { class: `btn btn-primary${danger ? " btn-danger" : ""}` }, confirmLabel)
  confirmBtn.addEventListener("click", () => { onConfirm(textarea.value); dialog.close() })
  footer.appendChild(cancelBtn); footer.appendChild(confirmBtn)
  dialog.appendChild(footer)

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  dialog.showModal()
  textarea.focus()
}

export async function render(main) {
  clear(main)

  let allActivos = []
  let categories = []
  let markerMap = {}
  let hideZero = true
  let selectMode = false
  const selectedIds = new Set()
  let groupTarget = "new"
  let groupName = ""
  const expandedIds = new Set()
  const filterTypes = new Set()

  const wrap = el("div", { style: "max-width:64rem; margin:0 auto;" })
  const header = el("div", { class: "flow-header" })
  const titleBox = el("div", { class: "flow-title-badge", style: "background:none; color:var(--black); padding:0; display:flex; align-items:center; gap:0.5rem; font-style:italic;" })
  titleBox.appendChild(svgIcon("icon-trending-up", 18))
  titleBox.appendChild(document.createTextNode("Activos"))
  header.appendChild(titleBox)
  const headerActions = el("div", { class: "flow-header-actions" })
  header.appendChild(headerActions)
  wrap.appendChild(header)

  const groupBar = el("div")
  wrap.appendChild(groupBar)
  const filterBar = el("div", { class: "flow-status-bar", style: "flex-wrap:wrap;" })
  wrap.appendChild(filterBar)
  const body = el("div")
  wrap.appendChild(body)
  mount(main, wrap)

  function paintHeaderActions() {
    clear(headerActions)
    if (selectMode) {
      const cancelBtn = el("button", { class: "btn" }, "✕ Cancelar")
      cancelBtn.addEventListener("click", () => { exitSelectMode(); paintAll() })
      headerActions.appendChild(cancelBtn)
      return
    }
    const hideZeroBtn = el("button", { class: `btn${hideZero ? " btn-primary" : ""}` })
    hideZeroBtn.appendChild(svgIcon(hideZero ? "icon-x" : "icon-check", 12))
    hideZeroBtn.appendChild(document.createTextNode(" Balance cero"))
    hideZeroBtn.title = hideZero ? "Mostrar activos en cero" : "Ocultar activos en cero"
    hideZeroBtn.addEventListener("click", () => { hideZero = !hideZero; paintHeaderActions(); paintBody() })
    headerActions.appendChild(hideZeroBtn)

    const groupModeBtn = el("button", { class: "btn" })
    groupModeBtn.appendChild(svgIcon("icon-network", 12))
    groupModeBtn.appendChild(document.createTextNode(" Agrupar"))
    groupModeBtn.addEventListener("click", () => { selectMode = true; paintAll() })
    headerActions.appendChild(groupModeBtn)

    const newBtn = el("button", { class: "btn btn-primary" })
    newBtn.appendChild(svgIcon("icon-plus", 12))
    newBtn.appendChild(document.createTextNode(" Nuevo activo"))
    newBtn.addEventListener("click", () => openAssetFormDialog({ onCreate: () => fetchAll() }))
    headerActions.appendChild(newBtn)
  }

  function exitSelectMode() {
    selectMode = false
    selectedIds.clear()
    groupName = ""
    groupTarget = "new"
  }

  async function fetchAll() {
    const [{ records }, { categories: cats }] = await Promise.all([
      apiGet("/api/dashboard"),
      apiGet("/api/categories"),
    ])
    allActivos = records.filter((r) => r.type === "activo")
    categories = cats
    await refreshMarkers(allActivos.map((r) => r.id))
    paintAll()
  }

  async function refreshMarkers(ids) {
    if (ids.length === 0) { markerMap = {}; return }
    markerMap = await fetchEntityMarkers(ids, "RECORD")
  }

  function paintAll() {
    paintHeaderActions()
    paintGroupBar()
    paintFilterBar()
    paintBody()
  }

  function paintGroupBar() {
    clear(groupBar)
    if (!selectMode) return
    const groupParents = allActivos.filter((r) => r.isGroupParent)
    const canGroup = selectedIds.size >= 2

    if (!canGroup) {
      groupBar.appendChild(el("div", { class: "state-message", style: "border:2px dashed var(--gray-300); margin-bottom:1rem;" }, "Seleccioná al menos 2 activos para agrupar."))
      return
    }

    const bar = el("div", { class: "select-bar", style: "position:static; box-shadow:none; margin-bottom:1rem;" })
    bar.appendChild(el("span", { style: "font-weight:bold; font-size:0.875rem;" }, `${selectedIds.size} activos seleccionados`))

    const targetSelect = el("select", { class: "input" })
    targetSelect.appendChild(el("option", { value: "new" }, "Crear nuevo grupo"))
    for (const g of groupParents) targetSelect.appendChild(el("option", { value: g.id }, `Agregar a: ${g.name}`))
    targetSelect.value = groupTarget
    targetSelect.addEventListener("change", () => { groupTarget = targetSelect.value; paintGroupBar() })
    bar.appendChild(targetSelect)

    if (groupTarget === "new") {
      const nameInput = el("input", { class: "input", placeholder: "Nombre del grupo...", value: groupName })
      nameInput.addEventListener("input", () => { groupName = nameInput.value; actionBtn.disabled = !groupName.trim() })
      nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleGroupAction() })
      bar.appendChild(nameInput)
    }

    const actionBtn = el("button", { class: "btn btn-primary" }, groupTarget === "new" ? "Crear grupo" : "Asignar al grupo")
    actionBtn.disabled = groupTarget === "new" && !groupName.trim()
    actionBtn.addEventListener("click", handleGroupAction)
    bar.appendChild(actionBtn)
    groupBar.appendChild(bar)
  }

  async function handleGroupAction() {
    const ids = [...selectedIds]
    const selectedRecords = allActivos.filter((r) => selectedIds.has(r.id))
    const currency = selectedRecords[0]?.currency ?? "USD"
    if (groupTarget === "new") {
      if (!groupName.trim()) return
      await apiPost("/api/assets/groups", { name: groupName.trim(), childIds: ids, currency })
    } else {
      await apiPost(`/api/assets/groups/${groupTarget}/assign`, { childIds: ids })
    }
    exitSelectMode()
    await fetchAll()
  }

  function paintFilterBar() {
    clear(filterBar)
    const allBtn = el("button", { class: `status-filter-btn${filterTypes.size === 0 ? " active" : ""}` }, "Todos")
    allBtn.addEventListener("click", () => { filterTypes.clear(); paintFilterBar(); paintBody() })
    filterBar.appendChild(allBtn)
    for (const c of categories) {
      const btn = el("button", { class: `status-filter-btn${filterTypes.has(c.id) ? " active" : ""}` }, c.name)
      btn.addEventListener("click", () => {
        if (filterTypes.has(c.id)) filterTypes.delete(c.id); else filterTypes.add(c.id)
        paintFilterBar(); paintBody()
      })
      filterBar.appendChild(btn)
    }
  }

  function getChildren(parentId) { return allActivos.filter((r) => r.parentId === parentId) }

  function paintBody() {
    clear(body)
    const topLevel = allActivos.filter((r) => {
      if (r.parentId) return false
      if (hideZero && r.amount === 0) return false
      return true
    })
    const filtered = filterTypes.size === 0 ? topLevel : topLevel.filter((r) => r.assetType && filterTypes.has(r.assetType))

    const table = el("div", { class: "obl-table", "data-testid": "activos-list" })
    const head = el("div", { class: "obl-header-row" })
    if (selectMode) head.appendChild(el("div", { style: "width:2.5rem;" }))
    head.appendChild(el("div", { style: "flex:1;" }, "Nombre"))
    head.appendChild(el("div", { class: "obl-col-type" }, "Tipo"))
    head.appendChild(el("div", { class: "obl-col-value", style: "width:11rem;" }, "Valor"))
    head.appendChild(el("div", { style: "width:5rem;" }))
    table.appendChild(head)

    for (const record of filtered) table.appendChild(paintRow(record))

    if (filtered.length === 0) {
      const msg = filterTypes.size > 0 ? "No hay activos para los tipos seleccionados." : "No hay activos. Creá el primero con el botón de arriba."
      table.appendChild(el("div", { class: "state-message" }, msg))
    }
    body.appendChild(table)
  }

  function paintRow(record, isChild = false) {
    const children = isChild ? [] : getChildren(record.id)
    const expanded = expandedIds.has(record.id)
    const isGroup = !isChild && (record.isGroupParent || children.length > 0)
    const isSelected = selectedIds.has(record.id)
    const marker = markerMap[record.id] ?? null

    const rowWrap = el("div", { "data-testid": isGroup ? `activos-group-row-${record.id}` : `activos-row-${record.id}` })
    const row = el("div", {
      class: `obl-row${isChild ? " asset-child-row" : ""}${isSelected ? " is-selected" : ""}`,
      style: marker ? `border-left:4px solid ${marker.color}; background-color:${marker.color}18;` : "",
    })

    if (selectMode) {
      const cbWrap = el("div", { style: "width:2.5rem; display:flex; justify-content:center;" })
      const cb = el("input", { type: "checkbox", checked: isSelected })
      cb.addEventListener("change", () => {
        if (isSelected) selectedIds.delete(record.id); else selectedIds.add(record.id)
        paintGroupBar(); paintBody()
      })
      cbWrap.appendChild(cb)
      row.appendChild(cbWrap)
    }

    const nameCol = el("div", { style: `flex:1; display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; font-weight:500;${isChild ? " padding-left:2.5rem; color:var(--gray-600); font-weight:normal;" : ""}` })
    if (isGroup) {
      const toggleBtn = el("button", { class: "flow-group-toggle", style: "color:var(--gray-400);" })
      toggleBtn.appendChild(svgIcon(expanded ? "icon-chevron-down" : "icon-chevron-right", 14))
      toggleBtn.addEventListener("click", () => {
        if (expanded) expandedIds.delete(record.id); else expandedIds.add(record.id)
        paintBody()
      })
      nameCol.appendChild(toggleBtn)
    }
    const link = el("a", { href: `/activos/${record.id}`, "data-link": "", style: "text-decoration:none; color:inherit;" }, record.name)
    link.addEventListener("mouseenter", () => link.style.textDecoration = "underline")
    link.addEventListener("mouseleave", () => link.style.textDecoration = "none")
    nameCol.appendChild(link)
    if (isGroup) nameCol.appendChild(svgIcon("icon-network", 12))
    row.appendChild(nameCol)

    row.appendChild(el("div", { class: "obl-col-type", style: isChild ? "color:var(--gray-400);" : "" }, categoryName(record.assetType, categories)))

    const valueCol = el("div", { class: "obl-col-value", style: "width:11rem;" })
    if (isGroup && children.length > 0) valueCol.appendChild(groupValueNode(children))
    else {
      valueCol.appendChild(document.createTextNode(`${formatAmount(record.amount, record.currency)} `))
      valueCol.appendChild(el("span", { class: "hint-text" }, record.currency))
    }
    row.appendChild(valueCol)

    const actionsCol = el("div", { style: "width:5rem; display:flex; align-items:center; justify-content:center; gap:0.25rem;" })
    const markerBtn = el("button", { class: "marker-trigger", title: "Marcador" })
    const dot = el("span", { class: "marker-trigger-dot" })
    if (marker) { dot.style.background = marker.color; dot.style.borderColor = marker.color }
    markerBtn.appendChild(dot)
    markerBtn.addEventListener("click", () => {
      openMarkerPicker(markerBtn, {
        entityId: record.id, entityType: "RECORD", currentMarker: marker,
        onChanged: () => refreshMarkers(allActivos.map((r) => r.id)).then(paintBody),
      })
    })
    actionsCol.appendChild(markerBtn)

    const goLink = el("a", { href: `/activos/${record.id}`, "data-link": "", class: "flow-row-icon-btn", "aria-label": "Ver detalle" })
    goLink.appendChild(svgIcon("icon-arrow-right", 12))
    actionsCol.appendChild(goLink)

    if (!selectMode) {
      if (isChild) {
        const unlinkBtn = el("button", { class: "flow-row-icon-btn", title: "Remover del grupo" })
        unlinkBtn.appendChild(svgIcon("icon-x", 12))
        unlinkBtn.addEventListener("click", async () => { await apiPost(`/api/assets/${record.id}/remove-from-group`); await fetchAll() })
        actionsCol.appendChild(unlinkBtn)
      } else if (isGroup) {
        const delBtn = el("button", { class: "flow-row-icon-btn", title: "Eliminar grupo (los activos quedan sueltos)" })
        delBtn.appendChild(svgIcon("icon-trash", 12))
        delBtn.addEventListener("click", () => {
          confirmWithComment({
            title: "Eliminar grupo",
            description: `El grupo "${record.name}" se eliminará. Los activos del grupo quedarán sueltos (no se eliminan).`,
            danger: true,
            onConfirm: async () => { await apiDelete(`/api/assets/groups/${record.id}`); await fetchAll() },
          })
        })
        actionsCol.appendChild(delBtn)
      } else {
        const delBtn = el("button", { class: "flow-row-icon-btn", title: record.amount > 0 ? "Liquidar activo (pone balance en 0)" : "Eliminar activo definitivamente" })
        delBtn.appendChild(svgIcon("icon-trash", 12))
        delBtn.addEventListener("click", () => openDeleteFlow(record))
        actionsCol.appendChild(delBtn)
      }
    }
    row.appendChild(actionsCol)
    rowWrap.appendChild(row)

    if (isGroup && expanded) {
      for (const child of children) rowWrap.appendChild(paintRow(child, true))
    }
    return rowWrap
  }

  function openDeleteFlow(record) {
    if (record.amount > 0) {
      openLiquidarDialog(record)
    } else {
      confirmWithComment({
        title: "Eliminar activo",
        description: `"${record.name}" tiene balance $0 y será eliminado definitivamente.`,
        danger: true,
        onConfirm: async () => { await apiDelete(`/api/assets/${record.id}/physical`); await fetchAll() },
      })
    }
  }

  function openLiquidarDialog(record) {
    const dialog = createDialog()
    let createIngreso = true
    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Liquidar activo"))
      const body = el("div", { class: "modal-body" })
      const p = el("p", { style: "font-size:0.875rem;" })
      p.appendChild(el("strong", {}, record.name))
      p.appendChild(document.createTextNode(" tiene un balance de "))
      p.appendChild(el("strong", {}, `${formatAmount(record.amount, record.currency)} ${record.currency}`))
      p.appendChild(document.createTextNode(". Al liquidar, el balance pasará a "))
      p.appendChild(el("strong", {}, "$0"))
      p.appendChild(document.createTextNode("."))
      body.appendChild(p)

      const switchRow = el("div", { class: "switch-row" })
      const sw = createSwitch(createIngreso, (v) => { createIngreso = v }, "Crear ingreso asociado")
      switchRow.appendChild(sw)
      const switchLabel = el("label", { class: "switch-label", style: "display:flex; align-items:center; gap:0.75rem; cursor:pointer;" })
      switchLabel.appendChild(document.createTextNode("Crear ingreso asociado "))
      switchLabel.appendChild(el("span", { class: "hint-text" }, `("Liquidación de ${record.name}")`))
      switchRow.appendChild(switchLabel)
      body.appendChild(switchRow)

      const commentField = el("div", { class: "field" })
      commentField.appendChild(el("label", {}, "Comentario (opcional)"))
      const textarea = el("textarea", { class: "input", rows: 2, style: "resize:none;" })
      commentField.appendChild(textarea)
      body.appendChild(commentField)
      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const confirmBtn = el("button", { class: "btn btn-danger" }, "Liquidar")
      confirmBtn.addEventListener("click", async () => {
        await apiPost(`/api/assets/${record.id}/liquidate`, {
          previousAmount: record.amount, currency: record.currency, assetName: record.name,
          description: textarea.value || undefined, createIngreso,
        })
        dialog.close()
        await fetchAll()
      })
      footer.appendChild(cancelBtn); footer.appendChild(confirmBtn)
      dialog.appendChild(footer)
    }
    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  await fetchAll()
  return () => {}
}
