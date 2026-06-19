"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { formatAmount } from "@/lib/finance"
import { MOVEMENT_TYPE_LABELS, type Asset } from "@/lib/assets"
import { deleteMovement } from "@/lib/assets-actions"

interface AssetMovementsSectionProps {
  asset: Asset
}

export function AssetMovementsSection({ asset }: AssetMovementsSectionProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteMovement(id)
    router.refresh()
    setDeletingId(null)
  }

  return (
    <div className="border-2 border-black">
      <div className="border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Movimientos</span>
      </div>

      <div className="flex bg-gray-100 text-xs font-bold">
        <div className="w-24 border-r border-black px-3 py-2">Tipo</div>
        <div className="flex-1 border-r border-black px-3 py-2">Comentario</div>
        <div className="w-28 border-r border-black px-3 py-2">Fecha</div>
        <div className="w-40 border-r border-black px-3 py-2 text-right">Monto</div>
        <div className="w-10 px-1 py-2" />
      </div>

      {asset.movements.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          Sin movimientos registrados.
        </div>
      )}

      {asset.movements.map((m) => (
        <div key={m.id} className="group flex border-b border-black text-sm">
          <div className="w-24 border-r border-black px-3 py-2 text-xs font-medium">
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
          <div className="flex w-10 items-center justify-center px-1 opacity-0 transition-opacity group-hover:opacity-100">
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
      ))}
    </div>
  )
}
