"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { NotificationsProvider } from "@/components/notifications/notifications-store"
import { useFinance } from "@/components/finance-store"

export function AppShell({ children }: { children: ReactNode }) {
  const { loading } = useFinance()

  return (
    <NotificationsProvider>
      <div className="flex min-h-screen flex-col bg-white font-sans text-black">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-x-auto p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Cargando...
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </NotificationsProvider>
  )
}
