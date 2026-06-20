"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Pencil, Check, X } from "lucide-react"
import { formatAmount } from "@/lib/finance"
import { MOVEMENT_TYPE_LABELS, type Asset, type MovementType } from "@/lib/assets"
import { deleteMovement, updateMovement } from "@/lib/assets-actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface AssetMovementsSectionProps {
  asset: Asset
}

const EDITABLE_MOVEMENT_TYPES: MovementType[] = [
  "DEPOSIT",
  "ADJUSTMENT",
  "EXTRACT",
  "BUY",
  "SELL",
  "DIVIDEND",
  "FEE",
  "COLLECT",
]

export function AssetMovementsSection({ asset }: AssetMovementsSectionProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState<MovementType>("ADJUSTMENT")
  const [editComment, setEditComment] = useState("")
  const [isSaving, startTransition] = useTransition()

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteMovement(id)
    router.refresh()
    setDeletingId(null)
  }

  const startEdit = (id: string, currentType: MovementType, currentComment: string) => {
    setEditingId(id)
    setEditType(currentType)
    setEditComment(currentComment)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = (id: string) => {
    startTransition(async () => {
      await updateMovement(id, { movementType: editType, description: editComment })
      router.refresh()
      setEditingId(null)
    })
  }

  return (
    <div data-testid="asset-movements-section" className="border-2 border-black">
      <div className="border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Movimientos</span>
      </div>

      <div className="flex bg-gray-100 text-xs font-bold">
        <div className="w-28 border-r border-black px-3 py-2">Tipo</div>
        <div className="flex-1 border-r border-black px-3 py-2">Comentario</div>
        <div className="w-28 border-r border-black px-3 py-2">Fecha</div>
        <div className="w-40 border-r border-black px-3 py-2 text-right">Monto</div>
        <div className="w-14 px-1 py-2" />
      </div>

      {asset.movements.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          Sin movimientos registrados.
        </div>
      )}

      {asset.movements.map((m) => (
        editingId === m.id ? (
          <div key={m.id} className="flex items-center border-b border-black text-sm bg-gray-50">
            <div className="w-28 border-r border-black px-1 py-1">
              <Select value={editType} onValueChange={(v) => setEditType(v as MovementType)}>
                <SelectTrigger className="h-7 border border-gray-300 text-xs focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_MOVEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {MOVEMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 border-r border-black px-1 py-1">
              <Input
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(m.id); if (e.key === "Escape") cancelEdit() }}
                className="h-7 border border-gray-300 text-xs focus-visible:ring-0"
                autoFocus
              />
            </div>
            <div className="w-28 border-r border-black px-3 py-2 text-xs text-gray-500">
              {new Date(m.operationDate).toLocaleDateString("es-ES")}
            </div>
            <div className="w-40 border-r border-black px-3 py-2 text-right font-mono text-xs">
              {formatAmount(m.amount, m.currency)} {m.currency}
            </div>
            <div className="flex w-14 items-center justify-center gap-1 px-1">
              <button onClick={() => saveEdit(m.id)} disabled={isSaving} className="text-emerald-700 hover:text-emerald-900" aria-label="Guardar">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelEdit} className="text-gray-500 hover:text-black" aria-label="Cancelar">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div key={m.id} className="group flex border-b border-black text-sm">
            <div className="w-28 border-r border-black px-3 py-2 text-xs font-medium">
              {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
            </div>
            <div className="flex-1 border-r border-black px-3 py-2 text-gray-600">
              {m.description ?? "—"}
            </div>
            <div className="w-28 border-r border-black px-3 py-2 text-xs text-gray-500">
              {new Date(m.operationDate).toLocaleDateString("es-ES")}
            </div>
            <div className="w-40 border-r border-black px-3 py-2 text-right font-mono">
              {formatAmount(m.amount, m.currency)} {m.currency}
            </div>
            <div className="flex w-14 items-center justify-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => startEdit(m.id, m.movementType, m.description ?? "")}
                className="text-gray-400 hover:text-black"
                aria-label="Editar movimiento"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={deletingId === m.id}
                className="text-gray-400 hover:text-rose-700"
                aria-label="Eliminar movimiento"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
