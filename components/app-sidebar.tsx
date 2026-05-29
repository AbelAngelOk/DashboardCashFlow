"use client"

import {
  LayoutDashboard,
  Camera,
  History,
  ChevronDown,
  Clock,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Snapshot } from "@/lib/finance"

export type View =
  | { kind: "dashboard" }
  | { kind: "snapshot"; id: string }
  | { kind: "movimientos" }

interface AppSidebarProps {
  view: View
  onSelectDashboard: () => void
  onSelectMovimientos: () => void
  onOpenSnapshot: (id: string) => void
  onTakeSnapshot: () => void
  snapshots: Snapshot[]
  movementsCount: number
}

export function AppSidebar({
  view,
  onSelectDashboard,
  onSelectMovimientos,
  onOpenSnapshot,
  onTakeSnapshot,
  snapshots,
  movementsCount,
}: AppSidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r-2 border-black bg-gray-50">
      <div className="border-b-2 border-black bg-black px-4 py-3">
        <span className="font-bold text-white">Cash Flow</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 text-sm">
        {/* Dashboard */}
        <Collapsible defaultOpen>
          <div
            className={cn(
              "flex items-center justify-between rounded-md",
              view.kind === "dashboard" && "bg-black text-white",
            )}
          >
            <button
              onClick={onSelectDashboard}
              className="flex flex-1 items-center gap-2 px-3 py-2 font-semibold"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <CollapsibleTrigger asChild>
              <button
                className="px-2 py-2"
                aria-label="Desplegar Dashboard"
              >
                <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:-rotate-90" />
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pl-4 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full justify-start gap-2 border-black bg-white text-xs"
              onClick={onTakeSnapshot}
            >
              <Camera className="h-3.5 w-3.5" />
              Tomar Snapshot
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {/* Snapshots */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between rounded-md px-3 py-2 font-semibold hover:bg-gray-200">
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Snapshots
                <span className="rounded-full bg-gray-300 px-1.5 text-[10px] font-bold">
                  {snapshots.length}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:-rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-2 pt-1">
            {snapshots.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">
                No hay snapshots aún
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {snapshots.map((snap) => (
                  <li key={snap.id}>
                    <button
                      onClick={() => onOpenSnapshot(snap.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left hover:bg-gray-200",
                        view.kind === "snapshot" &&
                          view.id === snap.id &&
                          "bg-black text-white hover:bg-black",
                      )}
                    >
                      <span className="block truncate font-medium">
                        {snap.name}
                      </span>
                      <span
                        className={cn(
                          "block text-[11px]",
                          view.kind === "snapshot" && view.id === snap.id
                            ? "text-gray-300"
                            : "text-gray-500",
                        )}
                      >
                        {snap.period}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-[10px]",
                          view.kind === "snapshot" && view.id === snap.id
                            ? "text-gray-400"
                            : "text-gray-400",
                        )}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {snap.createdAt}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Movimientos */}
        <button
          onClick={onSelectMovimientos}
          className={cn(
            "flex items-center justify-between rounded-md px-3 py-2 font-semibold hover:bg-gray-200",
            view.kind === "movimientos" && "bg-black text-white hover:bg-black",
          )}
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Movimientos
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 text-[10px] font-bold",
              view.kind === "movimientos"
                ? "bg-white text-black"
                : "bg-gray-300",
            )}
          >
            {movementsCount}
          </span>
        </button>
      </nav>
    </aside>
  )
}
