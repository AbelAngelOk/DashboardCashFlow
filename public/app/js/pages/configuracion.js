// Portado desde app/(dashboard)/configuracion/page.tsx +
// asset-categories-settings.tsx + marker-manager-dialog.tsx + cutoff-settings.tsx.
//
// Cada seccion administra su propio re-render: cambiar el dia de corte no
// reconstruye la seccion de categorias, tipear una tasa no reconstruye nada
// (el input ya refleja lo tipeado; solo se llama updateRate()).

import { apiGet, apiPost, apiPatch, apiDelete, invalidateCache, ApiError } from "../api.js"
import { el, mount, clear } from "../dom.js"
import { createSwitch } from "../dom.js"
import { toast } from "../toast.js"
import { currencies } from "../lib/finance.js"
import { TAILWIND_COLORS } from "../lib/colors.js"
import {
  getSettings,
  updateSettings,
  updateRate,
  fetchExchangeRates,
  isFetchingRates,
  onSettingsChange,
} from "../settings.js"

const MIN_CUTOFF_DAY = 1
const MAX_CUTOFF_DAY = 28

function errorMessage(e) {
  return e instanceof ApiError || e instanceof Error ? e.message : "Error desconocido"
}

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// ── Seccion: Dashboard (monedas) ────────────────────────────────────────────

function renderDashboardSection(container) {
  const panel = el("div", { class: "panel" })
  panel.appendChild(el("div", { class: "panel-header" }, "Dashboard"))
  const body = el("div", { class: "settings-body" })
  panel.appendChild(body)
  container.appendChild(panel)

  const paint = () => {
    clear(body)
    const s = getSettings()

    const row = el("div", { class: "switch-row" })
    const text = el("div")
    text.appendChild(el("p", { class: "switch-label" }, "Convertir divisas al calcular"))
    text.appendChild(el("p", { class: "switch-desc" }, "Consolida totales en una moneda base usando tasas de cambio."))
    row.appendChild(text)
    row.appendChild(createSwitch(s.convertCurrencies, (v) => updateSettings({ convertCurrencies: v }), "Convertir divisas"))
    body.appendChild(row)

    if (s.convertCurrencies) body.appendChild(renderCurrencyDetail(s))
  }

  paint()
  // Sin desuscribir esto, cada visita a la pagina apilaria un listener mas
  // (settings.js vive fuera del ciclo de vida de la pagina). El router llama
  // a la limpieza que devuelve render() al navegar afuera.
  return onSettingsChange(paint)
}

function renderCurrencyDetail(s) {
  const wrap = el("div", { class: "settings-indented" })

  // Moneda base
  const baseRow = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:1rem;" })
  baseRow.appendChild(el("p", { class: "switch-label" }, "Moneda base"))
  const baseSelect = el("select", { class: "input", style: "width:7rem; height:2rem;" })
  for (const c of currencies) {
    const opt = el("option", { value: c }, c)
    if (c === s.baseCurrency) opt.selected = true
    baseSelect.appendChild(opt)
  }
  baseSelect.addEventListener("change", () => updateSettings({ baseCurrency: baseSelect.value }))
  baseRow.appendChild(baseSelect)
  wrap.appendChild(baseRow)

  // Tasas de cambio
  const ratesBlock = el("div", { style: "display:flex; flex-direction:column; gap:0.5rem;" })
  const ratesHeader = el("div", { style: "display:flex; align-items:center; justify-content:space-between;" })
  ratesHeader.appendChild(el("p", { class: "switch-label" }, `Tasas de cambio (relativas a ${s.baseCurrency})`))
  const refreshBtn = el("button", { class: "hint-text", style: "display:flex; align-items:center; gap:0.25rem;" })
  refreshBtn.appendChild(el("span", { class: isFetchingRates() ? "spinner" : "" }, isFetchingRates() ? "" : "↻"))
  refreshBtn.appendChild(el("span", {}, "Actualizar"))
  refreshBtn.disabled = isFetchingRates()
  refreshBtn.addEventListener("click", () => fetchExchangeRates())
  ratesHeader.appendChild(refreshBtn)
  ratesBlock.appendChild(ratesHeader)

  const list = el("div", { class: "rates-list" })

  const baseRateRow = el("div", { class: "rate-row" })
  baseRateRow.appendChild(el("span", { class: "rate-currency" }, s.baseCurrency))
  const baseWrap = el("div", { class: "rate-input-wrap" })
  const baseInput = el("input", { class: "input rate-input", type: "number", value: "1", disabled: true })
  baseWrap.appendChild(baseInput)
  baseWrap.appendChild(el("span", { class: "rate-suffix" }, s.baseCurrency))
  baseRateRow.appendChild(baseWrap)
  list.appendChild(baseRateRow)

  for (const c of currencies) {
    if (c === s.baseCurrency) continue
    const row = el("div", { class: "rate-row" })
    row.appendChild(el("span", { class: "rate-currency" }, c))
    const iwrap = el("div", { class: "rate-input-wrap" })
    const input = el("input", {
      class: "input rate-input", type: "number", step: "any", min: "0",
      value: String(s.exchangeRates[c] ?? ""),
    })
    input.addEventListener("change", () => {
      const v = parseFloat(input.value)
      if (!isNaN(v) && v > 0) updateRate(c, v)
    })
    iwrap.appendChild(input)
    iwrap.appendChild(el("span", { class: "rate-suffix" }, s.baseCurrency))
    row.appendChild(iwrap)
    list.appendChild(row)
  }
  ratesBlock.appendChild(list)

  if (s.ratesLastUpdated) {
    ratesBlock.appendChild(el("p", { class: "hint-text" }, `Última actualización: ${s.ratesLastUpdated}`))
  }
  wrap.appendChild(ratesBlock)

  // Mostrar montos convertidos
  const convRow = el("div", { class: "switch-row" })
  const convText = el("div")
  convText.appendChild(el("p", { class: "switch-label" }, "Convertir montos a moneda base"))
  convText.appendChild(el("p", { class: "switch-desc" }, "Muestra cada registro en la moneda base (solo visual, no modifica los datos)."))
  convRow.appendChild(convText)
  convRow.appendChild(createSwitch(s.showConvertedAmounts, (v) => updateSettings({ showConvertedAmounts: v }), "Convertir montos"))
  wrap.appendChild(convRow)

  return wrap
}

// ── Seccion: Categorias de Activo ───────────────────────────────────────────

function renderCategoriesSection(container) {
  const panel = el("div", { class: "panel", "data-testid": "asset-categories-settings" })
  panel.appendChild(el("div", { class: "panel-header" }, "Categorías de Activo"))
  const body = el("div", { class: "settings-body" })
  panel.appendChild(body)
  container.appendChild(panel)

  let categories = []
  let counts = {}
  let editingId = null
  let busy = false

  async function load() {
    try {
      const data = await apiGet("/api/categories?counts=1")
      categories = data.categories
      counts = data.counts
    } catch {
      categories = []
      counts = {}
    }
    paint()
  }

  async function guard(fn, errorTitle) {
    busy = true
    try {
      await fn()
      invalidateCache("/api/categories")
      await load()
    } catch (e) {
      toast({ variant: "destructive", title: errorTitle, description: errorMessage(e) })
    } finally {
      busy = false
    }
  }

  function paint() {
    clear(body)
    body.appendChild(el("p", { class: "hint-text" },
      "Las categorías son solo etiquetas para organizar la lista. No definen ningún comportamiento: " +
      "lo que un activo puede hacer se configura activo por activo."))

    if (categories.length === 0) {
      body.appendChild(el("p", { class: "state-message" }, "Todavía no hay categorías. Creá la primera abajo."))
    }

    const list = el("div", { style: "display:flex; flex-direction:column;" })
    for (const c of categories) {
      list.appendChild(editingId === c.id ? renderEditingRow(c) : renderCategoryRow(c))
    }
    body.appendChild(list)
    body.appendChild(renderAddRow())
  }

  function renderCategoryRow(c) {
    const row = el("div", { style: "display:flex; align-items:center; gap:0.5rem; border-bottom:1px solid var(--gray-200); padding:0.5rem 0; font-size:0.875rem;" })
    row.appendChild(el("span", { style: "flex:1; font-weight:500;" }, c.name))
    const n = counts[c.id] ?? 0
    row.appendChild(el("span", { class: "hint-text" }, `${n} activo${n === 1 ? "" : "s"}`))

    const rename = el("button", { class: "btn-icon", title: "Renombrar" }, "✎")
    rename.disabled = busy
    rename.addEventListener("click", () => { editingId = c.id; paint() })
    row.appendChild(rename)

    const del = el("button", { class: "btn-icon", title: "Eliminar" }, "✕")
    del.disabled = busy
    del.addEventListener("click", () => {
      const msg = n > 0
        ? `¿Eliminar "${c.name}"? ${n} activo${n === 1 ? "" : "s"} quedará${n === 1 ? "" : "n"} sin categoría. Los activos NO se eliminan.`
        : `¿Eliminar la categoría "${c.name}"?`
      if (!confirm(msg)) return
      guard(() => apiDelete(`/api/categories/${c.id}`), "No se pudo eliminar la categoría")
    })
    row.appendChild(del)
    return row
  }

  function renderEditingRow(c) {
    const row = el("div", { style: "display:flex; align-items:center; gap:0.5rem; border-bottom:1px solid var(--gray-200); padding:0.5rem 0;" })
    const input = el("input", { class: "input", style: "flex:1; height:2rem;", value: c.name })
    const commit = () => {
      const name = input.value.trim()
      editingId = null
      if (!name || name === c.name) { paint(); return }
      guard(() => apiPatch(`/api/categories/${c.id}`, { name }), "No se pudo renombrar la categoría")
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit()
      if (e.key === "Escape") { editingId = null; paint() }
    })
    row.appendChild(input)
    const ok = el("button", { class: "btn-icon" }, "✓")
    ok.addEventListener("click", commit)
    row.appendChild(ok)
    const cancel = el("button", { class: "btn-icon" }, "✕")
    cancel.addEventListener("click", () => { editingId = null; paint() })
    row.appendChild(cancel)
    setTimeout(() => input.focus(), 0)
    return row
  }

  function renderAddRow() {
    const row = el("div", { style: "display:flex; gap:0.5rem; padding-top:0.25rem;" })
    const input = el("input", { class: "input", style: "flex:1; height:2rem;", placeholder: "Nueva categoría — ej: Inmuebles" })
    const add = () => {
      const name = input.value.trim()
      if (!name) return
      guard(() => apiPost("/api/categories", { name }), "No se pudo crear la categoría").then(() => { input.value = "" })
    }
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add() })
    row.appendChild(input)
    const btn = el("button", { class: "btn btn-primary" }, "+ Agregar")
    btn.addEventListener("click", add)
    row.appendChild(btn)
    return row
  }

  load()
}

// ── Seccion: Marcadores ─────────────────────────────────────────────────────

function renderMarkersSection(container) {
  const panel = el("div", { class: "panel" })
  panel.appendChild(el("div", { class: "panel-header" }, "Marcadores Visuales"))
  const body = el("div", { style: "display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem;" })
  body.appendChild(el("p", { style: "font-size:0.875rem; color:var(--gray-600);" }, "Creá marcadores de colores para resaltar entidades importantes."))
  const openBtn = el("button", { class: "btn btn-primary" }, "Gestionar marcadores")
  openBtn.addEventListener("click", () => openMarkerDialog())
  body.appendChild(openBtn)
  panel.appendChild(body)
  container.appendChild(panel)
}

let markerDialogEl = null

function openMarkerDialog() {
  if (!markerDialogEl) {
    markerDialogEl = el("dialog", { class: "modal" })
    document.body.appendChild(markerDialogEl)
  }
  paintMarkerDialog()
  markerDialogEl.showModal() // este si es modal a proposito: bloquea el resto mientras se gestiona
}

async function paintMarkerDialog() {
  clear(markerDialogEl)
  markerDialogEl.appendChild(el("div", { class: "modal-header" }, "Gestionar marcadores"))

  // Estructura fija: se crea UNA vez. Solo "body" se vacia y repinta en cada
  // reload (crear/reordenar/eliminar) -- footer y header nunca se duplican.
  const body = el("div", { class: "modal-body" })
  const footer = el("div", { class: "modal-footer" })
  const closeBtn = el("button", { class: "btn" }, "Cerrar")
  closeBtn.addEventListener("click", () => markerDialogEl.close())
  footer.appendChild(closeBtn)

  markerDialogEl.appendChild(body)
  markerDialogEl.appendChild(footer)
  body.appendChild(el("p", { class: "hint-text" }, "Cargando..."))

  let markers = []
  try {
    markers = (await apiGet("/api/markers")).markers
  } catch (e) {
    clear(body)
    body.appendChild(el("p", { class: "state-message is-error" }, "No se pudieron cargar los marcadores."))
    return
  }

  let newColor = TAILWIND_COLORS[5].value // Red, mismo default que el original

  const repaint = () => renderMarkerDialogBody(body, markers, newColor, (c) => { newColor = c })
  repaint()

  async function reload() {
    markers = (await apiGet("/api/markers", { fresh: true })).markers
    repaint()
  }

  markerDialogEl._reload = reload
}

function renderMarkerDialogBody(body, markers, selectedColor, onColorPick) {
  clear(body)

  if (markers.length === 0) {
    body.appendChild(el("p", { class: "hint-text" }, "No hay marcadores creados."))
  } else {
    const list = el("div", { style: "display:flex; flex-direction:column; gap:0.25rem;" })
    markers.forEach((m, idx) => {
      const row = el("div", { class: "marker-row" })
      const dot = el("span", { class: "marker-dot" })
      dot.style.backgroundColor = m.color
      row.appendChild(dot)
      row.appendChild(el("span", { class: "marker-name" }, m.name))

      const actions = el("div", { class: "marker-actions" })
      const up = el("button", { class: "btn-icon" }, "↑")
      up.disabled = idx === 0
      up.addEventListener("click", () => moveMarker(markers, idx, -1))
      actions.appendChild(up)

      const down = el("button", { class: "btn-icon" }, "↓")
      down.disabled = idx === markers.length - 1
      down.addEventListener("click", () => moveMarker(markers, idx, 1))
      actions.appendChild(down)

      const del = el("button", { class: "btn-icon" }, "✕")
      del.addEventListener("click", async () => {
        try {
          await apiDelete(`/api/markers/${m.id}`)
          await markerDialogEl._reload()
        } catch (e) {
          toast({ variant: "destructive", title: "No se pudo eliminar el marcador", description: errorMessage(e) })
        }
      })
      actions.appendChild(del)

      row.appendChild(actions)
      list.appendChild(row)
    })
    body.appendChild(list)
  }

  const newBlock = el("div", { style: "border-top:1px solid var(--gray-200); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.5rem;" })
  newBlock.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "Nuevo marcador"))

  const inputRow = el("div", { style: "display:flex; gap:0.5rem; align-items:center;" })
  const nameInput = el("input", { class: "input", style: "flex:1;", placeholder: "Nombre" })
  inputRow.appendChild(nameInput)
  const preview = el("div", { style: `width:2.25rem; height:2.25rem; border-radius:50%; border:2px solid var(--black); background:${selectedColor};` })
  inputRow.appendChild(preview)
  newBlock.appendChild(inputRow)

  const grid = el("div", { class: "color-grid" })
  for (const color of TAILWIND_COLORS) {
    const swatch = el("button", { class: `color-swatch${color.value === selectedColor ? " selected" : ""}`, title: color.name, type: "button" })
    swatch.style.backgroundColor = color.value
    swatch.addEventListener("click", () => {
      onColorPick(color.value)
      preview.style.background = color.value
      grid.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"))
      swatch.classList.add("selected")
    })
    grid.appendChild(swatch)
  }
  newBlock.appendChild(grid)

  const createBtn = el("button", { class: "btn btn-primary", style: "width:100%;" }, "+ Crear marcador")
  const doCreate = async () => {
    const name = nameInput.value.trim()
    if (!name) return
    createBtn.disabled = true
    try {
      await apiPost("/api/markers", { name, color: selectedColor, order: markers.length })
      nameInput.value = ""
      await markerDialogEl._reload()
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo crear el marcador", description: errorMessage(e) })
    } finally {
      createBtn.disabled = false
    }
  }
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doCreate() })
  createBtn.addEventListener("click", doCreate)
  newBlock.appendChild(createBtn)

  body.appendChild(newBlock)
}

async function moveMarker(markers, idx, dir) {
  const otherIdx = idx + dir
  if (otherIdx < 0 || otherIdx >= markers.length) return
  const a = markers[idx]
  const b = markers[otherIdx]
  try {
    await Promise.all([
      apiPatch(`/api/markers/${a.id}`, { order: b.order }),
      apiPatch(`/api/markers/${b.id}`, { order: a.order }),
    ])
    await markerDialogEl._reload()
  } catch (e) {
    toast({ variant: "destructive", title: "No se pudo reordenar", description: errorMessage(e) })
  }
}

// ── Seccion: Corte Mensual ───────────────────────────────────────────────────

function renderCutoffSection(container) {
  const panel = el("div", { class: "panel", "data-testid": "cutoff-settings" })
  panel.appendChild(el("div", { class: "panel-header" }, "Corte Mensual"))
  const body = el("div", { class: "settings-body" })
  panel.appendChild(body)
  container.appendChild(panel)

  let status = null
  let saving = false

  async function load() {
    try {
      status = (await apiGet("/api/cutoff")).status
    } catch {
      status = null
    }
    paint()
  }

  function paint() {
    clear(body)

    const row = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:1rem;" })
    const text = el("div")
    text.appendChild(el("p", { class: "switch-label" }, "Día de corte"))
    text.appendChild(el("p", { class: "switch-desc" },
      "El período va del día elegido de un mes al mismo día del siguiente. Se limita a 28 para que exista en todos los meses."))
    row.appendChild(text)

    const control = el("div", { style: "display:flex; align-items:center; gap:0.5rem;" })
    if (saving) control.appendChild(el("span", { class: "spinner" }))
    const select = el("select", { class: "input", style: "width:5rem; height:2rem;" })
    select.disabled = !status || saving
    for (let d = MIN_CUTOFF_DAY; d <= MAX_CUTOFF_DAY; d++) {
      const opt = el("option", { value: String(d) }, String(d))
      if (status && status.cutoffDay === d) opt.selected = true
      select.appendChild(opt)
    }
    select.addEventListener("change", async () => {
      const day = Number(select.value)
      saving = true
      paint()
      try {
        await apiPatch("/api/cutoff", { cutoffDay: day })
        await load()
        toast({ title: "Día de corte actualizado", description: `El corte pasa a habilitarse el día ${day} de cada mes.` })
      } catch (e) {
        toast({ variant: "destructive", title: "No se pudo guardar el día de corte", description: errorMessage(e) })
      } finally {
        saving = false
        paint()
      }
    })
    control.appendChild(select)
    row.appendChild(control)
    body.appendChild(row)

    if (status) {
      const info = el("div", { style: "border-top:1px solid var(--gray-200); padding-top:0.75rem; font-size:0.75rem; display:flex; flex-direction:column; gap:2px;" })
      const infoRow = (label, value) => {
        const r = el("div", { style: "display:flex; justify-content:space-between;" })
        r.appendChild(el("span", { style: "color:var(--gray-600);" }, label))
        r.appendChild(el("span", { style: "font-weight:600;" }, value))
        return r
      }
      info.appendChild(infoRow("Último corte", status.lastCutoffPeriod
        ? `${status.lastCutoffPeriod} · ${formatDate(status.lastCutoffAt)}` : "Ninguno todavía"))
      info.appendChild(infoRow("Período pendiente", status.available
        ? `${status.pendingPeriodLabel} · disponible desde ${formatDate(status.pendingSince)}` : "Ninguno"))
      info.appendChild(infoRow("Próximo corte", formatDate(status.nextCutoffAt)))
      body.appendChild(info)
    }

    body.appendChild(el("p", { class: "hint-text" },
      "El corte nunca se ejecuta solo: cuando corresponde, aparece un aviso en el Dashboard y el botón «Realizar corte de mes»."))
  }

  load()
}

// ── Entrada de la pagina ─────────────────────────────────────────────────────

export async function render(main) {
  clear(main)
  const wrap = el("div", { style: "max-width:36rem; margin:0 auto;" })
  wrap.appendChild(el("h1", { class: "settings-title" }, "Personalización"))
  mount(main, wrap)

  const dashboardSection = el("div", { class: "settings-section" })
  wrap.appendChild(dashboardSection)
  const unsubscribeSettings = renderDashboardSection(dashboardSection)

  const categoriesSection = el("div", { class: "settings-section" })
  wrap.appendChild(categoriesSection)
  renderCategoriesSection(categoriesSection)

  const markersSection = el("div", { class: "settings-section" })
  wrap.appendChild(markersSection)
  renderMarkersSection(markersSection)

  const cutoffSection = el("div", { class: "settings-section" })
  wrap.appendChild(cutoffSection)
  renderCutoffSection(cutoffSection)

  return () => {
    unsubscribeSettings()
    if (markerDialogEl) { markerDialogEl.remove(); markerDialogEl = null }
  }
}
