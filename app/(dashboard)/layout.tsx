import { SettingsProvider } from "@/components/settings-store"
import { FinanceProvider } from "@/components/finance-store"
import { AppShell } from "@/components/app-shell"
import { Toaster } from "@/components/ui/toaster"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SettingsProvider>
      <FinanceProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </FinanceProvider>
    </SettingsProvider>
  )
}
