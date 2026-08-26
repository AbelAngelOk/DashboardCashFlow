// Portado desde app/(dashboard)/snapshots/page.tsx. Solo la tabla — el
// original también tenía una variante de tarjetas para mobile con un
// media query, pero esta app es exclusivamente desktop (ver CLAUDE.md /
// MIGRATION_PLAN.md: sin responsive, sin breakpoints), así que esa segunda
// variante no tiene sentido acá.
//
// El detalle (/snapshots/:id) ya está migrado (reusa dashboard-sheet.js
// en modo readOnly, construido para el Dashboard en vivo) — ver snapshot-detail.js.

import { apiGet, ApiError, NetworkError } from "../api.js"
import { el, mount, clear, svgIcon } from "../dom.js"

export async function render(main) {
  clear(main)

  const wrap = el("div", { style: "max-width:56rem; margin:0 auto;" })
  const title = el("h1", { class: "settings-title" })
  title.appendChild(svgIcon("icon-camera", 20))
  title.appendChild(document.createTextNode("Snapshots"))
  wrap.appendChild(title)

  const body = el("div")
  wrap.appendChild(body)
  mount(main, wrap)

  body.appendChild(el("p", { class: "state-message" }, "Cargando..."))

  try {
    const { snapshots } = await apiGet("/api/snapshots")
    clear(body)

    if (snapshots.length === 0) {
      body.appendChild(el("p", { class: "hint-text" }, "Aún no hay snapshots guardados. Tomá uno desde el Dashboard."))
      return
    }

    const table = el("div", { class: "snapshots-table" })
    const head = el("div", { class: "snapshots-header-row" })
    head.appendChild(el("div", { class: "snap-col-name" }, "Nombre"))
    head.appendChild(el("div", { class: "snap-col-period" }, "Período"))
    head.appendChild(el("div", { class: "snap-col-date" }, "Fecha de creación"))
    head.appendChild(el("div", { class: "snap-col-action" }, "Acción"))
    table.appendChild(head)

    for (const snap of snapshots) {
      const row = el("div", { class: "snapshots-row" })
      row.appendChild(el("div", { class: "snap-col-name" }, snap.name))
      row.appendChild(el("div", { class: "snap-col-period" }, snap.period))
      row.appendChild(el("div", { class: "snap-col-date" }, snap.createdAt))
      const actionCell = el("div", { class: "snap-col-action" })
      const link = el("a", { href: `/snapshots/${snap.id}`, "data-link": "", "aria-label": `Ver snapshot ${snap.name}` })
      link.appendChild(svgIcon("icon-arrow-right"))
      actionCell.appendChild(link)
      row.appendChild(actionCell)
      table.appendChild(row)
    }
    body.appendChild(table)
  } catch (e) {
    clear(body)
    const msg = e instanceof NetworkError ? "No se pudo conectar con el servidor."
      : e instanceof ApiError ? e.message : "Ocurrió un error inesperado."
    body.appendChild(el("div", { class: "state-message is-error" }, msg))
  }
}
