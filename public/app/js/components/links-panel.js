// Portado desde components/gastos/gasto-ingreso-links-panel.tsx +
// components/ingresos/ingreso-gasto-links-panel.tsx. Los dos componentes
// React eran un espejo exacto uno del otro (mismos campos, nombres
// invertidos) — acá es un solo módulo parametrizado por `kind`, así un bug
// arreglado de un lado no puede quedar sin arreglar del otro.

import { apiGet, apiPost, apiDelete } from "../api.js"
import { el, clear, createDialog } from "../dom.js"
import { formatAmount, currencies } from "../lib/finance.js"

const KIND = {
  gasto: {
    queryParam: "gastoId",
    otherField: "ingresoId",
    otherLabel: "Ingreso",
    title: "Vincular ingreso",
    panelTitle: "Ingresos que financian este gasto",
    emptyText: "Sin ingresos vinculados.",
    placeholder: "Seleccionar ingreso...",
    noOptionsText: "Sin ingresos disponibles",
    optionsField: "ingresos",
    nameField: "ingresoName",
    idField: "ingresoId",
  },
  ingreso: {
    queryParam: "ingresoId",
    otherField: "gastoId",
    otherLabel: "Gasto",
    title: "Vincular gasto",
    panelTitle: "Gastos financiados por este ingreso",
    emptyText: "Sin gastos vinculados.",
    placeholder: "Seleccionar gasto...",
    noOptionsText: "Sin gastos disponibles",
    optionsField: "gastos",
    nameField: "gastoName",
    idField: "gastoId",
  },
}

/**
 * Crea el panel de vínculos para un gasto o ingreso. Devuelve el nodo raíz
 * ya montado con su propio ciclo de carga — el caller solo lo inserta donde
 * corresponda (debajo de la fila expandida).
 */
export function createLinksPanel(kind, recordId, recordCurrency) {
  const cfg = KIND[kind]
  const root = el("div", { class: "links-panel" })
  const listBox = el("div")
  root.appendChild(listBox)

  async function load() {
    clear(listBox)
    listBox.appendChild(el("p", { class: "hint-text" }, "Cargando..."))
    const { links } = await apiGet(`/api/links?${cfg.queryParam}=${recordId}`)
    clear(listBox)
    paint(links)
  }

  function paint(links) {
    const header = el("div", { class: "links-panel-header" })
    header.appendChild(el("span", { class: "links-panel-title" }, cfg.panelTitle))
    const addBtn = el("button", { class: "links-add-btn" }, "+ Agregar")
    addBtn.addEventListener("click", openAddDialog)
    header.appendChild(addBtn)
    listBox.appendChild(header)

    if (links.length === 0) {
      listBox.appendChild(el("div", { class: "hint-text", style: "padding:0.5rem 0;" }, cfg.emptyText))
      return
    }

    for (const link of links) {
      const row = el("div", { class: "link-row" })
      row.appendChild(el("span", { class: "link-name" }, link[cfg.nameField] ?? link[cfg.idField]))
      const right = el("div", { class: "link-right" })
      right.appendChild(el("span", { class: "link-amount" }, `${formatAmount(link.attributedAmount, link.currency)} ${link.currency}`))
      const delBtn = el("button", { class: "link-delete" }, "✕")
      delBtn.addEventListener("click", async () => {
        await apiDelete(`/api/links/${link.id}`)
        load()
      })
      right.appendChild(delBtn)
      row.appendChild(right)
      listBox.appendChild(row)
    }
  }

  async function openAddDialog() {
    const dialog = createDialog()
    const { [cfg.optionsField]: options } = await apiGet("/api/links/options")

    let selectedId = ""
    let attributedAmount = ""
    let linkCurrency = recordCurrency
    let saving = false

    function paintDialog() {
      clear(dialog)
      dialog.appendChild(el("div", { class: "modal-header" }, cfg.title))
      const body = el("div", { class: "modal-body" })

      const optionField = el("div", { class: "field" })
      optionField.appendChild(el("label", {}, `${cfg.otherLabel} *`))
      const select = el("select", { class: "input" })
      select.appendChild(el("option", { value: "" }, cfg.placeholder))
      if (options.length === 0) {
        select.appendChild(el("option", { value: "", disabled: true }, cfg.noOptionsText))
      } else {
        for (const o of options) {
          select.appendChild(el("option", { value: o.id }, `${o.name} (${formatAmount(o.amount, o.currency)} ${o.currency})`))
        }
      }
      select.value = selectedId
      select.addEventListener("change", () => {
        selectedId = select.value
        saveBtn.disabled = !selectedId || !attributedAmount || saving
      })
      optionField.appendChild(select)
      body.appendChild(optionField)

      const amountRow = el("div", { style: "display:flex; gap:0.75rem;" })
      const amountField = el("div", { class: "field", style: "flex:1;" })
      amountField.appendChild(el("label", {}, "Monto atribuido *"))
      const amountInput = el("input", { class: "input", placeholder: "0.00", value: attributedAmount })
      amountInput.addEventListener("input", () => {
        attributedAmount = amountInput.value
        saveBtn.disabled = !selectedId || !attributedAmount || saving
      })
      amountField.appendChild(amountInput)

      const currencyField = el("div", { class: "field", style: "width:6rem;" })
      currencyField.appendChild(el("label", {}, "Moneda"))
      const currencySelect = el("select", { class: "input" })
      for (const c of currencies) currencySelect.appendChild(el("option", { value: c }, c))
      currencySelect.value = linkCurrency
      currencySelect.addEventListener("change", () => { linkCurrency = currencySelect.value })
      currencyField.appendChild(currencySelect)

      amountRow.appendChild(amountField)
      amountRow.appendChild(currencyField)
      body.appendChild(amountRow)
      dialog.appendChild(body)

      const footer = el("div", { class: "modal-footer" })
      const cancelBtn = el("button", { class: "btn" }, "Cancelar")
      cancelBtn.addEventListener("click", () => dialog.close())
      const saveBtn = el("button", { class: "btn btn-primary" }, "Vincular")
      saveBtn.disabled = !selectedId || !attributedAmount
      saveBtn.addEventListener("click", async () => {
        if (!selectedId || !attributedAmount) return
        saving = true
        saveBtn.disabled = true
        saveBtn.textContent = "Vinculando..."
        try {
          await apiPost("/api/links", {
            [cfg.queryParam]: recordId,
            [cfg.otherField]: selectedId,
            attributedAmount: Number(attributedAmount),
            currency: linkCurrency,
          })
          dialog.close()
          load()
        } finally {
          saving = false
        }
      })
      footer.appendChild(cancelBtn)
      footer.appendChild(saveBtn)
      dialog.appendChild(footer)
    }

    dialog.addEventListener("close", () => dialog.remove(), { once: true })
    paintDialog()
    dialog.showModal()
  }

  load()
  return root
}
