// Portado desde components/activos/panels/rebalance-bot-panel.tsx. Se
// activa cuando metadata.assets es un array.

import { apiPatch } from "../../api.js"
import { el, clear, createDialog, svgIcon } from "../../dom.js"
import { formatAmount, currencies, defaultCurrency } from "../../lib/finance.js"
import { calcWeightedAvgPrice } from "../../lib/assets-calc.js"

export function renderRebalanceBotPanel(asset, onUpdated) {
  const wrap = el("div", { style: "display:flex; flex-direction:column; gap:1.5rem;", "data-testid": "asset-panel-rebalance-bot" })
  const metadata = asset.metadata ?? { assets: [] }
  const assets = metadata.assets ?? []
  const totalInvested = assets.reduce((s, a) => s + a.invested, 0)

  async function saveMetadata(updatedAssets) {
    const currentTotal = updatedAssets.reduce((s, a) => s + a.invested, 0)
    const totalValue = updatedAssets.reduce((s, a) => s + a.currentPrice * a.currentQty, 0)
    await apiPatch(`/api/assets/${asset.id}`, {
      metadata: { assets: updatedAssets, totalInvested: currentTotal },
      amount: Math.max(currentTotal, totalValue),
    })
    onUpdated()
  }

  const headerPanel = el("div", { class: "panel" })
  const header = el("div", { class: "panel-header", style: "display:flex; align-items:center; justify-content:space-between;" })
  header.appendChild(el("span", {}, "Bot de Rebalanceo"))
  const actions = el("div", { style: "display:flex; gap:0.75rem;" })
  const depositBtn = el("button", { style: "color:var(--white); border:none; background:none; font-size:0.75rem;" }, "Nuevo aporte")
  depositBtn.addEventListener("click", () => openOperationDialog("deposit", asset, assets, saveMetadata))
  const extractBtn = el("button", { style: "color:var(--white); border:none; background:none; font-size:0.75rem;" }, "Extracción parcial")
  extractBtn.addEventListener("click", () => openOperationDialog("extraction", asset, assets, saveMetadata))
  const addBtn = el("button", { style: "display:flex; align-items:center; gap:0.25rem; color:var(--white); border:none; background:none; font-size:0.75rem;" })
  addBtn.appendChild(svgIcon("icon-plus", 13))
  addBtn.appendChild(document.createTextNode(" Activo"))
  addBtn.addEventListener("click", () => openAddAssetDialog(asset, assets, saveMetadata))
  actions.appendChild(depositBtn); actions.appendChild(extractBtn); actions.appendChild(addBtn)
  header.appendChild(actions)
  headerPanel.appendChild(header)

  const totalRow = el("div", { style: "padding:0.75rem 1rem; font-size:0.875rem;" })
  totalRow.appendChild(el("span", { style: "font-weight:bold; color:var(--gray-500);" }, "Total invertido: "))
  totalRow.appendChild(el("span", { style: "font-weight:bold;" }, `${formatAmount(totalInvested, asset.currency)} ${asset.currency}`))
  headerPanel.appendChild(totalRow)
  wrap.appendChild(headerPanel)

  const tablePanel = el("div", { class: "panel" })
  const head = el("div", { style: "display:flex; background:var(--gray-100); font-size:0.75rem; font-weight:bold;" })
  head.appendChild(el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" }, "Activo"))
  head.appendChild(el("div", { style: "width:7rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Invertido"))
  head.appendChild(el("div", { style: "width:7rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Precio prom."))
  head.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Qty inicial"))
  head.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right;" }, "Qty actual"))
  head.appendChild(el("div", { style: "width:2.5rem; padding:0.5rem 0.25rem;" }))
  tablePanel.appendChild(head)

  if (assets.length === 0) {
    tablePanel.appendChild(el("div", { class: "state-message" }, "Sin activos en el bot. Agregá el primero."))
  }
  for (const a of assets) {
    const row = el("div", { style: "display:flex; border-bottom:1px solid var(--black); font-size:0.875rem;" })
    const nameCell = el("div", { style: "flex:1; border-right:1px solid var(--black); padding:0.5rem 0.75rem;" })
    nameCell.appendChild(el("div", { style: "font-weight:500;" }, a.name))
    if (a.ticker) nameCell.appendChild(el("div", { class: "hint-text" }, a.ticker))
    row.appendChild(nameCell)
    row.appendChild(el("div", { style: "width:7rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace; font-size:0.75rem;" }, formatAmount(a.invested, a.currency)))
    row.appendChild(el("div", { style: "width:7rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace; font-size:0.75rem;" }, formatAmount(a.currentPrice, a.currency)))
    row.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace; font-size:0.75rem;" }, a.initialQty.toFixed(4)))
    row.appendChild(el("div", { style: "width:6rem; border-right:1px solid var(--black); padding:0.5rem 0.75rem; text-align:right; font-family:monospace; font-size:0.75rem;" }, a.currentQty.toFixed(4)))
    const actionCell = el("div", { style: "width:2.5rem; display:flex; align-items:center; justify-content:center;" })
    const delBtn = el("button", { class: "flow-row-icon-btn" })
    delBtn.appendChild(svgIcon("icon-trash", 12))
    delBtn.addEventListener("click", () => saveMetadata(assets.filter((x) => x.id !== a.id)))
    actionCell.appendChild(delBtn)
    row.appendChild(actionCell)
    tablePanel.appendChild(row)
  }
  wrap.appendChild(tablePanel)

  return wrap
}

function openAddAssetDialog(asset, assets, saveMetadata) {
  const dialog = createDialog()
  let addName = "", addTicker = "", addInvested = "", addPrice = "", addQty = "", addCurrency = asset.currency ?? defaultCurrency

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, "Agregar activo al bot"))
    const body = el("div", { class: "modal-body" })

    const row1 = el("div", { style: "display:flex; gap:0.75rem;" })
    const nameField = el("div", { class: "field", style: "flex:1;" })
    nameField.appendChild(el("label", {}, "Nombre"))
    const nameInput = el("input", { class: "input", value: addName })
    nameInput.addEventListener("input", () => { addName = nameInput.value; syncSave() })
    nameField.appendChild(nameInput)
    const tickerField = el("div", { class: "field", style: "flex:1;" })
    tickerField.appendChild(el("label", {}, "Ticker"))
    const tickerInput = el("input", { class: "input", value: addTicker })
    tickerInput.addEventListener("input", () => { addTicker = tickerInput.value })
    tickerField.appendChild(tickerInput)
    row1.appendChild(nameField); row1.appendChild(tickerField)
    body.appendChild(row1)

    const row2 = el("div", { style: "display:flex; gap:0.75rem;" })
    const priceField = el("div", { class: "field", style: "flex:1;" })
    priceField.appendChild(el("label", {}, "Precio inicial"))
    const priceInput = el("input", { class: "input", placeholder: "0.00", value: addPrice })
    priceInput.addEventListener("input", () => { addPrice = priceInput.value; syncSave() })
    priceField.appendChild(priceInput)
    const qtyField = el("div", { class: "field", style: "flex:1;" })
    qtyField.appendChild(el("label", {}, "Cantidad"))
    const qtyInput = el("input", { class: "input", placeholder: "0", value: addQty })
    qtyInput.addEventListener("input", () => { addQty = qtyInput.value; syncSave() })
    qtyField.appendChild(qtyInput)
    row2.appendChild(priceField); row2.appendChild(qtyField)
    body.appendChild(row2)

    const row3 = el("div", { style: "display:flex; gap:0.75rem;" })
    const investedField = el("div", { class: "field", style: "flex:1;" })
    investedField.appendChild(el("label", {}, "Monto invertido"))
    const investedInput = el("input", { class: "input", placeholder: "Auto (precio×qty)", value: addInvested })
    investedInput.addEventListener("input", () => { addInvested = investedInput.value })
    investedField.appendChild(investedInput)
    const curField = el("div", { class: "field", style: "width:6rem;" })
    curField.appendChild(el("label", {}, "Moneda"))
    const curSelect = el("select", { class: "input" })
    for (const c of currencies) curSelect.appendChild(el("option", { value: c }, c))
    curSelect.value = addCurrency
    curSelect.addEventListener("change", () => { addCurrency = curSelect.value })
    curField.appendChild(curSelect)
    row3.appendChild(investedField); row3.appendChild(curField)
    body.appendChild(row3)
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, "Agregar")
    saveBtn.disabled = !addName || !addPrice || !addQty
    saveBtn.addEventListener("click", handleAdd)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)

    function syncSave() { saveBtn.disabled = !addName || !addPrice || !addQty }
  }

  function handleAdd() {
    if (!addName || !addPrice || !addQty) return
    const newAsset = {
      id: crypto.randomUUID(), name: addName, ticker: addTicker || undefined,
      invested: Number(addInvested) || Number(addPrice) * Number(addQty),
      currentPrice: Number(addPrice), initialQty: Number(addQty), currentQty: Number(addQty), currency: addCurrency,
    }
    dialog.close()
    saveMetadata([...assets, newAsset])
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}

function openOperationDialog(kind, asset, assets, saveMetadata) {
  const dialog = createDialog()
  let operationAmount = ""
  const isDeposit = kind === "deposit"

  function paint() {
    clear(dialog)
    dialog.appendChild(el("div", { class: "modal-header" }, isDeposit ? "Nuevo aporte" : "Extracción parcial"))
    const body = el("div", { class: "modal-body" })
    const field = el("div", { class: "field" })
    field.appendChild(el("label", {}, `${isDeposit ? "Monto del aporte" : "Monto total a extraer"} (${asset.currency})`))
    const input = el("input", { class: "input", placeholder: "0.00", value: operationAmount })
    input.addEventListener("input", () => { operationAmount = input.value; syncSave() })
    field.appendChild(input)
    body.appendChild(field)
    body.appendChild(el("p", { class: "hint-text" },
      isDeposit
        ? "Se distribuirá el aporte proporcionalmente entre los activos según su inversión inicial y se actualizará el precio promedio."
        : "Se reducirá la cantidad de cada activo proporcionalmente al valor de mercado actual."))
    dialog.appendChild(body)

    const footer = el("div", { class: "modal-footer" })
    const cancelBtn = el("button", { class: "btn" }, "Cancelar")
    cancelBtn.addEventListener("click", () => dialog.close())
    const saveBtn = el("button", { class: "btn btn-primary" }, isDeposit ? "Confirmar aporte" : "Confirmar extracción")
    saveBtn.disabled = !operationAmount
    saveBtn.addEventListener("click", handleConfirm)
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn)
    dialog.appendChild(footer)
    setTimeout(() => input.focus(), 0)

    function syncSave() { saveBtn.disabled = !operationAmount }
  }

  function handleConfirm() {
    if (isDeposit) {
      const total = assets.reduce((s, a) => s + a.invested, 0)
      if (total === 0 || assets.length === 0) return
      const depositAmt = Number(operationAmount)
      const updated = assets.map((a) => {
        const share = a.invested / total
        const depositForAsset = depositAmt * share
        const newQty = depositForAsset / a.currentPrice
        const newTotalQty = a.currentQty + newQty
        const newAvgPrice = calcWeightedAvgPrice(a.currentQty, a.currentPrice, newQty, a.currentPrice)
        return { ...a, invested: a.invested + depositForAsset, currentQty: newTotalQty, currentPrice: newAvgPrice }
      })
      dialog.close()
      saveMetadata(updated)
    } else {
      const total = assets.reduce((s, a) => s + a.currentPrice * a.currentQty, 0)
      if (total === 0) return
      const extractAmt = Number(operationAmount)
      const ratio = extractAmt / total
      const updated = assets.map((a) => ({ ...a, currentQty: Math.max(0, a.currentQty * (1 - ratio)) }))
      dialog.close()
      saveMetadata(updated)
    }
  }

  dialog.addEventListener("close", () => dialog.remove(), { once: true })
  paint()
  dialog.showModal()
}
