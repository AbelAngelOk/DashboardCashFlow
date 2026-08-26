// Portado desde components/activos/income/income-rules-section.tsx.

import { apiGet, apiPost, apiPatch, apiDelete } from "../api.js"
import { el, clear, svgIcon } from "../dom.js"
import { formatAmount } from "../lib/finance.js"
import { RECURRENCE_TYPE_LABELS } from "../lib/obligations.js"
import { INCOME_STATUS_LABELS } from "../lib/income-streams.js"
import { openIncomeRuleDialog } from "./income-rule-dialog.js"
import { openCollectIncomeDialog } from "./collect-income-dialog.js"
import { toast } from "../toast.js"

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

async function guard(fn, errorTitle) {
  try {
    await fn()
    return true
  } catch (e) {
    toast({ variant: "destructive", title: errorTitle, description: e.message })
    return false
  }
}

/** @param {{ recordId, assetCurrency, assetAmount }} opts */
export function renderIncomeRulesSection(opts, onMutated) {
  const section = el("div", { class: "panel", "data-testid": "asset-income-rules" })
  let data = null
  let showAllOccurrences = false

  async function load() {
    try {
      data = await apiGet(`/api/assets/${opts.recordId}/income`, { fresh: true })
    } catch {
      data = null
    }
    paint()
  }

  function afterMutation() { load(); onMutated() }

  function paint() {
    clear(section)
    const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
    header.appendChild(el("span", {}, "Ingresos recurrentes"))
    const addBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; border:1px solid var(--white); background:none; color:var(--white); padding:0.125rem 0.5rem; font-size:0.75rem; font-weight:bold;" })
    addBtn.appendChild(svgIcon("icon-plus", 11))
    addBtn.appendChild(document.createTextNode(" Agregar"))
    addBtn.addEventListener("click", () => {
      openIncomeRuleDialog({ recordId: opts.recordId, assetCurrency: opts.assetCurrency, rule: null, onSaved: afterMutation })
    })
    header.appendChild(addBtn)
    section.appendChild(header)

    if (!data) return

    const projectionEntries = Object.entries(data.annualProjection).filter(([, v]) => v > 0)
    const hasPrincipalRule = data.rules.some((r) => r.reducesPrincipal)

    if (projectionEntries.length > 0) {
      const projBox = el("div", { style: "display:flex; flex-wrap:wrap; align-items:center; gap:1.5rem; border-bottom:2px solid var(--black); background:var(--gray-50); padding:0.75rem 1rem;" })
      const projCol = el("div")
      const projLabel = el("div", { class: "obl-info-label", style: "display:flex; align-items:center; gap:0.25rem;" })
      projLabel.appendChild(svgIcon("icon-trending-up", 11))
      projLabel.appendChild(document.createTextNode("Ganancia anual proyectada"))
      projCol.appendChild(projLabel)
      const amounts = el("div", { style: "display:flex; flex-wrap:wrap; gap:0.75rem; margin-top:0.125rem;" })
      for (const [cur, val] of projectionEntries) amounts.appendChild(el("span", { style: "font-size:1.125rem; font-weight:bold;" }, `${formatAmount(val, cur)} ${cur}`))
      projCol.appendChild(amounts)
      projBox.appendChild(projCol)

      if (hasPrincipalRule) {
        const capCol = el("div")
        capCol.appendChild(el("div", { class: "obl-info-label" }, "Capital pendiente"))
        capCol.appendChild(el("div", { style: "font-size:1.125rem; font-weight:bold; margin-top:0.125rem;" }, `${formatAmount(opts.assetAmount, opts.assetCurrency)} ${opts.assetCurrency}`))
        projBox.appendChild(capCol)
      } else {
        const modeLabel = el("label", { style: "display:flex; align-items:flex-start; gap:0.5rem; font-size:0.75rem; cursor:pointer;" })
        const cb = el("input", { type: "checkbox", checked: data.valueIsProjection })
        cb.addEventListener("change", async () => {
          const ok = await guard(() => apiPatch(`/api/assets/${opts.recordId}/income/value-mode`, { mode: cb.checked ? "PROJECTION" : "MANUAL" }), "No se pudo cambiar el modo de valuación")
          if (ok) afterMutation(); else { cb.checked = !cb.checked }
        })
        const modeText = el("span", { style: "color:var(--gray-600);" })
        modeText.appendChild(document.createTextNode("El valor del activo "))
        modeText.appendChild(el("b", {}, "es"))
        modeText.appendChild(document.createTextNode(" esta proyección anual"))
        modeText.appendChild(el("span", { class: "hint-text", style: "display:block;" }, "Para sueldos y rentas sin patrimonio propio. Apagado, el valor lo fijás vos."))
        modeLabel.appendChild(cb); modeLabel.appendChild(modeText)
        projBox.appendChild(modeLabel)
      }
      section.appendChild(projBox)
    }

    if (data.rules.length === 0) {
      section.appendChild(el("p", { class: "state-message" }, "Sin ingresos recurrentes. Agregá uno para proyectar la ganancia anual y generar los cobros de cada período."))
    } else {
      const rulesBox = el("div", { style: "border-bottom:2px solid var(--black);" })
      for (const rule of data.rules) rulesBox.appendChild(paintRuleRow(rule))
      section.appendChild(rulesBox)
    }

    if (data.occurrences.length > 0) {
      const occHeader = el("div", { style: "display:flex; align-items:center; justify-content:space-between; background:var(--gray-100); padding:0.375rem 1rem;" })
      occHeader.appendChild(el("span", { style: "font-size:0.75rem; font-weight:bold; text-transform:uppercase;" }, showAllOccurrences ? "Todos los cobros" : "Próximos cobros"))
      const toggleBtn = el("button", { style: "font-size:0.75rem; font-weight:600; color:var(--gray-500); text-decoration:underline; border:none; background:none;" },
        showAllOccurrences ? "Ver solo pendientes" : `Ver todos (${data.occurrences.length})`)
      toggleBtn.addEventListener("click", () => { showAllOccurrences = !showAllOccurrences; paint() })
      occHeader.appendChild(toggleBtn)
      section.appendChild(occHeader)

      const pending = data.occurrences.filter((o) => o.status === "PENDING")
      const visible = showAllOccurrences ? data.occurrences : pending.slice(0, 6)
      for (const occ of visible) section.appendChild(paintOccurrenceRow(occ))
      if (!showAllOccurrences && pending.length === 0) {
        section.appendChild(el("p", { class: "state-message", style: "font-size:0.75rem; padding:1rem;" }, "No hay cobros pendientes."))
      }
    }
  }

  function paintRuleRow(rule) {
    const row = el("div", { style: "display:flex; align-items:center; gap:0.5rem; border-bottom:1px solid var(--gray-200); padding:0.5rem 1rem; font-size:0.875rem;" })
    const info = el("div", { style: "flex:1;" })
    const badges = el("div", { style: "display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem;" })
    badges.appendChild(el("span", { style: "font-weight:600;" }, rule.name))
    if (rule.status === "PAUSED") badges.appendChild(el("span", { class: "obl-status-badge obl-status-paused" }, "Pausada"))
    if (rule.status === "COMPLETED") badges.appendChild(el("span", { class: "obl-status-badge obl-status-active" }, "Completada"))
    if (rule.reducesPrincipal) badges.appendChild(el("span", { class: "status-chip" }, "Descuenta capital"))
    if (rule.amountMode === "PERCENTAGE") badges.appendChild(el("span", { class: "status-chip" }, "% del valor"))
    if (rule.settlement === "IN_KIND") badges.appendChild(el("span", { class: "status-chip" }, "En especie"))
    info.appendChild(badges)

    let detail = `${RECURRENCE_TYPE_LABELS[rule.recurrenceType]} · desde ${formatDate(rule.startDate)}`
    if (rule.installmentCount != null) detail += ` · cuota ${Math.min(rule.settledCount ?? 0, rule.installmentCount)} de ${rule.installmentCount}`
    if (rule.adjustmentPct != null && rule.adjustEveryN != null) detail += ` · +${rule.adjustmentPct}% cada ${rule.adjustEveryN}`
    info.appendChild(el("div", { class: "hint-text" }, detail))
    row.appendChild(info)

    row.appendChild(el("div", { style: "font-family:monospace; font-weight:bold;" },
      rule.amountMode === "PERCENTAGE" ? `${rule.percentage ?? 0}%` : `${formatAmount(rule.expectedAmount, rule.currency)} ${rule.currency}`))

    const actions = el("div", { style: "display:flex; align-items:center; gap:0.25rem;" })
    const editBtn = el("button", { class: "flow-row-icon-btn", title: "Editar" })
    editBtn.appendChild(svgIcon("icon-pencil", 13))
    editBtn.addEventListener("click", () => openIncomeRuleDialog({ recordId: opts.recordId, assetCurrency: opts.assetCurrency, rule, onSaved: afterMutation }))
    const pauseBtn = el("button", { class: "flow-row-icon-btn", title: rule.status === "ACTIVE" ? "Pausar" : "Reanudar" }, rule.status === "ACTIVE" ? "⏸" : "▶")
    pauseBtn.addEventListener("click", async () => {
      const ok = await guard(() => apiPost(`/api/income/rules/${rule.id}/${rule.status === "ACTIVE" ? "pause" : "resume"}`), "No se pudo cambiar el estado de la regla")
      if (ok) afterMutation()
    })
    const delBtn = el("button", { class: "flow-row-icon-btn", title: "Eliminar" })
    delBtn.appendChild(svgIcon("icon-trash", 13))
    delBtn.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar "${rule.name}"? Los cobros pendientes se cancelan; los ya confirmados se conservan.`)) return
      const ok = await guard(() => apiDelete(`/api/income/rules/${rule.id}`), "No se pudo eliminar la regla")
      if (ok) afterMutation()
    })
    actions.appendChild(editBtn); actions.appendChild(pauseBtn); actions.appendChild(delBtn)
    row.appendChild(actions)
    return row
  }

  function paintOccurrenceRow(occ) {
    const row = el("div", { style: "display:flex; align-items:center; gap:0.5rem; border-bottom:1px solid var(--gray-200); padding:0.5rem 1rem; font-size:0.875rem;" })
    row.appendChild(el("div", { style: "width:6rem; font-size:0.75rem; color:var(--gray-500);" }, formatDate(occ.expectedDate)))

    const info = el("div", { style: "flex:1;" })
    info.appendChild(el("span", { style: "font-weight:500;" }, occ.ruleName))
    if (occ.ingresoActive && occ.status === "PENDING") info.appendChild(el("span", { class: "hint-text", style: "margin-left:0.5rem; text-transform:uppercase; font-size:0.625rem; font-weight:bold;" }, "en el dashboard"))
    if (occ.comment) info.appendChild(el("div", { class: "hint-text" }, occ.comment))
    row.appendChild(info)

    const amountCol = el("div", { style: "text-align:right; font-family:monospace;" })
    if (occ.status === "COLLECTED" && occ.actualAmount != null) {
      amountCol.appendChild(el("span", { style: "font-weight:bold;" }, formatAmount(occ.actualAmount, occ.currency)))
      if (Math.abs(occ.actualAmount - occ.expectedAmount) > 0.001) {
        amountCol.appendChild(el("span", { style: "margin-left:0.25rem; font-size:0.75rem; color:var(--gray-400); text-decoration:line-through;" }, formatAmount(occ.expectedAmount, occ.currency)))
      }
    } else {
      amountCol.appendChild(document.createTextNode(formatAmount(occ.expectedAmount, occ.currency)))
    }
    row.appendChild(amountCol)

    const statusClass = occ.status === "PENDING" ? "obl-status-paused" : occ.status === "COLLECTED" ? "obl-status-active" : "obl-status-cancelled"
    row.appendChild(el("span", { class: `obl-status-badge ${statusClass}`, style: "width:5rem; text-align:center; flex-shrink:0;" }, INCOME_STATUS_LABELS[occ.status]))

    const actions = el("div", { style: "width:3.5rem; display:flex; justify-content:flex-end; gap:0.25rem; flex-shrink:0;" })
    if (occ.status === "PENDING") {
      const collectBtn = el("button", { class: "flow-row-icon-btn", title: "Confirmar cobro" })
      collectBtn.appendChild(svgIcon("icon-check", 14))
      collectBtn.addEventListener("click", () => openCollectIncomeDialog({ occurrence: occ, assetAmount: opts.assetAmount, onCollected: afterMutation }))
      const rejectBtn = el("button", { class: "flow-row-icon-btn", title: "Rechazar" })
      rejectBtn.appendChild(svgIcon("icon-x", 14))
      rejectBtn.addEventListener("click", async () => {
        if (!confirm(`¿Rechazar el cobro de "${occ.ruleName}" del ${formatDate(occ.expectedDate)}?`)) return
        const ok = await guard(() => apiPost(`/api/income/occurrences/${occ.id}/reject`), "No se pudo rechazar el cobro")
        if (ok) afterMutation()
      })
      actions.appendChild(collectBtn); actions.appendChild(rejectBtn)
    }
    row.appendChild(actions)
    return row
  }

  load()
  return section
}
