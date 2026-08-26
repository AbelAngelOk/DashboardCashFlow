// Portado desde app/(dashboard)/page.tsx. Reemplaza la página de estado
// provisional que sirvió como prueba de punta a punta durante toda la
// migración — esta es la última pantalla, según el orden del plan.

import { apiGet, apiPost } from "../api.js"
import { el, clear, mount, svgIcon, createDialog } from "../dom.js"
import { navigate } from "../router.js"
import { renderDashboardSheet } from "../components/dashboard-sheet.js"
import { renderCutoffBanner } from "../components/cutoff-banner.js"
import { openAssetFormDialog } from "../components/asset-form-dialog.js"
import { openObligationFormDialog } from "../components/obligation-form-dialog.js"

function currentPeriod() {
  return new Date().toLocaleString("es-ES", { month: "long", year: "numeric" })
}
function formatDate(iso) {
  return iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""
}

export async function render(main) {
  clear(main)
  const wrap = el("div", { style: "max-width:64rem; margin:0 auto;" })
  mount(main, wrap)
  wrap.appendChild(el("div", { class: "state-message" }, "Cargando..."))

  let records = [], gastoGroups = [], ingresoGroups = [], obligations = [], snapshotsCount = 0

  async function load() {
    const [dash, obl] = await Promise.all([
      apiGet("/api/dashboard", { fresh: true }),
      apiGet("/api/obligations", { fresh: true }),
    ])
    records = dash.records
    gastoGroups = dash.gastoGroups
    ingresoGroups = dash.ingresoGroups
    obligations = obl.obligations
    paint()
  }

  function paint() {
    clear(wrap)

    const header = el("div", { class: "flow-header" })
    header.appendChild(el("div", { class: "flow-title-badge" }, "Dashboard"))
    const headerActions = el("div", { class: "flow-header-actions" })
    headerActions.appendChild(renderCutoffBanner(() => load()))
    const snapshotBtn = el("button", { class: "btn btn-primary" })
    snapshotBtn.appendChild(svgIcon("icon-camera", 14))
    snapshotBtn.appendChild(document.createTextNode(" Tomar Snapshot"))
    snapshotBtn.addEventListener("click", () => openSnapshotDialog())
    headerActions.appendChild(snapshotBtn)
    header.appendChild(headerActions)
    wrap.appendChild(header)

    wrap.appendChild(renderDashboardSheet({
      records, gastoGroups, ingresoGroups, obligations,
      onAddAsset: () => openAssetFormDialog({ onCreate: () => load() }),
      onAddObligation: () => openObligationFormDialog({ onCreated: (id) => navigate(`/app/obligaciones/${id}`) }),
      onChanged: () => load(),
    }))
  }

  function openSnapshotDialog() {
    const dialog = createDialog()
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    let name = `Snapshot ${snapshotsCount + 1}`
    let dateFrom = firstDay.toISOString().slice(0, 10)
    let dateTo = lastDay.toISOString().slice(0, 10)

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Tomar Snapshot"))
      const body = el("div", { class: "modal-body" })
      body.appendChild(el("p", { class: "hint-text" }, "Guarda el estado actual del dashboard para consultarlo más tarde."))

      const nameField = el("div", { class: "field" })
      nameField.appendChild(el("label", {}, "Nombre"))
      const nameInput = el("input", { class: "input", value: name })
      nameInput.addEventListener("input", () => { name = nameInput.value; syncSave() })
      nameField.appendChild(nameInput)
      body.appendChild(nameField)

      const row = el("div", { style: "display:flex; gap:0.75rem;" })
      const fromField = el("div", { class: "field", style: "flex:1;" })
      fromField.appendChild(el("label", {}, "Fecha inicio"))
      const fromInput = el("input", { class: "input", type: "date", value: dateFrom })
      fromInput.addEventListener("change", () => { dateFrom = fromInput.value })
      fromField.appendChild(fromInput)
      const toField = el("div", { class: "field", style: "flex:1;" })
      toField.appendChild(el("label", {}, "Fecha fin"))
      const toInput = el("input", { class: "input", type: "date", value: dateTo })
      toInput.addEventListener("change", () => { dateTo = toInput.value })
      toField.appendChild(toInput)
      row.appendChild(fromField); row.appendChild(toField)
      body.appendChild(row)
      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const saveBtn = el("button", { class: "btn btn-primary" }, "Guardar Snapshot")
      saveBtn.disabled = !name.trim()
      saveBtn.addEventListener("click", handleConfirm)
      footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
      dialog.appendChild(footer)

      function syncSave() { saveBtn.disabled = !name.trim() }
    }

    async function handleConfirm() {
      if (!name.trim()) return
      const period = `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
      dialog.close()
      // El rango de fechas solo arma la etiqueta del período — igual que el
      // original, no filtra qué registros entran: siempre es la foto completa
      // del estado actual.
      await apiPost("/api/snapshots", { name: name.trim(), period: period.trim() || currentPeriod(), records })
      snapshotsCount += 1
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  const { snapshots } = await apiGet("/api/snapshots")
  snapshotsCount = snapshots.length
  await load()

  return () => {}
}
