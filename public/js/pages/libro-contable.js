// Portado desde app/(dashboard)/libro-contable/page.tsx. Solo lectura, sin
// URL-sync (el original tampoco la tiene: los filtros son estado local que
// se pierde al salir de la pantalla, y así se mantiene acá).
//
// Usa GET /api/journal, el endpoint compuesto que ya trae entries + balances
// en una sola request paralelizada en el servidor -- el original hacía
// Promise.all de dos Server Actions separadas; acá es una sola llamada HTTP.

import { apiGet, ApiError, NetworkError } from "../api.js"
import { el, mount, clear, svgIcon } from "../dom.js"
import { formatAmount } from "../lib/finance.js"

const ACCOUNT_LABELS = {
  activos: "Activos", pasivos: "Pasivos", ingresos: "Ingresos",
  gastos: "Gastos", efectivo: "Efectivo", obligaciones: "Obligaciones",
}

const ACCOUNT_COLORS = {
  activos: { bg: "#ecfdf5", fg: "#065f46" },
  pasivos: { bg: "#fff1f2", fg: "#9f1239" },
  ingresos: { bg: "#eff6ff", fg: "#1e40af" },
  gastos: { bg: "#fffbeb", fg: "#92400e" },
  efectivo: { bg: "#f1f5f9", fg: "#334155" },
  obligaciones: { bg: "#faf5ff", fg: "#6b21a8" },
}

function accountBadge(account) {
  const c = ACCOUNT_COLORS[account]
  return el("span", {
    class: "account-badge",
    style: `background:${c.bg}; color:${c.fg};`,
  }, ACCOUNT_LABELS[account] ?? account)
}

export async function render(main) {
  clear(main)

  const wrap = el("div")
  const header = el("div", { class: "page-header" })
  const icon = svgIcon("icon-book", 20)
  const headerText = el("div")
  headerText.appendChild(el("h1", { class: "settings-title", style: "border:none; margin:0; padding:0;" }, "Libro Contable"))
  headerText.appendChild(el("p", { class: "hint-text" }, "Asientos de doble entrada"))
  header.appendChild(icon)
  header.appendChild(headerText)
  wrap.appendChild(header)

  const balancesBox = el("div")
  wrap.appendChild(balancesBox)

  const filterBar = el("div", { class: "journal-filters" })
  const fromInput = el("input", { class: "input", type: "date" })
  const toInput = el("input", { class: "input", type: "date" })
  const accountSelect = el("select", { class: "input" })
  accountSelect.appendChild(el("option", { value: "all" }, "Todas las cuentas"))
  for (const [value, label] of Object.entries(ACCOUNT_LABELS)) {
    accountSelect.appendChild(el("option", { value }, label))
  }
  const currencySelect = el("select", { class: "input" })
  currencySelect.appendChild(el("option", { value: "all" }, "Todas"))
  const clearBtn = el("button", { class: "btn", style: "display:none;" }, "Limpiar")

  filterBar.appendChild(fromInput)
  filterBar.appendChild(toInput)
  filterBar.appendChild(accountSelect)
  filterBar.appendChild(currencySelect)
  filterBar.appendChild(clearBtn)
  wrap.appendChild(filterBar)

  const resultsBox = el("div")
  wrap.appendChild(resultsBox)

  mount(main, wrap)

  let state = { fromDate: "", toDate: "", account: "all", currency: "all" }
  let reqId = 0

  function syncClearButton() {
    const isFiltered = state.fromDate || state.toDate || state.account !== "all" || state.currency !== "all"
    clearBtn.style.display = isFiltered ? "" : "none"
  }

  function applyChange(patch) {
    state = { ...state, ...patch }
    syncClearButton()
    fetchData()
  }

  fromInput.addEventListener("change", () => applyChange({ fromDate: fromInput.value }))
  toInput.addEventListener("change", () => applyChange({ toDate: toInput.value }))
  accountSelect.addEventListener("change", () => applyChange({ account: accountSelect.value }))
  currencySelect.addEventListener("change", () => applyChange({ currency: currencySelect.value }))
  clearBtn.addEventListener("click", () => {
    fromInput.value = ""; toInput.value = ""; accountSelect.value = "all"; currencySelect.value = "all"
    applyChange({ fromDate: "", toDate: "", account: "all", currency: "all" })
  })

  async function fetchData() {
    const id = ++reqId
    resultsBox.classList.add("is-loading")
    const sp = new URLSearchParams()
    if (state.fromDate) sp.set("fromDate", state.fromDate)
    if (state.toDate) sp.set("toDate", state.toDate)
    if (state.account !== "all") sp.set("account", state.account)
    if (state.currency !== "all") sp.set("currency", state.currency)

    try {
      const { entries, balances } = await apiGet(`/api/journal?${sp.toString()}`)
      if (id !== reqId) return
      renderBalances(balances)
      renderCurrencyOptions(entries)
      renderEntries(entries)
    } catch (e) {
      if (id !== reqId) return
      renderError(e)
    } finally {
      if (id === reqId) resultsBox.classList.remove("is-loading")
    }
  }

  function renderBalances(balances) {
    clear(balancesBox)
    const accounts = Object.keys(balances)
    const hasSome = accounts.some((a) => Object.values(balances[a]).some((v) => v !== 0))
    if (!hasSome) return

    const grid = el("div", { class: "balances-grid" })
    for (const account of accounts) {
      const currencies = balances[account]
      const entries = Object.entries(currencies).filter(([, v]) => v !== 0)
      if (entries.length === 0) continue
      const card = el("div", { class: "balance-card" })
      card.appendChild(el("div", { class: "balance-card-title" }, ACCOUNT_LABELS[account]))
      for (const [cur, val] of entries) {
        const row = el("div", {
          class: "balance-card-row",
          style: `color: ${val >= 0 ? "var(--emerald-700)" : "var(--rose-700)"};`,
        }, `${val >= 0 ? "+" : ""}${formatAmount(Math.abs(val), cur)} ${cur}`)
        card.appendChild(row)
      }
      grid.appendChild(card)
    }
    balancesBox.appendChild(grid)
  }

  function renderCurrencyOptions(entries) {
    const currencies = [...new Set(entries.map((e) => e.currency))]
    const prev = currencySelect.value
    clear(currencySelect)
    currencySelect.appendChild(el("option", { value: "all" }, "Todas"))
    for (const c of currencies) currencySelect.appendChild(el("option", { value: c }, c))
    currencySelect.value = currencies.includes(prev) || prev === "all" ? prev : "all"
  }

  function renderEntries(entries) {
    clear(resultsBox)
    if (entries.length === 0) {
      const empty = el("div", { class: "state-message" }, "No hay asientos contables registrados")
      resultsBox.appendChild(empty)
      return
    }

    const tableWrap = el("div", { style: "overflow-x:auto;" })
    const table = el("table", { class: "journal-table" })
    const thead = el("thead")
    const headRow = el("tr")
    for (const h of ["Fecha", "Descripción", "Debe", "Haber", "Monto"]) {
      headRow.appendChild(el("th", { class: h === "Monto" ? "align-right" : "" }, h))
    }
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = el("tbody")
    for (const entry of entries) {
      const row = el("tr")
      const date = new Date(entry.date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
      row.appendChild(el("td", { class: "journal-date" }, date))
      row.appendChild(el("td", { class: "journal-desc" }, entry.description))
      const debitCell = el("td"); debitCell.appendChild(accountBadge(entry.debitAccount)); row.appendChild(debitCell)
      const creditCell = el("td"); creditCell.appendChild(accountBadge(entry.creditAccount)); row.appendChild(creditCell)
      row.appendChild(el("td", { class: "align-right journal-amount" }, `${formatAmount(entry.amount, entry.currency)} ${entry.currency}`))
      tbody.appendChild(row)
    }
    table.appendChild(tbody)
    tableWrap.appendChild(table)
    resultsBox.appendChild(tableWrap)
    resultsBox.appendChild(el("p", { class: "hint-text", style: "text-align:right; margin-top:0.5rem;" },
      `${entries.length} asiento${entries.length !== 1 ? "s" : ""}`))
  }

  function renderError(e) {
    clear(resultsBox)
    const msg = e instanceof NetworkError ? "No se pudo conectar con el servidor."
      : e instanceof ApiError ? e.message : "Ocurrió un error inesperado."
    resultsBox.appendChild(el("div", { class: "state-message is-error" }, msg))
  }

  fetchData()

  return () => { reqId++ }
}
