// Portado desde components/cutoff/cutoff-dialog.tsx.

import { apiGet, apiPost, ApiError } from "../api.js"
import { el, clear, createDialog, createSwitch, svgIcon } from "../dom.js"
import { toast } from "../toast.js"

/** @param {{ status, onDone: (result) => void, onDismiss: () => void }} opts */
export function openCutoffDialog(opts) {
  const dialog = createDialog()
  let preview = null
  let loadingPreview = true
  let running = false
  let takeSnapshot = true, keepMarked = false, clearEntityMarkers = false

  function archiveTotal() {
    if (!preview) return 0
    return preview.ingresosToArchive + preview.gastosToArchive - (keepMarked ? preview.markedToArchive : 0)
  }

  function paint() {
    clear(dialog)
    const header = el("div", { class: "modal-header", style: "display:flex; align-items:center; gap:0.5rem;" })
    header.appendChild(svgIcon("icon-history", 14))
    header.appendChild(document.createTextNode(`Corte de mes — ${opts.status.pendingPeriodLabel}`))
    dialog.appendChild(header)

    const body = el("div", { class: "modal-body" })
    body.appendChild(el("p", { class: "hint-text" },
      `Los ingresos y gastos activos pasan a histórico, y se preparan los de ${opts.status.incomingPeriodLabel} a partir de tus obligaciones y activos.`))

    const previewBox = el("div", { style: "border:var(--border); background:var(--gray-50); padding:0.75rem;" })
    if (loadingPreview) {
      previewBox.appendChild(el("div", { class: "hint-text" }, "Calculando impacto…"))
    } else if (preview) {
      const titleRow = el("div", { style: "display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:bold; text-transform:uppercase;" })
      titleRow.appendChild(el("span", {}, opts.status.pendingPeriodLabel))
      titleRow.appendChild(svgIcon("icon-arrow-right", 11))
      titleRow.appendChild(el("span", {}, opts.status.incomingPeriodLabel))
      previewBox.appendChild(titleRow)

      const rows = el("div", { style: "display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem;" })
      rows.appendChild(previewRow("Ingresos a histórico", preview.ingresosToArchive))
      rows.appendChild(previewRow("Gastos a histórico", preview.gastosToArchive))
      if (preview.markedToArchive > 0) {
        rows.appendChild(previewRow(keepMarked ? "Se conservan por etiqueta" : "Con etiqueta (se archivan)", preview.markedToArchive))
      }
      rows.appendChild(el("div", { style: "border-top:1px solid var(--gray-300); margin:0.25rem 0;" }))
      rows.appendChild(previewRow("Gastos de obligaciones a generar", preview.gastosToGenerate))
      rows.appendChild(previewRow("Ingresos de dividendos a generar", preview.ingresosToGenerate))
      if (clearEntityMarkers) rows.appendChild(previewRow("Etiquetas a quitar", preview.entityMarkersToClear))
      previewBox.appendChild(rows)
      previewBox.appendChild(el("p", { class: "hint-text", style: "margin-top:0.5rem;" }, `${archiveTotal()} registros dejarán el dashboard.`))
    } else {
      previewBox.appendChild(el("p", { class: "hint-text" }, "No se pudo calcular el impacto."))
    }
    body.appendChild(previewBox)

    body.appendChild(switchRow("Guardar snapshot del mes que sale",
      `Toma una foto del dashboard antes de archivar, con el nombre "Cierre ${opts.status.pendingPeriodLabel}".`,
      takeSnapshot, (v) => { takeSnapshot = v }, running))
    body.appendChild(switchRow("Mantener los ingresos y gastos con etiqueta",
      "Los registros etiquetados cruzan el corte y siguen activos. Útil si usás etiquetas como “revisar” para marcar lo que quedó pendiente.",
      keepMarked, (v) => { keepMarked = v; refreshPreviewOnly() }, running))
    body.appendChild(switchRow("Quitar las etiquetas a activos y obligaciones",
      "Como activos y obligaciones sobreviven al corte, sus etiquetas suelen ser del mes que cierra. Los marcadores no se borran, solo se desasignan.",
      clearEntityMarkers, (v) => { clearEntityMarkers = v; refreshPreviewOnly() }, running))

    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const dismissBtn = el("button", { class: "btn" }, "Ahora no")
    dismissBtn.disabled = running
    dismissBtn.addEventListener("click", () => { opts.onDismiss(); dialog.close() })
    const confirmBtn = el("button", { class: "btn btn-primary", style: "display:flex; align-items:center; gap:0.375rem;" })
    confirmBtn.appendChild(svgIcon("icon-history", 12))
    confirmBtn.appendChild(document.createTextNode(running ? " Realizando corte…" : " Confirmar corte"))
    confirmBtn.disabled = running || loadingPreview
    confirmBtn.addEventListener("click", handleConfirm)
    footer.appendChild(dismissBtn); footer.appendChild(confirmBtn)
    dialog.appendChild(footer)
  }

  function previewRow(label, value) {
    const row = el("div", { style: "display:flex; justify-content:space-between; gap:0.5rem; font-size:0.75rem;" })
    row.appendChild(el("span", { style: "color:var(--gray-600);" }, label))
    row.appendChild(el("span", { style: "font-weight:bold; font-variant-numeric:tabular-nums;" }, String(value)))
    return row
  }

  function switchRow(label, description, checked, onChange, disabled) {
    const row = el("div", { class: "switch-row", style: "align-items:flex-start;" })
    const text = el("div", { style: "flex:1;" })
    text.appendChild(el("p", { class: "switch-label" }, label))
    text.appendChild(el("p", { class: "switch-desc", style: "margin-top:0.125rem;" }, description))
    const sw = createSwitch(checked, onChange, label)
    if (disabled) sw.disabled = true
    row.appendChild(text)
    row.appendChild(sw)
    return row
  }

  async function refreshPreviewOnly() {
    // Los switches "keepMarked"/"clearEntityMarkers" no cambian la vista previa
    // en el servidor (son parámetros de ejecución, no de cálculo) — solo
    // repintan las líneas que dependen de ellos localmente.
    paint()
  }

  async function loadPreview() {
    loadingPreview = true
    paint()
    try {
      const r = await apiGet("/api/cutoff?preview=1", { fresh: true })
      preview = r.preview
    } catch {
      preview = null
    } finally {
      loadingPreview = false
      paint()
    }
  }

  async function handleConfirm() {
    running = true
    paint()
    try {
      const result = await apiPost("/api/cutoff", { takeSnapshot, keepMarked, clearEntityMarkers })
      toast({
        title: `Corte de ${opts.status.pendingPeriodLabel} realizado`,
        description: `${result.ingresosArchived} ingresos y ${result.gastosArchived} gastos a histórico. ${result.gastosGenerated} gastos y ${result.ingresosGenerated} ingresos generados para ${opts.status.incomingPeriodLabel}.`,
      })
      dialog.close()
      opts.onDone(result)
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo realizar el corte", description: e instanceof ApiError ? e.message : "Error desconocido" })
      running = false
      paint()
    }
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
  loadPreview()
}
