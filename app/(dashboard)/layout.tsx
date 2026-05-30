import { SettingsProvider } from "@/components/settings-store"
import { FinanceProvider } from "@/components/finance-store"
import { AppShell } from "@/components/app-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SettingsProvider>
      <FinanceProvider>
        <AppShell>{children}</AppShell>
      </FinanceProvider>
    </SettingsProvider>
  )
}
