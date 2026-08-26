// Portado desde components/notifications/notifications-store.tsx +
// notifications-popover.tsx. Misma clave de localStorage que la app React
// (cashflow:notifications), asi que alternar entre ambas no pierde el estado
// de lectura.

import { isDueWithin, isOverdue, formatObligationDate } from "./lib/obligations.js"
import { apiPost } from "./api.js"

const LS_KEY = "cashflow:notifications"
const ALERT_DAYS = 3

function loadReadIds() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveReadIds(ids) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids))
  } catch {
    /* localStorage lleno o bloqueado: no es critico, se pierde el estado de lectura */
  }
}

function currentYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Calcula las notificaciones a partir de los datos ya cargados (records +
 * obligations del bootstrap). Sin red propia: es una funcion pura sobre datos
 * que ya estan en memoria, igual que el useMemo original.
 */
export function computeNotifications(records, obligations) {
  const month = currentYYYYMM()
  const result = []

  for (const record of records) {
    if (record.type !== "activo") continue
    const boards = record.boards ?? []
    for (const board of boards) {
      if (board.type !== "dividends") continue
      for (const div of board.dividends ?? []) {
        if (div.month === month && div.actualGain === undefined) {
          result.push({
            id: `dividend-${record.id}-${div.id}`,
            type: "dividend_pending",
            title: `Dividendo pendiente - ${record.name}`,
            body: `Hay un dividendo esperado para ${month}${div.estimatedGain ? ` (est. ${div.estimatedGain})` : ""}`,
            assetId: record.id,
            dividendId: div.id,
          })
        }
      }
    }
  }

  for (const obligation of obligations) {
    if (obligation.status !== "ACTIVE") continue

    if (obligation.obligationType === "RECURRING") {
      for (const payment of obligation.payments) {
        if (payment.status !== "PENDING" || !payment.expectedDate) continue
        if (!isDueWithin(payment.expectedDate, ALERT_DAYS)) continue
        const overdue = isOverdue(payment.expectedDate)
        result.push({
          id: `obligation-payment-${payment.id}`,
          type: overdue ? "obligation_overdue" : "obligation_due",
          title: `${overdue ? "Vencido" : "Proximo vencimiento"} - ${obligation.name}`,
          body: `${payment.expectedAmount != null ? `$${payment.expectedAmount} ${payment.currency} - ` : ""}Regla recurrente`,
          obligationId: obligation.id,
          paymentId: payment.id,
          dueDate: payment.expectedDate,
        })
      }
    }

    if (obligation.obligationType === "INSTALLMENT") {
      for (const inst of obligation.installments) {
        if (inst.status !== "PENDING" && inst.status !== "OVERDUE") continue
        if (!isDueWithin(inst.dueDate, ALERT_DAYS)) continue
        const overdue = isOverdue(inst.dueDate)
        const total = obligation.installments.length
        result.push({
          id: `obligation-installment-${inst.id}`,
          type: overdue ? "obligation_overdue" : "obligation_due",
          title: `${overdue ? "Cuota vencida" : "Cuota proxima"} - ${obligation.name}`,
          body: `Cuota ${inst.installmentNumber}/${total} - $${inst.expectedAmount} ${obligation.currency}`,
          obligationId: obligation.id,
          installmentId: inst.id,
          dueDate: inst.dueDate,
        })
      }
    }
  }

  return result
}

export class NotificationsController {
  constructor(records, obligations) {
    this.notifications = computeNotifications(records, obligations)
    this.readIds = new Set(loadReadIds())
  }

  get unreadCount() {
    return this.notifications.filter((n) => !this.readIds.has(n.id)).length
  }

  markAsRead(id) {
    if (this.readIds.has(id)) return
    this.readIds.add(id)
    saveReadIds([...this.readIds])
  }

  markAllRead() {
    for (const n of this.notifications) this.readIds.add(n.id)
    saveReadIds([...this.readIds])
  }

  /** Quita una notificacion resuelta (aceptada/rechazada) de la lista en memoria. */
  remove(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id)
  }
}

// ── Render del popover ────────────────────────────────────────────────────────

function extractName(title) {
  // "Vencido - Alquiler" -> "Alquiler" (mismo parseo que hacia el componente React)
  const parts = title.split("-")
  return parts.length > 1 ? parts[1].trim() : "Obligacion"
}

export function renderNotificationsPopover(dialogEl, controller, { onResolved }) {
  while (dialogEl.firstChild) dialogEl.removeChild(dialogEl.firstChild)

  const header = document.createElement("div")
  header.className = "modal-header notif-popover-header"
  const title = document.createElement("span")
  title.textContent = "Notificaciones"
  header.appendChild(title)
  if (controller.unreadCount > 0) {
    const markAll = document.createElement("button")
    markAll.className = "notif-mark-all"
    markAll.textContent = "Marcar todo como leido"
    markAll.addEventListener("click", () => {
      controller.markAllRead()
      renderNotificationsPopover(dialogEl, controller, { onResolved })
    })
    header.appendChild(markAll)
  }
  dialogEl.appendChild(header)

  const list = document.createElement("div")
  list.className = "notif-list"

  if (controller.notifications.length === 0) {
    const empty = document.createElement("div")
    empty.className = "state-message"
    empty.textContent = "Sin notificaciones pendientes."
    list.appendChild(empty)
  }

  for (const n of controller.notifications) {
    if (n.type === "obligation_due" || n.type === "obligation_overdue") {
      list.appendChild(renderObligationRow(n, controller, onResolved, dialogEl))
    } else {
      list.appendChild(renderDividendRow(n, controller, dialogEl, onResolved))
    }
  }
  dialogEl.appendChild(list)
}

function renderDividendRow(n, controller, dialogEl, onResolved) {
  const tpl = document.getElementById("tpl-notif-dividend")
  const node = tpl.content.cloneNode(true).firstElementChild
  node.querySelector(".notif-title").textContent = n.title
  node.querySelector(".notif-text").textContent = n.body
  const link = node.querySelector(".notif-link")
  if (n.assetId) {
    link.textContent = "Ver activo ->"
    link.setAttribute("href", `/activos/${n.assetId}`) // aun vive en la app clasica
    link.removeAttribute("data-link")
  } else {
    link.remove()
  }
  node.querySelector(".notif-mark-read").addEventListener("click", () => {
    controller.markAsRead(n.id)
    renderNotificationsPopover(dialogEl, controller, { onResolved })
  })
  return node
}

function renderObligationRow(n, controller, onResolved, dialogEl) {
  const tpl = document.getElementById("tpl-notif-obligation")
  const node = tpl.content.cloneNode(true).firstElementChild
  node.querySelector(".notif-dot").classList.add(n.type === "obligation_overdue" ? "notif-dot-danger" : "notif-dot-warn")
  node.querySelector(".notif-title").textContent = n.title
  node.querySelector(".notif-text").textContent = n.body
  const due = node.querySelector(".notif-due")
  due.textContent = n.dueDate ? `Vencimiento: ${formatObligationDate(n.dueDate)}` : ""

  const goto = node.querySelector(".notif-goto")
  goto.setAttribute("href", `/obligaciones/${n.obligationId}`)
  goto.removeAttribute("data-link") // el detalle de obligacion aun no esta migrado

  const acceptBtn = node.querySelector(".notif-accept")
  const rejectBtn = node.querySelector(".notif-reject")

  acceptBtn.addEventListener("click", async () => {
    acceptBtn.disabled = true
    rejectBtn.disabled = true
    try {
      const name = extractName(n.title)
      if (n.paymentId) {
        await apiPost(`/api/obligations/payments/${n.paymentId}/accept`, { gastoName: `Pago - ${name}` })
      } else if (n.installmentId) {
        const cuotaLabel = n.body.split("-")[0]?.trim() ?? "Cuota"
        await apiPost(`/api/obligations/installments/${n.installmentId}/accept`, { gastoName: `${cuotaLabel} - ${name}` })
      }
      controller.markAsRead(n.id)
      controller.remove(n.id)
      renderNotificationsPopover(dialogEl, controller, { onResolved })
      onResolved()
    } catch {
      acceptBtn.disabled = false
      rejectBtn.disabled = false
    }
  })

  rejectBtn.addEventListener("click", async () => {
    acceptBtn.disabled = true
    rejectBtn.disabled = true
    try {
      if (n.paymentId) await apiPost(`/api/obligations/payments/${n.paymentId}/reject`)
      else if (n.installmentId) await apiPost(`/api/obligations/installments/${n.installmentId}/reject`)
      controller.markAsRead(n.id)
      controller.remove(n.id)
      renderNotificationsPopover(dialogEl, controller, { onResolved })
      onResolved()
    } catch {
      acceptBtn.disabled = false
      rejectBtn.disabled = false
    }
  })

  return node
}
