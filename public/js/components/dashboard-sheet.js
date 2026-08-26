// Portado desde el compositor externo de components/dashboard-sheet.tsx (la
// parte que arma Estado de Resultados + Auditor + BALANCE a partir de
// SectionTable). Usado por el Dashboard en vivo y por la vista de solo
// lectura de un snapshot.

import { el } from "../dom.js"
import { renderSectionTable } from "./section-table.js"
import { formatAmount, activeCurrencies, calculateTotals, calculateTotalsConverted, convertAmount } from "../lib/finance.js"
import { computeRecurringBreakdown } from "../lib/obligations.js"
import { getSettings } from "../settings.js"

/**
 * @param {{ records, readOnly, gastoGroups, ingresoGroups, obligations, onAddAsset, onAddObligation, onChanged }} opts
 */
export function renderDashboardSheet(opts) {
  const { records, readOnly = false, obligations = [] } = opts
  const { convertCurrencies, baseCurrency, exchangeRates } = getSettings()

  const obligationExtraRows = readOnly ? [] : obligations
    .filter((o) => o.status === "ACTIVE" || o.status === "PAUSED")
    .map((o) => ({
      id: o.id,
      name: o.name,
      href: `/obligaciones/${o.id}`,
      paused: o.status === "PAUSED",
      valueNode: obligationValueNode(o, convertCurrencies, baseCurrency, exchangeRates),
    }))

  const ingresos = records.filter((r) => r.type === "ingreso")
  const gastos = records.filter((r) => r.type === "gasto")
  const activos = records.filter((r) => r.type === "activo" && !r.parentId && r.amount !== 0)
  const pasivos = records.filter((r) => r.type === "pasivo")
  const activosForTotal = records.filter((r) => r.type === "activo" && r.amount !== 0 && !r.isGroupParent)

  const totalIngresos = calculateTotals(ingresos)
  const totalGastos = calculateTotals(gastos)
  const flujoCurrencies = [...new Set([...activeCurrencies(totalIngresos), ...activeCurrencies(totalGastos)])]
  const flujoCaja = flujoCurrencies.map((c) => ({ currency: c, value: (totalIngresos[c] ?? 0) - (totalGastos[c] ?? 0) }))
  const convertedIngresos = calculateTotalsConverted(ingresos, baseCurrency, exchangeRates)
  const convertedGastos = calculateTotalsConverted(gastos, baseCurrency, exchangeRates)
  const convertedFlujo = convertedIngresos - convertedGastos

  const root = el("div")

  // ── Estado de Resultados ──────────────────────────────────────────────
  const resultBox = el("div", { style: "margin-bottom:1.5rem;" })
  resultBox.appendChild(el("h2", { style: "text-align:center; font-size:1.25rem; font-weight:bold; font-style:italic; margin-bottom:0.5rem;" }, "Estado de Resultados"))
  const resultRow = el("div", { style: "display:flex; gap:1rem; flex-wrap:wrap;" })

  const tablesCol = el("div", { style: "flex:1; min-width:20rem; display:flex; flex-direction:column; gap:1rem;" })
  tablesCol.appendChild(renderSectionTable({
    title: "Ingresos", type: "ingreso", records: ingresos, allRecords: records, valueLabel: "Flujo de Caja",
    linkType: "activo", linkLabel: "Activo", readOnly, flowGroups: opts.ingresoGroups, onChanged: opts.onChanged,
  }))
  tablesCol.appendChild(renderSectionTable({
    title: "Gastos", type: "gasto", records: gastos, allRecords: records, valueLabel: "Monto",
    readOnly, flowGroups: opts.gastoGroups, onChanged: opts.onChanged,
  }))
  resultRow.appendChild(tablesCol)

  const auditorBox = el("div", { class: "panel", style: "width:18rem; height:fit-content;" })
  auditorBox.appendChild(el("div", { class: "panel-header", style: "text-align:center;" }, "Auditor"))
  const auditorBody = el("div", { style: "display:flex; flex-direction:column; gap:1rem; padding:0.75rem;" })

  const ingresosStat = el("div")
  ingresosStat.appendChild(el("div", { style: "font-size:0.875rem; font-weight:bold;" }, "Total Ingresos:"))
  const ingresosValue = el("div", { style: "border-bottom:1px solid var(--black); padding:0.125rem 0; font-size:0.875rem;" })
  ingresosValue.appendChild(convertCurrencies ? el("span", {}, `${formatAmount(convertedIngresos, baseCurrency)} ${baseCurrency}`) : totalsInlineNode(totalIngresos))
  ingresosStat.appendChild(ingresosValue)
  auditorBody.appendChild(ingresosStat)

  const gastosStat = el("div")
  gastosStat.appendChild(el("div", { style: "font-size:0.875rem; font-weight:bold;" }, "Total Gastos:"))
  const gastosValue = el("div", { style: "border-bottom:1px solid var(--black); padding:0.125rem 0; font-size:0.875rem;" })
  gastosValue.appendChild(convertCurrencies ? el("span", {}, `${formatAmount(convertedGastos, baseCurrency)} ${baseCurrency}`) : totalsInlineNode(totalGastos))
  gastosStat.appendChild(gastosValue)
  auditorBody.appendChild(gastosStat)

  const flujoStat = el("div", { style: "border-top:2px solid var(--black); padding-top:0.75rem;" })
  flujoStat.appendChild(el("div", { style: "font-size:0.875rem; font-weight:bold;" }, "Flujo de Caja Mensual:"))
  const flujoValue = el("div", { style: "border-bottom:2px solid var(--black); padding-bottom:0.25rem; font-size:0.875rem; font-weight:bold;" })
  if (convertCurrencies) {
    flujoValue.appendChild(el("span", { style: `color:${convertedFlujo >= 0 ? "#047857" : "#be123c"};` }, `${convertedFlujo >= 0 ? "+" : ""}${formatAmount(convertedFlujo, baseCurrency)} ${baseCurrency}`))
  } else if (flujoCaja.length === 0) {
    flujoValue.appendChild(document.createTextNode("—"))
  } else {
    const col = el("div", { style: "display:flex; flex-direction:column; gap:0.125rem;" })
    for (const f of flujoCaja) col.appendChild(el("span", { style: `color:${f.value >= 0 ? "#047857" : "#be123c"};` }, `${f.value >= 0 ? "+" : ""}${formatAmount(f.value, f.currency)} ${f.currency}`))
    flujoValue.appendChild(col)
  }
  flujoStat.appendChild(flujoValue)
  const flujoHint = el("div", { class: "hint-text", style: "margin-top:0.25rem;" }, "(Ingresos - Gastos)")
  if (convertCurrencies) flujoHint.appendChild(el("span", { style: "margin-left:0.25rem; color:var(--gray-400);" }, `≈ ${baseCurrency}`))
  flujoStat.appendChild(flujoHint)
  auditorBody.appendChild(flujoStat)

  auditorBox.appendChild(auditorBody)
  resultRow.appendChild(auditorBox)
  resultBox.appendChild(resultRow)
  root.appendChild(resultBox)

  // ── BALANCE ───────────────────────────────────────────────────────────
  const balanceBox = el("div")
  balanceBox.appendChild(el("h2", { style: "text-align:center; font-size:1.25rem; font-weight:bold; margin-bottom:0.5rem;" }, "BALANCE"))
  const balanceGrid = el("div", { style: "display:grid; grid-template-columns:1fr 1fr; gap:1rem;" })
  balanceGrid.appendChild(renderSectionTable({
    title: "Activos", type: "activo", records: activos, allRecords: records, totalRecords: activosForTotal,
    valueLabel: "Valor", readOnly, onAddClick: opts.onAddAsset, onChanged: opts.onChanged,
  }))
  balanceGrid.appendChild(renderSectionTable({
    title: "Obligaciones", type: "pasivo", records: pasivos, allRecords: records, valueLabel: "Valor",
    readOnly, extraRows: obligationExtraRows, onAddClick: opts.onAddObligation, onChanged: opts.onChanged,
  }))
  balanceBox.appendChild(balanceGrid)
  root.appendChild(balanceBox)

  return root
}

function totalsInlineNode(totals) {
  const active = Object.keys(totals).filter((c) => totals[c] !== 0)
  if (active.length === 0) return document.createTextNode("—")
  const wrap = el("span")
  wrap.appendChild(document.createTextNode(active.map((c) => `${formatAmount(totals[c], c)} ${c}`).join(" · ")))
  return wrap
}

function obligationValueNode(o, convertCurrencies, baseCurrency, exchangeRates) {
  if (o.obligationType === "RECURRING") {
    const breakdown = computeRecurringBreakdown(o.rules)
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0)
    if (entries.length === 0) return el("span", { style: "color:var(--gray-400);" }, "—")
    if (convertCurrencies) {
      const total = entries.reduce((s, [cur, val]) => s + convertAmount(val, cur, baseCurrency, exchangeRates), 0)
      const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; line-height:1.2;" })
      wrap.appendChild(el("span", {}, `${formatAmount(total, baseCurrency)} ${baseCurrency}`))
      wrap.appendChild(el("span", { style: "font-size:0.625rem; color:var(--gray-400);" }, "anual"))
      return wrap
    }
    const wrap = el("div", { style: "display:flex; flex-direction:column; align-items:flex-end; gap:0.125rem; line-height:1.2;" })
    for (const [cur, val] of entries) wrap.appendChild(el("span", {}, `${formatAmount(val, cur)} ${cur}`))
    wrap.appendChild(el("span", { style: "font-size:0.625rem; color:var(--gray-400);" }, "anual"))
    return wrap
  }
  return el("span", {}, `${formatAmount(o.amount, o.currency)} ${o.currency}`)
}
