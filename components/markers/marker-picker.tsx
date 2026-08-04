"use client"

import { useState } from "react"
import { Tag, X, Plus, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { setEntityMarker, removeEntityMarker, createMarker } from "@/lib/marker-actions"
import { TailwindColorPicker, TAILWIND_COLORS } from "@/components/ui/tailwind-color-picker"
import { useMarkers } from "./markers-store"
import type { EntityType, MarkerDefinition } from "@/lib/marker-types"

interface MarkerPickerProps {
  entityId: string
  entityType: EntityType
  currentMarker: MarkerDefinition | null
  onChanged: () => void
}

export function MarkerPicker({ entityId, entityType, currentMarker, onChanged }: MarkerPickerProps) {
  const { markers, reload } = useMarkers()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState(TAILWIND_COLORS[5].value)

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
      setCreating(false)
    }
  }

  const handleQuickCreate = async () => {
    if (!newName.trim()) return
    setPending(true)
    try {
      const created = await createMarker({ name: newName.trim(), color: newColor, order: markers.length })
      await reload()
      await setEntityMarker(entityId, entityType, created.id)
      onChanged()
      setNewName("")
      setNewColor(TAILWIND_COLORS[5].value)
      setCreating(false)
    } catch (err) {
      console.error(err)
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  const cancelCreate = () => {
    setCreating(false)
    setNewName("")
    setNewColor(TAILWIND_COLORS[5].value)
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) cancelCreate() }}>
      <PopoverTrigger asChild>
        <button
          disabled={pending}
          className="flex items-center justify-center rounded p-1 transition-colors hover:bg-gray-100"
          title="Marcador"
        >
          <Tag
            className="h-3.5 w-3.5"
            style={currentMarker
              ? { fill: currentMarker.color, stroke: currentMarker.color }
              : { fill: "none", stroke: "currentColor" }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 rounded-none border-2 border-black p-1" align="end">
        {creating ? (
          <div className="flex flex-col gap-2 p-1">
            <p className="text-[10px] font-bold uppercase text-gray-500">Nuevo marcador</p>
            <div className="flex items-center gap-2">
              <div
                className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300"
                style={{ backgroundColor: newColor }}
              />
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickCreate()
                  if (e.key === "Escape") cancelCreate()
                }}
                placeholder="Nombre..."
                className="h-7 flex-1 border-2 border-black text-xs focus-visible:ring-0"
              />
            </div>
            <TailwindColorPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-1">
              <button
                onClick={handleQuickCreate}
                disabled={!newName.trim() || pending}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-black px-2 py-1 text-[10px] font-bold text-white hover:bg-gray-800 disabled:opacity-40"
              >
                <Check className="h-3 w-3" />
                Crear y asignar
              </button>
              <button
                onClick={cancelCreate}
                className="rounded border border-gray-300 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
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
            <div className="my-0.5 border-t border-gray-200" />
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              <Plus className="h-3 w-3" />
              Nuevo marcador
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
