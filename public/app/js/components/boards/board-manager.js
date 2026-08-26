// Portado desde components/activos/boards/board-manager.tsx. El "Agregar
// tablero" del original es un DropdownMenu de Radix con 2 opciones fijas
// (Dividendos / Tablero personalizado). Montar un dropdown genérico para 2
// botones que nunca cambian es más aparato del que el caso pide -- acá son
// dos botones lado a lado, mismo resultado en un clic menos.

import { apiPatch } from "../../api.js"
import { el, clear, svgIcon } from "../../dom.js"
import { renderDividendsBoard } from "./dividends-board.js"
import { renderCustomBoard } from "./custom-board.js"

export function renderBoardManager(asset, onUpdated) {
  const wrap = el("div", { style: "display:flex; flex-direction:column; gap:1.5rem;", "data-testid": "asset-board-manager" })
  let confirmDeleteId = null

  function paint() {
    clear(wrap)
    for (const board of asset.boards) wrap.appendChild(paintBoard(board))
    wrap.appendChild(paintAddRow())
  }

  function paintBoard(board) {
    const box = el("div", { style: "position:relative;" })
    const content = board.type === "dividends" ? renderDividendsBoard(asset, board, onUpdated) : renderCustomBoard(asset, board, onUpdated)
    box.appendChild(content)

    const deleteRow = el("div", { style: "margin-top:0.25rem; display:flex; align-items:center; justify-content:flex-end; gap:0.5rem; font-size:0.75rem;" })
    if (confirmDeleteId === board.id) {
      deleteRow.appendChild(el("span", { class: "hint-text" }, "¿Eliminar tablero?"))
      const confirmBtn = el("button", { style: "font-weight:bold; color:#be123c; border:none; background:none;" }, "Confirmar")
      confirmBtn.addEventListener("click", async () => {
        await apiPatch(`/api/assets/${asset.id}/boards`, { boards: asset.boards.filter((b) => b.id !== board.id) })
        confirmDeleteId = null
        onUpdated()
      })
      const cancelBtn = el("button", { style: "color:var(--gray-500); border:none; background:none;" }, "Cancelar")
      cancelBtn.addEventListener("click", () => { confirmDeleteId = null; paint() })
      deleteRow.appendChild(confirmBtn); deleteRow.appendChild(cancelBtn)
    } else {
      const delBtn = el("button", { style: "color:var(--gray-400); border:none; background:none; display:flex; align-items:center; gap:0.25rem;" })
      delBtn.appendChild(svgIcon("icon-trash", 11))
      delBtn.appendChild(document.createTextNode(" Eliminar tablero"))
      delBtn.addEventListener("click", () => { confirmDeleteId = board.id; paint() })
      deleteRow.appendChild(delBtn)
    }
    box.appendChild(deleteRow)
    return box
  }

  function paintAddRow() {
    const row = el("div", { style: "display:flex; justify-content:center; gap:0.5rem;" })
    const addDividends = el("button", { class: "btn", style: "border-style:dashed; color:var(--gray-500);" })
    addDividends.appendChild(svgIcon("icon-plus", 12))
    addDividends.appendChild(document.createTextNode(" Dividendos"))
    addDividends.addEventListener("click", () => addBoard("dividends"))
    const addCustom = el("button", { class: "btn", style: "border-style:dashed; color:var(--gray-500);" })
    addCustom.appendChild(svgIcon("icon-plus", 12))
    addCustom.appendChild(document.createTextNode(" Tablero personalizado"))
    addCustom.addEventListener("click", () => addBoard("custom"))
    row.appendChild(addDividends); row.appendChild(addCustom)
    return row
  }

  async function addBoard(type) {
    const newBoard = {
      id: crypto.randomUUID(),
      type,
      title: type === "dividends" ? "Dividendos" : "Tablero personalizado",
      order: asset.boards.length,
      ...(type === "dividends" ? { dividends: [] } : { config: { columns: [], rows: [] } }),
    }
    await apiPatch(`/api/assets/${asset.id}/boards`, { boards: [...asset.boards, newBoard] })
    onUpdated()
  }

  paint()
  return wrap
}
