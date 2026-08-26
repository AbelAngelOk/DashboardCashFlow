// Portado desde app/(dashboard)/gastos/[id]/page.tsx. Encontrado al migrar
// el Dashboard: dashboard-sheet.tsx enlaza a esta ruta y no había sido
// migrada en la sub-fase de Gastos/Ingresos (esa cubrió solo la lista).

import { apiGet } from "../api.js"
import { el, clear, mount, svgIcon } from "../dom.js"
import { formatAmount } from "../lib/finance.js"
import { createLinksPanel } from "../components/links-panel.js"

const STATUS_LABELS = { ACTIVE: "Activo", HISTORICAL: "Histórico", ARCHIVED: "Archivado", PENDING: "Pendiente", CANCELLED: "Cancelado" }
const STATUS_CLASSES = {
  ACTIVE: "obl-status-active", HISTORICAL: "obl-status-completed", ARCHIVED: "obl-status-completed",
  PENDING: "obl-status-paused", CANCELLED: "obl-status-cancelled",
}

export async function render(main, params) {
  clear(main)
  const wrap = el("div", { style: "max-width:36rem; margin:0 auto;" })
  mount(main, wrap)
  wrap.appendChild(el("div", { class: "state-message" }, "Cargando..."))

  const gasto = await apiGet(`/api/gastos/${params.id}`)
  clear(wrap)

  const backLink = el("a", { href: "/gastos", "data-link": "", class: "obl-back-link", style: "margin-bottom:1rem;" })
  backLink.appendChild(svgIcon("icon-arrow-right", 14))
  backLink.firstChild.style.transform = "rotate(180deg)"
  backLink.appendChild(document.createTextNode(" Volver a Gastos"))
  wrap.appendChild(backLink)

  const header = el("div", { style: "display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid var(--black); padding-bottom:0.5rem; margin-bottom:1rem;" })
  const titleBox = el("div")
  titleBox.appendChild(el("h1", { style: "font-size:1.25rem; font-weight:bold;" }, gasto.name))
  titleBox.appendChild(el("p", { class: "hint-text" }, "Gasto"))
  header.appendChild(titleBox)
  header.appendChild(el("span", { class: `obl-status-badge ${STATUS_CLASSES[gasto.status] ?? "obl-status-completed"}` }, STATUS_LABELS[gasto.status] ?? gasto.status))
  wrap.appendChild(header)

  const infoPanel = el("div", { class: "panel", style: "margin-bottom:1rem;" })
  infoPanel.appendChild(el("div", { class: "panel-header" }, "Información"))
  const infoBody = el("div", { style: "display:flex; flex-direction:column; gap:0.75rem; padding:1rem; font-size:0.875rem;" })

  const amountRow = el("div", { style: "display:flex; justify-content:space-between;" })
  amountRow.appendChild(el("span", { style: "font-weight:600; color:var(--gray-500);" }, "Monto"))
  amountRow.appendChild(el("span", { style: "font-weight:bold;" }, `${formatAmount(gasto.amount, gasto.currency)} ${gasto.currency}`))
  infoBody.appendChild(amountRow)

  if (gasto.operationDate) {
    const dateRow = el("div", { style: "display:flex; justify-content:space-between;" })
    dateRow.appendChild(el("span", { style: "font-weight:600; color:var(--gray-500);" }, "Fecha"))
    dateRow.appendChild(el("span", {}, new Date(gasto.operationDate).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })))
    infoBody.appendChild(dateRow)
  }

  const sourceRow = el("div", { style: "display:flex; justify-content:space-between; align-items:center;" })
  sourceRow.appendChild(el("span", { style: "font-weight:600; color:var(--gray-500);" }, "Origen"))
  if (gasto.source.type === "obligation") {
    const link = el("a", { href: `/obligaciones/${gasto.source.obligationId}`, "data-link": "", style: "font-weight:500; text-decoration:none;" }, gasto.source.obligationName)
    sourceRow.appendChild(link)
  } else if (gasto.source.type === "asset") {
    const link = el("a", { href: `/activos/${gasto.source.assetId}`, "data-link": "", style: "font-weight:500; text-decoration:none;" }, gasto.source.assetName)
    sourceRow.appendChild(link)
  } else {
    sourceRow.appendChild(el("span", { class: "hint-text" }, "Manual"))
  }
  infoBody.appendChild(sourceRow)
  infoPanel.appendChild(infoBody)
  wrap.appendChild(infoPanel)

  if (gasto.previousVersionId || gasto.nextVersionId) {
    const versionPanel = el("div", { class: "panel", style: "margin-bottom:1rem;" })
    versionPanel.appendChild(el("div", { class: "panel-header" }, "Historial de versiones"))
    const versionBody = el("div", { style: "display:flex; flex-direction:column; gap:0.5rem; padding:1rem; font-size:0.875rem;" })
    if (gasto.previousVersionId) {
      const link = el("a", { href: `/gastos/${gasto.previousVersionId}`, "data-link": "", class: "obl-back-link" })
      link.appendChild(svgIcon("icon-arrow-right", 12))
      link.firstChild.style.transform = "rotate(180deg)"
      link.appendChild(document.createTextNode(" Ver versión anterior"))
      versionBody.appendChild(link)
    }
    if (gasto.nextVersionId) {
      const link = el("a", { href: `/gastos/${gasto.nextVersionId}`, "data-link": "", class: "obl-back-link" })
      link.appendChild(document.createTextNode("Ver versión actual "))
      link.appendChild(svgIcon("icon-arrow-right", 12))
      versionBody.appendChild(link)
    }
    versionPanel.appendChild(versionBody)
    wrap.appendChild(versionPanel)
  }

  wrap.appendChild(createLinksPanel("gasto", gasto.id, gasto.currency))

  return () => {}
}
