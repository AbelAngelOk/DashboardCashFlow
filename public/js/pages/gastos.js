// Portado desde app/(dashboard)/gastos/page.tsx. La lista, agrupamiento,
// panel de vínculos y marker picker viven en flow-list.js (compartido con
// ingresos.js) — acá solo la configuración específica de gastos: 3 fuentes
// posibles (obligación / activo / libre) y el diálogo de creación propio.

import { el, svgIcon } from "../dom.js"
import { renderFlowList } from "./flow-list.js"
import { openGastoFormDialog } from "../components/gasto-form-dialog.js"

function sourceBadge(source) {
  if (source.type === "obligation") {
    const link = el("a", { href: `/obligaciones/${source.obligationId}`, "data-link": "", class: "source-badge source-badge-blue" })
    link.appendChild(el("span", { class: "source-badge-tag" }, "Obligación"))
    link.appendChild(document.createTextNode(source.obligationName))
    link.appendChild(svgIcon("icon-arrow-right", 10))
    return link
  }
  if (source.type === "asset") {
    const link = el("a", { href: `/activos/${source.assetId}`, "data-link": "", class: "source-badge source-badge-emerald" })
    link.appendChild(el("span", { class: "source-badge-tag" }, "Activo"))
    link.appendChild(document.createTextNode(source.assetName))
    link.appendChild(svgIcon("icon-arrow-right", 10))
    return link
  }
  return el("span", { class: "source-badge source-badge-plain" }, "Libre")
}

export function render(main) {
  return renderFlowList(main, {
    kind: "gasto",
    title: "Gastos",
    icon: "icon-cart",
    itemsField: "gastos",
    createButtonLabel: "Nuevo Gasto",
    emptyCreateLabel: "Crear primer gasto",
    groupType: "EXPENSE",
    linksToggleTitle: "Ver ingresos vinculados",
    archivePath: (id) => `/api/gastos/${id}/archive`,
    restorePath: (id) => `/api/gastos/${id}/restore`,
    sourceBadge,
    sections: (items) => [
      { label: "Desde Obligaciones", rows: items.filter((g) => g.source.type === "obligation") },
      { label: "Depósitos en Activos", rows: items.filter((g) => g.source.type === "asset") },
      { label: "Gastos Libres", rows: items.filter((g) => g.source.type === "free") },
    ],
    openCreateDialog: (onCreated) => openGastoFormDialog({ onCreated }),
  })
}
