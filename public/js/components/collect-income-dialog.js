// Portado desde components/activos/income/collect-income-dialog.tsx.
//
// El monto se recalcula en vivo mientras se tipea (diferencia vs. esperado,
// vista previa de "el activo pasa de X a Y"), pero solo el bloque de
// vista previa se repinta -- el <input> de monto nunca se reconstruye, así
// no se pierde el cursor a mitad de tecleo (mismo cuidado que en Historial).

import { apiPost } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { formatAmount } from "../lib/finance.js"
import { toast } from "../toast.js"

/** @param {{ occurrence, assetAmount, onCollected: () => void }} opts */
export function openCollectIncomeDialog(opts) {
  const occ = opts.occurrence
  const dialog = createDialog()

  let amount = String(occ.expectedAmount)
  let quantity = ""
  let comment = ""
  let saving = false

  const inKind = occ.settlement === "IN_KIND"

  function valid() { return Number(amount) > 0 }
  function diff() { return Number(amount) - occ.expectedAmount }
  function exceedsPrincipal() { return occ.reducesPrincipal && Number(amount) > opts.assetAmount }

  dialog.appendChild(el("div", { class: "modal-header" }, `Confirmar cobro — ${occ.ruleName}`))
  const body = el("div", { class: "modal-body" })
  body.appendChild(el("p", { class: "hint-text" },
    `Esperado: ${formatAmount(occ.expectedAmount, occ.currency)} ${occ.currency} · ${new Date(occ.expectedDate).toLocaleDateString("es-AR")}`))

  const amountField = el("div", { class: "field" })
  amountField.appendChild(el("label", {}, "Monto realmente cobrado"))
  const amountInput = el("input", { class: "input", placeholder: "0.00", value: amount })
  amountField.appendChild(amountInput)
  const diffHint = el("p", { class: "hint-text" })
  amountField.appendChild(diffHint)
  body.appendChild(amountField)

  let qtyInput = null
  const inKindBox = el("div", { class: "info-box" })
  const inKindTitle = el("p", { style: "font-weight:bold; text-transform:uppercase; font-size:0.75rem;" }, "Cobro en especie")
  const inKindText = el("p", { style: "margin-top:0.25rem;" })
  inKindBox.appendChild(inKindTitle); inKindBox.appendChild(inKindText)
  if (inKind) {
    const qtyField = el("div", { class: "field" })
    qtyField.appendChild(el("label", {}, "Unidades recibidas (opcional)"))
    qtyInput = el("input", { class: "input", placeholder: "0.00000000", value: quantity })
    qtyInput.addEventListener("input", () => { quantity = qtyInput.value })
    qtyField.appendChild(qtyInput)
    body.appendChild(qtyField)
    body.appendChild(inKindBox)
  }

  const principalBox = el("div", { class: "info-box" })
  const principalTitle = el("p", { style: "font-weight:bold; text-transform:uppercase; font-size:0.75rem;" }, "Descuenta del capital")
  const principalText = el("p", { style: "margin-top:0.25rem;" })
  const exceedsText = el("p", { style: "margin-top:0.25rem; font-weight:600; color:#92400e;" }, "El cobro supera el capital pendiente: el activo queda en 0.")
  principalBox.appendChild(principalTitle); principalBox.appendChild(principalText)
  if (occ.reducesPrincipal) body.appendChild(principalBox)

  const commentField = el("div", { class: "field" })
  commentField.appendChild(el("label", {}, "Comentario (opcional)"))
  const commentInput = el("input", { class: "input", placeholder: "Ej: incluye ajuste por inflación", value: comment })
  commentInput.addEventListener("input", () => { comment = commentInput.value })
  commentField.appendChild(commentInput)
  body.appendChild(commentField)

  dialog.appendChild(body)

  const footer = el("div", { class: "modal-footer" })
  const cancelBtn = el("button", { class: "btn" }, "Cancelar")
  cancelBtn.addEventListener("click", () => dialog.close())
  const confirmBtn = el("button", { class: "btn btn-primary" }, "Confirmar cobro")
  confirmBtn.addEventListener("click", handleCollect)
  footer.appendChild(cancelBtn); footer.appendChild(confirmBtn)
  dialog.appendChild(footer)

  function refreshPreview() {
    diffHint.textContent = Math.abs(diff()) > 0.001 ? `${diff() > 0 ? "+" : ""}${formatAmount(diff(), occ.currency)} respecto de lo esperado` : ""

    if (inKind) {
      inKindText.textContent = `No entra efectivo. El valor del activo sube de ${formatAmount(opts.assetAmount, occ.currency)} a ${formatAmount(opts.assetAmount + (valid() ? Number(amount) : 0), occ.currency)}, y las unidades se suman a la cantidad del activo.`
    }

    if (occ.reducesPrincipal) {
      principalText.textContent = `El valor del activo baja de ${formatAmount(opts.assetAmount, occ.currency)} a ${formatAmount(Math.max(0, opts.assetAmount - (valid() ? Number(amount) : 0)), occ.currency)}. Se registra como conversión de activo, no como ganancia.`
      if (exceedsPrincipal()) { if (!exceedsText.isConnected) principalBox.appendChild(exceedsText) }
      else exceedsText.remove()
    }

    confirmBtn.disabled = !valid() || saving
  }

  amountInput.addEventListener("input", () => { amount = amountInput.value; refreshPreview() })
  refreshPreview()

  async function handleCollect() {
    if (!valid()) return
    saving = true
    confirmBtn.disabled = true
    confirmBtn.textContent = "Registrando..."
    cancelBtn.disabled = true
    try {
      await apiPost(`/api/income/occurrences/${occ.id}/collect`, {
        actualAmount: Number(amount), comment: comment.trim() || undefined,
        quantity: inKind && Number(quantity) > 0 ? Number(quantity) : undefined,
      })
      toast({ title: "Cobro registrado", description: `${occ.ruleName}: ${formatAmount(Number(amount), occ.currency)} ${occ.currency}` })
      dialog.close()
      opts.onCollected()
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo registrar el cobro", description: e.message })
      saving = false
      confirmBtn.disabled = !valid()
      confirmBtn.textContent = "Confirmar cobro"
      cancelBtn.disabled = false
    }
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  dialog.showModal()
  amountInput.focus()
  amountInput.select()
}
