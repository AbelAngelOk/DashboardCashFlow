"use client"

import { useSession } from "next-auth/react"
import { User } from "lucide-react"
import { NotificationsPopover } from "@/components/notifications/notifications-popover"

export function AppHeader() {
  const { data: session } = useSession()

  return (
    <header
      data-testid="app-header"
      className="flex h-10 shrink-0 items-center justify-between border-b-2 border-black bg-black px-4"
    >
      {/* User info */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10">
          <User className="h-3.5 w-3.5 text-white" />
        </div>
        {session?.user && (
          <span className="text-xs font-semibold text-white">
            {session.user.name ?? session.user.email}
          </span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <NotificationsPopover />
      </div>
    </header>
  )
}
