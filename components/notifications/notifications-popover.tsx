"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useNotifications } from "./notifications-store"

export function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()

  return (
    <Popover>
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
          {notifications.map((n) => (
            <div
              key={n.id}
              className="group flex items-start gap-3 border-b border-black px-3 py-2.5 hover:bg-gray-50"
            >
              <div
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  !n.id ? "bg-rose-500" : "bg-transparent"
                }`}
              />
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
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
