// Portado desde components/activos/asset-info-section.tsx. Edición inline
// por campo (click → editar, blur/Enter → guardar con debounce de 200ms).
//
// La descripción usa un <textarea> plano, no un editor de texto enriquecido.
// El original usa TipTap (RichEditor), guardando JSON en `description`. Ese
// mismo componente ya tolera strings planos como fallback (los envuelve en
// un párrafo — ver rich-editor.tsx: tryParseJson devuelve null y arma un doc
// de un solo nodo de texto). Portar TipTap completo a vanilla — toolbar,
// esquema JSON, sanitización — para un solo campo de texto es precisamente
// la clase de complejidad que el proyecto pide cuestionar. Guardar texto
// plano acá es compatible con lo que la app React ya sabe leer; se pierde
// negrita/listas/tablas en la descripción, nada más.

import { apiPatch } from "../api.js"
import { el, clear } from "../dom.js"
import { formatAmount, computeGroupValue } from "../lib/finance.js"
import { categoryName } from "../lib/asset-categories.js"
import { getSettings } from "../settings.js"

const SAVE_DEBOUNCE_MS = 200

export function renderAssetInfoSection(asset, categories, onUpdated) {
  const panel = el("div", { class: "panel", "data-testid": "asset-info-section" })
  panel.appendChild(el("div", { class: "panel-header" }, "Información general"))
  const grid = el("div", { class: "obl-info-grid" })

  let saveTimer = null
  function debouncedSave(patch) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      await apiPatch(`/api/assets/${asset.id}`, patch)
      onUpdated()
    }, SAVE_DEBOUNCE_MS)
  }

  // Valor actual (solo lectura)
  const valueCell = el("div")
  valueCell.appendChild(el("div", { class: "obl-info-label" }, "Valor actual"))
  const valueLine = el("div", { style: "font-weight:bold;" })
  if (asset.isGroupParent && asset.children?.length > 0) {
    const { convertCurrencies, baseCurrency, exchangeRates } = getSettings()
    const result = computeGroupValue(asset.children, convertCurrencies, baseCurrency, exchangeRates)
    if (result.type === "single") {
      valueLine.textContent = `${formatAmount(result.value, result.currency)} ${result.currency}`
    } else {
      for (const { currency, value } of result.entries) {
        valueLine.appendChild(el("div", { style: "font-size:0.8125rem;" }, `${formatAmount(value, currency)} ${currency}`))
      }
    }
  } else {
    valueLine.textContent = `${formatAmount(asset.amount, asset.currency)} ${asset.currency}`
  }
  valueCell.appendChild(valueLine)
  grid.appendChild(valueCell)

  // Categoría
  grid.appendChild(editableCell("Categoría", () => {
    let editing = false
    const box = el("div")
    function paint() {
      clear(box)
      if (editing) {
        const select = el("select", { class: "input", style: "height:2rem;" })
        select.appendChild(el("option", { value: "" }, "—"))
        for (const c of categories) select.appendChild(el("option", { value: c.id }, c.name))
        select.value = asset.assetType ?? ""
        select.addEventListener("change", () => {
          asset.assetType = select.value || undefined
          debouncedSave({ assetType: select.value || undefined })
          editing = false; paint()
        })
        select.addEventListener("blur", () => { editing = false; paint() })
        box.appendChild(select)
        setTimeout(() => select.focus(), 0)
      } else {
        const btn = el("button", { class: "obl-inline-edit-btn" }, asset.assetType ? categoryName(asset.assetType, categories) : "—")
        btn.addEventListener("click", () => { editing = true; paint() })
        box.appendChild(btn)
      }
    }
    paint()
    return box
  }))

  // Ticker
  grid.appendChild(editableCell("Ticker", () => {
    let editing = false
    const box = el("div")
    function paint() {
      clear(box)
      if (editing) {
        const input = el("input", { class: "input", style: "height:2rem; font-family:monospace;", placeholder: "Ej: AAPL, BTCUSDT", value: asset.ticker ?? "" })
        input.addEventListener("blur", () => { commit(input.value) })
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(input.value) }
          if (e.key === "Escape") { editing = false; paint() }
        })
        box.appendChild(input)
        setTimeout(() => input.focus(), 0)
      } else {
        const btn = el("button", { class: "obl-inline-edit-btn", style: "font-family:monospace;" }, asset.ticker || "—")
        btn.addEventListener("click", () => { editing = true; paint() })
        box.appendChild(btn)
      }
    }
    function commit(value) {
      asset.ticker = value.trim() || undefined
      debouncedSave({ ticker: value.trim() || undefined })
      editing = false; paint()
    }
    paint()
    return box
  }))

  // Nombre
  grid.appendChild(editableCell("Nombre", () => {
    let editing = false
    const box = el("div")
    function paint() {
      clear(box)
      if (editing) {
        const input = el("input", { class: "input", style: "height:2rem;", value: asset.name })
        input.addEventListener("blur", () => commit(input.value))
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(input.value) }
          if (e.key === "Escape") { editing = false; paint() }
        })
        box.appendChild(input)
        setTimeout(() => input.focus(), 0)
      } else {
        const btn = el("button", { class: "obl-inline-edit-btn", style: "font-weight:500;" }, asset.name)
        btn.addEventListener("click", () => { editing = true; paint() })
        box.appendChild(btn)
      }
    }
    function commit(value) {
      if (!value.trim()) { editing = false; paint(); return }
      asset.name = value.trim()
      debouncedSave({ name: value.trim() })
      editing = false; paint()
    }
    paint()
    return box
  }))

  // Descripción (texto plano — ver nota arriba)
  const descCell = editableCell("Descripción", () => {
    let editing = false
    const box = el("div")
    function paint() {
      clear(box)
      if (editing) {
        const textarea = el("textarea", { class: "input", rows: 3, style: "resize:none; width:100%;", placeholder: "Descripción del activo...", value: asset.description ?? "" })
        textarea.addEventListener("blur", () => commit(textarea.value))
        box.appendChild(textarea)
        setTimeout(() => textarea.focus(), 0)
      } else {
        const btn = el("button", { class: "obl-inline-edit-btn", style: "text-align:left; white-space:pre-wrap; width:100%; color:var(--gray-700);" },
          asset.description || "Sin descripción — click para editar")
        btn.addEventListener("click", () => { editing = true; paint() })
        box.appendChild(btn)
      }
    }
    function commit(value) {
      asset.description = value.trim() || undefined
      debouncedSave({ description: value.trim() || undefined })
      editing = false; paint()
    }
    paint()
    return box
  })
  descCell.style.gridColumn = "1 / -1"
  grid.appendChild(descCell)

  // Capacidades (solo activos que no son grupo)
  if (!asset.isGroupParent) {
    const capCell = el("div", { style: "grid-column:1 / -1; border-top:1px solid var(--gray-200); padding-top:0.75rem;" })
    capCell.appendChild(el("div", { class: "obl-info-label", style: "margin-bottom:0.5rem;" }, "Capacidades"))
    const label = el("label", { style: "display:flex; align-items:flex-start; gap:0.5rem; font-size:0.875rem; cursor:pointer;" })
    const cb = el("input", { type: "checkbox", checked: asset.tracksQuantity })
    cb.addEventListener("change", async () => {
      await apiPatch(`/api/assets/${asset.id}`, { tracksQuantity: cb.checked })
      onUpdated()
    })
    const text = el("div")
    text.appendChild(el("div", { style: "font-weight:500;" }, "Se opera en unidades"))
    text.appendChild(el("div", { class: "hint-text" }, "Habilita cantidad, precio promedio ponderado y registro de compras."))
    label.appendChild(cb); label.appendChild(text)
    capCell.appendChild(label)
    capCell.appendChild(el("p", { class: "hint-text", style: "margin-top:0.5rem;" }, "Los ingresos recurrentes y los tableros se agregan desde sus propias secciones, más abajo."))
    grid.appendChild(capCell)
  }

  panel.appendChild(grid)
  return panel
}

function editableCell(label, buildValue) {
  const cell = el("div")
  cell.appendChild(el("div", { class: "obl-info-label" }, label))
  cell.appendChild(buildValue())
  return cell
}
