"use client"

import { History } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useFinance } from "@/components/finance-store"
import { type Movement, recordTypeLabels } from "@/lib/finance"

const actionStyles: Record<Movement["action"], string> = {
  creado: "bg-emerald-100 text-emerald-800",
  editado: "bg-amber-100 text-amber-800",
  eliminado: "bg-rose-100 text-rose-800",
}

export default function MovimientosPage() {
  const { movements, movementsLoading, updateComment } = useFinance()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <History className="h-5 w-5" />
        <span className="text-lg font-bold">Movimientos</span>
      </div>
      {movementsLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
      ) : movements.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aún no hay movimientos registrados. Crea, edita o elimina un registro
          para verlo aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {movements.map((m) => (
            <li key={m.id} className="rounded-lg border-2 border-black p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${actionStyles[m.action]}`}
                >
                  {m.action}
                </span>
                <span className="text-xs font-semibold uppercase text-gray-500">
                  {recordTypeLabels[m.recordType]}
                </span>
                <span className="ml-auto text-xs text-gray-500">{m.date}</span>
              </div>
              <p className="mt-2 text-sm">{m.detail}</p>
              <Input
                value={m.comment}
                onChange={(e) => updateComment(m.id, e.target.value)}
                placeholder="Agregar comentario (opcional)..."
                className="mt-2 h-8 text-sm"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
