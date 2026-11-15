"use client"

import Link from "next/link"
import { MoreHorizontal, Tag } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMarkers } from "@/components/markers/markers-store"
import { removeEntityMarker, setEntityMarker } from "@/lib/marker-actions"
import type { EntityType, MarkerDefinition } from "@/lib/marker-types"

export interface RowAction {
  key: string
  label: string
  icon?: React.ReactNode
  onSelect?: () => void
  href?: string
  /** Va al final, separada y en rojo (eliminar, poner en cero) */
  destructive?: boolean
}

interface RowActionsMenuProps {
  actions: RowAction[]
  marker?: {
    entityId: string
    entityType: EntityType
    current: MarkerDefinition | null
    onChanged: () => void
  }
  label?: string
}

const ITEM = "rounded-none text-xs"

/** Un único botón con todas las acciones de una fila (en vez de íconos sueltos). */
export function RowActionsMenu({ actions, marker, label = "Acciones" }: RowActionsMenuProps) {
  const { markers } = useMarkers()
  const normal = actions.filter((a) => !a.destructive)
  const destructive = actions.filter((a) => a.destructive)

  const setMarker = async (markerId: string | null) => {
    if (!marker) return
    try {
      if (markerId === null) await removeEntityMarker(marker.entityId, marker.entityType)
      else await setEntityMarker(marker.entityId, marker.entityType, markerId)
      marker.onChanged()
    } catch (err) {
      console.error(err)
    }
  }

  const renderItem = (a: RowAction) => {
    const content = (
      <>
        {a.icon}
        {a.label}
      </>
    )
    return a.href ? (
      <DropdownMenuItem key={a.key} asChild className={ITEM} data-variant={a.destructive ? "destructive" : undefined}>
        <Link href={a.href}>{content}</Link>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem
        key={a.key}
        className={ITEM}
        variant={a.destructive ? "destructive" : "default"}
        onSelect={a.onSelect}
      >
        {content}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="row-actions"
          aria-label={label}
          title={label}
          className="flex h-6 w-6 items-center justify-center border border-transparent text-gray-500 hover:border-black hover:text-black data-[state=open]:border-black data-[state=open]:bg-black data-[state=open]:text-white"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-none border-2 border-black p-0.5 shadow-none">
        {normal.map(renderItem)}

        {marker && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={ITEM}>
              <Tag
                className="h-3.5 w-3.5"
                style={marker.current ? { fill: marker.current.color, stroke: marker.current.color } : undefined}
              />
              Marcador
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-40 rounded-none border-2 border-black p-0.5 shadow-none">
              {markers.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-gray-400">Sin marcadores</div>
              )}
              {markers.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  className={`${ITEM} ${marker.current?.id === m.id ? "font-bold" : ""}`}
                  onSelect={() => setMarker(m.id)}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.name}
                </DropdownMenuItem>
              ))}
              {marker.current && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className={`${ITEM} text-gray-500`} onSelect={() => setMarker(null)}>
                    Quitar marcador
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className={`${ITEM} text-gray-500`}>
                <Link href="/configuracion">Crear o editar marcadores…</Link>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {destructive.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
