// Portado desde components/activos/income/income-rule-dialog.tsx. Un mismo
// diálogo para crear y editar — `rule` presente = editar.

import { apiPost, apiPatch } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { currencies } from "../lib/finance.js"
import { RECURRENCE_TYPE_LABELS } from "../lib/obligations.js"
import { AMOUNT_MODE_LABELS, SETTLEMENT_LABELS } from "../lib/income-streams.js"
import { toast } from "../toast.js"

/** @param {{ recordId, assetCurrency, rule?: object|null, onSaved: () => void }} opts */
export function openIncomeRuleDialog(opts) {
  const dialog = createDialog()
  const editing = !!opts.rule

  let name = "", recurrenceType = "MONTHLY", startDate = new Date().toISOString().slice(0, 10)
  let expectedAmount = "", currency = opts.assetCurrency, reducesPrincipal = false
  let amountMode = "FIXED", percentage = "", adjustmentPct = "", adjustEveryN = ""
  let settlement = "CASH", finite = false, installmentCount = ""
  let saving = false

  if (editing) {
    const r = opts.rule
    name = r.name
    recurrenceType = r.recurrenceType
    startDate = r.startDate.slice(0, 10)
    expectedAmount = String(r.expectedAmount)
    currency = r.currency
    reducesPrincipal = r.reducesPrincipal
    amountMode = r.amountMode
    percentage = r.percentage != null ? String(r.percentage) : ""
    adjustmentPct = r.adjustmentPct != null ? String(r.adjustmentPct) : ""
    adjustEveryN = r.adjustEveryN != null ? String(r.adjustEveryN) : ""
    settlement = r.settlement
    finite = r.installmentCount != null
    installmentCount = r.installmentCount != null ? String(r.installmentCount) : ""
  }

  function isPct() { return amountMode === "PERCENTAGE" }
  function amountOk() { return isPct() ? Number(percentage) > 0 : Number(expectedAmount) > 0 }
  function finiteOk() { return !finite || Number(installmentCount) > 0 }
  function adjustOk() { return !adjustmentPct || Number(adjustEveryN) > 0 }
  function valid() { return name.trim() !== "" && startDate !== "" && amountOk() && finiteOk() && adjustOk() }

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, editing ? "Editar ingreso recurrente" : "Nuevo ingreso recurrente"))
    const body = el("div", { class: "modal-body", style: "max-height:65vh; overflow-y:auto;" })

    const nameField = el("div", { class: "field" })
    nameField.appendChild(el("label", {}, "Nombre"))
    const nameInput = el("input", { class: "input", placeholder: "Ej: Sueldo, Capital, Interés", value: name })
    nameInput.addEventListener("input", () => { name = nameInput.value; syncSave() })
    nameField.appendChild(nameInput)
    body.appendChild(nameField)

    const row1 = el("div", { style: "display:flex; gap:0.75rem;" })
    const recurField = el("div", { class: "field", style: "flex:1;" })
    recurField.appendChild(el("label", {}, "Frecuencia"))
    const recurSelect = el("select", { class: "input" })
    for (const [k, v] of Object.entries(RECURRENCE_TYPE_LABELS)) recurSelect.appendChild(el("option", { value: k }, v))
    recurSelect.value = recurrenceType
    recurSelect.addEventListener("change", () => { recurrenceType = recurSelect.value })
    recurField.appendChild(recurSelect)
    const dateField = el("div", { class: "field", style: "flex:1;" })
    dateField.appendChild(el("label", {}, "Primer cobro"))
    const dateInput = el("input", { class: "input", type: "date", value: startDate })
    dateInput.addEventListener("change", () => { startDate = dateInput.value; syncSave() })
    dateField.appendChild(dateInput)
    row1.appendChild(recurField); row1.appendChild(dateField)
    body.appendChild(row1)

    const modeField = el("div", { class: "field" })
    modeField.appendChild(el("label", {}, "Cómo se calcula el monto"))
    const modeSelect = el("select", { class: "input" })
    for (const [k, v] of Object.entries(AMOUNT_MODE_LABELS)) modeSelect.appendChild(el("option", { value: k }, v))
    modeSelect.value = amountMode
    modeSelect.addEventListener("change", () => { amountMode = modeSelect.value; paint() })
    modeField.appendChild(modeSelect)
    if (isPct()) modeField.appendChild(el("p", { class: "hint-text" }, "Cada cobro se calcula sobre el valor del activo al generarse. Si el activo sube, el ingreso sube con él."))
    body.appendChild(modeField)

    const row2 = el("div", { style: "display:flex; gap:0.75rem;" })
    const amountField = el("div", { class: "field", style: "flex:1;" })
    amountField.appendChild(el("label", {}, isPct() ? "Porcentaje (%)" : "Monto esperado"))
    const amountInput = el("input", { class: "input", placeholder: isPct() ? "5.00" : "0.00", value: isPct() ? percentage : expectedAmount })
    amountInput.addEventListener("input", () => {
      if (isPct()) percentage = amountInput.value; else expectedAmount = amountInput.value
      syncSave()
    })
    amountField.appendChild(amountInput)
    const curField = el("div", { class: "field", style: "width:6rem;" })
    curField.appendChild(el("label", {}, "Moneda"))
    const curSelect = el("select", { class: "input" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = currency
    curSelect.addEventListener("change", () => { currency = curSelect.value })
    curField.appendChild(curSelect)
    row2.appendChild(amountField); row2.appendChild(curField)
    body.appendChild(row2)

    if (!isPct()) {
      const adjField = el("div", { class: "field" })
      adjField.appendChild(el("label", {}, "Ajuste periódico (opcional)"))
      const adjRow = el("div", { style: "display:flex; align-items:center; gap:0.5rem;" })
      const adjPctInput = el("input", { class: "input", placeholder: "0", style: "width:5rem;", value: adjustmentPct })
      adjPctInput.addEventListener("input", () => { adjustmentPct = adjPctInput.value; syncSave() })
      const adjEveryInput = el("input", { class: "input", placeholder: "3", style: "width:4.5rem;", value: adjustEveryN })
      adjEveryInput.addEventListener("input", () => { adjustEveryN = adjEveryInput.value; syncSave() })
      adjRow.appendChild(adjPctInput)
      adjRow.appendChild(el("span", { class: "hint-text" }, "% cada"))
      adjRow.appendChild(adjEveryInput)
      adjRow.appendChild(el("span", { class: "hint-text" }, "cobros"))
      adjField.appendChild(adjRow)
      adjField.appendChild(el("p", { class: "hint-text" }, "Aumento compuesto: con 10% cada 3 cobros, los primeros tres van al monto base, los siguientes tres un 10% arriba, y así. Para sueldos y alquileres ajustados por inflación."))
      body.appendChild(adjField)
    }

    const finiteBox = el("div", { style: "display:flex; flex-direction:column; gap:0.5rem;" })
    const finiteLabel = el("label", { style: "display:flex; align-items:flex-start; gap:0.5rem; font-size:0.875rem; cursor:pointer;" })
    const finiteCb = el("input", { type: "checkbox", checked: finite })
    finiteCb.addEventListener("change", () => { finite = finiteCb.checked; paint() })
    const finiteText = el("div")
    finiteText.appendChild(el("div", { style: "font-weight:500;" }, "Cantidad de cobros limitada"))
    finiteText.appendChild(el("div", { class: "hint-text" }, "Para préstamos y cobros en cuotas. Al agotarse, la regla se marca completada sola."))
    finiteLabel.appendChild(finiteCb); finiteLabel.appendChild(finiteText)
    finiteBox.appendChild(finiteLabel)
    if (finite) {
      const countRow = el("div", { style: "display:flex; align-items:center; gap:0.5rem; padding-left:1.5rem;" })
      const countInput = el("input", { class: "input", placeholder: "12", style: "width:5rem;", value: installmentCount })
      countInput.addEventListener("input", () => { installmentCount = countInput.value; syncSave() })
      countRow.appendChild(countInput)
      countRow.appendChild(el("span", { class: "hint-text" }, "cuotas en total"))
      finiteBox.appendChild(countRow)
    }
    body.appendChild(finiteBox)

    const settlementField = el("div", { class: "field" })
    settlementField.appendChild(el("label", {}, "Cómo se cobra"))
    const settlementSelect = el("select", { class: "input" })
    for (const [k, v] of Object.entries(SETTLEMENT_LABELS)) settlementSelect.appendChild(el("option", { value: k }, v))
    settlementSelect.value = settlement
    settlementSelect.addEventListener("change", () => { settlement = settlementSelect.value; paint() })
    settlementField.appendChild(settlementSelect)
    if (settlement === "IN_KIND") settlementField.appendChild(el("p", { class: "hint-text" }, "No entra efectivo: crece el propio activo. Para staking o dividendos reinvertidos. Contablemente se asienta contra activos, no contra caja."))
    body.appendChild(settlementField)

    const reducesLabel = el("label", { class: "radio-option" })
    const reducesCb = el("input", { type: "checkbox", checked: reducesPrincipal })
    reducesCb.addEventListener("change", () => { reducesPrincipal = reducesCb.checked })
    const reducesText = el("div")
    reducesText.appendChild(el("div", { style: "font-weight:500;" }, "Descuenta del capital"))
    reducesText.appendChild(el("div", { class: "hint-text" }, "Activalo para cuotas que devuelven capital (préstamos). El valor del activo baja con cada cobro y contablemente es conversión de activo, no ganancia. Dejalo apagado para sueldos, intereses y alquileres."))
    reducesLabel.appendChild(reducesCb); reducesLabel.appendChild(reducesText)
    body.appendChild(reducesLabel)

    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.disabled = saving
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Guardar")
    saveBtn.disabled = !valid() || saving
    saveBtn.addEventListener("click", handleSave)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSave() { saveBtn.disabled = !valid() || saving }
  }

  async function handleSave() {
    if (!valid()) return
    saving = true
    paint()
    try {
      const data = {
        name: name.trim(), recurrenceType, startDate,
        expectedAmount: isPct() ? 0 : Number(expectedAmount), currency, reducesPrincipal, amountMode,
        percentage: isPct() ? Number(percentage) : undefined,
        adjustmentPct: !isPct() && adjustmentPct ? Number(adjustmentPct) : undefined,
        adjustEveryN: !isPct() && adjustmentPct ? Number(adjustEveryN) : undefined,
        settlement, installmentCount: finite ? Number(installmentCount) : undefined,
      }
      if (editing) {
        await apiPatch(`/api/income/rules/${opts.rule.id}`, data)
        toast({ title: "Regla actualizada", description: "Los cobros pendientes que aún no llegaron al dashboard se regeneraron con el monto nuevo." })
      } else {
        await apiPost(`/api/assets/${opts.recordId}/income`, data)
        toast({ title: "Ingreso recurrente creado", description: "Se generaron los próximos 12 meses." })
      }
      dialog.close()
      opts.onSaved()
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo guardar la regla", description: e.message })
    } finally {
      saving = false
    }
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
