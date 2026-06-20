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

const LS_KEY = "cashflow:notifications"

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
  const [readIds, setReadIds] = useState<string[]>([])

  useEffect(() => {
    setReadIds(loadReadIds())
  }, [])

  // Compute notifications from records (dividend_pending)
  const notifications = useMemo<AppNotification[]>(() => {
    const month = currentYYYYMM()
    const result: AppNotification[] = []

    for (const record of records) {
      if (record.type !== "activo") continue
      // Check boards for pending dividends
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
    return result
  }, [records])

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
