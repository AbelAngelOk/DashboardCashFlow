// Portado desde app/(dashboard)/snapshots/[id]/page.tsx. Quedó pendiente
// desde la sub-fase de Snapshots (ver MIGRATION_PLAN.md): dependía del
// mismo dashboard-sheet.js de 1250 líneas que recién se terminó de portar
// para el Dashboard en vivo. Ahora que existe, esta página lo reusa en modo
// `readOnly` — no se vuelve a escribir nada.
//
// No hay endpoint GET /api/snapshots/:id (el original tampoco lo tiene: lee
// del array ya cargado en el Context). Acá se pide la lista completa y se
// busca el id — igual costo que el original, que ya traía todos los
// snapshots completos desde el bootstrap.

import { apiGet } from "../api.js"
import { el, clear, mount, svgIcon } from "../dom.js"
import { formatAmount } from "../lib/finance.js"
import { renderDashboardSheet } from "../components/dashboard-sheet.js"

const ACCOUNT_LABELS = { activos: "Activos", pasivos: "Pasivos", ingresos: "Ingresos", gastos: "Gastos", efectivo: "Efectivo", obligaciones: "Obligaciones" }

export async function render(main, params) {
  clear(main)
  const wrap = el("div", { style: "max-width:72rem; margin:0 auto;" })
  mount(main, wrap)
  wrap.appendChild(el("div", { class: "state-message" }, "Cargando..."))

  const { snapshots } = await apiGet("/api/snapshots")
  const snapshot = snapshots.find((s) => s.id === params.id)
  clear(wrap)

  if (!snapshot) {
    const backLink = el("a", { href: "/app/snapshots", "data-link": "", class: "obl-back-link" })
    backLink.appendChild(svgIcon("icon-arrow-right", 14))
    backLink.firstChild.style.transform = "rotate(180deg)"
    backLink.appendChild(document.createTextNode(" Snapshots"))
    const header = el("div", { class: "obl-detail-header" })
    header.appendChild(backLink)
    header.appendChild(el("span", { style: "font-weight:bold;" }, "Snapshot no encontrado"))
    wrap.appendChild(header)
    wrap.appendChild(el("p", { class: "hint-text" }, "Este snapshot no existe o fue eliminado."))
    return () => {}
  }

  const header = el("div", { style: "display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid var(--black); padding-bottom:0.5rem; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;" })
  const left = el("div", { style: "display:flex; align-items:center; gap:0.75rem;" })
  const backLink = el("a", { href: "/app/snapshots", "data-link": "", class: "obl-back-link" })
  backLink.appendChild(svgIcon("icon-arrow-right", 14))
  backLink.firstChild.style.transform = "rotate(180deg)"
  left.appendChild(backLink)
  left.appendChild(el("div", { style: "display:inline-block; background:var(--black); color:var(--white); padding:0.25rem 1rem; font-weight:bold;" }, snapshot.name))
  header.appendChild(left)
  const right = el("div", { style: "display:flex; align-items:center; gap:0.75rem; font-size:0.875rem; color:var(--gray-500);" })
  right.appendChild(el("span", { style: "text-transform:capitalize;" }, snapshot.period))
  const dateBox = el("span", { style: "display:flex; align-items:center; gap:0.25rem;" })
  dateBox.appendChild(svgIcon("icon-camera", 13))
  dateBox.appendChild(document.createTextNode(snapshot.createdAt))
  right.appendChild(dateBox)
  header.appendChild(right)
  wrap.appendChild(header)

  const balances = snapshot.data?.accountBalances
  if (balances) {
    const accounts = Object.keys(balances)
    const hasSome = accounts.some((a) => Object.values(balances[a]).some((v) => v !== 0))
    if (hasSome) {
      const balancesSection = el("div", { style: "margin-bottom:1.5rem;" })
      balancesSection.appendChild(el("h2", { class: "obl-info-label", style: "margin-bottom:0.5rem;" }, "Balances Contables al Snapshot"))
      const grid = el("div", { class: "balances-grid" })
      for (const account of accounts) {
        const entries = Object.entries(balances[account]).filter(([, v]) => v !== 0)
        if (entries.length === 0) continue
        const card = el("div", { class: "balance-card" })
        card.appendChild(el("div", { class: "balance-card-title" }, ACCOUNT_LABELS[account] ?? account))
        for (const [cur, val] of entries) {
          card.appendChild(el("div", { class: "balance-card-row", style: `color:${val >= 0 ? "var(--emerald-700)" : "var(--rose-700)"};` },
            `${val >= 0 ? "+" : ""}${formatAmount(Math.abs(val), cur)} ${cur}`))
        }
        grid.appendChild(card)
      }
      balancesSection.appendChild(grid)
      wrap.appendChild(balancesSection)
    }
  }

  wrap.appendChild(renderDashboardSheet({ records: snapshot.records, readOnly: true }))

  return () => {}
}
