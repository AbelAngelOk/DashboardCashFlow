"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  History,
  MoreHorizontal,
  Camera,
  Settings2,
  LogOut,
  X,
  ShoppingCart,
  TrendingDown,
  BookOpen,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

type DrawerSection = {
  title: string
  items: NavItem[]
}

const mainItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/activos", label: "Activos", icon: TrendingUp },
  { href: "/obligaciones", label: "Obligac.", icon: FileText },
  { href: "/historial", label: "Historial", icon: History },
]

const drawerSections: DrawerSection[] = [
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
      { href: "/snapshots", label: "Snapshots", icon: Camera },
      { href: "/libro-contable", label: "Libro Contable", icon: BookOpen },
    ],
  },
  {
    title: "Configuración",
    items: [
      { href: "/configuracion", label: "Personalización", icon: Settings2 },
    ],
  },
]

const allDrawerItems = drawerSections.flatMap((s) => s.items)

export function AppBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const isMoreActive = allDrawerItems.some((item) => isActive(item.href))

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {moreOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-50 border-t-2 border-black bg-white shadow-xl lg:hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Más opciones</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="text-gray-400 hover:text-black"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {drawerSections.map((section) => (
            <div key={section.title}>
              <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {section.title}
              </p>
              {section.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 border-b border-gray-100 px-6 py-3.5 text-sm font-semibold",
                    isActive(href) ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
            </div>
          ))}

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 px-6 py-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      )}

      <nav
        data-testid="app-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 shrink-0 border-t-2 border-black bg-white lg:hidden"
      >
        {mainItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50 hover:text-black",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-semibold">{label}</span>
            </Link>
          )
        })}

        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
            isMoreActive || moreOpen
              ? "bg-black text-white"
              : "text-gray-500 hover:bg-gray-50 hover:text-black",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[9px] font-semibold">Más</span>
        </button>
      </nav>
    </>
  )
}
