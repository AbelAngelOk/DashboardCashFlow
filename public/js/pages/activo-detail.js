// Portado desde app/(dashboard)/activos/[id]/page.tsx + components/activos/asset-detail.tsx.
//
// El panel especializado se elige por la FORMA de los datos, nunca por tipo
// (ver CLAUDE.md — no reintroducir branching por tipo). Portado tal cual de
// asset-detail.tsx: mismo orden de checks, mismos campos de metadata.

import { apiGet, apiPost } from "../api.js"
import { el, clear, mount, svgIcon } from "../dom.js"
import { navigate } from "../router.js"
import { categoryName } from "../lib/asset-categories.js"
import { renderAssetInfoSection } from "../components/asset-info-section.js"
import { renderAssetMovementsSection } from "../components/asset-movements-section.js"
import { renderGenericPanel } from "../components/asset-panels/generic-panel.js"
import { renderRebalanceBotPanel } from "../components/asset-panels/rebalance-bot-panel.js"
import { renderBondPanel } from "../components/asset-panels/bond-panel.js"
import { renderFixedTermPanel } from "../components/asset-panels/fixed-term-panel.js"
import { renderTradingBotPanel } from "../components/asset-panels/trading-bot-panel.js"
import { renderTradingPanel } from "../components/asset-panels/trading-panel.js"
import { renderFuturesPanel } from "../components/asset-panels/futures-panel.js"
import { renderIncomeRulesSection } from "../components/income-rules-section.js"
import { renderBoardManager } from "../components/boards/board-manager.js"

function pickPanel(asset, onUpdated) {
  const meta = asset.metadata ?? {}
  if (Array.isArray(meta.assets)) return renderRebalanceBotPanel(asset, onUpdated)
  if (Array.isArray(meta.disbursements)) return renderBondPanel(asset, onUpdated)
  if (meta.rate != null && meta.endDate != null) return renderFixedTermPanel(asset, onUpdated)
  if (meta.totalGained != null || meta.totalLost != null) return renderTradingBotPanel(asset, onUpdated)
  if (meta.totalObtained != null) return renderTradingPanel(asset, onUpdated)
  if (meta.positionTracking === true || meta.liquidated != null) return renderFuturesPanel(asset, onUpdated)
  // tracksQuantity (stock) y el resto (generic) son el mismo panel — ver nota en generic-panel.js
  return renderGenericPanel(asset)
}

export async function render(main, params) {
  clear(main)
  const { id } = params
  let asset, income, categories

  const wrap = el("div", { style: "max-width:56rem; margin:0 auto;" })
  mount(main, wrap)
  wrap.appendChild(el("div", { class: "state-message" }, "Cargando..."))

  async function load() {
    const [full, cats] = await Promise.all([
      apiGet(`/api/assets/${id}/full`, { fresh: true }),
      apiGet("/api/categories"),
    ])
    asset = full.asset
    income = full.income
    categories = cats.categories
    paint()
  }

  function paint() {
    clear(wrap)

    // Header
    const header = el("div", { class: "obl-detail-header" })
    const backLink = el("a", { href: "/activos", "data-link": "", class: "obl-back-link" })
    backLink.appendChild(svgIcon("icon-arrow-right", 14))
    backLink.firstChild.style.transform = "rotate(180deg)"
    backLink.appendChild(document.createTextNode(" Activos"))
    header.appendChild(backLink)
    const nameBadge = el("div", { style: "display:inline-block; background:var(--black); color:var(--white); padding:0.25rem 1rem; font-weight:bold; font-style:italic;" }, asset.name)
    header.appendChild(nameBadge)
    header.appendChild(el("span", { class: "hint-text", style: "text-transform:uppercase; font-weight:bold;" }, categoryName(asset.assetType, categories)))
    if (asset.ticker) header.appendChild(el("span", { style: "font-family:monospace; font-size:0.875rem; color:var(--gray-500);" }, asset.ticker))
    if (asset.isGroupParent) {
      header.appendChild(el("span", { style: "border:1px solid var(--gray-300); padding:0.125rem 0.5rem; font-size:0.75rem; color:var(--gray-500);" }, `Grupo (${asset.children?.length ?? 0} activos)`))
      header.appendChild(paintUngroupButton())
    }
    wrap.appendChild(header)

    // Group children summary
    if (asset.isGroupParent && asset.children?.length > 0) {
      const box = el("div", { class: "panel", style: "margin-bottom:1.5rem;" })
      box.appendChild(el("div", { class: "panel-header", style: "background:var(--gray-100); color:var(--black);" }, "Activos del grupo"))
      for (const child of asset.children) {
        const row = el("div", { class: "obl-rule-row" })
        const nameCol = el("div", { style: "flex:1;" })
        const link = el("a", { href: `/activos/${child.id}`, "data-link": "", style: "font-weight:500; text-decoration:none; color:inherit;" }, child.name)
        nameCol.appendChild(link)
        row.appendChild(nameCol)
        row.appendChild(el("div", { style: "width:8rem; font-size:0.75rem; color:var(--gray-500);" }, categoryName(child.assetType, categories)))
        row.appendChild(el("div", { style: "width:10rem; text-align:right; font-family:monospace;" }, `${child.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${child.currency}`))
        box.appendChild(row)
      }
      wrap.appendChild(box)
    }

    const col = el("div", { style: "display:flex; flex-direction:column; gap:1.5rem;" })
    col.appendChild(renderAssetInfoSection(asset, categories, load))

    if (asset.isGroupParent) {
      col.appendChild(renderAssetMovementsSection(asset, load))
    } else {
      const panel = pickPanel(asset, load)
      if (panel) col.appendChild(panel)
      col.appendChild(renderIncomeRulesSection({ recordId: asset.id, assetCurrency: asset.currency, assetAmount: asset.amount }, load))
      col.appendChild(renderAssetMovementsSection(asset, load))
      col.appendChild(renderBoardManager(asset, load))
    }
    wrap.appendChild(col)
  }

  function paintUngroupButton() {
    let confirming = false
    const wrapBtn = el("span")
    function paintBtn() {
      clear(wrapBtn)
      if (!confirming) {
        const btn = el("button", { class: "btn", style: "height:1.5rem; font-size:0.75rem; padding:0 0.5rem;" })
        btn.appendChild(svgIcon("icon-network", 11))
        btn.appendChild(document.createTextNode(" Desagrupar"))
        btn.addEventListener("click", () => { confirming = true; paintBtn() })
        wrapBtn.appendChild(btn)
      } else {
        const box = el("span", { style: "display:inline-flex; align-items:center; gap:0.5rem; border:1px solid #fecdd3; background:#fff1f2; padding:0.125rem 0.5rem; font-size:0.75rem;" })
        box.appendChild(el("span", { style: "color:#be123c;" }, "¿Confirmar desagrupar?"))
        const yesBtn = el("button", { style: "font-weight:bold; color:#be123c; border:none; background:none;" }, "Sí")
        yesBtn.addEventListener("click", async () => {
          await apiPost(`/api/assets/${id}/ungroup`)
          navigate("/activos")
        })
        const noBtn = el("button", { style: "color:var(--gray-500); border:none; background:none;" }, "No")
        noBtn.addEventListener("click", () => { confirming = false; paintBtn() })
        box.appendChild(yesBtn); box.appendChild(noBtn)
        wrapBtn.appendChild(box)
      }
    }
    paintBtn()
    return wrapBtn
  }

  await load()
  return () => {}
}
