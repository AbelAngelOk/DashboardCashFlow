// Portado desde components/ingresos/ingreso-form-dialog.tsx. 3 orígenes:
// libre, extracción de activo existente (con tope al balance del activo), o
// "automático" — un panel informativo sin acción (dividendos/plazos
// fijos/liquidaciones se generan desde Activos, no acá).

import { apiGet, apiPost } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { currencies } from "../lib/finance.js"

/** @param {{ onCreated?: () => void }} opts */
export async function openIngresoFormDialog(opts = {}) {
  const dialog = createDialog()
  dialog.appendChild(el("div", { class: "modal-body" }, "Cargando..."))
  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  dialog.showModal()

  const { records } = await apiGet("/api/dashboard")
  const activos = records.filter((r) => r.type === "activo" && !r.isGroupParent)

  let sourceType = "free"
  let name = ""
  let amount = ""
  let currency = "ARS"
  let saving = false
  let selectedAssetId = ""

  function selectedAsset() { return activos.find((a) => a.id === selectedAssetId) }
  function suggestedName() {
    if (sourceType === "existing-asset" && selectedAsset()) return `Venta de ${selectedAsset().name}`
    return ""
  }
  function effectiveName() { return name.trim() || suggestedName() }
  function canSave() {
    if (sourceType === "auto") return false
    if (!effectiveName() || !amount || Number(amount) <= 0) return false
    if (sourceType === "existing-asset") {
      if (!selectedAssetId) return false
      if (Number(amount) > (selectedAsset()?.amount ?? 0)) return false
    }
    return true
  }

  function paint() {
    clear(dialog)
    let saveBtn = null
    function syncSaveBtn() { if (saveBtn) saveBtn.disabled = !canSave() || saving }

    dialog.appendChild(el("div", { class: "modal-header" }, "Nuevo Ingreso"))
    const body = el("div", { class: "modal-body" })

    const typeField = el("div", { class: "field" })
    typeField.appendChild(el("label", {}, "Origen"))
    const options = [
      ["free", "Ingreso libre", "Salario, alquiler cobrado, etc."],
      ["existing-asset", "Extracción de activo", "Reduce el valor de un activo y registra el ingreso"],
      ["auto", "Automático", "Dividendos, plazos fijos y liquidaciones"],
    ]
    for (const [value, label, desc] of options) {
      const optLabel = el("label", { class: `radio-option${sourceType === value ? " selected" : ""}` })
      const radio = el("input", { type: "radio", name: "ingreso-source", checked: sourceType === value })
      radio.addEventListener("change", () => { sourceType = value; paint() })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:600;" }, label))
      text.appendChild(el("div", { class: "hint-text" }, desc))
      optLabel.appendChild(radio)
      optLabel.appendChild(text)
      typeField.appendChild(optLabel)
    }
    body.appendChild(typeField)

    if (sourceType === "auto") {
      const box = el("div", { class: "info-box" })
      box.appendChild(el("p", { style: "font-weight:600; color:var(--gray-700);" }, "Generación automática"))
      box.appendChild(el("p", { style: "margin-top:0.25rem;" },
        "Los ingresos por dividendos, cobro de plazos fijos y liquidaciones de activos se generan automáticamente cuando realizás esas acciones desde la sección Activos."))
      box.appendChild(el("p", { class: "hint-text", style: "margin-top:0.375rem;" }, "No es necesario registrarlos manualmente."))
      body.appendChild(box)
    }

    if (sourceType === "existing-asset") {
      const field = el("div", { class: "field" })
      field.appendChild(el("label", {}, "Activo *"))
      const select = el("select", { class: "input" })
      select.appendChild(el("option", { value: "" }, "Seleccionar activo..."))
      if (activos.length === 0) select.appendChild(el("option", { value: "", disabled: true }, "Sin activos disponibles"))
      for (const a of activos) {
        const suffix = a.amount > 0 ? ` (${a.amount.toLocaleString("es-ES")} ${a.currency})` : ""
        select.appendChild(el("option", { value: a.id }, `${a.name}${suffix}`))
      }
      select.value = selectedAssetId
      select.addEventListener("change", () => { selectedAssetId = select.value; paint() })
      field.appendChild(select)
      body.appendChild(field)
    }

    if (sourceType !== "auto") {
      const nameField = el("div", { class: "field" })
      nameField.appendChild(el("label", {}, sourceType === "existing-asset" ? "Nombre del ingreso (auto-sugerido)" : "Nombre del ingreso"))
      const nameInput = el("input", { class: "input", placeholder: suggestedName() || "Ej: Salario julio", value: name })
      nameInput.addEventListener("input", () => { name = nameInput.value; syncSaveBtn() })
      nameField.appendChild(nameInput)
      if (sourceType === "existing-asset" && !name.trim() && suggestedName()) {
        nameField.appendChild(el("p", { class: "hint-text" }, `Se usará: "${suggestedName()}"`))
      }
      body.appendChild(nameField)

      const row = el("div", { style: "display:flex; gap:0.75rem;" })
      const amountField = el("div", { class: "field", style: "flex:1;" })
      amountField.appendChild(el("label", {}, "Monto *"))
      const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
      amountInput.addEventListener("input", () => { amount = amountInput.value; syncSaveBtn() })
      amountField.appendChild(amountInput)
      if (sourceType === "existing-asset" && selectedAsset() && Number(amount) > selectedAsset().amount) {
        amountField.appendChild(el("p", { class: "warn-text" }, `Supera el balance del activo (${selectedAsset().amount.toLocaleString("es-ES")} ${selectedAsset().currency})`))
      }
      const currencyField = el("div", { class: "field", style: "width:6rem;" })
      currencyField.appendChild(el("label", {}, "Moneda"))
      const currencySelect = el("select", { class: "input" })
      for (const c of currencies) currencySelect.appendChild(el("option", { value: c }, c))
      currencySelect.value = currency
      currencySelect.addEventListener("change", () => { currency = currencySelect.value })
      currencyField.appendChild(currencySelect)
      row.appendChild(amountField)
      row.appendChild(currencyField)
      body.appendChild(row)

      if (sourceType === "existing-asset" && selectedAsset() && amount && Number(amount) > 0 && Number(amount) <= selectedAsset().amount) {
        const a = selectedAsset()
        body.appendChild(el("div", { class: "info-box" },
          `Se registrará el ingreso y el activo ${a.name} pasará de ${a.amount.toLocaleString("es-ES")} ${a.currency} a ${(a.amount - Number(amount)).toLocaleString("es-ES")} ${a.currency}.`))
      }
    }

    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.disabled = saving
    cancelBtn.addEventListener("click", () => dialog.close())
    footer.appendChild(cancelBtn)
    if (sourceType !== "auto") {
      saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Guardar")
      saveBtn.disabled = !canSave() || saving
      saveBtn.addEventListener("click", handleSave)
      footer.appendChild(saveBtn)
    }
    dialog.appendChild(footer)
  }

  async function handleSave() {
    if (!canSave()) return
    saving = true
    paint()
    try {
      const amountNum = Number(amount)
      const ingreso = { name: effectiveName(), amount: amountNum, currency }
      if (sourceType === "free") {
        await apiPost("/api/ingresos", { mode: "free", ingreso })
      } else if (sourceType === "existing-asset") {
        await apiPost("/api/ingresos", { mode: "asset", ingreso, assetId: selectedAssetId, egressAmount: amountNum })
      }
      dialog.close()
      opts.onCreated?.()
    } finally {
      saving = false
    }
  }

  paint()
}
