"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, Plus, EyeOff, Eye, Network, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFinance } from "@/components/finance-store"
import { AssetList } from "@/components/activos/asset-list"
import { AssetFormDialog } from "@/components/activos/asset-form-dialog"
import { createGroup, removeFromGroup, deleteGroup, assignToGroup, liquidarActivo, physicalDeleteAsset } from "@/lib/assets-actions"
import type { FinancialRecord } from "@/lib/finance"

export default function ActivosPage() {
  const router = useRouter()
  const { records, deleteRecord, reload } = useFinance()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [hideZero, setHideZero] = useState(true)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState("")
  // "new" = create new group, groupId = assign to existing group
  const [groupTarget, setGroupTarget] = useState<"new" | string>("new")

  const allActivos = records.filter((r) => r.type === "activo")
  const groupParents = allActivos.filter((r) => r.isGroupParent)

  const topLevel = allActivos.filter((r) => {
    if (r.parentId) return false
    if (hideZero && r.amount === 0) return false
    return true
  })

  const handleLiquidate = (record: FinancialRecord, comment: string, createIngreso: boolean) => {
    startTransition(async () => {
      await liquidarActivo(record.id, record.amount, record.currency, record.name, comment || undefined, createIngreso)
      await reload()
      router.refresh()
    })
  }

  const handlePhysicalDelete = (record: FinancialRecord) => {
    startTransition(async () => {
      await physicalDeleteAsset(record.id)
      await reload()
      router.refresh()
    })
  }

  const handleRemoveFromGroup = (assetId: string) => {
    startTransition(async () => {
      await removeFromGroup(assetId)
      await reload()
      router.refresh()
    })
  }

  const handleDeleteGroup = (record: FinancialRecord) => {
    startTransition(async () => {
      await deleteGroup(record.id)
      await reload()
      router.refresh()
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setGroupName("")
    setGroupTarget("new")
  }

  const selectedRecords = allActivos.filter((r) => selectedIds.has(r.id))
  const canGroup = selectedIds.size >= 2

  const handleGroupAction = () => {
    const ids = [...selectedIds]
    const currency = selectedRecords[0]?.currency ?? "USD"

    if (groupTarget === "new") {
      if (!groupName.trim()) return
      startTransition(async () => {
        await createGroup(groupName.trim(), ids, currency)
        await reload()
        router.refresh()
        exitSelectMode()
      })
    } else {
      startTransition(async () => {
        await assignToGroup(groupTarget, ids)
        await reload()
        router.refresh()
        exitSelectMode()
      })
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 border-b-2 border-black pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span className="text-lg font-bold italic">Activos</span>
          </div>
          {/* Desktop buttons inline */}
          <div className="hidden items-center gap-2 sm:flex">
            {selectMode ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-2 border-black text-xs"
                onClick={exitSelectMode}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            ) : (
              <>
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
                  variant="outline"
                  className="gap-2 border-2 border-black text-xs"
                  onClick={() => setSelectMode(true)}
                >
                  <Network className="h-3.5 w-3.5" />
                  Agrupar
                </Button>
                <Button
                  size="sm"
                  className="gap-2 bg-black text-white hover:bg-gray-800"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Nuevo activo
                </Button>
              </>
            )}
          </div>
          {/* Mobile: only primary action visible inline */}
          <div className="flex items-center gap-2 sm:hidden">
            {selectMode ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-2 border-black text-xs"
                onClick={exitSelectMode}
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 bg-black text-white hover:bg-gray-800"
                onClick={() => setOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Nuevo
              </Button>
            )}
          </div>
        </div>
        {/* Mobile: secondary actions below title */}
        {!selectMode && (
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
            <Button
              size="sm"
              variant="outline"
              className={`gap-1.5 border-2 border-black text-xs ${hideZero ? "bg-black text-white" : "bg-white text-black"}`}
              onClick={() => setHideZero((v) => !v)}
            >
              {hideZero ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Balance cero
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-2 border-black text-xs"
              onClick={() => setSelectMode(true)}
            >
              <Network className="h-3.5 w-3.5" />
              Agrupar
            </Button>
          </div>
        )}
      </div>

      {/* Group action bar */}
      {selectMode && canGroup && (
        <div className="mb-4 flex flex-col gap-3 border-2 border-black bg-gray-50 px-4 py-3 sm:flex-wrap sm:flex-row sm:items-center">
          <span className="text-sm font-bold">
            {selectedIds.size} activos seleccionados
          </span>

          {/* Target: new group or existing */}
          <Select value={groupTarget} onValueChange={setGroupTarget}>
            <SelectTrigger className="h-8 w-full border-2 border-black text-xs focus:ring-0 sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new" className="text-xs">Crear nuevo grupo</SelectItem>
              {groupParents.map((g) => (
                <SelectItem key={g.id} value={g.id} className="text-xs">
                  Agregar a: {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {groupTarget === "new" && (
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGroupAction()}
              placeholder="Nombre del grupo..."
              className="h-8 w-full border-2 border-black focus-visible:ring-0 sm:w-48"
              autoFocus
            />
          )}

          <Button
            size="sm"
            className="w-full bg-black text-white hover:bg-gray-800 sm:w-auto"
            onClick={handleGroupAction}
            disabled={(groupTarget === "new" && !groupName.trim()) || isPending}
          >
            {isPending ? "Procesando..." : groupTarget === "new" ? "Crear grupo" : "Asignar al grupo"}
          </Button>
        </div>
      )}

      {selectMode && !canGroup && (
        <div className="mb-4 border-2 border-dashed border-gray-300 px-4 py-3 text-center text-sm text-gray-500">
          Seleccioná al menos 2 activos para agrupar.
        </div>
      )}

      <AssetList
        topLevel={topLevel}
        all={allActivos}
        onLiquidate={handleLiquidate}
        onPhysicalDelete={handlePhysicalDelete}
        onRemoveFromGroup={handleRemoveFromGroup}
        onDeleteGroup={handleDeleteGroup}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <AssetFormDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
