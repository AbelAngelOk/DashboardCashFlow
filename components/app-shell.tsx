"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      <AppSidebar />
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  )
}
