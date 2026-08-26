// Portado desde app/(dashboard)/obligaciones/page.tsx. Solo la variante de
// tabla (desktop-only, ver MIGRATION_PLAN.md — sin breakpoints ni tarjetas mobile).

import { apiGet } from "../api.js"
import { el, clear, mount, svgIcon } from "../dom.js"
import { navigate } from "../router.js"
import { formatAmount, convertAmount } from "../lib/finance.js"
import { fetchEntityMarkers } from "../lib/markers.js"
import { openMarkerPicker } from "../components/marker-picker.js"
import { openObligationFormDialog } from "../components/obligation-form-dialog.js"
import { getSettings } from "../settings.js"
import {
  OBLIGATION_TYPE_LABELS, OBLIGATION_STATUS_LABELS, computeRecurringBreakdown, formatObligationDate,
} from "../lib/obligations.js"

const STATUS_FILTERS = [
  { label: "Todas", value: "ALL" },
  { label: "Activas", value: "ACTIVE" },
  { label: "Pausadas", value: "PAUSED" },
  { label: "Completadas", value: "COMPLETED" },
  { label: "Canceladas", value: "CANCELLED" },
]

function valueCell(o) {
  if (o.obligationType === "RECURRING") {
    const breakdown = computeRecurringBreakdown(o.rules)
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0)
    if (entries.length === 0) return el("span", { style: "color:var(--gray-400);" }, "Sin reglas")

    const { convertCurrencies, baseCurrency, exchangeRates } = getSettings()
    const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; line-height:1.2;" })
    if (convertCurrencies) {
      const total = entries.reduce((s, [cur, val]) => s + convertAmount(val, cur, baseCurrency, exchangeRates), 0)
      wrap.appendChild(el("span", {}, `${formatAmount(total, baseCurrency)} ${baseCurrency}`))
    } else {
      for (const [cur, val] of entries) wrap.appendChild(el("span", {}, `${formatAmount(val, cur)} ${cur}`))
    }
    wrap.appendChild(el("span", { style: "font-size:0.625rem; color:var(--gray-400);" }, "anual"))
    return wrap
  }
  return el("span", {}, `${formatAmount(o.amount, o.currency)} ${o.currency}`)
}

export async function render(main) {
  clear(main)

  let obligations = []
  let filter = "ALL"
  let markerMap = {}

  const wrap = el("div", { style: "max-width:64rem; margin:0 auto;" })
  const header = el("div", { class: "flow-header" })
  header.appendChild(el("div", { class: "flow-title-badge" }, "Obligaciones"))
  const newBtn = el("button", { class: "btn btn-primary" })
  newBtn.appendChild(svgIcon("icon-plus", 12))
  newBtn.appendChild(document.createTextNode(" Nueva"))
  newBtn.addEventListener("click", () => {
    openObligationFormDialog({ onCreated: (id) => navigate(`/app/obligaciones/${id}`) })
  })
  header.appendChild(newBtn)
  wrap.appendChild(header)

  const statusBar = el("div", { class: "flow-status-bar" })
  wrap.appendChild(statusBar)

  const body = el("div")
  wrap.appendChild(body)
  mount(main, wrap)

  function paintStatusBar() {
    clear(statusBar)
    for (const { label, value } of STATUS_FILTERS) {
      const btn = el("button", { class: `status-filter-btn${filter === value ? " active" : ""}` }, label)
      btn.addEventListener("click", () => { filter = value; paintBody() })
      statusBar.appendChild(btn)
    }
  }

  async function refreshMarkers(ids) {
    if (ids.length === 0) { markerMap = {}; return }
    markerMap = await fetchEntityMarkers(ids, "OBLIGATION")
  }

  function paintBody() {
    clear(body)
    const filtered = filter === "ALL" ? obligations : obligations.filter((o) => o.status === filter)

    const table = el("div", { class: "obl-table" })
    const head = el("div", { class: "obl-header-row" })
    head.appendChild(el("div", { style: "flex:1;" }, "Nombre"))
    head.appendChild(el("div", { class: "obl-col-type" }, "Tipo"))
    head.appendChild(el("div", { class: "obl-col-value" }, "Valor"))
    head.appendChild(el("div", { class: "obl-col-due" }, "Próx. venc."))
    head.appendChild(el("div", { class: "obl-col-status" }, "Estado"))
    head.appendChild(el("div", { class: "obl-col-marker" }))
    table.appendChild(head)

    for (const o of filtered) {
      const marker = markerMap[o.id] ?? null
      const row = el("div", {
        class: "obl-row",
        style: marker ? `border-left:4px solid ${marker.color}; background-color:${marker.color}18;` : "",
      })
      const link = el("a", { href: `/app/obligaciones/${o.id}`, "data-link": "", class: "obl-row-link" })
      link.appendChild(el("div", { style: "flex:1; padding:0.5rem 0.75rem; font-weight:500;" }, o.name))
      link.appendChild(el("div", { class: "obl-col-type" }, OBLIGATION_TYPE_LABELS[o.obligationType]))
      const valueCol = el("div", { class: "obl-col-value" })
      valueCol.appendChild(valueCell(o))
      link.appendChild(valueCol)
      link.appendChild(el("div", { class: "obl-col-due" }, o.nextDueDate ? formatObligationDate(o.nextDueDate) : "—"))
      const statusCol = el("div", { class: "obl-col-status" })
      statusCol.appendChild(el("span", { class: `obl-status-badge obl-status-${o.status.toLowerCase()}` }, OBLIGATION_STATUS_LABELS[o.status]))
      link.appendChild(statusCol)
      row.appendChild(link)

      const markerCol = el("div", { class: "obl-col-marker" })
      const markerBtn = el("button", { class: "marker-trigger", title: "Marcador" })
      const dot = el("span", { class: "marker-trigger-dot" })
      if (marker) { dot.style.background = marker.color; dot.style.borderColor = marker.color }
      markerBtn.appendChild(dot)
      markerBtn.addEventListener("click", () => {
        openMarkerPicker(markerBtn, {
          entityId: o.id, entityType: "OBLIGATION", currentMarker: marker,
          onChanged: () => refreshMarkers(obligations.map((x) => x.id)).then(paintBody),
        })
      })
      markerCol.appendChild(markerBtn)
      row.appendChild(markerCol)

      table.appendChild(row)
    }

    if (filtered.length === 0) {
      const emptyText = filter === "ALL"
        ? "No hay obligaciones. Creá la primera con el botón de arriba."
        : `No hay obligaciones con estado "${OBLIGATION_STATUS_LABELS[filter]}".`
      table.appendChild(el("div", { class: "state-message" }, emptyText))
    }

    body.appendChild(table)
  }

  paintStatusBar()
  const { obligations: data } = await apiGet("/api/obligations")
  obligations = data
  await refreshMarkers(obligations.map((o) => o.id))
  paintBody()

  return () => {}
}
