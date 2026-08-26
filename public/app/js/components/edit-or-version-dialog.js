// Portado desde components/shared/edit-or-version-dialog.tsx. Diálogo de 2
// pasos: elegir modo (editar in-situ / nuevo período) y después el formulario.
// Ya era genérico sobre recordType en el original (ingreso|gasto) — se
// mantiene así acá, un solo módulo para ambas pantallas.

import { apiPost } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { currencies } from "../lib/finance.js"

/**
 * @param {{ recordId, recordType: "ingreso"|"gasto", initialName, initialAmount,
 *   initialCurrency, onSaved: (newId: string) => void }} opts
 */
export function openEditOrVersionDialog(opts) {
  const dialog = createDialog()
  const typeLabel = opts.recordType === "ingreso" ? "ingreso" : "gasto"

  let step = "mode"
  let mode = "edit"
  let name = opts.initialName
  let amount = String(opts.initialAmount)
  let currency = opts.initialCurrency
  let effectiveDate = ""
  let saving = false

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, `Editar ${typeLabel}`))
    if (step === "mode") paintModeStep()
    else paintFormStep()
  }

  function paintModeStep() {
    const body = el("div", { class: "modal-body" })
    body.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "¿Qué deseas hacer?"))

    const options = [
      ["edit", `Editar este ${typeLabel}`, "Modifica el registro actual. El historial anterior se pierde."],
      ["new-period", "Crear nuevo período", `Crea un nuevo ${typeLabel} activo y marca el actual como histórico.`],
    ]
    for (const [value, label, desc] of options) {
      const optLabel = el("label", { class: `radio-option${mode === value ? " selected" : ""}` })
      const radio = el("input", { type: "radio", name: "edit-mode", checked: mode === value })
      radio.addEventListener("change", () => { mode = value; paint() })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:600; font-size:0.875rem;" }, label))
      text.appendChild(el("div", { class: "hint-text" }, desc))
      optLabel.appendChild(radio)
      optLabel.appendChild(text)
      body.appendChild(optLabel)
    }
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const nextBtn = el("button", { class: "btn btn-primary" }, "Continuar")
    nextBtn.addEventListener("click", () => { step = "form"; paint() })
    footer.appendChild(cancelBtn)
    footer.appendChild(nextBtn)
    dialog.appendChild(footer)
  }

  function paintFormStep() {
    const body = el("div", { class: "modal-body" })

    const nameField = el("div", { class: "field" })
    nameField.appendChild(el("label", {}, "Nombre"))
    const nameInput = el("input", { class: "input", value: name })
    nameInput.addEventListener("input", () => { name = nameInput.value; syncSaveBtn() })
    nameField.appendChild(nameInput)
    body.appendChild(nameField)

    const row = el("div", { style: "display:flex; gap:0.75rem;" })
    const amountField = el("div", { class: "field", style: "flex:1;" })
    amountField.appendChild(el("label", {}, "Monto"))
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

    if (mode === "new-period") {
      const dateField = el("div", { class: "field" })
      dateField.appendChild(el("label", {}, "Fecha efectiva (opcional)"))
      const dateInput = el("input", { class: "input", type: "date", value: effectiveDate })
      dateInput.addEventListener("change", () => { effectiveDate = dateInput.value })
      dateField.appendChild(dateInput)
      body.appendChild(dateField)
    }
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const backBtn = el("button", { class: "btn" }, "Atrás")
    backBtn.addEventListener("click", () => { step = "mode"; paint() })
    const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : (mode === "edit" ? "Guardar cambios" : "Crear nuevo período"))
    saveBtn.disabled = !name.trim() || !amount || saving
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(backBtn)
    footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSaveBtn() { saveBtn.disabled = !name.trim() || !amount || saving }
  }

  async function handleSave() {
    if (!name.trim() || !amount) return
    saving = true
    paint()
    try {
      const result = await apiPost("/api/records/version", {
        id: opts.recordId,
        data: {
          name: name.trim(),
          amount: Number(amount),
          currency,
          effectiveDate: effectiveDate || undefined,
        },
        mode,
        recordType: opts.recordType,
      })
      dialog.close()
      opts.onSaved(result.id)
    } finally {
      saving = false
    }
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
