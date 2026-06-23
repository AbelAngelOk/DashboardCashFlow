"use client"

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
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useFinance } from "@/components/finance-store"

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
      className="hidden w-56 shrink-0 flex-col border-r-2 border-black bg-gray-50 lg:flex"
    >
      <nav className="flex flex-1 flex-col overflow-y-auto p-2 text-sm">
        {sections.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && "mt-3")}>
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, icon: Icon, badge }) => {
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
            </div>
          </div>
        ))}
      </nav>

      {session?.user && (
        <div className="border-t-2 border-black p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  )
}
