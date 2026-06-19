"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { LayoutDashboard, Camera, History, LogOut, Settings2, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFinance } from "@/components/finance-store"

export function AppSidebar() {
  const pathname = usePathname()
  const { snapshots, movements } = useFinance()
  const { data: session } = useSession()

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const items = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: undefined as number | undefined,
    },
    {
      href: "/activos",
      label: "Activos",
      icon: TrendingUp,
      badge: undefined as number | undefined,
    },
    {
      href: "/snapshots",
      label: "Snapshots",
      icon: Camera,
      badge: snapshots.length,
    },
    {
      href: "/movimientos",
      label: "Movimientos",
      icon: History,
      badge: movements.length,
    },
    {
      href: "/configuracion",
      label: "Personalización",
      icon: Settings2,
      badge: undefined,
    },
  ]

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r-2 border-black bg-gray-50">
      <div className="border-b-2 border-black bg-black px-4 py-3">
        <span className="font-bold text-white">Cash Flow</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 text-sm">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 font-semibold hover:bg-gray-200",
                active && "bg-black text-white hover:bg-black",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              {badge !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    active ? "bg-white text-black" : "bg-gray-300",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {session?.user && (
        <div className="border-t-2 border-black p-3">
          <p className="truncate text-xs font-semibold text-gray-700">
            {session.user.name ?? session.user.email}
          </p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  )
}
