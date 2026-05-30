"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { useFinance } from "@/components/finance-store"

export function AppShell({ children }: { children: ReactNode }) {
  const { loading } = useFinance()

  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
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
  )
}
