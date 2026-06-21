"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AppNotification } from "@/lib/assets"
import { useFinance } from "@/components/finance-store"
import { useObligations } from "@/components/obligations-store"
import { isDueWithin, isOverdue } from "@/lib/obligations"

const LS_KEY = "cashflow:notifications"
const ALERT_DAYS = 3

function loadReadIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveReadIds(ids: string[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_KEY, JSON.stringify(ids))
}

function currentYYYYMM(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

interface NotificationsContextValue {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { records } = useFinance()
  const { obligations } = useObligations()
  const [readIds, setReadIds] = useState<string[]>([])

  useEffect(() => {
    setReadIds(loadReadIds())
  }, [])

  const notifications = useMemo<AppNotification[]>(() => {
    const month = currentYYYYMM()
    const result: AppNotification[] = []

    // ── Dividend notifications (existing) ──────────────────────────────────
    for (const record of records) {
      if (record.type !== "activo") continue
      const boards = (record as { boards?: Array<{ id: string; type: string; title: string; dividends?: Array<{ id: string; month: string; actualGain?: number; estimatedGain?: number }> }> }).boards ?? []
      for (const board of boards) {
        if (board.type !== "dividends") continue
        for (const div of board.dividends ?? []) {
          if (div.month === month && div.actualGain === undefined) {
            const id = `dividend-${record.id}-${div.id}`
            result.push({
              id,
              type: "dividend_pending",
              title: `Dividendo pendiente — ${record.name}`,
              body: `Hay un dividendo esperado para ${month}${div.estimatedGain ? ` (est. ${div.estimatedGain})` : ""}`,
              assetId: record.id,
              dividendId: div.id,
              createdAt: new Date().toISOString(),
            })
          }
        }
      }
    }

    // ── Obligation notifications ────────────────────────────────────────────
    for (const obligation of obligations) {
      if (obligation.status !== "ACTIVE") continue

      if (obligation.obligationType === "RECURRING") {
        for (const payment of obligation.payments) {
          if (payment.status !== "PENDING" || !payment.expectedDate) continue
          if (!isDueWithin(payment.expectedDate, ALERT_DAYS)) continue
          const overdue = isOverdue(payment.expectedDate)
          const id = `obligation-payment-${payment.id}`
          result.push({
            id,
            type: overdue ? "obligation_overdue" : "obligation_due",
            title: `${overdue ? "Vencido" : "Próximo vencimiento"} — ${obligation.name}`,
            body: `${payment.expectedAmount != null ? `$${payment.expectedAmount} ${payment.currency} — ` : ""}Regla recurrente`,
            obligationId: obligation.id,
            paymentId: payment.id,
            expectedAmount: payment.expectedAmount,
            currency: payment.currency,
            dueDate: payment.expectedDate,
            createdAt: new Date().toISOString(),
          })
        }
      }

      if (obligation.obligationType === "INSTALLMENT") {
        for (const inst of obligation.installments) {
          if (inst.status !== "PENDING" && inst.status !== "OVERDUE") continue
          if (!isDueWithin(inst.dueDate, ALERT_DAYS)) continue
          const overdue = isOverdue(inst.dueDate)
          const total = obligation.installments.length
          const id = `obligation-installment-${inst.id}`
          result.push({
            id,
            type: overdue ? "obligation_overdue" : "obligation_due",
            title: `${overdue ? "Cuota vencida" : "Cuota próxima"} — ${obligation.name}`,
            body: `Cuota ${inst.installmentNumber}/${total} — $${inst.expectedAmount} ${obligation.currency}`,
            obligationId: obligation.id,
            installmentId: inst.id,
            expectedAmount: inst.expectedAmount,
            currency: obligation.currency,
            dueDate: inst.dueDate,
            createdAt: new Date().toISOString(),
          })
        }
      }
      // FIXED: no automatic notifications
    }

    return result
  }, [records, obligations])

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    const ids = notifications.map((n) => n.id)
    setReadIds((prev) => {
      const next = [...new Set([...prev, ...ids])]
      saveReadIds(next)
      return next
    })
  }, [notifications])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider")
  return ctx
}

export function useIsRead(id: string): boolean {
  const ctx = useContext(NotificationsContext)
  return ctx?.notifications.find((n) => n.id === id) !== undefined
    ? !(ctx?.unreadCount !== undefined) || true
    : true
}
