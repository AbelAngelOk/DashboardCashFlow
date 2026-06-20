"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Check, X, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Asset, BoardConfig, TrackingColumn, TrackingConfig, TrackingRow } from "@/lib/assets"
import { updateBoards } from "@/lib/assets-actions"

const COLUMN_TYPE_LABELS: Record<TrackingColumn["type"], string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
}

function AddColumnDialog({
  onAdd,
  onClose,
}: {
  onAdd: (col: Omit<TrackingColumn, "id">) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<TrackingColumn["type"]>("text")

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({ name: name.trim(), type })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Nueva columna</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Precio de compra"
              className="border-2 border-black"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as TrackingColumn["type"])}>
              <SelectTrigger className="border-2 border-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["text", "number", "date"] as const).map((t) => (
                  <SelectItem key={t} value={t}>
                    {COLUMN_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CustomBoardProps {
  asset: Asset
  board: BoardConfig
}

export function CustomBoard({ asset, board }: CustomBoardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const initial: TrackingConfig = board.config ?? { columns: [], rows: [] }
  const [config, setConfig] = useState<TrackingConfig>(initial)
  const [title, setTitle] = useState(board.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  const markDirty = (newConfig: TrackingConfig) => {
    setConfig(newConfig)
    setDirty(true)
  }

  const updateBoardInAsset = async (updates: Partial<BoardConfig>) => {
    const updatedBoard = { ...board, ...updates }
    const updatedBoards = asset.boards.map((b) => (b.id === board.id ? updatedBoard : b))
    await updateBoards(asset.id, updatedBoards)
    router.refresh()
  }

  const handleAddColumn = (col: Omit<TrackingColumn, "id">) => {
    const newCol: TrackingColumn = { ...col, id: crypto.randomUUID() }
    markDirty({ ...config, columns: [...config.columns, newCol] })
  }

  const handleDeleteColumn = (colId: string) => {
    const columns = config.columns.filter((c) => c.id !== colId)
    const rows = config.rows.map((r) => {
      const cells = { ...r.cells }
      delete cells[colId]
      return { ...r, cells }
    })
    markDirty({ columns, rows })
  }

  const handleAddRow = () => {
    const newRow: TrackingRow = {
      id: crypto.randomUUID(),
      cells: Object.fromEntries(config.columns.map((c) => [c.id, ""])),
    }
    const newConfig = { ...config, rows: [...config.rows, newRow] }
    setConfig(newConfig)
    setDirty(true)
    setEditingRowId(newRow.id)
    setEditDraft(newRow.cells)
  }

  const startEditRow = (row: TrackingRow) => {
    setEditingRowId(row.id)
    setEditDraft({ ...row.cells })
  }

  const saveRow = () => {
    if (!editingRowId) return
    const rows = config.rows.map((r) =>
      r.id === editingRowId ? { ...r, cells: { ...editDraft } } : r,
    )
    markDirty({ ...config, rows })
    setEditingRowId(null)
    setEditDraft({})
  }

  const cancelEditRow = (rowId: string) => {
    const row = config.rows.find((r) => r.id === rowId)
    if (row && Object.values(row.cells).every((v) => !v)) {
      setConfig({ ...config, rows: config.rows.filter((r) => r.id !== rowId) })
    }
    setEditingRowId(null)
    setEditDraft({})
  }

  const handleDeleteRow = (rowId: string) => {
    markDirty({ ...config, rows: config.rows.filter((r) => r.id !== rowId) })
  }

  const handleSave = () => {
    startTransition(async () => {
      await updateBoardInAsset({ config, title })
      setDirty(false)
    })
  }

  const handleDiscard = () => {
    setConfig(board.config ?? { columns: [], rows: [] })
    setTitle(board.title)
    setDirty(false)
    setEditingRowId(null)
    setEditDraft({})
  }

  const handleSaveTitle = () => {
    if (!title.trim()) { setTitle(board.title); setEditingTitle(false); return }
    startTransition(async () => {
      await updateBoardInAsset({ title: title.trim() })
      setEditingTitle(false)
    })
  }

  const hasColumns = config.columns.length > 0

  return (
    <div
      data-testid={`asset-board-custom-${board.id}`}
      className="border-2 border-black"
    >
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
        {editingTitle ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle()
                if (e.key === "Escape") { setTitle(board.title); setEditingTitle(false) }
              }}
              className="w-40 border-0 bg-transparent font-bold italic text-white outline-none ring-1 ring-white/40 focus:ring-white"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="font-bold italic text-white hover:opacity-80"
          >
            {title}
          </button>
        )}
        <div className="flex items-center gap-2">
          {dirty && (
            <>
              <button
                onClick={handleDiscard}
                className="text-gray-400 hover:text-white"
                aria-label="Descartar cambios"
              >
                <X className="h-4 w-4" />
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 text-xs text-white hover:bg-white/20"
                onClick={handleSave}
                disabled={isPending}
              >
                <Check className="h-3.5 w-3.5" />
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-xs text-white hover:bg-white/20"
            onClick={() => setShowAddColumn(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Columna
          </Button>
          {hasColumns && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 text-xs text-white hover:bg-white/20"
              onClick={handleAddRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Fila
            </Button>
          )}
        </div>
      </div>

      {!hasColumns && (
        <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-gray-500">
          <p>Sin columnas configuradas.</p>
          <Button
            variant="outline"
            size="sm"
            className="border-2 border-black"
            onClick={() => setShowAddColumn(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar columna
          </Button>
        </div>
      )}

      {hasColumns && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                {config.columns.map((col) => (
                  <th
                    key={col.id}
                    className="group border-r border-black px-3 py-2 text-left text-xs font-bold"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{col.name}</span>
                      <button
                        onClick={() => handleDeleteColumn(col.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-gray-400 hover:text-rose-700"
                        aria-label={`Eliminar columna ${col.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-[10px] font-normal text-gray-400">
                      {COLUMN_TYPE_LABELS[col.type]}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {config.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={config.columns.length + 1}
                    className="px-4 py-4 text-center text-gray-400"
                  >
                    Sin filas. Hacé click en &quot;+ Fila&quot; para agregar.
                  </td>
                </tr>
              )}
              {config.rows.map((row) =>
                editingRowId === row.id ? (
                  <tr key={row.id} className="border-t border-black bg-amber-50">
                    {config.columns.map((col) => (
                      <td key={col.id} className="border-r border-black px-1 py-0.5">
                        <Input
                          type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                          value={editDraft[col.id] ?? ""}
                          onChange={(e) => setEditDraft({ ...editDraft, [col.id]: e.target.value })}
                          className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                          autoFocus={config.columns[0]?.id === col.id}
                        />
                      </td>
                    ))}
                    <td className="px-1">
                      <div className="flex items-center gap-1">
                        <button onClick={saveRow} className="text-emerald-700 hover:text-emerald-900">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => cancelEditRow(row.id)} className="text-gray-500 hover:text-black">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.id}
                    className="group cursor-pointer border-t border-black hover:bg-gray-50"
                    onDoubleClick={() => startEditRow(row)}
                  >
                    {config.columns.map((col) => (
                      <td key={col.id} className="border-r border-black px-3 py-2 text-gray-700">
                        {row.cells[col.id] || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-1">
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEditRow(row)}
                          className="text-gray-400 hover:text-black"
                        >
                          <Plus className="h-3 w-3 rotate-45" />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-gray-400 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAddColumn && (
        <AddColumnDialog onAdd={handleAddColumn} onClose={() => setShowAddColumn(false)} />
      )}
    </div>
  )
}
