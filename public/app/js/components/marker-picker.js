// Portado desde components/markers/marker-picker.tsx. Un único popover
// compartido por página (no uno por fila) — igual criterio que el popover de
// notificaciones en shell.js: <dialog> no-modal, posicionado con
// getBoundingClientRect, cierre manual por click afuera y Escape (`.show()`
// no dispara el evento `cancel` nativo, eso es exclusivo de `showModal()`).

import { el, clear, svgIcon } from "../dom.js"
import { fetchMarkers, createMarker, setEntityMarker, removeEntityMarker } from "../lib/markers.js"
import { TAILWIND_COLORS } from "../lib/colors.js"

let sharedDialog = null
let cleanupCurrent = null

function ensureDialog() {
  if (sharedDialog) return sharedDialog
  sharedDialog = document.createElement("dialog")
  sharedDialog.className = "marker-popover"
  document.body.appendChild(sharedDialog)
  return sharedDialog
}

/**
 * Abre el picker anclado a `trigger`. `onChanged()` se llama después de
 * cualquier cambio (asignar/quitar/crear) para que el caller refresque su fila.
 */
export function openMarkerPicker(trigger, { entityId, entityType = "RECORD", currentMarker, onChanged }) {
  if (cleanupCurrent) cleanupCurrent()

  const dialog = ensureDialog()
  let creating = false
  let newName = ""
  let newColor = TAILWIND_COLORS[5].value
  let pending = false

  function position() {
    const rect = trigger.getBoundingClientRect()
    dialog.style.position = "fixed"
    dialog.style.top = `${rect.bottom + 4}px`
    dialog.style.right = `${window.innerWidth - rect.right}px`
    dialog.style.margin = "0"
  }

  async function paint() {
    clear(dialog)
    if (creating) {
      paintCreateForm()
    } else {
      dialog.appendChild(el("p", { class: "hint-text" }, "Cargando..."))
      const markers = await fetchMarkers()
      clear(dialog)
      paintList(markers)
    }
  }

  function paintList(markers) {
    if (markers.length === 0) {
      dialog.appendChild(el("div", { class: "marker-popover-empty" }, "Sin marcadores"))
    }
    for (const m of markers) {
      const row = el("button", { class: `marker-option${currentMarker?.id === m.id ? " active" : ""}` })
      row.appendChild(el("span", { class: "marker-dot", style: `background:${m.color}; border-color:${m.color};` }))
      row.appendChild(document.createTextNode(m.name))
      row.addEventListener("click", () => handleSelect(m.id))
      dialog.appendChild(row)
    }
    if (currentMarker) {
      dialog.appendChild(el("div", { class: "marker-popover-sep" }))
      const removeBtn = el("button", { class: "marker-option marker-option-muted" })
      removeBtn.appendChild(svgIcon("icon-x", 12))
      removeBtn.appendChild(document.createTextNode("Quitar marcador"))
      removeBtn.addEventListener("click", () => handleSelect(null))
      dialog.appendChild(removeBtn)
    }
    dialog.appendChild(el("div", { class: "marker-popover-sep" }))
    const newBtn = el("button", { class: "marker-option marker-option-muted" }, "+ Nuevo marcador")
    newBtn.addEventListener("click", () => { creating = true; paint() })
    dialog.appendChild(newBtn)
  }

  function paintCreateForm() {
    dialog.appendChild(el("p", { class: "marker-popover-title" }, "Nuevo marcador"))

    const row = el("div", { class: "marker-create-row" })
    const preview = el("span", { class: "marker-color-preview", style: `background:${newColor};` })
    const nameInput = el("input", { class: "input", placeholder: "Nombre...", value: newName })
    nameInput.addEventListener("input", () => {
      newName = nameInput.value
      createBtn.disabled = !newName.trim() || pending
    })
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleQuickCreate()
      if (e.key === "Escape") { creating = false; paint() }
    })
    row.appendChild(preview)
    row.appendChild(nameInput)
    dialog.appendChild(row)

    const grid = el("div", { class: "color-grid" })
    const swatches = []
    for (const c of TAILWIND_COLORS) {
      const swatch = el("button", { class: `color-swatch${c.value === newColor ? " selected" : ""}`, style: `background:${c.value};`, "aria-label": c.name })
      swatch.addEventListener("click", () => {
        newColor = c.value
        preview.style.background = newColor
        for (const s of swatches) s.el.classList.toggle("selected", s.value === newColor)
      })
      swatches.push({ el: swatch, value: c.value })
      grid.appendChild(swatch)
    }
    dialog.appendChild(grid)

    const actions = el("div", { class: "marker-create-actions" })
    const createBtn = el("button", { class: "btn btn-primary", disabled: !newName.trim() || pending }, "Crear y asignar")
    createBtn.addEventListener("click", handleQuickCreate)
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => { creating = false; newName = ""; newColor = TAILWIND_COLORS[5].value; paint() })
    actions.appendChild(createBtn)
    actions.appendChild(cancelBtn)
    dialog.appendChild(actions)

    nameInput.focus()
  }

  async function handleSelect(markerId) {
    pending = true
    try {
      if (markerId === null) await removeEntityMarker(entityId, entityType)
      else await setEntityMarker(entityId, entityType, markerId)
      onChanged()
    } finally {
      pending = false
      close()
    }
  }

  async function handleQuickCreate() {
    if (!newName.trim()) return
    pending = true
    try {
      const markers = await fetchMarkers()
      const created = await createMarker({ name: newName.trim(), color: newColor, order: markers.length })
      await setEntityMarker(entityId, entityType, created.id)
      onChanged()
    } finally {
      pending = false
      close()
    }
  }

  function close() {
    dialog.close()
    document.removeEventListener("mousedown", onOutside)
    document.removeEventListener("keydown", onEsc)
    cleanupCurrent = null
  }
  function onOutside(e) {
    if (!dialog.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) close()
  }
  function onEsc(e) { if (e.key === "Escape") close() }

  position()
  paint()
  dialog.show()
  // El listener se agrega después del tick actual: el propio click que abrió
  // el picker no debe cerrarlo inmediatamente vía onOutside.
  setTimeout(() => {
    document.addEventListener("mousedown", onOutside)
    document.addEventListener("keydown", onEsc)
  }, 0)
  cleanupCurrent = close
}
