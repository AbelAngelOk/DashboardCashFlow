"use client"

import { useState } from "react"
import { TrendingUp, Plus, EyeOff, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "@/components/finance-store"
import { AssetList } from "@/components/activos/asset-list"
import { AssetFormDialog } from "@/components/activos/asset-form-dialog"
import type { FinancialRecord } from "@/lib/finance"

export default function ActivosPage() {
  const { records, deleteRecord } = useFinance()
  const [open, setOpen] = useState(false)
  const [hideZero, setHideZero] = useState(true)

  const allActivos = records.filter((r) => r.type === "activo")

  const topLevel = allActivos.filter((r) => {
    if (r.parentId) return false
    if (hideZero && r.amount === 0) return false
    return true
  })

  const handleDelete = (record: FinancialRecord, _comment: string) => {
    deleteRecord(record)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <span className="text-lg font-bold italic">Activos</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className={`gap-2 border-2 border-black text-xs ${hideZero ? "bg-black text-white" : "bg-white text-black"}`}
            onClick={() => setHideZero((v) => !v)}
            title={hideZero ? "Mostrar activos en cero" : "Ocultar activos en cero"}
          >
            {hideZero ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Balance cero
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-black text-white hover:bg-gray-800"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nuevo activo
          </Button>
        </div>
      </div>

      <AssetList topLevel={topLevel} all={allActivos} onDelete={handleDelete} />

      <AssetFormDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
