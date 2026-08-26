// Portado desde el componente interno SectionTable de components/dashboard-sheet.tsx
// (~600 de las 1250 líneas del original). Reutilizado por el Dashboard en
// vivo y por la vista de solo lectura de un snapshot (`readOnly: true`).
//
// El original recibe 7 callbacks (onCreate/onEdit/onDelete/onGroupAdjust/...)
// desde su padre porque en React conviene mantener DashboardSheet como
// componente puro de presentación. Acá no hay ventaja real en esa
// indirección — este módulo solo se usa desde dos lugares (dashboard en vivo
// y snapshot de solo lectura) y ninguno necesita testear la tabla por
// separado de sus efectos — así que llama a la API directamente y expone un
// único `onChanged()` para que el caller recargue todo.

import { apiPost, apiPatch, apiDelete } from "../api.js"
import { el, clear, createDialog, createSwitch, svgIcon } from "../dom.js"
import { formatAmount, currencies, defaultCurrency, recordTypeLabels, computeGroupValue } from "../lib/finance.js"
import { fetchEntityMarkers } from "../lib/markers.js"
import { openMarkerPicker } from "./marker-picker.js"
import { getSettings } from "../settings.js"

function now() {
  return new Date().toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function buildMovement(action, record, detail) {
  return { id: crypto.randomUUID(), date: now(), action, recordType: record.type, recordName: record.name, detail, comment: "" }
}

async function dbCreateRecord(record) {
  const detail = `${recordTypeLabels[record.type]} "${record.name}" por ${formatAmount(record.amount, record.currency)} ${record.currency}`
  await apiPost("/api/records", { record, movement: buildMovement("creado", record, detail) })
}

async function dbEditRecord(record, previous) {
  const changes = []
  if (previous.name !== record.name) changes.push(`nombre: "${previous.name}" → "${record.name}"`)
  if (previous.amount !== record.amount || previous.currency !== record.currency) {
    changes.push(`monto: ${formatAmount(previous.amount, previous.currency)} ${previous.currency} → ${formatAmount(record.amount, record.currency)} ${record.currency}`)
  }
  const detail = changes.length ? changes.join(", ") : "sin cambios de valor"
  await apiPatch("/api/records", { record, movement: buildMovement("editado", record, detail) })
}

async function dbDeleteRecord(record) {
  const detail = `${recordTypeLabels[record.type]} "${record.name}" (${formatAmount(record.amount, record.currency)} ${record.currency})`
  await apiDelete("/api/records", { record, movement: buildMovement("eliminado", record, detail) })
}

function totalsBlockNode(records) {
  const { convertCurrencies, baseCurrency, exchangeRates } = getSettings()
  if (convertCurrencies) {
    const total = records.reduce((s, r) => {
      const rate = exchangeRates[r.currency] ?? 1
      const rateBase = exchangeRates[baseCurrency] ?? 1
      return s + (r.amount * rate) / rateBase
    }, 0)
    return el("span", {}, `${formatAmount(total, baseCurrency)} ${baseCurrency}`)
  }
  const totals = {}
  for (const r of records) totals[r.currency] = (totals[r.currency] ?? 0) + r.amount
  const active = Object.keys(totals).filter((c) => totals[c] !== 0)
  if (active.length === 0) return el("span", {}, "—")
  const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; gap:0.125rem;" })
  for (const c of active) wrap.appendChild(el("span", {}, `${formatAmount(totals[c], c)} ${c}`))
  return wrap
}

function recordAmountNode(record) {
  const { convertCurrencies, showConvertedAmounts, baseCurrency, exchangeRates } = getSettings()
  if (convertCurrencies && showConvertedAmounts && record.currency !== baseCurrency) {
    const rate = exchangeRates[record.currency] ?? 1
    const rateBase = exchangeRates[baseCurrency] ?? 1
    const converted = (record.amount * rate) / rateBase
    const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; line-height:1.2;" })
    wrap.appendChild(el("span", {}, `${formatAmount(converted, baseCurrency)} ${baseCurrency}`))
    wrap.appendChild(el("span", { style: "font-size:0.625rem; color:var(--gray-400);" }, `${formatAmount(record.amount, record.currency)} ${record.currency}`))
    return wrap
  }
  return el("span", {}, `${formatAmount(record.amount, record.currency)} ${record.currency}`)
}

function groupValueNode(children) {
  const { convertCurrencies, baseCurrency, exchangeRates } = getSettings()
  const result = computeGroupValue(children, convertCurrencies, baseCurrency, exchangeRates)
  if (result.type === "single") return el("span", {}, `${formatAmount(result.value, result.currency)} ${result.currency}`)
  const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; gap:0.125rem;" })
  for (const { currency, value } of result.entries) wrap.appendChild(el("span", { style: "font-size:0.75rem;" }, `${formatAmount(value, currency)} ${currency}`))
  return wrap
}

/** @param {object} opts ver comentario de cabecera */
export function renderSectionTable(opts) {
  const { type, records, allRecords, readOnly } = opts
  const newRows = []
  let editingId = null
  let editDraft = null
  let nameError = null
  const expandedGroupIds = new Set()
  let markerMap = {}

  const hasLink = Boolean(opts.linkType)
  const isActivo = type === "activo"
  const linkOptions = opts.linkType ? allRecords.filter((r) => r.type === opts.linkType) : []
  const getLinkedName = (id) => (id ? allRecords.find((r) => r.id === id)?.name ?? "—" : "—")
  const getGroupChildren = (parentId) => allRecords.filter((r) => r.parentId === parentId)

  const testId = type === "ingreso" ? "dashboard-income-table" : type === "gasto" ? "dashboard-expense-table" : type === "activo" ? "dashboard-assets-table" : "dashboard-liabilities-table"
  const panel = el("div", { class: "panel", "data-testid": testId })

  async function refreshMarkers() {
    if (readOnly) return
    markerMap = await fetchEntityMarkers(records.map((r) => r.id), "RECORD")
  }

  function paint() {
    clear(panel)

    const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
    header.appendChild(el("span", {}, opts.title))
    if (!readOnly) {
      const addBtn = el("button", { style: "border:none; background:none; color:var(--white); padding:0.125rem;", "aria-label": `Agregar fila a ${opts.title}` })
      addBtn.appendChild(svgIcon("icon-plus", 16))
      addBtn.addEventListener("click", () => { if (opts.onAddClick) opts.onAddClick(); else { newRows.push(emptyDraft()); paint() } })
      header.appendChild(addBtn)
    }
    panel.appendChild(header)

    const colHead = el("div", { style: "display:flex; border-bottom:1px solid var(--black); background:var(--gray-100); font-size:0.875rem; font-weight:bold;" })
    colHead.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.375rem 0.5rem;" }, "Descripción"))
    colHead.appendChild(el("div", { style: "width:9rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem; text-align:right;" }, opts.valueLabel))
    if (hasLink) colHead.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem; text-align:center;" }, opts.linkLabel))
    if (!readOnly) colHead.appendChild(el("div", { style: "width:5rem; padding:0.375rem 0.25rem; text-align:center;" }, "Acción"))
    panel.appendChild(colHead)

    const groupedIds = new Set()
    if (opts.flowGroups?.length && (type === "gasto" || type === "ingreso")) {
      for (const group of opts.flowGroups) {
        const members = records.filter((r) => group.memberIds.includes(r.id))
        if (members.length === 0) continue
        for (const m of members) groupedIds.add(m.id)
        panel.appendChild(paintFlowGroup(group, members))
      }
    }

    const displayRecords = isActivo ? records.filter((r) => !r.parentId) : records
    for (const record of displayRecords) {
      if (groupedIds.has(record.id)) continue
      panel.appendChild(editingId === record.id ? paintEditRow(record) : paintRow(record))
    }

    for (const row of opts.extraRows ?? []) panel.appendChild(paintExtraRow(row))

    if (!readOnly) for (const row of newRows) panel.appendChild(paintNewRow(row))

    const footer = el("div", { style: "display:flex; align-items:center; border-top:2px solid var(--black); background:var(--gray-100); font-size:0.875rem; font-weight:bold;" })
    footer.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.375rem 0.5rem;" }, `Total ${opts.title}:`))
    const footerValue = el("div", { style: "flex:1; padding:0.375rem 0.5rem; text-align:right;" })
    footerValue.appendChild(totalsBlockNode(opts.totalRecords ?? records))
    footer.appendChild(footerValue)
    panel.appendChild(footer)
  }

  function emptyDraft() { return { id: crypto.randomUUID(), name: "", amount: "", currency: defaultCurrency, linkedTo: "" } }

  function paintFlowGroup(group, members) {
    const isExpanded = expandedGroupIds.has(group.id)
    const wrap = el("div")
    const totals = {}
    for (const r of members) totals[r.currency] = (totals[r.currency] ?? 0) + r.amount

    const head = el("div", { style: "display:flex; border-bottom:1px solid var(--black); background:var(--gray-50); font-size:0.875rem; font-weight:600;" })
    const nameCell = el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.375rem 0.5rem; display:flex; align-items:center; gap:0.25rem;" })
    const toggleBtn = el("button", { style: "border:none; background:none; color:var(--gray-400); flex-shrink:0;" })
    toggleBtn.appendChild(svgIcon(isExpanded ? "icon-chevron-down" : "icon-chevron-right", 14))
    toggleBtn.addEventListener("click", () => { if (isExpanded) expandedGroupIds.delete(group.id); else expandedGroupIds.add(group.id); paint() })
    nameCell.appendChild(toggleBtn)
    nameCell.appendChild(el("span", {}, group.name))
    nameCell.appendChild(el("span", { class: "status-chip" }, String(members.length)))
    head.appendChild(nameCell)
    const totalsCell = el("div", { style: "width:9rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem; text-align:right;" })
    for (const [c, amt] of Object.entries(totals)) totalsCell.appendChild(el("div", { style: "font-size:0.75rem;" }, `${formatAmount(amt, c)} ${c}`))
    head.appendChild(totalsCell)
    if (hasLink) head.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black);" }))
    if (!readOnly) head.appendChild(el("div", { style: "width:5rem;" }))
    wrap.appendChild(head)

    if (isExpanded) {
      for (const member of members) wrap.appendChild(editingId === member.id ? paintEditRow(member) : paintRow(member, true))
    }
    return wrap
  }

  function paintRow(record, indented = false) {
    const marker = markerMap[record.id] ?? null
    const row = el("div", {
      class: `group flex${record.isGroupParent ? " is-group-row" : ""}`,
      style: `display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;${record.isGroupParent ? " background:var(--gray-50);" : ""}${marker ? ` border-left:4px solid ${marker.color}; background-color:${marker.color}18;` : ""}`,
    })

    const nameCell = el("div", { style: `flex:1; border-right:1px solid var(--black); padding:0.375rem 0.5rem;${indented ? " padding-left:2rem; color:var(--gray-600);" : ""}` })
    const nameRow = el("div", { style: "display:flex; align-items:center; gap:0.25rem;" })
    if (record.isGroupParent) {
      const toggleBtn = el("button", { style: "border:none; background:none; color:var(--gray-400); flex-shrink:0;" })
      toggleBtn.appendChild(svgIcon(expandedGroupIds.has(record.id) ? "icon-chevron-down" : "icon-chevron-right", 14))
      toggleBtn.addEventListener("click", () => { if (expandedGroupIds.has(record.id)) expandedGroupIds.delete(record.id); else expandedGroupIds.add(record.id); paint() })
      nameRow.appendChild(toggleBtn)
    }
    nameRow.appendChild(el("span", { style: record.isGroupParent ? "font-weight:600;" : "" }, record.name))
    if (record.isGroupParent) nameRow.appendChild(svgIcon("icon-network", 11))
    nameCell.appendChild(nameRow)
    row.appendChild(nameCell)

    const valueCell = el("div", { style: "width:9rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem; text-align:right;" })
    valueCell.appendChild(record.isGroupParent ? groupValueNode(getGroupChildren(record.id)) : recordAmountNode(record))
    row.appendChild(valueCell)

    if (hasLink) row.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem; text-align:center; font-size:0.75rem; color:var(--gray-500);" }, getLinkedName(record.linkedTo)))

    if (!readOnly) {
      const actionsCell = el("div", { style: "width:5rem; display:flex; align-items:center; justify-content:center; gap:0.25rem; padding:0 0.25rem;" })
      const markerBtn = el("button", { class: "marker-trigger", title: "Marcador" })
      const dot = el("span", { class: "marker-trigger-dot" })
      if (marker) { dot.style.background = marker.color; dot.style.borderColor = marker.color }
      markerBtn.appendChild(dot)
      markerBtn.addEventListener("click", () => {
        openMarkerPicker(markerBtn, { entityId: record.id, entityType: "RECORD", currentMarker: marker, onChanged: () => refreshMarkers().then(paint) })
      })
      actionsCell.appendChild(markerBtn)

      if (isActivo) actionsCell.appendChild(viewLink(`/activos/${record.id}`))
      if (type === "ingreso") actionsCell.appendChild(viewLink(`/ingresos/${record.id}`))
      if (type === "gasto") actionsCell.appendChild(viewLink(`/gastos/${record.id}`))

      if (indented) {
        // hijo de grupo: editar y (si activo) poner en cero
        const editBtn = iconBtn("icon-pencil", () => startEdit(record))
        actionsCell.appendChild(editBtn)
        if (isActivo && record.amount !== 0) {
          const zeroBtn = iconBtn("icon-trash", () => openDeleteDialog(record))
          actionsCell.appendChild(zeroBtn)
        }
      } else if (!record.isGroupParent) {
        actionsCell.appendChild(iconBtn("icon-pencil", () => startEdit(record)))
        actionsCell.appendChild(iconBtn("icon-trash", () => handleDeleteClick(record)))
      }
      row.appendChild(actionsCell)
    }

    const wrapEl = el("div")
    wrapEl.appendChild(row)
    if (!indented && record.isGroupParent && expandedGroupIds.has(record.id)) {
      for (const child of getGroupChildren(record.id)) wrapEl.appendChild(editingId === child.id ? paintEditRow(child) : paintRow(child, true))
    }
    return wrapEl
  }

  function viewLink(href) {
    const link = el("a", { href, "data-link": "", class: "flow-row-icon-btn", "aria-label": "Ver" })
    link.appendChild(svgIcon("icon-arrow-right", 12))
    return link
  }
  function iconBtn(icon, onClick) {
    const btn = el("button", { class: "flow-row-icon-btn" })
    btn.appendChild(svgIcon(icon, 12))
    btn.addEventListener("click", onClick)
    return btn
  }

  function startEdit(record) {
    editingId = record.id
    nameError = null
    editDraft = { id: record.id, name: record.name, amount: String(record.amount), currency: record.currency, linkedTo: record.linkedTo ?? "none" }
    paint()
  }
  function cancelEdit() { editingId = null; editDraft = null; nameError = null; paint() }

  function paintEditRow(previous) {
    const wrapEl = el("div", { style: "display:flex; flex-direction:column; border-bottom:1px solid var(--black); font-size:0.875rem;" })
    const row = el("div", { style: "display:flex;" })

    const nameCell = el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
    const nameInput = el("input", { class: "input", style: "height:1.5rem; border:none; padding:0;", value: editDraft.name })
    nameInput.addEventListener("input", () => { editDraft.name = nameInput.value; nameError = null })
    nameCell.appendChild(nameInput)
    row.appendChild(nameCell)

    const amountCell = el("div", { style: "width:9rem; display:flex; align-items:center; gap:0.25rem; border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
    const amountInput = el("input", { class: "input", style: "height:1.5rem; border:none; padding:0; text-align:right; width:5.5rem;", value: editDraft.amount })
    amountInput.addEventListener("input", () => { editDraft.amount = amountInput.value })
    amountCell.appendChild(amountInput)
    const curSelect = el("select", { class: "input", style: "height:1.5rem; border:none; padding:0; font-size:0.75rem;" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = editDraft.currency
    curSelect.addEventListener("change", () => { editDraft.currency = curSelect.value })
    amountCell.appendChild(curSelect)
    row.appendChild(amountCell)

    if (hasLink) {
      const linkCell = el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
      const linkSelect = el("select", { class: "input", style: "height:1.5rem; border:none; padding:0; font-size:0.6875rem;" })
      linkSelect.appendChild(el("option", { value: "none" }, "—"))
      for (const o of linkOptions) linkSelect.appendChild(el("option", { value: o.id }, o.name))
      linkSelect.value = editDraft.linkedTo
      linkSelect.addEventListener("change", () => { editDraft.linkedTo = linkSelect.value })
      linkCell.appendChild(linkSelect)
      row.appendChild(linkCell)
    }

    const actionsCell = el("div", { style: "width:5rem; display:flex; align-items:center; justify-content:center; gap:0.25rem;" })
    const okBtn = iconBtn("icon-check", () => saveEdit(previous))
    const xBtn = iconBtn("icon-x", cancelEdit)
    actionsCell.appendChild(okBtn); actionsCell.appendChild(xBtn)
    row.appendChild(actionsCell)
    wrapEl.appendChild(row)

    if (nameError) wrapEl.appendChild(el("div", { style: "padding:0.25rem 0.5rem; font-size:0.75rem; color:#e11d48;" }, nameError))
    return wrapEl
  }

  async function saveEdit(previous) {
    if (!editDraft.name || !editDraft.amount) return
    if (type === "activo" && editDraft.name !== previous.name) {
      const duplicate = allRecords.some((r) => r.type === "activo" && r.id !== previous.id && r.name === editDraft.name)
      if (duplicate) { nameError = `Ya existe un activo con el nombre "${editDraft.name}"`; paint(); return }
    }
    const updated = {
      id: previous.id, type, name: editDraft.name, amount: Number.parseFloat(editDraft.amount), currency: editDraft.currency,
      linkedTo: editDraft.linkedTo && editDraft.linkedTo !== "none" ? editDraft.linkedTo : undefined,
      parentId: previous.parentId, assetType: previous.assetType, isGroupParent: previous.isGroupParent,
    }
    const amountChanged = updated.amount !== previous.amount

    if (type === "activo" && amountChanged) {
      cancelEdit()
      openEditAmountDialog(updated, previous)
      return
    }
    if (previous.isGroupParent && amountChanged) {
      await groupAdjust(updated, previous)
    } else {
      await dbEditRecord(updated, previous)
    }
    cancelEdit()
    opts.onChanged()
  }

  async function groupAdjust(record, previous) {
    await dbEditRecord(record, previous)
    const diff = record.amount - previous.amount
    await apiPost(`/api/assets/${record.id}/movements`, { movementType: "ADJUSTMENT", amount: diff, currency: record.currency })
  }

  function paintExtraRow(row) {
    const wrapEl = el("div", { style: "display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;" })
    const nameCell = el("div", { style: "flex:1; display:flex; align-items:center; gap:0.5rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem;" })
    const link = el("a", { href: row.href, "data-link": "", style: "font-weight:500; text-decoration:none;" }, row.name)
    nameCell.appendChild(link)
    if (row.paused) nameCell.appendChild(el("span", { class: "status-chip", style: "background:#fef3c7; color:#92400e;" }, "Pausada"))
    wrapEl.appendChild(nameCell)
    const valueCell = el("div", { style: "width:9rem; border-right:1px solid var(--black); padding:0.375rem 0.5rem; text-align:right; font-size:0.875rem;" })
    valueCell.appendChild(row.valueNode)
    wrapEl.appendChild(valueCell)
    if (hasLink) wrapEl.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black);" }))
    if (!readOnly) {
      const actionsCell = el("div", { style: "width:5rem; display:flex; align-items:center; justify-content:center;" })
      actionsCell.appendChild(viewLink(row.href))
      wrapEl.appendChild(actionsCell)
    }
    return wrapEl
  }

  function paintNewRow(row) {
    const wrapEl = el("div", { style: "display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;" })
    const nameCell = el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
    const nameInput = el("input", { class: "input", style: "height:1.5rem; border:none; padding:0;", placeholder: "Descripción..." })
    nameInput.addEventListener("input", () => { row.name = nameInput.value })
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveNewRow(row) })
    nameCell.appendChild(nameInput)
    wrapEl.appendChild(nameCell)

    const amountCell = el("div", { style: "width:9rem; display:flex; align-items:center; gap:0.25rem; border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
    const amountInput = el("input", { class: "input", style: "height:1.5rem; border:none; padding:0; text-align:right; width:5.5rem;", placeholder: "0.00" })
    amountInput.addEventListener("input", () => { row.amount = amountInput.value })
    amountInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveNewRow(row) })
    amountCell.appendChild(amountInput)
    const curSelect = el("select", { class: "input", style: "height:1.5rem; border:none; padding:0; font-size:0.75rem;" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = row.currency
    curSelect.addEventListener("change", () => { row.currency = curSelect.value })
    amountCell.appendChild(curSelect)
    wrapEl.appendChild(amountCell)

    if (hasLink) {
      const linkCell = el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.125rem 0.25rem;" })
      const linkSelect = el("select", { class: "input", style: "height:1.5rem; border:none; padding:0; font-size:0.6875rem;" })
      linkSelect.appendChild(el("option", { value: "none" }, "—"))
      for (const o of linkOptions) linkSelect.appendChild(el("option", { value: o.id }, o.name))
      linkSelect.addEventListener("change", () => { row.linkedTo = linkSelect.value })
      linkCell.appendChild(linkSelect)
      wrapEl.appendChild(linkCell)
    }

    const actionsCell = el("div", { style: "width:5rem; display:flex; align-items:center; justify-content:center; gap:0.25rem;" })
    actionsCell.appendChild(iconBtn("icon-check", () => saveNewRow(row)))
    actionsCell.appendChild(iconBtn("icon-x", () => { newRows.splice(newRows.indexOf(row), 1); paint() }))
    wrapEl.appendChild(actionsCell)

    setTimeout(() => nameInput.focus(), 0)
    return wrapEl
  }

  async function saveNewRow(row) {
    if (!row.name || !row.amount) return
    const record = {
      id: row.id, type, name: row.name, amount: Number.parseFloat(row.amount), currency: row.currency,
      linkedTo: row.linkedTo && row.linkedTo !== "none" ? row.linkedTo : undefined,
    }
    await dbCreateRecord(record)
    newRows.splice(newRows.indexOf(row), 1)
    opts.onChanged()
  }

  function handleDeleteClick(record) {
    if (type === "activo") openDeleteDialog(record)
    else deleteRecordDirect(record)
  }

  async function deleteRecordDirect(record) {
    await dbDeleteRecord(record)
    opts.onChanged()
  }

  function openDeleteDialog(record) {
    const dialog = createDialog()
    let comment = "", createIngreso = false

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Poner activo en cero"))
      const body = el("div", { class: "modal-body" })
      body.appendChild(el("p", { style: "font-size:0.875rem; color:var(--gray-600);" }, `El valor de "${record.name}" pasará a 0. Se registrará un movimiento de Egreso.`))

      const switchRow = el("div", { class: "switch-row" })
      const sw = createSwitch(createIngreso, (v) => { createIngreso = v }, "Crear ingreso asociado")
      switchRow.appendChild(sw)
      switchRow.appendChild(el("span", {}, `Crear ingreso asociado (${formatAmount(record.amount, record.currency)} ${record.currency})`))
      body.appendChild(switchRow)

      const commentField = el("div", { class: "field" })
      commentField.appendChild(el("label", {}, "Comentario (opcional)"))
      const textarea = el("textarea", { class: "input", rows: 2, style: "resize:none;", value: comment })
      textarea.addEventListener("input", () => { comment = textarea.value })
      commentField.appendChild(textarea)
      body.appendChild(commentField)
      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const confirmBtn = el("button", { class: "btn btn-primary" }, "Confirmar")
      confirmBtn.addEventListener("click", async () => {
        dialog.close()
        await apiPost(`/api/assets/${record.id}/zero-out`, {
          previousAmount: record.amount, currency: record.currency, assetName: record.name,
          description: comment || undefined, createIngreso,
        })
        opts.onChanged()
      })
      footer.appendChild(cancelBtn); footer.appendChild(confirmBtn)
      dialog.appendChild(footer)
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  function openEditAmountDialog(record, previous) {
    const dialog = createDialog()
    let comment = "", movementType = "ADJUSTMENT", createGasto = false, createIngreso = false

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Cambiar valor del activo"))
      const body = el("div", { class: "modal-body" })
      const valueLine = el("p", { style: "font-size:0.875rem; color:var(--gray-600);" })
      valueLine.appendChild(document.createTextNode("Nuevo valor: "))
      valueLine.appendChild(el("strong", {}, `${formatAmount(record.amount, record.currency)} ${record.currency}`))
      body.appendChild(valueLine)

      const typeField = el("div", { class: "field" })
      typeField.appendChild(el("label", {}, "Tipo de movimiento"))
      const typeRow = el("div", { style: "display:flex; gap:0.75rem;" })
      const options = [["ADJUSTMENT", "Ajuste"], ["DEPOSIT", "Depósito"], ["EXTRACT", "Egreso"]]
      for (const [value, label] of options) {
        const optLabel = el("label", { style: "display:flex; align-items:center; gap:0.375rem; font-size:0.875rem; cursor:pointer;" })
        const radio = el("input", { type: "radio", name: "dash-movement-type", checked: movementType === value })
        radio.addEventListener("change", () => {
          movementType = value
          if (value !== "DEPOSIT") createGasto = false
          if (value !== "EXTRACT") createIngreso = false
          paintDialog()
        })
        optLabel.appendChild(radio)
        optLabel.appendChild(document.createTextNode(label))
        typeRow.appendChild(optLabel)
      }
      typeField.appendChild(typeRow)
      body.appendChild(typeField)

      if (movementType === "DEPOSIT") {
        const gastoLabel = el("label", { class: "radio-option" })
        const cb = el("input", { type: "checkbox", checked: createGasto })
        cb.addEventListener("change", () => { createGasto = cb.checked })
        gastoLabel.appendChild(cb)
        gastoLabel.appendChild(el("span", {}, "Crear gasto asociado"))
        body.appendChild(gastoLabel)
      }
      if (movementType === "EXTRACT") {
        const ingresoLabel = el("label", { class: "radio-option" })
        const cb = el("input", { type: "checkbox", checked: createIngreso })
        cb.addEventListener("change", () => { createIngreso = cb.checked })
        ingresoLabel.appendChild(cb)
        ingresoLabel.appendChild(el("span", {}, `Crear ingreso asociado ("Venta de ${record.name}")`))
        body.appendChild(ingresoLabel)
      }

      const commentField = el("div", { class: "field" })
      commentField.appendChild(el("label", {}, "Comentario (opcional)"))
      const textarea = el("textarea", { class: "input", rows: 2, style: "resize:none;", value: comment })
      textarea.addEventListener("input", () => { comment = textarea.value })
      commentField.appendChild(textarea)
      body.appendChild(commentField)
      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const confirmBtn = el("button", { class: "btn btn-primary" }, "Confirmar")
      confirmBtn.addEventListener("click", handleConfirm)
      footer.appendChild(cancelBtn); footer.appendChild(confirmBtn)
      dialog.appendChild(footer)
    }

    async function handleConfirm() {
      dialog.close()
      if (record.isGroupParent) {
        await groupAdjust(record, previous)
      } else if (movementType === "EXTRACT") {
        const egressAmount = previous.amount - record.amount
        await apiPost(`/api/assets/${record.id}/extract`, {
          newAmount: record.amount, egressAmount, currency: record.currency, assetName: record.name,
          description: comment || undefined, createIngreso,
        })
      } else {
        await dbEditRecord(record, previous)
        const diff = record.amount - previous.amount
        await apiPost(`/api/assets/${record.id}/movements`, { movementType, amount: diff, currency: record.currency, description: comment || undefined })
        if (movementType === "DEPOSIT" && createGasto) {
          await dbCreateRecord({ id: crypto.randomUUID(), type: "gasto", name: `Depósito en ${record.name}`, amount: diff, currency: record.currency })
        }
      }
      opts.onChanged()
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  refreshMarkers().then(paint)
  if (readOnly) paint()
  return panel
}
