"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createMarker,
  updateMarker,
  deleteMarker,
} from "@/lib/marker-actions"
import { useMarkers } from "./markers-store"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MarkerManagerDialog({ open, onOpenChange }: Props) {
  const { markers, reload } = useMarkers()
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#EF4444")
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createMarker({ name: newName.trim(), color: newColor, order: markers.length })
      setNewName("")
      setNewColor("#EF4444")
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteMarker(id)
    await reload()
  }

  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return
    const a = markers[idx - 1]
    const b = markers[idx]
    await Promise.all([
      updateMarker(a.id, { order: b.order }),
      updateMarker(b.id, { order: a.order }),
    ])
    await reload()
  }

  const handleMoveDown = async (idx: number) => {
    if (idx === markers.length - 1) return
    const a = markers[idx]
    const b = markers[idx + 1]
    await Promise.all([
      updateMarker(a.id, { order: b.order }),
      updateMarker(b.id, { order: a.order }),
    ])
    await reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Gestionar marcadores</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Existing markers */}
          {markers.length === 0 ? (
            <p className="text-sm text-gray-400">No hay marcadores creados.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {markers.map((m, idx) => (
                <div key={m.id} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-gray-200"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className="flex-1 text-sm font-medium">{m.name}</span>
                  <div className="flex gap-0.5">
                    <button onClick={() => handleMoveUp(idx)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-black disabled:opacity-30">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleMoveDown(idx)} disabled={idx === markers.length - 1} className="p-0.5 text-gray-400 hover:text-black disabled:opacity-30">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="p-0.5 text-gray-400 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <div className="border-t border-gray-200 pt-3">
            <Label className="mb-2 block text-xs font-bold uppercase">Nuevo marcador</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre"
                className="flex-1 border-2 border-black"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border-2 border-black bg-white p-0.5"
              />
              <Button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="gap-1 bg-black text-white hover:bg-gray-800"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
