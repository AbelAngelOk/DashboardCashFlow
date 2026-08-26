// Portado desde components/obligations/obligation-detail.tsx (830 líneas).
// A diferencia del original -- que guarda `obligation` en useState sembrado
// desde una prop y depende de router.refresh() para refrescarlo (un patrón
// fràgil: React no vuelve a sincronizar ese estado solo porque la prop
// cambió) -- acá cada mutación vuelve a pedir /api/obligations/:id y repinta
// desde la respuesta fresca. Más simple y sin el riesgo de quedar stale.

import { apiGet, apiPost, apiPatch, apiDelete } from "../api.js"
import { el, clear, mount, svgIcon, createDialog } from "../dom.js"
import { navigate } from "../router.js"
import { currencies, formatAmount } from "../lib/finance.js"
import {
  OBLIGATION_TYPE_LABELS, OBLIGATION_STATUS_LABELS, RECURRENCE_TYPE_LABELS,
  PAYMENT_TYPE_LABELS, INSTALLMENT_STATUS_LABELS,
  computeRecurringBreakdown, pendingInstallmentsTotal, formatObligationDate, isOverdue,
} from "../lib/obligations.js"

export async function render(main, params) {
  clear(main)
  const { id } = params
  let obligation = null

  const wrap = el("div", { style: "max-width:48rem; margin:0 auto;" })
  mount(main, wrap)
  wrap.appendChild(el("div", { class: "state-message" }, "Cargando..."))

  async function load() {
    obligation = await apiGet(`/api/obligations/${id}`)
    paint()
  }

  function paint() {
    clear(wrap)

    const header = el("div", { class: "obl-detail-header" })
    const backLink = el("a", { href: "/obligaciones", "data-link": "", class: "obl-back-link" })
    backLink.appendChild(svgIcon("icon-arrow-right", 14))
    backLink.firstChild.style.transform = "rotate(180deg)"
    backLink.appendChild(document.createTextNode(" Obligaciones"))
    header.appendChild(backLink)
    header.appendChild(el("span", { style: "color:var(--gray-300);" }, "/"))
    header.appendChild(el("span", { style: "font-weight:bold;" }, obligation.name))
    wrap.appendChild(header)

    wrap.appendChild(paintInfoPanel())

    const canEdit = obligation.status === "ACTIVE" || obligation.status === "PAUSED"
    if (canEdit) wrap.appendChild(paintActionsRow())

    if (obligation.obligationType === "RECURRING") wrap.appendChild(paintRulesBoard())
    wrap.appendChild(paintPaymentsBoard())
  }

  // ── Info panel ──────────────────────────────────────────────────────────
  function paintInfoPanel() {
    const canEdit = obligation.status === "ACTIVE" || obligation.status === "PAUSED"
    const panel = el("div", { class: "panel", "data-testid": "obligation-info-section" })
    panel.appendChild(el("div", { class: "panel-header" }, "Información general"))
    const grid = el("div", { class: "obl-info-grid" })

    // Nombre
    grid.appendChild(infoCell("Nombre", () => {
      let editing = false
      const box = el("div")
      function paintCell() {
        clear(box)
        if (editing) {
          const row = el("div", { style: "display:flex; gap:0.25rem;" })
          const input = el("input", { class: "input", value: obligation.name, style: "height:1.75rem; font-size:0.875rem;" })
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveName(input.value)
            if (e.key === "Escape") { editing = false; paintCell() }
          })
          const okBtn = el("button", { class: "flow-row-icon-btn" }); okBtn.appendChild(svgIcon("icon-check", 14))
          okBtn.addEventListener("click", () => saveName(input.value))
          const xBtn = el("button", { class: "flow-row-icon-btn" }); xBtn.appendChild(svgIcon("icon-x", 14))
          xBtn.addEventListener("click", () => { editing = false; paintCell() })
          row.appendChild(input); row.appendChild(okBtn); row.appendChild(xBtn)
          box.appendChild(row)
          setTimeout(() => input.focus(), 0)
        } else {
          const btn = el("button", { class: "obl-inline-edit-btn" }, obligation.name)
          if (canEdit) btn.addEventListener("click", () => { editing = true; paintCell() })
          box.appendChild(btn)
        }
      }
      async function saveName(value) {
        if (!value.trim()) { editing = false; paintCell(); return }
        await apiPatch(`/api/obligations/${id}`, { name: value.trim() })
        editing = false
        await load()
      }
      paintCell()
      return box
    }))

    // Tipo
    grid.appendChild(infoCell("Tipo", () => el("span", {}, OBLIGATION_TYPE_LABELS[obligation.obligationType])))

    // Estado
    grid.appendChild(infoCell("Estado", () => {
      const row = el("div", { style: "display:flex; align-items:center; gap:0.5rem;" })
      row.appendChild(el("span", { class: `obl-status-badge obl-status-${obligation.status.toLowerCase()}` }, OBLIGATION_STATUS_LABELS[obligation.status]))
      if (canEdit) {
        const toggleBtn = el("button", { class: "obl-toggle-status" }, obligation.status === "PAUSED" ? "Reanudar" : "Pausar")
        toggleBtn.addEventListener("click", async () => {
          await apiPatch(`/api/obligations/${id}/status`, { status: obligation.status === "PAUSED" ? "ACTIVE" : "PAUSED" })
          await load()
        })
        row.appendChild(toggleBtn)
      }
      return row
    }))

    // Valor
    grid.appendChild(infoCell(obligation.obligationType === "RECURRING" ? "Proyección anual" : "Saldo pendiente", () => {
      if (obligation.obligationType === "RECURRING") {
        const bd = computeRecurringBreakdown(obligation.rules)
        const entries = Object.entries(bd).filter(([, v]) => v > 0)
        if (entries.length === 0) return el("span", { style: "color:var(--gray-400); font-weight:normal;" }, "Sin reglas activas")
        const wrap = el("span")
        for (const [cur, val] of entries) wrap.appendChild(el("span", { style: "margin-right:0.75rem; font-weight:bold;" }, `${formatAmount(val, cur)} ${cur}`))
        return wrap
      }
      return el("span", { style: "font-weight:bold; font-size:1rem;" }, `${formatAmount(obligation.amount, obligation.currency)} ${obligation.currency}`)
    }))

    // Próximo vencimiento
    if (obligation.nextDueDate) {
      grid.appendChild(infoCell("Próximo vencimiento", () => el("span", {}, formatObligationDate(obligation.nextDueDate))))
    }

    // Moneda
    grid.appendChild(infoCell("Moneda", () => el("span", {}, obligation.currency)))

    // Descripción
    const descCell = infoCell("Descripción", () => {
      let editing = false
      const box = el("div")
      function paintCell() {
        clear(box)
        if (editing) {
          const textarea = el("textarea", { class: "input", rows: 3, style: "resize:none;", value: obligation.description ?? "" })
          box.appendChild(textarea)
          const actions = el("div", { style: "display:flex; gap:0.25rem; margin-top:0.25rem;" })
          const okBtn = el("button", { class: "flow-row-icon-btn" }); okBtn.appendChild(svgIcon("icon-check", 14))
          okBtn.addEventListener("click", () => saveDesc(textarea.value))
          const xBtn = el("button", { class: "flow-row-icon-btn" }); xBtn.appendChild(svgIcon("icon-x", 14))
          xBtn.addEventListener("click", () => { editing = false; paintCell() })
          actions.appendChild(okBtn); actions.appendChild(xBtn)
          box.appendChild(actions)
          setTimeout(() => textarea.focus(), 0)
        } else {
          const btn = el("button", { class: "obl-inline-edit-btn", style: "text-align:left; white-space:pre-wrap;" },
            obligation.description || "Sin descripción — click para editar")
          if (canEdit) btn.addEventListener("click", () => { editing = true; paintCell() })
          box.appendChild(btn)
        }
      }
      async function saveDesc(value) {
        await apiPatch(`/api/obligations/${id}`, { description: value.trim() || undefined })
        editing = false
        await load()
      }
      paintCell()
      return box
    })
    descCell.style.gridColumn = "1 / -1"
    grid.appendChild(descCell)

    panel.appendChild(grid)
    return panel
  }

  function infoCell(label, buildValue) {
    const cell = el("div")
    cell.appendChild(el("div", { class: "obl-info-label" }, label))
    cell.appendChild(buildValue())
    return cell
  }

  // ── Actions row ─────────────────────────────────────────────────────────
  function paintActionsRow() {
    const row = el("div", { style: "display:flex; flex-wrap:wrap; gap:0.5rem; margin:1rem 0;" })
    if (obligation.obligationType === "FIXED") {
      const payBtn = el("button", { class: "btn btn-primary" })
      payBtn.appendChild(svgIcon("icon-plus", 12))
      payBtn.appendChild(document.createTextNode(" Registrar pago"))
      payBtn.addEventListener("click", () => openManualPaymentDialog())
      row.appendChild(payBtn)
    }
    const delBtn = el("button", { class: "btn", style: "margin-left:auto; border-color:#be123c; color:#be123c;" })
    delBtn.appendChild(svgIcon("icon-trash", 12))
    delBtn.appendChild(document.createTextNode(" Eliminar"))
    delBtn.addEventListener("click", () => openFinalizeDialog())
    row.appendChild(delBtn)
    return row
  }

  // ── Rules board (RECURRING) ─────────────────────────────────────────────
  function paintRulesBoard() {
    const box = el("div", { class: "panel", style: "margin-bottom:1rem;", "data-testid": "obligation-rules-board" })
    const head = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
    head.appendChild(el("span", {}, "Reglas de gasto"))
    if (obligation.status === "ACTIVE") {
      const addBtn = el("button", { class: "links-add-btn", style: "color:var(--gray-300);" })
      addBtn.appendChild(svgIcon("icon-plus", 11))
      addBtn.appendChild(document.createTextNode(" Agregar"))
      addBtn.addEventListener("click", () => openAddRuleDialog())
      head.appendChild(addBtn)
    }
    box.appendChild(head)

    if (obligation.rules.length === 0) {
      box.appendChild(el("div", { class: "state-message" }, "Sin reglas. Agrega la primera."))
    }
    for (const rule of obligation.rules) {
      const row = el("div", { class: "obl-rule-row" })
      const info = el("div", { style: "flex:1;" })
      info.appendChild(el("span", { style: rule.status === "PAUSED" ? "color:var(--gray-400); text-decoration:line-through;" : "font-weight:500;" }, rule.name))
      info.appendChild(el("span", { class: "hint-text", style: "margin-left:0.5rem;" }, `${RECURRENCE_TYPE_LABELS[rule.recurrenceType]} · desde ${formatObligationDate(rule.startDate)}`))
      row.appendChild(info)
      row.appendChild(el("div", { style: "width:9rem; text-align:right;" }, `${formatAmount(rule.expectedAmount, rule.currency)} ${rule.currency}`))
      if (obligation.status === "ACTIVE") {
        const actions = el("div", { style: "display:flex; gap:0.25rem; margin-left:0.5rem;" })
        const pauseBtn = el("button", { class: "flow-row-text-btn", title: rule.status === "ACTIVE" ? "Pausar regla" : "Reanudar regla" }, rule.status === "ACTIVE" ? "⏸" : "▶")
        pauseBtn.addEventListener("click", async () => {
          await apiPost(`/api/obligations/${id}/rules/${rule.id}/${rule.status === "ACTIVE" ? "pause" : "resume"}`)
          await load()
        })
        const delBtn = el("button", { class: "flow-row-icon-btn" }); delBtn.appendChild(svgIcon("icon-trash", 12))
        delBtn.addEventListener("click", async () => {
          await apiDelete(`/api/obligations/${id}/rules/${rule.id}`)
          await load()
        })
        actions.appendChild(pauseBtn); actions.appendChild(delBtn)
        row.appendChild(actions)
      }
      box.appendChild(row)
    }

    const breakdown = computeRecurringBreakdown(obligation.rules)
    if (Object.keys(breakdown).length > 0) {
      const footer = el("div", { class: "obl-rules-footer" })
      footer.appendChild(el("span", { style: "font-weight:600;" }, "Proyección anual: "))
      for (const [cur, val] of Object.entries(breakdown)) {
        footer.appendChild(el("span", { style: "margin-right:0.75rem;" }, `${formatAmount(val, cur)} ${cur}`))
      }
      box.appendChild(footer)
    }
    return box
  }

  function openAddRuleDialog() {
    const dialog = createDialog()
    let name = "", recurrenceType = "MONTHLY", startDate = new Date().toISOString().slice(0, 10)
    let amount = "", currency = "ARS", saving = false

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Agregar regla de gasto"))
      const body = el("div", { class: "modal-body" })

      const nameField = el("div", { class: "field" })
      nameField.appendChild(el("label", {}, "Nombre *"))
      const nameInput = el("input", { class: "input", placeholder: "Ej: Alquiler", value: name })
      nameInput.addEventListener("input", () => { name = nameInput.value; syncSave() })
      nameField.appendChild(nameInput)
      body.appendChild(nameField)

      const row = el("div", { style: "display:flex; gap:0.5rem;" })
      const amountField = el("div", { class: "field", style: "flex:1;" })
      amountField.appendChild(el("label", {}, "Monto *"))
      const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
      amountInput.addEventListener("input", () => { amount = amountInput.value; syncSave() })
      amountField.appendChild(amountInput)
      const curField = el("div", { class: "field", style: "width:5.5rem;" })
      curField.appendChild(el("label", {}, "Moneda"))
      const curSelect = el("select", { class: "input" })
      for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
      curSelect.value = currency
      curSelect.addEventListener("change", () => { currency = curSelect.value })
      curField.appendChild(curSelect)
      row.appendChild(amountField); row.appendChild(curField)
      body.appendChild(row)

      const recurField = el("div", { class: "field" })
      recurField.appendChild(el("label", {}, "Recurrencia"))
      const recurSelect = el("select", { class: "input" })
      for (const [k, v] of Object.entries(RECURRENCE_TYPE_LABELS)) recurSelect.appendChild(el("option", { value: k }, v))
      recurSelect.value = recurrenceType
      recurSelect.addEventListener("change", () => { recurrenceType = recurSelect.value })
      recurField.appendChild(recurSelect)
      body.appendChild(recurField)

      const dateField = el("div", { class: "field" })
      dateField.appendChild(el("label", {}, "Fecha inicio"))
      const dateInput = el("input", { class: "input", type: "date", value: startDate })
      dateInput.addEventListener("change", () => { startDate = dateInput.value })
      dateField.appendChild(dateInput)
      body.appendChild(dateField)

      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Agregar")
      saveBtn.disabled = !name.trim() || !amount || saving
      saveBtn.addEventListener("click", handleAdd)
      footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
      dialog.appendChild(footer)

      function syncSave() { saveBtn.disabled = !name.trim() || !amount || saving }
    }

    async function handleAdd() {
      if (!name.trim() || !amount) return
      saving = true
      paintDialog()
      try {
        await apiPost(`/api/obligations/${id}/rules`, { name: name.trim(), recurrenceType, startDate, expectedAmount: parseFloat(amount), currency })
        dialog.close()
        await load()
      } finally { saving = false }
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  // ── Payments / Installments board ───────────────────────────────────────
  function paintPaymentsBoard() {
    const canPay = obligation.status === "ACTIVE" || obligation.status === "PAUSED"

    if (obligation.obligationType === "INSTALLMENT") {
      const insts = obligation.installments
      const paidCount = insts.filter((i) => i.status === "PAID").length
      const box = el("div", { class: "panel", "data-testid": "obligation-installments-board" })
      box.appendChild(el("div", { class: "panel-header" }, `Cuotas (${paidCount}/${insts.length} pagadas)`))

      const head = el("div", { class: "obl-inst-row obl-inst-head" })
      head.appendChild(el("div", { class: "obl-inst-num" }, "#"))
      head.appendChild(el("div", { style: "flex:1;" }, "Vencimiento"))
      head.appendChild(el("div", { class: "obl-inst-amount" }, "Monto"))
      head.appendChild(el("div", { class: "obl-inst-status" }, "Estado"))
      head.appendChild(el("div", { class: "obl-inst-gasto" }, "Gasto ID"))
      if (canPay) head.appendChild(el("div", { class: "obl-inst-action" }, "Acción"))
      box.appendChild(head)

      let payingId = null
      for (const inst of insts) {
        const overdue = inst.status === "PENDING" && isOverdue(inst.dueDate)
        const isPendingOrOverdue = inst.status === "PENDING" || inst.status === "OVERDUE"
        const row = el("div", { class: "obl-inst-row" })
        row.appendChild(el("div", { class: "obl-inst-num" }, String(inst.installmentNumber)))
        const dueCell = el("div", { style: `flex:1; ${overdue ? "font-weight:600; color:#be123c;" : ""}` }, formatObligationDate(inst.dueDate))
        if (overdue) dueCell.appendChild(el("span", { style: "font-size:0.75rem; margin-left:0.25rem;" }, "(vencida)"))
        row.appendChild(dueCell)
        row.appendChild(el("div", { class: "obl-inst-amount" }, `${formatAmount(inst.expectedAmount, obligation.currency)} ${obligation.currency}`))
        const statusColor = { PENDING: overdue ? "#be123c" : "#92400e", OVERDUE: "#be123c", PAID: "#047857", REJECTED: "var(--gray-400)" }[inst.status]
        row.appendChild(el("div", { class: "obl-inst-status", style: `color:${statusColor}; font-weight:600;` }, INSTALLMENT_STATUS_LABELS[inst.status]))
        row.appendChild(el("div", { class: "obl-inst-gasto" }, inst.gastoRecordId ? inst.gastoRecordId.slice(0, 8) : "—"))
        if (canPay) {
          const actionCell = el("div", { class: "obl-inst-action" })
          if (isPendingOrOverdue) {
            const payBtn = el("button", { class: "btn", style: "font-size:0.6875rem; padding:0.125rem 0.5rem;" }, payingId === inst.id ? "..." : "Pagar")
            payBtn.disabled = payingId === inst.id
            payBtn.addEventListener("click", async () => {
              payingId = inst.id
              payBtn.textContent = "..."; payBtn.disabled = true
              try {
                await apiPost(`/api/obligations/installments/${inst.id}/accept`, { gastoName: `Cuota ${inst.installmentNumber} — ${obligation.name}` })
                await load()
              } finally { payingId = null }
            })
            actionCell.appendChild(payBtn)
          }
          row.appendChild(actionCell)
        }
        box.appendChild(row)
      }

      const footer = el("div", { class: "obl-inst-row obl-inst-foot" })
      footer.appendChild(el("div", { style: "flex:1; font-weight:bold;" }, "Saldo pendiente"))
      footer.appendChild(el("div", { class: "obl-inst-amount", style: "font-weight:bold;" }, `${formatAmount(pendingInstallmentsTotal(insts), obligation.currency)} ${obligation.currency}`))
      box.appendChild(footer)
      return box
    }

    // RECURRING or FIXED: payment history
    const payments = obligation.payments
    const box = el("div", { class: "panel", "data-testid": "obligation-payments-board" })
    box.appendChild(el("div", { class: "panel-header" }, "Pagos"))
    if (payments.length === 0) {
      box.appendChild(el("div", { class: "state-message" }, "Sin pagos registrados."))
      return box
    }
    const head = el("div", { class: "obl-pay-row obl-pay-head" })
    head.appendChild(el("div", { style: "flex:1;" }, "Fecha esperada"))
    head.appendChild(el("div", { class: "obl-pay-col" }, "Monto esperado"))
    head.appendChild(el("div", { class: "obl-pay-col" }, "Pago realizado"))
    head.appendChild(el("div", { class: "obl-pay-small" }, "Tipo"))
    head.appendChild(el("div", { class: "obl-pay-small" }, "Estado"))
    head.appendChild(el("div", { class: "obl-inst-gasto" }, "Gasto ID"))
    box.appendChild(head)

    for (const p of payments) {
      const row = el("div", { class: "obl-pay-row" })
      const dateCell = el("div", { style: "flex:1; color:var(--gray-700);" }, p.expectedDate ? formatObligationDate(p.expectedDate) : "—")
      if (p.comment) dateCell.appendChild(el("span", { class: "hint-text", style: "margin-left:0.5rem;" }, p.comment))
      row.appendChild(dateCell)
      row.appendChild(el("div", { class: "obl-pay-col" }, p.expectedAmount != null ? `${formatAmount(p.expectedAmount, p.currency)} ${p.currency}` : "—"))
      row.appendChild(el("div", { class: "obl-pay-col" }, p.actualAmount != null ? `${formatAmount(p.actualAmount, p.currency)} ${p.currency}` : ""))
      row.appendChild(el("div", { class: "obl-pay-small hint-text" }, PAYMENT_TYPE_LABELS[p.paymentType]))
      const statusColor = p.status === "PAID" ? "#047857" : p.status === "REJECTED" ? "var(--gray-400)" : "#92400e"
      const statusText = p.status === "PAID" ? "Pagado" : p.status === "REJECTED" ? "Rechazado" : "Pendiente"
      row.appendChild(el("div", { class: "obl-pay-small", style: `color:${statusColor}; font-weight:${p.status === "PAID" ? "600" : "400"};` }, statusText))
      row.appendChild(el("div", { class: "obl-inst-gasto" }, p.gastoRecordId ? p.gastoRecordId.slice(0, 8) : "—"))
      box.appendChild(row)
    }
    return box
  }

  // ── Manual payment dialog (FIXED) ───────────────────────────────────────
  function openManualPaymentDialog() {
    const dialog = createDialog()
    let amount = "", paymentType = "PAYMENT", comment = "", saving = false

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Registrar pago"))
      const body = el("div", { class: "modal-body" })

      const typeField = el("div", { class: "field" })
      typeField.appendChild(el("label", {}, "Tipo"))
      const typeRow = el("div", { style: "display:flex; gap:0.75rem;" })
      for (const t of ["PAYMENT", "INTEREST", "FEE"]) {
        const label = el("label", { style: "display:flex; align-items:center; gap:0.25rem; font-size:0.875rem; cursor:pointer;" })
        const radio = el("input", { type: "radio", name: "payment-type", checked: paymentType === t })
        radio.addEventListener("change", () => { paymentType = t; paintDialog() })
        label.appendChild(radio)
        label.appendChild(document.createTextNode(PAYMENT_TYPE_LABELS[t]))
        typeRow.appendChild(label)
      }
      typeField.appendChild(typeRow)
      body.appendChild(typeField)

      const amountField = el("div", { class: "field" })
      amountField.appendChild(el("label", {}, `Monto (${obligation.currency}) *`))
      const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
      amountInput.addEventListener("input", () => { amount = amountInput.value; syncSave(); refreshPreview() })
      amountField.appendChild(amountInput)
      body.appendChild(amountField)

      const preview = el("p", { class: "hint-text" })
      body.appendChild(preview)
      function refreshPreview() {
        if (paymentType === "PAYMENT" && obligation.amount > 0) {
          let text = `Saldo actual: ${formatAmount(obligation.amount, obligation.currency)} ${obligation.currency}`
          if (amount && parseFloat(amount) > 0) {
            text += ` → ${formatAmount(Math.max(0, obligation.amount - parseFloat(amount)), obligation.currency)} ${obligation.currency} después del pago`
          }
          preview.textContent = text
        } else {
          preview.textContent = ""
        }
      }
      refreshPreview()

      const commentField = el("div", { class: "field" })
      commentField.appendChild(el("label", {}, "Comentario (opcional)"))
      const commentInput = el("textarea", { class: "input", rows: 2, style: "resize:none;", placeholder: "Notas...", value: comment })
      commentInput.addEventListener("input", () => { comment = commentInput.value })
      commentField.appendChild(commentInput)
      body.appendChild(commentField)

      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const saveBtn = el("button", { class: "btn btn-primary" }, saving ? "Guardando..." : "Registrar")
      saveBtn.disabled = !amount || saving
      saveBtn.addEventListener("click", handleSave)
      footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
      dialog.appendChild(footer)

      function syncSave() { saveBtn.disabled = !amount || saving }
    }

    async function handleSave() {
      if (!amount) return
      saving = true
      paintDialog()
      try {
        const prefix = paymentType === "INTEREST" ? "Intereses" : paymentType === "FEE" ? "Comisión" : "Pago"
        await apiPost(`/api/obligations/${id}/manual-payment`, {
          amount: parseFloat(amount), paymentType, comment: comment || undefined,
          gastoName: `${prefix} — ${obligation.name}`,
        })
        dialog.close()
        await load()
      } finally { saving = false }
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  // ── Finalize (delete) dialog ─────────────────────────────────────────────
  function openFinalizeDialog() {
    const dialog = createDialog()
    let generateExpenses = false
    let loading = false

    const isInstallment = obligation.obligationType === "INSTALLMENT"
    const pendingInstallments = obligation.installments.filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    const pendingAmount = pendingInstallments.reduce((s, i) => s + i.expectedAmount, 0)
    const hasPending = isInstallment && pendingInstallments.length > 0

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, "Finalizar obligación"))
      const body = el("div", { class: "modal-body" })
      body.appendChild(el("p", { style: "font-weight:600;" }, obligation.name))

      if (hasPending) {
        const summary = el("div", { class: "info-box" })
        const row1 = el("div", { style: "display:flex; justify-content:space-between;" })
        row1.appendChild(el("span", {}, "Saldo pendiente"))
        row1.appendChild(el("strong", {}, `${formatAmount(pendingAmount, obligation.currency)} ${obligation.currency}`))
        const row2 = el("div", { style: "display:flex; justify-content:space-between; margin-top:0.25rem;" })
        row2.appendChild(el("span", {}, "Cuotas pendientes"))
        row2.appendChild(el("strong", {}, String(pendingInstallments.length)))
        summary.appendChild(row1); summary.appendChild(row2)
        body.appendChild(summary)

        const checkLabel = el("label", { class: "radio-option" })
        const checkbox = el("input", { type: "checkbox", checked: generateExpenses })
        checkbox.addEventListener("change", () => { generateExpenses = checkbox.checked; paintDialog() })
        const text = el("div")
        text.appendChild(el("div", { style: "font-weight:500;" }, "Generar gastos por cuotas pendientes"))
        text.appendChild(el("div", { class: "hint-text" }, "Se registrará un gasto por cada cuota pendiente. La obligación quedará como Completada."))
        checkLabel.appendChild(checkbox); checkLabel.appendChild(text)
        body.appendChild(checkLabel)
      }

      body.appendChild(el("p", { class: "hint-text" }, "El historial de pagos se conservará. Esta acción no se puede deshacer."))
      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.disabled = loading
      cancelBtn.addEventListener("click", () => dialog.close())
      const confirmLabel = hasPending && generateExpenses ? "Finalizar y registrar gastos" : "Cancelar obligación"
      const confirmBtn = el("button", { class: "btn btn-primary" }, loading ? "Procesando..." : confirmLabel)
      confirmBtn.disabled = loading
      confirmBtn.addEventListener("click", handleConfirm)
      footer.appendChild(cancelBtn); footer.appendChild(confirmBtn)
      dialog.appendChild(footer)
    }

    async function handleConfirm() {
      loading = true
      paintDialog()
      try {
        await apiPost(`/api/obligations/${id}/finalize`, { generateExpenses: hasPending && generateExpenses })
        dialog.close()
        navigate("/obligaciones")
      } finally {
        loading = false
      }
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  await load()
  return () => {}
}
