import { SettingsProvider } from "@/components/settings-store"
import { FinanceProvider } from "@/components/finance-store"
import { ObligationsProvider } from "@/components/obligations-store"
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
        <ObligationsProvider>
          <AppShell>{children}</AppShell>
          <Toaster />
        </ObligationsProvider>
      </FinanceProvider>
    </SettingsProvider>
  )
}
