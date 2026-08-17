import { SettingsProvider } from "@/components/settings-store"
import { FinanceProvider } from "@/components/finance-store"
import { ObligationsProvider } from "@/components/obligations-store"
import { MarkersProvider } from "@/components/markers/markers-store"
import { AssetCategoriesProvider } from "@/components/activos/asset-categories-store"
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
          <MarkersProvider>
            <AssetCategoriesProvider>
              <AppShell>{children}</AppShell>
              <Toaster />
            </AssetCategoriesProvider>
          </MarkersProvider>
        </ObligationsProvider>
      </FinanceProvider>
    </SettingsProvider>
  )
}
