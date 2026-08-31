"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { AppBottomNav } from "@/components/app-bottom-nav"
import { NotificationsProvider } from "@/components/notifications/notifications-store"

// El shell (header, sidebar, bottom nav) ya NO espera a que los datos
// financieros terminen de cargar: se pinta siempre de inmediato. Cada
// pantalla/sección es responsable de su propio estado de carga y vacío
// (ver dashboard-sheet.tsx para el caso del dashboard). Antes había un
// único spinner global acá que tapaba TODO — incluido el audit log
// completo sin límite — antes de mostrar cualquier cosa.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <div className="flex min-h-screen flex-col bg-white font-sans text-black">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-x-auto p-3 pb-20 md:p-6 lg:pb-6">
            {children}
          </main>
        </div>
        <AppBottomNav />
      </div>
    </NotificationsProvider>
  )
}
