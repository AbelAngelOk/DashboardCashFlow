"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { useAssetCategories } from "@/components/activos/asset-categories-store"
import {
  assetCountByCategory,
  createAssetCategory,
  deleteAssetCategory,
  renameAssetCategory,
} from "@/lib/asset-category-actions"

export function AssetCategoriesSettings() {
  const { categories, reload } = useAssetCategories()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [busy, setBusy] = useState(false)

  const refreshCounts = useCallback(() => {
    assetCountByCategory().then(setCounts).catch(() => setCounts({}))
  }, [])

  useEffect(() => { refreshCounts() }, [refreshCounts, categories])

  const guard = async (fn: () => Promise<unknown>, errorTitle: string) => {
    setBusy(true)
    try {
      await fn()
      await reload()
      refreshCounts()
    } catch (e) {
      toast({
        variant: "destructive",
        title: errorTitle,
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    guard(async () => {
      await createAssetCategory(newName.trim())
      setNewName("")
    }, "No se pudo crear la categoría")
  }

  const handleRename = () => {
    if (!editingId || !editingName.trim()) return setEditingId(null)
    const id = editingId
    const name = editingName.trim()
    setEditingId(null)
    guard(() => renameAssetCategory(id, name), "No se pudo renombrar la categoría")
  }

  const handleDelete = (id: string, name: string) => {
    const n = counts[id] ?? 0
    const msg = n > 0
      ? `¿Eliminar "${name}"? ${n} activo${n === 1 ? "" : "s"} quedará${n === 1 ? "" : "n"} sin categoría. Los activos NO se eliminan.`
      : `¿Eliminar la categoría "${name}"?`
    if (!confirm(msg)) return
    guard(() => deleteAssetCategory(id), "No se pudo eliminar la categoría")
  }

  return (
    <div className="mb-6 border-2 border-black" data-testid="asset-categories-settings">
      <div className="border-b-2 border-black bg-black px-4 py-2">
        <h2 className="font-bold italic text-white">Categorías de Activo</h2>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-gray-500">
          Las categorías son solo etiquetas para organizar la lista. No definen ningún
          comportamiento: lo que un activo puede hacer se configura activo por activo.
        </p>

        {categories.length === 0 && (
          <p className="py-2 text-center text-sm text-gray-500">
            Todavía no hay categorías. Creá la primera abajo.
          </p>
        )}

        <div className="flex flex-col">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 border-b border-gray-200 py-2 text-sm last:border-b-0"
            >
              {editingId === c.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename()
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    autoFocus
                    className="h-8 flex-1 border-2 border-black focus-visible:ring-0"
                  />
                  <button onClick={handleRename} className="p-1 text-gray-400 hover:text-black">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-black">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-gray-400">
                    {counts[c.id] ?? 0} activo{(counts[c.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={() => { setEditingId(c.id); setEditingName(c.name) }}
                    disabled={busy}
                    className="p-1 text-gray-400 hover:text-black"
                    title="Renombrar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={busy}
                    className="p-1 text-gray-400 hover:text-rose-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
            placeholder="Nueva categoría — ej: Inmuebles"
            className="h-8 flex-1 border-2 border-black focus-visible:ring-0"
          />
          <button
            onClick={handleAdd}
            disabled={busy || !newName.trim()}
            className="flex items-center gap-1 border-2 border-black bg-black px-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
