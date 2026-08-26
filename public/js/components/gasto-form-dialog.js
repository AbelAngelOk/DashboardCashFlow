// Portado desde components/gastos/gasto-form-dialog.tsx. 3 modos de
// creación: libre, depósito en activo existente, o gasto + activo nuevo.

import { apiGet, apiPost } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { currencies } from "../lib/finance.js"

/** @param {{ onCreated?: () => void }} opts */
export async function openGastoFormDialog(opts = {}) {
  const dialog = createDialog()
  dialog.appendChild(el("div", { class: "modal-body" }, "Cargando..."))
  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  dialog.showModal()

  const [{ records }, { categories }] = await Promise.all([
    apiGet("/api/dashboard"),
    apiGet("/api/categories"),
  ])
  const activos = records.filter((r) => r.type === "activo" && !r.isGroupParent)

  let sourceType = "free"
  let name = ""
  let amount = ""
  let currency = "ARS"
  let saving = false
  let selectedAssetId = ""
  let assetName = ""
  let assetType = ""

  function suggestedName() {
    if (sourceType === "existing-asset" && selectedAssetId) {
      const a = activos.find((r) => r.id === selectedAssetId)
      return a ? `Inversión en ${a.name}` : ""
    }
    if (sourceType === "new-asset" && assetName.trim()) return `Inversión en ${assetName.trim()}`
    return ""
  }
  function effectiveName() { return name.trim() || suggestedName() }
  function canSave() {
    if (!effectiveName() || !amount || Number(amount) <= 0) return false
    if (sourceType === "existing-asset" && !selectedAssetId) return false
    if (sourceType === "new-asset" && !assetName.trim()) return false
    return true
  }

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Nuevo Gasto"))
    const body = el("div", { class: "modal-body" })

    // Tipo
    const typeField = el("div", { class: "field" })
    typeField.appendChild(el("label", {}, "Tipo"))
    const options = [
      ["free", "Gasto libre", "Sin asociación a ningún activo"],
      ["existing-asset", "Depósito en activo existente", "Aumenta el valor de un activo"],
      ["new-asset", "Crear activo nuevo", "Crea un gasto y un nuevo activo"],
    ]
    for (const [value, label, desc] of options) {
      const optLabel = el("label", { class: `radio-option${sourceType === value ? " selected" : ""}` })
      const radio = el("input", { type: "radio", name: "gasto-source", checked: sourceType === value })
      radio.addEventListener("change", () => { sourceType = value; paint() })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:600;" }, label))
      text.appendChild(el("div", { class: "hint-text" }, desc))
      optLabel.appendChild(radio)
      optLabel.appendChild(text)
      typeField.appendChild(optLabel)
    }
    body.appendChild(typeField)

    if (sourceType === "existing-asset") {
      const field = el("div", { class: "field" })
      field.appendChild(el("label", {}, "Activo *"))
      const select = el("select", { class: "input" })
      select.appendChild(el("option", { value: "" }, "Seleccionar activo..."))
      if (activos.length === 0) select.appendChild(el("option", { value: "", disabled: true }, "Sin activos disponibles"))
      for (const a of activos) select.appendChild(el("option", { value: a.id }, a.name))
      select.value = selectedAssetId
      select.addEventListener("change", () => { selectedAssetId = select.value; paint() })
      field.appendChild(select)
      body.appendChild(field)
    }

    if (sourceType === "new-asset") {
      const nameField = el("div", { class: "field" })
      nameField.appendChild(el("label", {}, "Nombre del activo *"))
      const assetNameInput = el("input", { class: "input", placeholder: "Ej: Tesla Inc.", value: assetName })
      assetNameInput.addEventListener("input", () => { assetName = assetNameInput.value; syncNameFieldAndSave() })
      nameField.appendChild(assetNameInput)
      body.appendChild(nameField)

      const catField = el("div", { class: "field" })
      catField.appendChild(el("label", {}, "Categoría (opcional)"))
      const catSelect = el("select", { class: "input" })
      catSelect.appendChild(el("option", { value: "" }, "Sin categoría"))
      for (const c of categories) catSelect.appendChild(el("option", { value: c.id }, c.name))
      catSelect.value = assetType
      catSelect.addEventListener("change", () => { assetType = catSelect.value })
      catField.appendChild(catSelect)
      body.appendChild(catField)
    }

    // Nombre del gasto
    const nameField = el("div", { class: "field" })
    nameField.appendChild(el("label", {}, sourceType !== "free" ? "Nombre del gasto (auto-sugerido)" : "Nombre del gasto"))
    const nameInput = el("input", { class: "input", placeholder: suggestedName() || "Ej: Supermercado", value: name })
    nameInput.addEventListener("input", () => { name = nameInput.value; syncSaveBtn() })
    nameField.appendChild(nameInput)
    if (sourceType !== "free" && !name.trim() && suggestedName()) {
      nameField.appendChild(el("p", { class: "hint-text" }, `Se usará: "${suggestedName()}"`))
    }
    body.appendChild(nameField)

    // Monto + moneda
    const row = el("div", { style: "display:flex; gap:0.75rem;" })
    const amountField = el("div", { class: "field", style: "flex:1;" })
    amountField.appendChild(el("label", {}, "Monto *"))
    const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
    amountInput.addEventListener("input", () => { amount = amountInput.value; syncSaveBtn() })
    amountField.appendChild(amountInput)
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

    if (sourceType === "existing-asset" && selectedAssetId && amount && Number(amount) > 0) {
      body.appendChild(el("div", { class: "info-box" }, `Se creará un gasto y se incrementará el valor del activo en ${Number(amount).toLocaleString("es-ES")} ${currency}.`))
    }
    if (sourceType === "new-asset" && assetName.trim() && amount && Number(amount) > 0) {
      body.appendChild(el("div", { class: "info-box" }, `Se creará el activo "${assetName.trim()}" y un gasto vinculado por ${Number(amount).toLocaleString("es-ES")} ${currency}.`))
    }

    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.disabled = saving
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Guardar")
    saveBtn.disabled = !canSave() || saving
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(cancelBtn)
    footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSaveBtn() { saveBtn.disabled = !canSave() || saving }
    function syncNameFieldAndSave() { syncSaveBtn() }
  }

  async function handleSave() {
    if (!canSave()) return
    saving = true
    paint()
    try {
      const amountNum = Number(amount)
      const gastoName = effectiveName()
      const gasto = { name: gastoName, amount: amountNum, currency }

      if (sourceType === "free") {
        await apiPost("/api/gastos", { mode: "free", gasto })
      } else if (sourceType === "existing-asset") {
        await apiPost("/api/gastos", { mode: "existing-asset", gasto, assetId: selectedAssetId })
      } else {
        await apiPost("/api/gastos", {
          mode: "new-asset",
          gasto,
          asset: { name: assetName.trim(), assetType: assetType || null, amount: amountNum, currency },
        })
      }
      dialog.close()
      opts.onCreated?.()
    } finally {
      saving = false
    }
  }

  paint()
}
