// Portado desde components/activos/asset-form-dialog.tsx. Diálogo de 2
// pasos: preset (define con qué capacidades arranca) → detalle. Un activo no
// tiene tipo fijo — la categoría es una etiqueta libre (ver CLAUDE.md, v2.5.0).
//
// Nota: el original lee `settings.customAssetTypes` para sembrar categorías
// legadas de localStorage. Esa lista ya no tiene forma de poblarse desde la
// UI actual (decisión tomada al portar Configuración) — siempre está vacía
// para cualquier usuario nuevo, así que acá se siembra sin ese extra.

import { apiPost, apiPatch } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { currencies, defaultCurrency } from "../lib/finance.js"
import { ASSET_PRESETS, CAPABILITY_LABELS, CAPABILITY_DESCRIPTIONS } from "../lib/asset-categories.js"
import { RECURRENCE_TYPE_LABELS } from "../lib/obligations.js"
import { toast } from "../toast.js"
import { invalidateCache, apiGet } from "../api.js"

const NEW_CATEGORY = "__new__"
const NO_CATEGORY = "__none__"

function newRuleDraft(currency, reducesPrincipal) {
  return { id: crypto.randomUUID(), name: "", recurrenceType: "MONTHLY", startDate: new Date().toISOString().slice(0, 10), expectedAmount: "", currency, reducesPrincipal }
}

/** @param {{ onCreate?: () => void, parentId?: string, defaultName?: string }} opts */
export async function openAssetFormDialog(opts = {}) {
  const dialog = createDialog()
  dialog.appendChild(el("div", { class: "modal-body" }, "Cargando..."))
  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  dialog.showModal()

  // Siembra/lee categorías (mismo POST ?seed=1 que ya usaba Configuración)
  const { categories } = await apiPost("/api/categories?seed=1", { extra: [] })
  invalidateCache("/api/categories")

  let step = "preset"
  let preset = "UNITS"
  let categoryId = NO_CATEGORY
  let newCategoryName = ""
  let name = opts.defaultName ?? ""
  let description = ""
  let ticker = ""
  let amount = ""
  let currency = defaultCurrency
  let caps = []
  let valueIsProjection = false
  let positionTracking = false
  let qty = ""
  let avgPrice = ""
  let rules = []
  let createGasto = false
  let saving = false

  function applyPreset(p) {
    const def = ASSET_PRESETS[p]
    preset = p
    caps = [...def.capabilities]
    valueIsProjection = def.valueIsProjection
    rules = def.capabilities.includes("income") ? [newRuleDraft(currency, def.reducesPrincipal)] : []
  }

  function hasCap(c) { return caps.includes(c) }
  function toggleCap(c) {
    caps = caps.includes(c) ? caps.filter((x) => x !== c) : [...caps, c]
    if (c === "income") {
      rules = caps.includes("income") ? [newRuleDraft(currency, ASSET_PRESETS[preset].reducesPrincipal)] : []
    }
  }

  function calcMismatch() {
    if (!hasCap("quantity") || qty === "" || avgPrice === "" || amount === "") return false
    return Math.abs(Number(qty) * Number(avgPrice) - Number(amount)) > 0.01
  }
  function needsAmount() { return !valueIsProjection }
  function rulesOk() { return !hasCap("income") || rules.some((r) => r.name.trim() && Number(r.expectedAmount) > 0) }
  function categoryOk() { return categoryId !== NEW_CATEGORY || newCategoryName.trim() !== "" }
  function canSave() {
    return name.trim() !== "" && (!needsAmount() || amount !== "") && !calcMismatch() && rulesOk() && categoryOk()
  }

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Nuevo activo"))
    const body = el("div", { class: "modal-body", style: "max-height:65vh; overflow-y:auto;" })
    if (step === "preset") paintPresetStep(body)
    else paintDetailsStep(body)
    dialog.appendChild(body)
    dialog.appendChild(paintFooter())
  }

  function paintPresetStep(body) {
    body.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "¿Qué clase de activo es?"))
    body.appendChild(el("p", { class: "hint-text" }, "Solo define con qué capacidades arranca. Podés cambiarlas después: un activo no tiene tipo fijo."))
    for (const p of Object.keys(ASSET_PRESETS)) {
      const def = ASSET_PRESETS[p]
      const optLabel = el("label", { class: `radio-option${preset === p ? " selected" : ""}` })
      const radio = el("input", { type: "radio", name: "asset-preset", checked: preset === p })
      radio.addEventListener("change", () => { applyPreset(p); paint() })
      const text = el("div")
      text.appendChild(el("p", { style: "font-weight:600; font-size:0.875rem;" }, def.label))
      text.appendChild(el("p", { class: "hint-text" }, def.description))
      optLabel.appendChild(radio); optLabel.appendChild(text)
      body.appendChild(optLabel)
    }
  }

  function paintDetailsStep(body) {
    const nameField = el("div", { class: "field" })
    nameField.appendChild(el("label", {}, "Nombre *"))
    const nameInput = el("input", { class: "input", placeholder: "Ej: Departamento Palermo", value: name })
    nameInput.addEventListener("input", () => { name = nameInput.value; syncFooter() })
    nameField.appendChild(nameInput)
    body.appendChild(nameField)

    const catField = el("div", { class: "field" })
    catField.appendChild(el("label", {}, "Categoría (etiqueta)"))
    const catSelect = el("select", { class: "input" })
    catSelect.appendChild(el("option", { value: NO_CATEGORY }, "Sin categoría"))
    for (const c of categories) catSelect.appendChild(el("option", { value: c.id }, c.name))
    catSelect.appendChild(el("option", { value: NEW_CATEGORY }, "+ Crear categoría nueva"))
    catSelect.value = categoryId
    catSelect.addEventListener("change", () => { categoryId = catSelect.value; paint() })
    catField.appendChild(catSelect)
    if (categoryId === NEW_CATEGORY) {
      const newCatInput = el("input", { class: "input", placeholder: "Ej: Inmuebles", style: "margin-top:0.25rem;", value: newCategoryName })
      newCatInput.addEventListener("input", () => { newCategoryName = newCatInput.value; syncFooter() })
      catField.appendChild(newCatInput)
    }
    body.appendChild(catField)

    const descField = el("div", { class: "field" })
    descField.appendChild(el("label", {}, "Descripción (opcional)"))
    const descInput = el("textarea", { class: "input", rows: 2, style: "resize:none;", value: description })
    descInput.addEventListener("input", () => { description = descInput.value })
    descField.appendChild(descInput)
    body.appendChild(descField)

    const row = el("div", { style: "display:flex; gap:0.75rem;" })
    if (needsAmount()) {
      const amountField = el("div", { class: "field", style: "flex:1;" })
      amountField.appendChild(el("label", {}, ASSET_PRESETS[preset].reducesPrincipal ? "Capital inicial *" : "Valor inicial *"))
      const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
      if (calcMismatch()) amountInput.style.borderColor = "#f59e0b"
      amountInput.addEventListener("input", () => { amount = amountInput.value; paint() })
      amountField.appendChild(amountInput)
      row.appendChild(amountField)
    } else {
      row.appendChild(el("p", { class: "hint-text", style: "flex:1; align-self:flex-end;" }, "El valor se calcula solo: es la proyección anual de los ingresos de abajo."))
    }
    const curField = el("div", { class: "field", style: "width:6rem;" })
    curField.appendChild(el("label", {}, "Moneda"))
    const curSelect = el("select", { class: "input" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = currency
    curSelect.addEventListener("change", () => { currency = curSelect.value })
    curField.appendChild(curSelect)
    row.appendChild(curField)
    body.appendChild(row)

    // Capacidades
    const capBox = el("div", { style: "display:flex; flex-direction:column; gap:0.5rem; border:var(--border); padding:0.75rem;" })
    capBox.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "Capacidades"))
    for (const c of ["quantity", "income", "boards"]) {
      const capLabel = el("label", { style: "display:flex; align-items:flex-start; gap:0.5rem; font-size:0.875rem; cursor:pointer;" })
      const cb = el("input", { type: "checkbox", checked: hasCap(c) })
      cb.addEventListener("change", () => { toggleCap(c); paint() })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:500;" }, CAPABILITY_LABELS[c]))
      text.appendChild(el("div", { class: "hint-text" }, CAPABILITY_DESCRIPTIONS[c]))
      capLabel.appendChild(cb); capLabel.appendChild(text)
      capBox.appendChild(capLabel)
    }
    if (hasCap("quantity")) {
      const posLabel = el("label", { style: "display:flex; align-items:flex-start; gap:0.5rem; font-size:0.875rem; cursor:pointer; padding-left:1.5rem;" })
      const cb = el("input", { type: "checkbox", checked: positionTracking })
      cb.addEventListener("change", () => { positionTracking = cb.checked })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:500;" }, "Posiciones LONG / SHORT"))
      text.appendChild(el("div", { class: "hint-text" }, "Para futuros: cada movimiento registra el sentido de la posición."))
      posLabel.appendChild(cb); posLabel.appendChild(text)
      capBox.appendChild(posLabel)
    }
    if (hasCap("income")) {
      const projLabel = el("label", { style: "display:flex; align-items:flex-start; gap:0.5rem; font-size:0.875rem; cursor:pointer;" })
      const cb = el("input", { type: "checkbox", checked: valueIsProjection })
      cb.addEventListener("change", () => { valueIsProjection = cb.checked; paint() })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:500;" }, "El valor es la proyección anual"))
      text.appendChild(el("div", { class: "hint-text" }, "Para sueldos y rentas sin patrimonio propio. Apagado, el valor lo fijás vos."))
      projLabel.appendChild(cb); projLabel.appendChild(text)
      capBox.appendChild(projLabel)
    }
    body.appendChild(capBox)

    if (hasCap("quantity")) {
      const unitsRow = el("div", { style: "display:flex; gap:0.75rem;" })
      const tickerField = el("div", { class: "field", style: "flex:1;" })
      tickerField.appendChild(el("label", {}, "Ticker"))
      const tickerInput = el("input", { class: "input", placeholder: "AAPL, BTCUSDT", value: ticker })
      tickerInput.addEventListener("input", () => { ticker = tickerInput.value })
      tickerField.appendChild(tickerInput)
      const qtyField = el("div", { class: "field", style: "flex:1;" })
      qtyField.appendChild(el("label", {}, "Cantidad"))
      const qtyInput = el("input", { class: "input", placeholder: "0", value: qty })
      qtyInput.addEventListener("input", () => {
        qty = qtyInput.value
        if (qty !== "" && avgPrice !== "") amount = String(Number(qty) * Number(avgPrice))
        paint()
      })
      qtyField.appendChild(qtyInput)
      const priceField = el("div", { class: "field", style: "flex:1;" })
      priceField.appendChild(el("label", {}, "Precio prom."))
      const priceInput = el("input", { class: "input", placeholder: "0.00", value: avgPrice })
      priceInput.addEventListener("input", () => {
        avgPrice = priceInput.value
        if (avgPrice !== "" && qty !== "") amount = String(Number(qty) * Number(avgPrice))
        paint()
      })
      priceField.appendChild(priceInput)
      unitsRow.appendChild(tickerField); unitsRow.appendChild(qtyField); unitsRow.appendChild(priceField)
      body.appendChild(unitsRow)
      if (calcMismatch()) {
        body.appendChild(el("p", { class: "warn-text" }, `El valor (${amount}) no coincide con cantidad × precio (${(Number(qty) * Number(avgPrice)).toFixed(2)}). Corregí uno de los tres campos.`))
      }
    }

    if (hasCap("income")) {
      const rulesBox = el("div", { style: "display:flex; flex-direction:column; gap:0.75rem;" })
      const rulesHead = el("div", { style: "display:flex; align-items:center; justify-content:space-between;" })
      rulesHead.appendChild(el("label", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, "Reglas de ingreso"))
      const addBtn = el("button", { class: "links-add-btn" }, "+ Agregar regla")
      addBtn.addEventListener("click", () => { rules = [...rules, newRuleDraft(currency, ASSET_PRESETS[preset].reducesPrincipal)]; paint() })
      rulesHead.appendChild(addBtn)
      rulesBox.appendChild(rulesHead)

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

        const nameInput = el("input", { class: "input", placeholder: "Nombre (ej: Sueldo, Capital, Interés)", value: rule.name })
        nameInput.addEventListener("input", () => { rule.name = nameInput.value; syncFooter() })
        box.appendChild(nameInput)

        const ruleRow = el("div", { style: "display:flex; gap:0.5rem;" })
        const recurSelect = el("select", { class: "input" })
        for (const [k, v] of Object.entries(RECURRENCE_TYPE_LABELS)) recurSelect.appendChild(el("option", { value: k }, v))
        recurSelect.value = rule.recurrenceType
        recurSelect.addEventListener("change", () => { rule.recurrenceType = recurSelect.value })
        const amountInput = el("input", { class: "input", placeholder: "Monto", style: "width:7rem;", value: rule.expectedAmount })
        amountInput.addEventListener("input", () => { rule.expectedAmount = amountInput.value; syncFooter() })
        const currSelect = el("select", { class: "input", style: "width:5rem;" })
        for (const c of currencies) currSelect.appendChild(el("option", { value: c }, c))
        currSelect.value = rule.currency
        currSelect.addEventListener("change", () => { rule.currency = currSelect.value })
        ruleRow.appendChild(recurSelect); ruleRow.appendChild(amountInput); ruleRow.appendChild(currSelect)
        box.appendChild(ruleRow)

        const bottomRow = el("div", { style: "display:flex; align-items:flex-end; gap:0.75rem;" })
        const dateField = el("div", { class: "field", style: "flex:1;" })
        dateField.appendChild(el("label", { style: "font-size:0.625rem;" }, "Primer cobro"))
        const dateInput = el("input", { class: "input", type: "date", value: rule.startDate })
        dateInput.addEventListener("change", () => { rule.startDate = dateInput.value })
        dateField.appendChild(dateInput)
        const reducesLabel = el("label", { style: "display:flex; align-items:center; gap:0.375rem; font-size:0.75rem; cursor:pointer; padding-bottom:0.5rem;" })
        const reducesCb = el("input", { type: "checkbox", checked: rule.reducesPrincipal })
        reducesCb.addEventListener("change", () => { rule.reducesPrincipal = reducesCb.checked })
        reducesLabel.appendChild(reducesCb)
        reducesLabel.appendChild(document.createTextNode("Descuenta capital"))
        bottomRow.appendChild(dateField); bottomRow.appendChild(reducesLabel)
        box.appendChild(bottomRow)

        rulesBox.appendChild(box)
      })
      rulesBox.appendChild(el("p", { class: "hint-text" }, "Podés afinar cada regla —porcentaje, ajuste periódico, cuotas, cobro en especie— desde el detalle del activo una vez creado."))
      body.appendChild(rulesBox)
    }

    if (!opts.parentId && needsAmount()) {
      const gastoLabel = el("label", { class: "radio-option" })
      const cb = el("input", { type: "checkbox", checked: createGasto })
      cb.addEventListener("change", () => { createGasto = cb.checked })
      const text = el("div")
      text.appendChild(el("div", { style: "font-weight:500;" }, "Generar gasto asociado"))
      text.appendChild(el("div", { class: "hint-text" }, `Registra un gasto por el monto invertido: "Inversión en ${name.trim() || "activo"}"`))
      gastoLabel.appendChild(cb); gastoLabel.appendChild(text)
      body.appendChild(gastoLabel)
    }
  }

  function paintFooter() {
    const footer = el("div", { class: "modal-footer" })
    if (step === "details") {
      const backBtn = el("button", { class: "btn" }, "Atrás")
      backBtn.disabled = saving
      backBtn.addEventListener("click", () => { step = "preset"; paint() })
      footer.appendChild(backBtn)
    }
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.disabled = saving
    cancelBtn.addEventListener("click", () => dialog.close())
    footer.appendChild(cancelBtn)
    if (step === "preset") {
      const nextBtn = el("button", { class: "btn btn-primary" }, "Continuar")
      nextBtn.addEventListener("click", () => { applyPreset(preset); step = "details"; paint() })
      footer.appendChild(nextBtn)
    } else {
      const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Crear activo")
      saveBtn.disabled = !canSave() || saving
      saveBtn.addEventListener("click", handleSave)
      footer.appendChild(saveBtn)
    }
    return footer
  }

  function syncFooter() {
    const saveBtn = dialog.querySelector(".modal-footer .btn-primary")
    if (saveBtn && step === "details") saveBtn.disabled = !canSave() || saving
  }

  function buildMetadata() {
    const meta = {}
    if (valueIsProjection) meta.valueMode = "PROJECTION"
    if (positionTracking) meta.positionTracking = true
    return Object.keys(meta).length > 0 ? meta : undefined
  }

  async function handleSave() {
    if (!canSave()) return
    saving = true
    paint()
    try {
      let finalCategoryId = null
      if (categoryId === NEW_CATEGORY) {
        const created = await apiPost("/api/categories", { name: newCategoryName.trim() })
        finalCategoryId = created.id
        invalidateCache("/api/categories")
      } else if (categoryId !== NO_CATEGORY) {
        finalCategoryId = categoryId
      }

      const initialAmount = valueIsProjection ? 0 : Number(amount)

      const { id } = await apiPost("/api/assets", {
        name: name.trim(), assetType: finalCategoryId, ticker: ticker.trim() || undefined,
        amount: initialAmount, currency, tracksQuantity: hasCap("quantity"),
        currentQty: hasCap("quantity") && qty ? Number(qty) : undefined,
        avgBuyPrice: hasCap("quantity") && avgPrice ? Number(avgPrice) : undefined,
        description: description.trim() || undefined, parentId: opts.parentId, metadata: buildMetadata(),
      })

      if (createGasto && initialAmount > 0) {
        await apiPost("/api/gastos", {
          mode: "linked", gasto: { name: `Inversión en ${name.trim()}`, amount: initialAmount, currency }, linkedTo: id,
        }).catch(() => {})
      }

      if (hasCap("income")) {
        for (const r of rules) {
          if (!r.name.trim() || !(Number(r.expectedAmount) > 0)) continue
          await apiPost(`/api/assets/${id}/income`, {
            name: r.name.trim(), recurrenceType: r.recurrenceType, startDate: r.startDate,
            expectedAmount: Number(r.expectedAmount), currency: r.currency, reducesPrincipal: r.reducesPrincipal,
          })
        }
        if (valueIsProjection) await apiPatch(`/api/assets/${id}/income/value-mode`, { mode: "PROJECTION" })
      }

      dialog.close()
      opts.onCreate?.(id)
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo crear el activo", description: e.message })
    } finally {
      saving = false
    }
  }

  paint()
}
