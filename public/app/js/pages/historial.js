// Portado desde app/(dashboard)/historial/{page,content}.tsx +
// hooks/use-historial-filters.ts + use-pagination.ts + use-historial-query.ts.
//
// El punto delicado de esta pagina: los filtros sincronizan con la URL via
// history.replaceState (NO router.navigate) para no disparar un remount
// completo via router.js en cada tecla. Si usara el router normal, escribir
// en el buscador reconstruiria el <input> cada 350ms y el usuario perderia
// el foco a mitad de palabra -- exactamente el tipo de "espera artificial
// provocada por la arquitectura" que el proyecto quiere evitar.
//
// Cancelacion de requests obsoletas: mismo patron reqId que el hook original.

import { apiGet, apiPatch, ApiError, NetworkError } from "../api.js"
import { el, mount, clear, svgIcon } from "../dom.js"
import { recordTypeLabels } from "../lib/finance.js"

const PAGE_SIZES = [10, 25, 50, 100]
const SEARCH_DEBOUNCE_MS = 350
const COMMENT_DEBOUNCE_MS = 600

const ACTION_LABELS = { creado: "Creado", editado: "Editado", eliminado: "Eliminado" }
const RECORD_TYPES = Object.entries(recordTypeLabels) // [["activo","Activo"], ...]

const FILTER_KEYS = ["action", "recordType", "search", "dateFrom", "dateTo"]

function parseStateFromURL() {
  const sp = new URLSearchParams(location.search)
  const page = parseInt(sp.get("page") ?? "1", 10)
  const pageSize = parseInt(sp.get("pageSize") ?? "25", 10)
  return {
    action: sp.get("action") ?? "",
    recordType: sp.get("recordType") ?? "",
    search: sp.get("search") ?? "",
    dateFrom: sp.get("dateFrom") ?? "",
    dateTo: sp.get("dateTo") ?? "",
    page: Number.isNaN(page) || page < 1 ? 1 : page,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : 25,
  }
}

/** Actualiza la URL sin disparar el router (sin remount de la pagina). */
function writeStateToURL(state) {
  const sp = new URLSearchParams()
  for (const k of FILTER_KEYS) if (state[k]) sp.set(k, state[k])
  sp.set("page", String(state.page))
  sp.set("pageSize", String(state.pageSize))
  const qs = sp.toString()
  history.replaceState({}, "", `/app/historial${qs ? `?${qs}` : ""}`)
}

function isFiltered(state) {
  return FILTER_KEYS.some((k) => !!state[k])
}

export async function render(main) {
  clear(main)
  const wrap = el("div", { style: "max-width:48rem; margin:0 auto;" })
  const title = el("h1", { class: "settings-title" })
  title.appendChild(svgIcon("icon-history", 20))
  title.appendChild(document.createTextNode("Historial"))
  wrap.appendChild(title)
  mount(main, wrap)

  let state = parseStateFromURL()
  let reqId = 0
  const commentTimers = new Map()
  let searchDebounceTimer = null

  // ── Filtros (se construyen UNA vez; solo el valor de los controles cambia) ──
  const filterPanel = el("div", { class: "historial-filters" })
  wrap.appendChild(filterPanel)

  const searchInput = el("input", {
    class: "input", placeholder: "Buscar en nombre o detalle...", value: state.search,
  })
  filterPanel.appendChild(wrapField(searchInput))

  const actionSelect = el("select", { class: "input" })
  actionSelect.appendChild(el("option", { value: "" }, "Todas las acciones"))
  for (const [value, label] of Object.entries(ACTION_LABELS)) {
    actionSelect.appendChild(el("option", { value }, label))
  }
  actionSelect.value = state.action
  filterPanel.appendChild(wrapField(actionSelect))

  const typeSelect = el("select", { class: "input" })
  typeSelect.appendChild(el("option", { value: "" }, "Todas las categorías"))
  for (const [value, label] of RECORD_TYPES) {
    typeSelect.appendChild(el("option", { value }, label))
  }
  typeSelect.value = state.recordType
  filterPanel.appendChild(wrapField(typeSelect))

  const dateFromInput = el("input", { class: "input", type: "date", value: state.dateFrom })
  filterPanel.appendChild(wrapField(dateFromInput, "Desde"))

  const dateToInput = el("input", { class: "input", type: "date", value: state.dateTo })
  filterPanel.appendChild(wrapField(dateToInput, "Hasta"))

  const clearBtn = el("button", { class: "btn", style: "display:none;" }, "✕ Limpiar filtros")
  filterPanel.appendChild(clearBtn)

  function syncClearButton() {
    clearBtn.style.display = isFiltered(state) ? "" : "none"
  }
  syncClearButton()

  // ── Resultados + paginacion ──────────────────────────────────────────────
  const resultsBox = el("div")
  wrap.appendChild(resultsBox)
  const paginationBox = el("div")
  wrap.appendChild(paginationBox)

  function applyFilterChange(patch) {
    state = { ...state, ...patch, page: 1 }
    writeStateToURL(state)
    syncClearButton()
    fetchData()
  }

  actionSelect.addEventListener("change", () => applyFilterChange({ action: actionSelect.value }))
  typeSelect.addEventListener("change", () => applyFilterChange({ recordType: typeSelect.value }))
  dateFromInput.addEventListener("change", () => applyFilterChange({ dateFrom: dateFromInput.value }))
  dateToInput.addEventListener("change", () => applyFilterChange({ dateTo: dateToInput.value }))

  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => applyFilterChange({ search: searchInput.value }), SEARCH_DEBOUNCE_MS)
  })

  clearBtn.addEventListener("click", () => {
    searchInput.value = ""
    actionSelect.value = ""
    typeSelect.value = ""
    dateFromInput.value = ""
    dateToInput.value = ""
    applyFilterChange({ action: "", recordType: "", search: "", dateFrom: "", dateTo: "" })
  })

  function goToPage(p) {
    state = { ...state, page: Math.max(1, p) }
    writeStateToURL(state)
    fetchData()
  }

  function setPageSize(size) {
    state = { ...state, pageSize: size, page: 1 }
    writeStateToURL(state)
    fetchData()
  }

  async function fetchData() {
    const id = ++reqId
    resultsBox.classList.add("is-loading")

    const sp = new URLSearchParams()
    sp.set("page", String(state.page))
    sp.set("pageSize", String(state.pageSize))
    for (const k of FILTER_KEYS) if (state[k]) sp.set(k, state[k])

    try {
      const result = await apiGet(`/api/historial?${sp.toString()}`)
      if (id !== reqId) return // respuesta obsoleta: se descarta
      renderResults(result.items, result.total)
      renderPagination(result.total)
    } catch (e) {
      if (id !== reqId) return
      renderError(e)
    } finally {
      if (id === reqId) resultsBox.classList.remove("is-loading")
    }
  }

  function renderResults(items, total) {
    clear(resultsBox)
    if (items.length === 0) {
      const empty = el("div", { class: "state-message", style: "border:var(--border); padding:2rem;" })
      empty.appendChild(el("p", { style: "font-weight:600; color:var(--gray-500);" },
        isFiltered(state)
          ? "No hay registros que coincidan con los filtros aplicados."
          : "Aún no hay movimientos registrados. Crea, edita o elimina un registro para verlo aquí."))
      if (isFiltered(state)) {
        empty.appendChild(el("p", { class: "hint-text", style: "margin-top:0.25rem;" }, "Probá ajustar o limpiar los filtros."))
      }
      resultsBox.appendChild(empty)
      return
    }

    const list = el("ul", { class: "historial-list" })
    for (const m of items) list.appendChild(renderMovementCard(m))
    resultsBox.appendChild(list)
  }

  function renderMovementCard(m) {
    const card = el("li", { class: "movement-card" })
    const header = el("div", { class: "movement-header" })
    header.appendChild(el("span", { class: `action-badge action-${m.action}` }, ACTION_LABELS[m.action] ?? m.action))
    header.appendChild(el("span", { class: "movement-type" }, recordTypeLabels[m.recordType] ?? m.recordType))
    header.appendChild(el("span", { class: "movement-date" }, m.date))
    card.appendChild(header)
    card.appendChild(el("p", { class: "movement-detail" }, m.detail))

    const commentInput = el("input", {
      class: "input", style: "height:2rem; margin-top:0.5rem; width:100%;",
      placeholder: "Agregar comentario (opcional)...", value: m.comment,
    })
    commentInput.addEventListener("input", () => {
      clearTimeout(commentTimers.get(m.id))
      const value = commentInput.value
      commentTimers.set(m.id, setTimeout(() => {
        apiPatch(`/api/historial/${m.id}`, { comment: value }).catch(() => {
          // Fallo silencioso, igual que el original: no bloquea la edicion
        })
      }, COMMENT_DEBOUNCE_MS))
    })
    card.appendChild(commentInput)
    return card
  }

  function renderError(e) {
    clear(resultsBox)
    const msg = e instanceof NetworkError
      ? "No se pudo conectar con el servidor."
      : e instanceof ApiError ? e.message : "Ocurrió un error inesperado."
    resultsBox.appendChild(el("div", { class: "state-message is-error", style: "border:var(--border); padding:2rem;" }, msg))
  }

  function renderPagination(total) {
    clear(paginationBox)
    if (total === 0) return

    const totalPages = Math.max(1, Math.ceil(total / state.pageSize))
    const from = (state.page - 1) * state.pageSize + 1
    const to = Math.min(state.page * state.pageSize, total)

    const bar = el("div", { class: "pagination-bar" })
    bar.appendChild(el("p", { class: "hint-text" }, `Mostrando ${from}–${to} de ${total} registros`))

    const controls = el("div", { class: "pagination-controls" })

    const sizeGroup = el("div", { class: "page-size-group" })
    for (const s of PAGE_SIZES) {
      const btn = el("button", { class: `page-size-btn${s === state.pageSize ? " active" : ""}` }, String(s))
      btn.addEventListener("click", () => setPageSize(s))
      sizeGroup.appendChild(btn)
    }
    sizeGroup.appendChild(el("span", { class: "hint-text", style: "margin-left:0.25rem;" }, "por pág."))
    controls.appendChild(sizeGroup)

    const nav = el("div", { class: "page-nav" })
    const prevBtn = el("button", { class: "btn", style: "padding:0.25rem 0.5rem;" }, "‹")
    prevBtn.disabled = state.page <= 1
    prevBtn.addEventListener("click", () => goToPage(state.page - 1))
    nav.appendChild(prevBtn)
    nav.appendChild(el("span", { class: "page-indicator" }, `${state.page} / ${totalPages}`))
    const nextBtn = el("button", { class: "btn", style: "padding:0.25rem 0.5rem;" }, "›")
    nextBtn.disabled = state.page >= totalPages
    nextBtn.addEventListener("click", () => goToPage(state.page + 1))
    nav.appendChild(nextBtn)
    controls.appendChild(nav)

    bar.appendChild(controls)
    paginationBox.appendChild(bar)
  }

  fetchData()

  return () => {
    clearTimeout(searchDebounceTimer)
    for (const t of commentTimers.values()) clearTimeout(t)
    reqId++ // invalida cualquier fetch en vuelo al salir de la pagina
  }
}

function wrapField(control, label) {
  const wrap = el("div", { class: "field" })
  if (label) wrap.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, label))
  wrap.appendChild(control)
  return wrap
}
