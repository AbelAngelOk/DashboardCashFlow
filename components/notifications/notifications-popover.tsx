"use client"

import { useState } from "react"
import Link from "next/link"
import { Bell, Check, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useNotifications } from "./notifications-store"
import { useFinance } from "@/components/finance-store"
import { useObligations } from "@/components/obligations-store"
import {
  acceptObligationPayment,
  acceptInstallmentPayment,
  rejectObligationPayment,
  rejectInstallmentPayment,
} from "@/lib/obligation-actions"
import type { AppNotification } from "@/lib/assets"
import { formatObligationDate } from "@/lib/obligations"

function ObligationNotificationRow({
  n,
  onDone,
}: {
  n: AppNotification
  onDone: () => void
}) {
  const { reload: reloadFinance } = useFinance()
  const { reload: reloadObligations } = useObligations()
  const { markAsRead } = useNotifications()
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    if (!n.obligationId) return
    setLoading(true)
    try {
      if (n.paymentId) {
        await acceptObligationPayment(n.paymentId, `Pago — ${n.title.split("—")[1]?.trim() ?? "Obligación"}`)
      } else if (n.installmentId) {
        await acceptInstallmentPayment(n.installmentId, `${n.body.split("—")[0]?.trim() ?? "Cuota"} — ${n.title.split("—")[1]?.trim() ?? "Obligación"}`)
      }
      reloadFinance()
      reloadObligations()
      markAsRead(n.id)
      onDone()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!n.obligationId) return
    setLoading(true)
    try {
      if (n.paymentId) {
        await rejectObligationPayment(n.paymentId)
      } else if (n.installmentId) {
        await rejectInstallmentPayment(n.installmentId)
      }
      reloadObligations()
      markAsRead(n.id)
      onDone()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-black px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.type === "obligation_overdue" ? "bg-rose-500" : "bg-amber-500"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight">{n.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>
          {n.dueDate && (
            <p className="mt-0.5 text-[10px] text-gray-400">
              Vencimiento: {formatObligationDate(n.dueDate)}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 pl-4">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="flex items-center gap-1 rounded border-2 border-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          Aceptar
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1 rounded border-2 border-gray-400 px-2 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Rechazar
        </button>
        {n.obligationId && (
          <Link
            href={`/obligaciones/${n.obligationId}`}
            className="ml-auto text-[10px] text-gray-400 hover:text-black underline"
          >
            Ver →
          </Link>
        )}
      </div>
    </div>
  )
}

export function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="app-notifications-trigger"
          aria-label="Notificaciones"
          className="relative flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        >
          <Bell className="h-4 w-4 text-white" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        data-testid="app-notifications-popover"
        align="end"
        className="w-80 rounded-none border-2 border-black p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
          <span className="text-sm font-bold italic text-white">Notificaciones</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-gray-300 hover:text-white"
            >
              Marcar todo como leído
            </button>
          )}
        </div>

        {notifications.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            Sin notificaciones pendientes.
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {notifications.map((n) => {
            if (n.type === "obligation_due" || n.type === "obligation_overdue") {
              return (
                <ObligationNotificationRow
                  key={n.id}
                  n={n}
                  onDone={() => setOpen(false)}
                />
              )
            }

            // dividend_pending (existing behavior)
            return (
              <div
                key={n.id}
                className="group flex items-start gap-3 border-b border-black px-3 py-2.5 hover:bg-gray-50"
              >
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-transparent" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight">{n.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>
                  {n.assetId && (
                    <Link
                      href={`/activos/${n.assetId}`}
                      onClick={() => markAsRead(n.id)}
                      className="mt-1 inline-block text-xs font-semibold underline hover:no-underline"
                    >
                      Ver activo →
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => markAsRead(n.id)}
                  className="shrink-0 text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-black"
                >
                  ✓
                </button>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
