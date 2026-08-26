// Portado desde components/cutoff/cutoff-banner.tsx. El botón solo aparece
// cuando hay un período pendiente; el diálogo se auto-abre una vez por
// período salvo que el usuario ya lo haya descartado ("Ahora no").

import { apiGet } from "../api.js"
import { el, svgIcon } from "../dom.js"
import { openCutoffDialog } from "./cutoff-dialog.js"

const DISMISS_KEY = "cashflow:cutoff-dismissed"

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) } catch { return null }
}
function writeDismissed(period) {
  try { localStorage.setItem(DISMISS_KEY, period) } catch { /* no crítico */ }
}

/** @param {(result: object) => void} onDone */
export function renderCutoffBanner(onDone) {
  const wrap = el("span")
  let status = null

  async function refresh() {
    try {
      const r = await apiGet("/api/cutoff", { fresh: true })
      status = r.status
    } catch {
      status = null
    }
    paint()
    return status
  }

  function openDialog() {
    openCutoffDialog({
      status,
      onDone: (result) => { refresh(); onDone(result) },
      onDismiss: () => { if (status) writeDismissed(status.pendingPeriod) },
    })
  }

  function paint() {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild)
    if (!status || !status.available) return
    const btn = el("button", { class: "btn", "data-testid": "cutoff-button", title: `Cerrar ${status.pendingPeriodLabel} y preparar ${status.incomingPeriodLabel}` })
    btn.appendChild(svgIcon("icon-history", 14))
    btn.appendChild(document.createTextNode(" Realizar corte de mes"))
    btn.addEventListener("click", openDialog)
    wrap.appendChild(btn)
  }

  refresh().then((s) => {
    if (!s || !s.available) return
    if (readDismissed() !== s.pendingPeriod) openDialog()
  })

  return wrap
}
