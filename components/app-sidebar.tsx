"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Camera,
  History,
  LogOut,
  Settings2,
  TrendingUp,
  FileText,
  ShoppingCart,
  TrendingDown,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useFinance } from "@/components/finance-store"

const SIDEBAR_KEY = "cashflow:sidebar-collapsed"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: number
}

type NavSection = {
  title: string
  items: NavItem[]
}

export function AppSidebar() {
  const pathname = usePathname()
  const { snapshots, movements } = useFinance()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)

  // Load persisted state
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "true")
    } catch {}
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch {}
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const sections: NavSection[] = [
    {
      title: "Inicio",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "Patrimonio",
      items: [
        { href: "/activos", label: "Activos", icon: TrendingUp },
        { href: "/obligaciones", label: "Obligaciones", icon: FileText },
      ],
    },
    {
      title: "Flujo de Caja",
      items: [
        { href: "/ingresos", label: "Ingresos", icon: TrendingDown },
        { href: "/gastos", label: "Gastos", icon: ShoppingCart },
      ],
    },
    {
      title: "Control",
      items: [
        { href: "/snapshots", label: "Snapshots", icon: Camera, badge: snapshots.length },
        { href: "/libro-contable", label: "Libro Contable", icon: BookOpen },
      ],
    },
    {
      title: "Auditoría",
      items: [
        { href: "/historial", label: "Historial", icon: History, badge: movements.length },
      ],
    },
    {
      title: "Configuración",
      items: [
        { href: "/configuracion", label: "Personalización", icon: Settings2 },
      ],
    },
  ]

  return (
    <aside
      data-testid="app-sidebar"
      className={cn(
        "hidden shrink-0 flex-col border-r-2 border-black bg-gray-50 lg:flex transition-all duration-200",
        collapsed ? "w-14" : "w-56",
      )}
    >
      {/* Toggle button */}
      <div className={cn("flex border-b border-gray-200 px-2 py-1.5", collapsed ? "justify-center" : "justify-end")}>
        <button
          onClick={toggleCollapsed}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-black"
          title={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-2 text-sm">
        {sections.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && "mt-3")}>
            {/* Section title — hidden when collapsed */}
            {!collapsed && (
              <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {section.title}
              </p>
            )}
            {collapsed && idx > 0 && (
              <div className="my-1.5 border-t border-gray-200" />
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(href)
                return collapsed ? (
                  /* Collapsed: icon only with tooltip */
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    className={cn(
                      "flex items-center justify-center rounded-md p-2 hover:bg-gray-200 relative",
                      active && "bg-black text-white hover:bg-black",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {badge !== undefined && badge > 0 && (
                      <span
                        className={cn(
                          "absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full px-1 text-[9px] font-bold leading-tight",
                          active ? "bg-white text-black" : "bg-gray-700 text-white",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                ) : (
                  /* Expanded: full label */
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
            </div>
          </div>
        ))}
      </nav>

      {session?.user && (
        <div className={cn("border-t-2 border-black p-2", collapsed && "flex justify-center")}>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className={cn(
              "flex items-center gap-2 rounded-md text-xs font-semibold text-gray-600 hover:bg-gray-200",
              collapsed ? "p-2" : "w-full px-3 py-1.5",
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && "Cerrar sesión"}
          </button>
        </div>
      )}
    </aside>
  )
}
