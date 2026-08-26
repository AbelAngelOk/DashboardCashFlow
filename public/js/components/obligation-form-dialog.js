// Portado desde components/obligations/obligation-form-dialog.tsx. Diálogo
// de 2 pasos: elegir tipo (Recurrente/Cuotas/Fijo), después el formulario
// específico. RECURRING permite armar N reglas antes de guardar (cada una
// se crea con un POST separado a /rules, igual que el original).

import { apiPost } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { currencies } from "../lib/finance.js"
import { OBLIGATION_TYPE_LABELS, RECURRENCE_TYPE_LABELS } from "../lib/obligations.js"

function todayISO() { return new Date().toISOString().slice(0, 10) }
function nextMonthFirstISO() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}
function newRuleDraft() {
  return { id: crypto.randomUUID(), name: "", recurrenceType: "MONTHLY", startDate: todayISO(), expectedAmount: "", currency: "ARS" }
}

/** @param {{ onCreated: (id: string) => void }} opts */
export function openObligationFormDialog(opts) {
  const dialog = createDialog()

  let step = "type"
  let obligationType = "RECURRING"
  let name = ""
  let description = ""
  let currency = "ARS"
  let saving = false
  let fixedAmount = ""
  let installmentCount = "12"
  let installmentAmount = ""
  let firstDueDate = nextMonthFirstISO()
  let rules = [newRuleDraft()]

  function canSave() {
    if (!name.trim()) return false
    if (obligationType === "RECURRING") return rules.some((r) => r.name.trim() && r.expectedAmount)
    if (obligationType === "INSTALLMENT") return !!(installmentAmount && installmentCount && firstDueDate)
    return !!fixedAmount
  }

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Nueva obligación"))
    const body = el("div", { class: "modal-body", style: "max-height:65vh; overflow-y:auto;" })

    if (step === "type") paintTypeStep(body)
    else paintDetailsStep(body)

    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    if (step === "details") {
      const backBtn = el("button", { class: "btn" }, "Atrás")
      backBtn.addEventListener("click", () => { step = "type"; paint() })
      footer.appendChild(backBtn)
    }
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    footer.appendChild(cancelBtn)
    if (step === "type") {
      const nextBtn = el("button", { class: "btn btn-primary" }, "Continuar")
      nextBtn.addEventListener("click", () => { step = "details"; paint() })
      footer.appendChild(nextBtn)
    } else {
      const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Crear obligación")
      saveBtn.disabled = !canSave() || saving
      saveBtn.addEventListener("click", handleSave)
      footer.appendChild(saveBtn)
    }
    dialog.appendChild(footer)
  }

  function paintTypeStep(body) {
    body.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "Tipo de obligación"))
    const descriptions = {
      RECURRING: "Alquiler, servicios, gastos periódicos. Muestra costo anual proyectado.",
      INSTALLMENT: "Financiaciones, cuotas. Monto fijo dividido en N cuotas.",
      FIXED: "Préstamos, deudas de monto conocido. El saldo se reduce con cada pago.",
    }
    for (const t of ["RECURRING", "INSTALLMENT", "FIXED"]) {
      const optLabel = el("label", { class: `radio-option${obligationType === t ? " selected" : ""}` })
      const radio = el("input", { type: "radio", name: "obligation-type", checked: obligationType === t })
      radio.addEventListener("change", () => { obligationType = t; paint() })
      const text = el("div")
      text.appendChild(el("p", { style: "font-weight:600; font-size:0.875rem;" }, OBLIGATION_TYPE_LABELS[t]))
      text.appendChild(el("p", { class: "hint-text" }, descriptions[t]))
      optLabel.appendChild(radio)
      optLabel.appendChild(text)
      body.appendChild(optLabel)
    }
  }

  function syncSave() {
    const saveBtn = dialog.querySelector(".modal-footer .btn-primary")
    if (saveBtn) saveBtn.disabled = !canSave() || saving
  }

  function paintDetailsStep(body) {
    const nameField = el("div", { class: "field" })
    nameField.appendChild(el("label", {}, "Nombre *"))
    const nameInput = el("input", { class: "input", placeholder: "Ej: Alquiler departamento", value: name })
    nameInput.addEventListener("input", () => { name = nameInput.value; syncSave() })
    nameField.appendChild(nameInput)
    body.appendChild(nameField)

    const descField = el("div", { class: "field" })
    descField.appendChild(el("label", {}, "Descripción (opcional)"))
    const descInput = el("textarea", { class: "input", rows: 2, style: "resize:none;", value: description })
    descInput.addEventListener("input", () => { description = descInput.value })
    descField.appendChild(descInput)
    body.appendChild(descField)

    const curField = el("div", { class: "field" })
    curField.appendChild(el("label", {}, "Moneda principal"))
    const curSelect = el("select", { class: "input" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = currency
    curSelect.addEventListener("change", () => { currency = curSelect.value })
    curField.appendChild(curSelect)
    body.appendChild(curField)

    if (obligationType === "FIXED") {
      const f = el("div", { class: "field" })
      f.appendChild(el("label", {}, "Monto pendiente inicial *"))
      const input = el("input", { class: "input", placeholder: "0.00", value: fixedAmount })
      input.addEventListener("input", () => { fixedAmount = input.value; syncSave() })
      f.appendChild(input)
      body.appendChild(f)
    }

    if (obligationType === "INSTALLMENT") {
      const row = el("div", { style: "display:flex; gap:0.75rem;" })
      const countField = el("div", { class: "field", style: "flex:1;" })
      countField.appendChild(el("label", {}, "Cantidad de cuotas *"))
      const countInput = el("input", { class: "input", type: "number", value: installmentCount })
      countInput.addEventListener("input", () => { installmentCount = countInput.value; syncSave(); refreshTotal() })
      countField.appendChild(countInput)
      const amountField = el("div", { class: "field", style: "flex:1;" })
      amountField.appendChild(el("label", {}, "Monto por cuota *"))
      const amountInput = el("input", { class: "input", placeholder: "0.00", value: installmentAmount })
      amountInput.addEventListener("input", () => { installmentAmount = amountInput.value; syncSave(); refreshTotal() })
      amountField.appendChild(amountInput)
      row.appendChild(countField); row.appendChild(amountField)
      body.appendChild(row)

      const dateField = el("div", { class: "field" })
      dateField.appendChild(el("label", {}, "Vencimiento primera cuota *"))
      const dateInput = el("input", { class: "input", type: "date", value: firstDueDate })
      dateInput.addEventListener("change", () => { firstDueDate = dateInput.value; syncSave() })
      dateField.appendChild(dateInput)
      body.appendChild(dateField)

      const totalP = el("p", { class: "hint-text" })
      body.appendChild(totalP)
      function refreshTotal() {
        if (installmentCount && installmentAmount) {
          totalP.textContent = `Total: ${(parseInt(installmentCount) * parseFloat(installmentAmount || "0")).toLocaleString("es-ES")} ${currency}`
        } else {
          totalP.textContent = ""
        }
      }
      refreshTotal()
    }

    if (obligationType === "RECURRING") {
      const rulesHeader = el("div", { style: "display:flex; align-items:center; justify-content:space-between;" })
      rulesHeader.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "Reglas de gasto"))
      const addBtn = el("button", { class: "links-add-btn" }, "+ Agregar regla")
      addBtn.addEventListener("click", () => { rules = [...rules, newRuleDraft()]; paint() })
      rulesHeader.appendChild(addBtn)
      body.appendChild(rulesHeader)

      rules.forEach((rule, idx) => {
        const box = el("div", { class: "rule-draft" })
        const head = el("div", { style: "display:flex; align-items:center; justify-content:space-between;" })
        head.appendChild(el("span", { class: "hint-text" }, `Regla ${idx + 1}`))
        if (rules.length > 1) {
          const rmBtn = el("button", { class: "flow-row-icon-btn" }, "✕")
          rmBtn.addEventListener("click", () => { rules = rules.filter((r) => r.id !== rule.id); paint() })
          head.appendChild(rmBtn)
        }
        box.appendChild(head)

        const nameInput = el("input", { class: "input", placeholder: "Nombre (ej: Alquiler)", value: rule.name })
        nameInput.addEventListener("input", () => { rule.name = nameInput.value; syncSave() })
        box.appendChild(nameInput)

        const row = el("div", { style: "display:flex; gap:0.5rem;" })
        const recurSelect = el("select", { class: "input" })
        for (const [k, v] of Object.entries(RECURRENCE_TYPE_LABELS)) recurSelect.appendChild(el("option", { value: k }, v))
        recurSelect.value = rule.recurrenceType
        recurSelect.addEventListener("change", () => { rule.recurrenceType = recurSelect.value })
        const amountInput = el("input", { class: "input", placeholder: "Monto", value: rule.expectedAmount, style: "width:7rem;" })
        amountInput.addEventListener("input", () => { rule.expectedAmount = amountInput.value; syncSave() })
        const currSelect = el("select", { class: "input", style: "width:5rem;" })
        for (const c of currencies) currSelect.appendChild(el("option", { value: c }, c))
        currSelect.value = rule.currency
        currSelect.addEventListener("change", () => { rule.currency = currSelect.value })
        row.appendChild(recurSelect); row.appendChild(amountInput); row.appendChild(currSelect)
        box.appendChild(row)

        const dateField = el("div", { class: "field" })
        dateField.appendChild(el("label", { style: "font-size:0.625rem;" }, "Fecha inicio"))
        const dateInput = el("input", { class: "input", type: "date", value: rule.startDate })
        dateInput.addEventListener("change", () => { rule.startDate = dateInput.value })
        dateField.appendChild(dateInput)
        box.appendChild(dateField)

        body.appendChild(box)
      })
    }
  }

  async function handleSave() {
    if (!canSave()) return
    saving = true
    paint()
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        obligationType,
        currency,
        ...(obligationType === "FIXED" && fixedAmount ? { fixedAmount: parseFloat(fixedAmount) } : {}),
        ...(obligationType === "INSTALLMENT" ? {
          installmentCount: parseInt(installmentCount),
          installmentAmount: parseFloat(installmentAmount),
          firstDueDate,
        } : {}),
      }
      const { id } = await apiPost("/api/obligations", payload)

      if (obligationType === "RECURRING") {
        for (const rule of rules) {
          if (!rule.name.trim() || !rule.expectedAmount) continue
          await apiPost(`/api/obligations/${id}/rules`, {
            name: rule.name.trim(), recurrenceType: rule.recurrenceType,
            startDate: rule.startDate, expectedAmount: parseFloat(rule.expectedAmount), currency: rule.currency,
          })
        }
      }
      dialog.close()
      opts.onCreated(id)
    } finally {
      saving = false
    }
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
