"use client"

import { useState } from "react"
import { Tag, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { setEntityMarker, removeEntityMarker } from "@/lib/marker-actions"
import { useMarkers } from "./markers-store"
import type { EntityType, MarkerDefinition } from "@/lib/marker-types"

interface MarkerPickerProps {
  entityId: string
  entityType: EntityType
  currentMarker: MarkerDefinition | null
  onChanged: () => void
}

export function MarkerPicker({ entityId, entityType, currentMarker, onChanged }: MarkerPickerProps) {
  const { markers } = useMarkers()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleSelect = async (markerId: string | null) => {
    setPending(true)
    try {
      if (markerId === null) {
        await removeEntityMarker(entityId, entityType)
      } else {
        await setEntityMarker(entityId, entityType, markerId)
      }
      onChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={pending}
          className="flex items-center justify-center rounded p-1 transition-colors hover:bg-gray-100"
          title="Marcador"
          style={currentMarker ? { color: currentMarker.color } : undefined}
        >
          <Tag className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 rounded-none border-2 border-black p-1" align="end">
        <div className="flex flex-col gap-0.5">
          {markers.length === 0 && (
            <div className="px-2 py-1 text-xs text-gray-400">Sin marcadores</div>
          )}
          {markers.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-100 ${
                currentMarker?.id === m.id ? "font-bold" : ""
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.name}
            </button>
          ))}
          {currentMarker && (
            <>
              <div className="my-0.5 border-t border-gray-200" />
              <button
                onClick={() => handleSelect(null)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
              >
                <X className="h-3 w-3" />
                Quitar marcador
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
