// Renderer compartido por gastos.js e ingresos.js. En React eran dos
// archivos de ~550 líneas casi idénticos (mismo agrupamiento, mismo modo
// selección, mismo panel de vínculos, mismo marker picker) con los nombres
// de campo invertidos. Acá es un solo módulo configurado por `kind` — así
// un bug corregido de un lado no puede quedar sin corregir del otro, y el
// navegador descarga la lógica de lista una sola vez, no dos.

import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../api.js"
import { el, clear, mount, svgIcon } from "../dom.js"
import { formatAmount } from "../lib/finance.js"
import { fetchEntityMarkers } from "../lib/markers.js"
import { openMarkerPicker } from "../components/marker-picker.js"
import { createLinksPanel } from "../components/links-panel.js"
import { openEditOrVersionDialog } from "../components/edit-or-version-dialog.js"

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const STATUS_BUTTONS = [
  { label: "Activos", value: "ACTIVE" },
  { label: "Históricos", value: "HISTORICAL" },
  { label: "Archivados", value: "ARCHIVED" },
]

/** @param {import("./flow-list-config.js").FlowListConfig} cfg */
export async function renderFlowList(main, cfg) {
  clear(main)

  let statusFilter = "ACTIVE"
  let items = []
  let groups = []
  let markerMap = {}
  let loading = true
  let selectMode = false
  const selectedIds = new Set()
  const expandedLinks = new Set()
  const expandedGroups = new Set()
  let groupTarget = "new"
  let groupName = ""
  let renamingGroupId = null
  let renamingName = ""

  const wrap = el("div", { style: "max-width:56rem; margin:0 auto;" })
  mount(main, wrap)

  // ── Header ────────────────────────────────────────────────────────────
  const header = el("div", { class: "flow-header" })
  header.appendChild(el("div", { class: "flow-title-badge" }, cfg.title))
  const headerActions = el("div", { class: "flow-header-actions" })
  header.appendChild(headerActions)
  wrap.appendChild(header)

  // ── Status filter ─────────────────────────────────────────────────────
  const statusBar = el("div", { class: "flow-status-bar" })
  wrap.appendChild(statusBar)

  const body = el("div")
  wrap.appendChild(body)

  function paintHeaderActions() {
    clear(headerActions)
    if (selectMode) {
      const cancelBtn = el("button", { class: "btn" }, "✕ Cancelar")
      cancelBtn.addEventListener("click", exitSelectMode)
      headerActions.appendChild(cancelBtn)
    } else {
      const groupBtn = el("button", { class: "btn" }, "Agrupar")
      groupBtn.addEventListener("click", () => { selectMode = true; paintHeaderActions(); paintBody() })
      const newBtn = el("button", { class: "btn btn-primary" })
      newBtn.appendChild(svgIcon("icon-plus", 12))
      newBtn.appendChild(document.createTextNode(" " + cfg.createButtonLabel))
      newBtn.addEventListener("click", () => cfg.openCreateDialog(() => fetchItems()))
      headerActions.appendChild(groupBtn)
      headerActions.appendChild(newBtn)
    }
  }

  function paintStatusBar() {
    clear(statusBar)
    for (const { label, value } of STATUS_BUTTONS) {
      const btn = el("button", { class: `status-filter-btn${statusFilter === value ? " active" : ""}` }, label)
      btn.addEventListener("click", () => { statusFilter = value; fetchItems() })
      statusBar.appendChild(btn)
    }
  }

  async function fetchGroups() {
    const { groups: g } = await apiGet(`/api/flow-groups?type=${cfg.groupType}`)
    groups = g
  }

  async function refreshMarkers(ids) {
    if (ids.length === 0) { markerMap = {}; return }
    markerMap = await fetchEntityMarkers(ids, "RECORD")
  }

  async function fetchItems() {
    loading = true
    paintBody()
    try {
      const [{ [cfg.itemsField]: data }] = await Promise.all([
        apiGet(`/api/${cfg.itemsField}?status=${statusFilter}`),
        fetchGroups(),
      ])
      items = data
      await refreshMarkers(items.map((x) => x.id))
    } finally {
      loading = false
      paintBody()
    }
  }

  function exitSelectMode() {
    selectMode = false
    selectedIds.clear()
    groupTarget = "new"
    groupName = ""
    paintHeaderActions()
    paintBody()
  }

  async function handleArchive(id) {
    await apiPost(cfg.archivePath(id))
    fetchItems()
  }
  async function handleRestore(id) {
    await apiPost(cfg.restorePath(id))
    fetchItems()
  }

  async function handleGroupAction() {
    const ids = [...selectedIds]
    if (groupTarget === "new") {
      if (!groupName.trim()) return
      await apiPost("/api/flow-groups", { name: groupName.trim(), groupType: cfg.groupType, recordIds: ids })
    } else {
      await Promise.all(ids.map((id) => apiPut(`/api/flow-groups/${groupTarget}/members`, { recordId: id })))
    }
    await fetchGroups()
    exitSelectMode()
  }

  async function handleRemoveFromGroup(groupId, recordId) {
    await apiDelete(`/api/flow-groups/${groupId}/members?recordId=${recordId}`)
    await fetchGroups()
    paintBody()
  }

  async function handleDeleteGroup(id) {
    await apiDelete(`/api/flow-groups/${id}`)
    await fetchGroups()
    paintBody()
  }

  async function handleRenameGroup(id) {
    if (!renamingName.trim()) return
    await apiPatch(`/api/flow-groups/${id}`, { name: renamingName.trim() })
    await fetchGroups()
    renamingGroupId = null
    paintBody()
  }

  function totalsByCurrency(rows) {
    const acc = {}
    for (const r of rows) acc[r.currency] = (acc[r.currency] ?? 0) + r.amount
    return acc
  }

  function paintBody() {
    clear(body)

    if (loading) {
      body.appendChild(el("div", { class: "state-message" }, "Cargando..."))
      return
    }
    if (items.length === 0) {
      const empty = el("div", { class: "flow-empty" })
      empty.appendChild(svgIcon(cfg.icon, 40))
      const statusText = statusFilter === "ACTIVE" ? "activos" : statusFilter === "HISTORICAL" ? "históricos" : "archivados"
      empty.appendChild(el("p", { class: "hint-text" }, `No hay ${cfg.itemsField} ${statusText}.`))
      if (statusFilter === "ACTIVE") {
        const btn = el("button", { class: "btn btn-primary" })
        btn.appendChild(svgIcon("icon-plus", 12))
        btn.appendChild(document.createTextNode(" " + cfg.emptyCreateLabel))
        btn.addEventListener("click", () => cfg.openCreateDialog(() => fetchItems()))
        empty.appendChild(btn)
      }
      body.appendChild(empty)
      return
    }

    const col = el("div", { class: "flow-col" })

    // Summary
    const summary = el("div", { class: "flow-summary" })
    const totalBox = el("div")
    totalBox.appendChild(el("span", { class: "flow-summary-label" }, `Total ${cfg.itemsField}`))
    totalBox.appendChild(el("div", { style: "font-weight:bold;" }, String(items.length)))
    summary.appendChild(totalBox)
    for (const [cur, total] of Object.entries(totalsByCurrency(items))) {
      const box = el("div")
      box.appendChild(el("span", { class: "flow-summary-label" }, `Total ${cur}`))
      box.appendChild(el("div", { style: "font-weight:bold;" }, `${formatAmount(total, cur)} ${cur}`))
      summary.appendChild(box)
    }
    col.appendChild(summary)

    // User groups
    if (groups.length > 0) {
      const groupsCol = el("div", { class: "flow-col" })
      for (const group of groups) paintGroup(groupsCol, group)
      col.appendChild(groupsCol)
    }

    // Select-mode action bar
    if (selectMode && selectedIds.size > 0) paintSelectBar(col)

    // Grouped tables
    for (const { label, rows } of cfg.sections(items)) {
      if (rows.length === 0) continue
      col.appendChild(paintSection(label, rows))
    }

    body.appendChild(col)
  }

  function paintGroup(container, group) {
    const members = items.filter((x) => group.memberIds.includes(x.id))
    const isExpanded = expandedGroups.has(group.id)
    const box = el("div", { class: "flow-group" })

    const head = el("div", { class: "flow-group-header" })
    const toggleBtn = el("button", { class: "flow-group-toggle" })
    toggleBtn.appendChild(svgIcon(isExpanded ? "icon-chevron-down" : "icon-chevron-right", 14))
    toggleBtn.addEventListener("click", () => {
      if (isExpanded) expandedGroups.delete(group.id); else expandedGroups.add(group.id)
      paintBody()
    })
    head.appendChild(toggleBtn)

    if (renamingGroupId === group.id) {
      const renameInput = el("input", { class: "input flow-group-rename-input", value: renamingName })
      renameInput.addEventListener("input", () => { renamingName = renameInput.value })
      renameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleRenameGroup(group.id)
        if (e.key === "Escape") { renamingGroupId = null; paintBody() }
      })
      head.appendChild(renameInput)
      const okBtn = el("button", { class: "flow-group-icon-btn" }); okBtn.appendChild(svgIcon("icon-check", 12))
      okBtn.addEventListener("click", () => handleRenameGroup(group.id))
      const xBtn = el("button", { class: "flow-group-icon-btn" }); xBtn.appendChild(svgIcon("icon-x", 12))
      xBtn.addEventListener("click", () => { renamingGroupId = null; paintBody() })
      head.appendChild(okBtn); head.appendChild(xBtn)
      setTimeout(() => renameInput.focus(), 0)
    } else {
      head.appendChild(el("span", { class: "flow-group-name" }, group.name))
      head.appendChild(el("span", { class: "flow-group-count" }, String(members.length)))
      const totalsWrap = el("div", { class: "flow-group-totals" })
      for (const [c, amt] of Object.entries(totalsByCurrency(members))) {
        totalsWrap.appendChild(el("span", {}, `${formatAmount(amt, c)} ${c}`))
      }
      head.appendChild(totalsWrap)
      const renameBtn = el("button", { class: "flow-group-icon-btn", title: "Renombrar" })
      renameBtn.appendChild(svgIcon("icon-pencil", 12))
      renameBtn.addEventListener("click", () => { renamingGroupId = group.id; renamingName = group.name; paintBody() })
      const delBtn = el("button", { class: "flow-group-icon-btn flow-group-icon-danger", title: "Eliminar grupo" })
      delBtn.appendChild(svgIcon("icon-trash", 12))
      delBtn.addEventListener("click", () => handleDeleteGroup(group.id))
      head.appendChild(renameBtn); head.appendChild(delBtn)
    }
    box.appendChild(head)

    if (isExpanded) {
      const memberHead = el("div", { class: "flow-group-members-header" })
      memberHead.appendChild(el("div", { style: "flex:1;" }, "Descripción"))
      memberHead.appendChild(el("div", { class: "flow-group-member-amount-head" }, "Monto"))
      box.appendChild(memberHead)
      if (members.length === 0) {
        box.appendChild(el("div", { class: "hint-text", style: "padding:0.5rem 1rem;" }, "Sin miembros — puedes eliminar este grupo."))
      }
      for (const m of members) {
        const row = el("div", { class: "flow-group-member-row" })
        row.appendChild(el("span", { style: "flex:1;" }, m.name))
        row.appendChild(el("span", { class: "flow-group-member-amount" }, `${formatAmount(m.amount, m.currency)} ${m.currency}`))
        const removeBtn = el("button", { class: "flow-group-icon-btn", title: "Quitar del grupo" })
        removeBtn.appendChild(svgIcon("icon-x", 12))
        removeBtn.addEventListener("click", () => handleRemoveFromGroup(group.id, m.id))
        row.appendChild(removeBtn)
        box.appendChild(row)
      }
    }
    container.appendChild(box)
  }

  function paintSelectBar(container) {
    const bar = el("div", { class: "select-bar" })
    bar.appendChild(el("span", { style: "font-weight:600; font-size:0.875rem;" }, `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? "s" : ""}`))

    const targetSelect = el("select", { class: "input" })
    targetSelect.appendChild(el("option", { value: "new" }, "Crear nuevo grupo"))
    for (const g of groups) targetSelect.appendChild(el("option", { value: g.id }, g.name))
    targetSelect.value = groupTarget
    targetSelect.addEventListener("change", () => { groupTarget = targetSelect.value; paintBody() })
    bar.appendChild(targetSelect)

    if (groupTarget === "new") {
      const nameInput = el("input", { class: "input", placeholder: "Nombre del grupo...", value: groupName })
      nameInput.addEventListener("input", () => { groupName = nameInput.value; actionBtn.disabled = !groupName.trim() })
      nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleGroupAction() })
      bar.appendChild(nameInput)
    }

    const actionBtn = el("button", { class: "btn btn-primary" }, groupTarget === "new" ? "Crear" : "Asignar")
    actionBtn.disabled = groupTarget === "new" && !groupName.trim()
    actionBtn.addEventListener("click", handleGroupAction)
    bar.appendChild(actionBtn)

    container.appendChild(bar)
  }

  function paintSection(label, rows) {
    const section = el("div", { class: "flow-section" })
    section.appendChild(el("div", { class: "flow-section-header" }, label))

    const tableHead = el("div", { class: "flow-table-header" })
    tableHead.appendChild(el("div", { style: "flex:1;" }, "Descripción"))
    tableHead.appendChild(el("div", { class: "flow-col-amount" }, "Monto"))
    tableHead.appendChild(el("div", { class: "flow-col-source" }, "Fuente"))
    tableHead.appendChild(el("div", { class: "flow-col-date" }, "Fecha"))
    tableHead.appendChild(el("div", { class: "flow-col-actions" }))
    section.appendChild(tableHead)

    for (const item of rows) section.appendChild(paintRow(item))
    return section
  }

  function paintRow(item) {
    const wrapEl = el("div", { class: item.status !== "ACTIVE" ? "flow-row-wrap is-inactive" : "flow-row-wrap" })
    const marker = markerMap[item.id] ?? null
    const row = el("div", {
      class: "flow-row",
      style: marker ? `border-left: 4px solid ${marker.color}; background-color: ${marker.color}18;` : "",
    })

    if (selectMode) {
      const cb = el("input", { type: "checkbox", checked: selectedIds.has(item.id) })
      cb.addEventListener("change", () => {
        if (selectedIds.has(item.id)) selectedIds.delete(item.id); else selectedIds.add(item.id)
        paintBody()
      })
      const cbWrap = el("label", { class: "flow-row-checkbox" })
      cbWrap.appendChild(cb)
      row.appendChild(cbWrap)
    } else {
      const expandBtn = el("button", { class: "flow-row-expand", title: cfg.linksToggleTitle })
      expandBtn.appendChild(svgIcon(expandedLinks.has(item.id) ? "icon-chevron-down" : "icon-chevron-right", 14))
      expandBtn.addEventListener("click", () => {
        if (expandedLinks.has(item.id)) expandedLinks.delete(item.id); else expandedLinks.add(item.id)
        paintBody()
      })
      row.appendChild(expandBtn)
    }

    const nameCol = el("div", { class: "flow-row-name-col" })
    nameCol.appendChild(el("span", { style: "font-weight:500;" }, item.name))
    if (item.status === "HISTORICAL") nameCol.appendChild(el("span", { class: "status-chip" }, "HISTÓRICO"))
    if (item.status === "ARCHIVED") nameCol.appendChild(el("span", { class: "status-chip" }, "ARCHIVADO"))
    row.appendChild(nameCol)

    row.appendChild(el("div", { class: "flow-col-amount" }, `${formatAmount(item.amount, item.currency)} ${item.currency}`))

    const sourceCol = el("div", { class: "flow-col-source" })
    sourceCol.appendChild(cfg.sourceBadge(item.source))
    row.appendChild(sourceCol)

    row.appendChild(el("div", { class: "flow-col-date" }, formatDate(item.operationDate)))

    const actionsCol = el("div", { class: "flow-col-actions" })
    const markerBtn = el("button", { class: "marker-trigger", title: "Marcador" })
    const dot = el("span", { class: "marker-trigger-dot" })
    if (marker) { dot.style.background = marker.color; dot.style.borderColor = marker.color }
    markerBtn.appendChild(dot)
    markerBtn.addEventListener("click", () => {
      openMarkerPicker(markerBtn, {
        entityId: item.id, entityType: "RECORD", currentMarker: marker,
        onChanged: () => refreshMarkers(items.map((x) => x.id)).then(paintBody),
      })
    })
    actionsCol.appendChild(markerBtn)

    if (item.status === "ACTIVE") {
      const editBtn = el("button", { class: "flow-row-icon-btn", title: "Editar" })
      editBtn.appendChild(svgIcon("icon-pencil", 12))
      editBtn.addEventListener("click", () => {
        openEditOrVersionDialog({
          recordId: item.id, recordType: cfg.kind,
          initialName: item.name, initialAmount: item.amount, initialCurrency: item.currency,
          onSaved: () => fetchItems(),
        })
      })
      actionsCol.appendChild(editBtn)
      const archiveBtn = el("button", { class: "flow-row-text-btn" }, "Archivar")
      archiveBtn.addEventListener("click", () => handleArchive(item.id))
      actionsCol.appendChild(archiveBtn)
    } else {
      const restoreBtn = el("button", { class: "flow-row-text-btn" }, "Restaurar")
      restoreBtn.addEventListener("click", () => handleRestore(item.id))
      actionsCol.appendChild(restoreBtn)
    }
    row.appendChild(actionsCol)

    wrapEl.appendChild(row)
    if (expandedLinks.has(item.id)) {
      wrapEl.appendChild(createLinksPanel(cfg.kind, item.id, item.currency))
    }
    return wrapEl
  }

  paintHeaderActions()
  paintStatusBar()
  await fetchItems()

  return () => {}
}
