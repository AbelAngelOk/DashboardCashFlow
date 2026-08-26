// Portado desde app/(dashboard)/ingresos/page.tsx. Mirror de gastos.js sobre
// el mismo flow-list.js compartido — acá solo lo específico de ingresos: 2
// fuentes posibles (activo / libre, sin "obligación") con sub-tipo
// (dividendo/plazo fijo/liquidación/extracción/manual) y el diálogo propio.

import { el, svgIcon } from "../dom.js"
import { renderFlowList } from "./flow-list.js"
import { openIngresoFormDialog } from "../components/ingreso-form-dialog.js"

const SOURCE_TYPE_LABELS = {
  dividend: "Dividendo",
  "fixed-term": "Plazo Fijo",
  liquidation: "Liquidación",
  extraction: "Extracción",
  manual: "Manual",
}

function sourceBadge(source) {
  if (source.type === "asset") {
    const link = el("a", { href: `/activos/${source.assetId}`, "data-link": "", class: "source-badge source-badge-emerald" })
    link.appendChild(el("span", { class: "source-badge-tag" }, SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType))
    link.appendChild(document.createTextNode(source.assetName))
    link.appendChild(svgIcon("icon-arrow-right", 10))
    return link
  }
  return el("span", { class: "source-badge source-badge-plain" }, "Libre")
}

export function render(main) {
  return renderFlowList(main, {
    kind: "ingreso",
    title: "Ingresos",
    icon: "icon-trending-down",
    itemsField: "ingresos",
    createButtonLabel: "Nuevo Ingreso",
    emptyCreateLabel: "Registrar ingreso",
    groupType: "INCOME",
    linksToggleTitle: "Ver gastos vinculados",
    archivePath: (id) => `/api/ingresos/${id}/archive`,
    restorePath: (id) => `/api/ingresos/${id}/restore`,
    sourceBadge,
    sections: (items) => [
      { label: "Desde Activos", rows: items.filter((i) => i.source.type === "asset") },
      { label: "Ingresos Libres", rows: items.filter((i) => i.source.type === "free") },
    ],
    openCreateDialog: (onCreated) => openIngresoFormDialog({ onCreated }),
  })
}
