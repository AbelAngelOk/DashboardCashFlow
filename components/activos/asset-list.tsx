"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Network, Trash2, Unlink } from "lucide-react"
import { formatAmount, type FinancialRecord } from "@/lib/finance"
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/assets"
import { ConfirmWithCommentDialog } from "@/components/activos/confirm-with-comment-dialog"
import { useSettings } from "@/components/settings-store"
import { GroupValueDisplay } from "@/components/group-value-display"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

// ── LiquidarActivoDialog ──────────────────────────────────────────────────────

function LiquidarActivoDialog({
  open,
  record,
  createIngreso,
  onCreateIngresoChange,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  record: FinancialRecord
  createIngreso: boolean
  onCreateIngresoChange: (v: boolean) => void
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState("")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Liquidar activo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-4 text-sm">
          <p>
            <span className="font-bold">{record.name}</span> tiene un balance de{" "}
            <span className="font-bold">
              {formatAmount(record.amount, record.currency)} {record.currency}
            </span>
            . Al liquidar, el balance pasará a{" "}
            <span className="font-bold">$0</span>.
          </p>
          <div className="flex items-center gap-3">
            <Switch
              id="liquidate-ingreso"
              checked={createIngreso}
              onCheckedChange={onCreateIngresoChange}
            />
            <Label htmlFor="liquidate-ingreso" className="cursor-pointer">
              Crear ingreso asociado{" "}
              <span className="text-xs text-gray-500">
                (&quot;Liquidación de {record.name}&quot;)
              </span>
            </Label>
          </div>
          <Textarea
            placeholder="Comentario opcional..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="resize-none border-2 border-black text-sm focus-visible:ring-0"
            rows={2}
          />
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-rose-700 text-white hover:bg-rose-800"
            onClick={() => {
              onConfirm(comment)
              setComment("")
            }}
          >
            Liquidar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AssetListProps {
  topLevel: FinancialRecord[]
  all: FinancialRecord[]
  onLiquidate?: (record: FinancialRecord, comment: string, createIngreso: boolean) => void
  onPhysicalDelete?: (record: FinancialRecord) => void
  onRemoveFromGroup?: (assetId: string) => void
  onDeleteGroup?: (record: FinancialRecord) => void
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function AssetList({
  topLevel,
  all,
  onLiquidate,
  onPhysicalDelete,
  onRemoveFromGroup,
  onDeleteGroup,
  selectMode,
  selectedIds,
  onToggleSelect,
}: AssetListProps) {
  const { settings } = useSettings()
  const { hiddenAssetTypes = [], customAssetTypes = [] } = settings

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set())
  const [pendingLiquidate, setPendingLiquidate] = useState<FinancialRecord | null>(null)
  const [pendingPhysicalDelete, setPendingPhysicalDelete] = useState<FinancialRecord | null>(null)
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<FinancialRecord | null>(null)
  const [liquidateCreateIngreso, setLiquidateCreateIngreso] = useState(true)

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleFilter = (type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  const clearFilter = () => setFilterTypes(new Set())

  const getChildren = (parentId: string) => all.filter((r) => r.parentId === parentId)

  const filtered =
    filterTypes.size === 0
      ? topLevel
      : topLevel.filter((r) => r.assetType && filterTypes.has(r.assetType))

  // Visible asset types: exclude GROUP and hidden system types; include custom types
  const visibleTypes: [string, string][] = [
    ...(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).filter(
      ([type]) => type !== "GROUP" && !hiddenAssetTypes.includes(type),
    ),
    ...customAssetTypes.map((ct): [string, string] => [ct.id, ct.name]),
  ]

  return (
    <div data-testid="activos-list">
      {/* Type filter bar — multi-select */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={clearFilter}
          className={`border-2 border-black px-3 py-1 text-xs font-bold ${filterTypes.size === 0 ? "bg-black text-white" : "hover:bg-gray-100"}`}
        >
          Todos
        </button>
        {visibleTypes.map(([typeKey, label]) => (
          <button
            key={typeKey}
            onClick={() => toggleFilter(typeKey)}
            className={`border-2 border-black px-3 py-1 text-xs font-bold ${filterTypes.has(typeKey) ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Asset table */}
      <div className="border-2 border-black">
        <div className="flex bg-black text-xs font-bold text-white">
          {selectMode && <div className="w-10 px-3 py-2" />}
          <div className="flex-1 px-3 py-2">Nombre</div>
          <div className="w-36 px-3 py-2">Tipo</div>
          <div className="w-44 px-3 py-2 text-right">Valor</div>
          <div className="w-16 px-3 py-2" />
        </div>

        {filtered.map((record) => {
          const children = getChildren(record.id)
          const expanded = expandedIds.has(record.id)
          const isGroup = record.isGroupParent || children.length > 0
          const isSelected = selectedIds?.has(record.id) ?? false

          return (
            <div
              key={record.id}
              data-testid={isGroup ? `activos-group-row-${record.id}` : `activos-row-${record.id}`}
            >
              <div className={`group flex border-b border-black text-sm hover:bg-gray-50 ${isSelected ? "bg-gray-100" : ""}`}>
                {selectMode && (
                  <div className="flex w-10 items-center justify-center px-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(record.id)}
                      className="h-4 w-4 cursor-pointer rounded border-2 border-black"
                    />
                  </div>
                )}
                <div className="flex flex-1 items-center gap-2 px-3 py-2 font-medium">
                  {isGroup ? (
                    <button
                      onClick={() => toggle(record.id)}
                      className="shrink-0 text-gray-400 hover:text-black"
                      aria-label={expanded ? "Colapsar" : "Expandir"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <Link href={`/activos/${record.id}`} className="hover:underline">
                    {record.name}
                  </Link>
                  {isGroup && (
                    <Network className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  )}
                </div>
                <div className="w-36 px-3 py-2 text-xs text-gray-500">
                  {record.assetType
                    ? (ASSET_TYPE_LABELS[record.assetType as AssetType] ?? record.assetType)
                    : "—"}
                </div>
                <div className="w-44 px-3 py-2 text-right">
                  {isGroup && children.length > 0 ? (
                    <GroupValueDisplay children={children} />
                  ) : (
                    <>
                      {formatAmount(record.amount, record.currency)}{" "}
                      <span className="text-xs text-gray-400">{record.currency}</span>
                    </>
                  )}
                </div>
                <div className="flex w-16 items-center justify-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/activos/${record.id}`}
                    className="text-gray-400 hover:text-black text-sm"
                    aria-label="Ver detalle"
                  >
                    →
                  </Link>
                  {!selectMode && (
                    isGroup ? (
                      <button
                        onClick={() => setPendingDeleteGroup(record)}
                        className="text-gray-400 hover:text-rose-700"
                        aria-label="Eliminar grupo"
                        title="Eliminar grupo (los activos quedan sueltos)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      (onLiquidate || onPhysicalDelete) && (
                        <button
                          onClick={() => {
                            if (record.amount > 0) {
                              setLiquidateCreateIngreso(true)
                              setPendingLiquidate(record)
                            } else {
                              setPendingPhysicalDelete(record)
                            }
                          }}
                          className="text-gray-400 hover:text-rose-700"
                          aria-label={record.amount > 0 ? "Liquidar activo" : "Eliminar activo"}
                          title={record.amount > 0 ? "Liquidar activo (pone balance en 0)" : "Eliminar activo definitivamente"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )
                    )
                  )}
                </div>
              </div>

              {/* Expanded children */}
              {expanded &&
                children.map((child) => (
                  <div
                    key={child.id}
                    className="group flex border-b border-black bg-gray-50 text-sm"
                  >
                    <div className="flex flex-1 items-center gap-2 px-3 py-2 pl-10 text-gray-600">
                      <Link href={`/activos/${child.id}`} className="hover:underline">
                        {child.name}
                      </Link>
                    </div>
                    <div className="w-36 px-3 py-2 text-xs text-gray-400">
                      {child.assetType
                        ? (ASSET_TYPE_LABELS[child.assetType as AssetType] ?? child.assetType)
                        : "—"}
                    </div>
                    <div className="w-44 px-3 py-2 text-right text-gray-600">
                      {formatAmount(child.amount, child.currency)}{" "}
                      <span className="text-xs text-gray-300">{child.currency}</span>
                    </div>
                    <div className="flex w-16 items-center justify-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        href={`/activos/${child.id}`}
                        className="text-gray-400 hover:text-black text-sm"
                        aria-label="Ver detalle"
                      >
                        →
                      </Link>
                      {!selectMode && onRemoveFromGroup && (
                        <button
                          onClick={() => onRemoveFromGroup(child.id)}
                          className="text-gray-400 hover:text-amber-600"
                          aria-label="Remover del grupo"
                          title="Remover del grupo"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {filterTypes.size > 0
              ? "No hay activos para los tipos seleccionados."
              : "No hay activos. Creá el primero con el botón de arriba."}
          </div>
        )}
      </div>

      {/* Liquidar activo (balance > 0) */}
      {pendingLiquidate && (
        <LiquidarActivoDialog
          open={!!pendingLiquidate}
          record={pendingLiquidate}
          createIngreso={liquidateCreateIngreso}
          onCreateIngresoChange={setLiquidateCreateIngreso}
          onOpenChange={(o) => !o && setPendingLiquidate(null)}
          onConfirm={(comment) => {
            onLiquidate?.(pendingLiquidate, comment, liquidateCreateIngreso)
            setPendingLiquidate(null)
          }}
        />
      )}

      {/* Eliminar físicamente (balance = 0) */}
      {pendingPhysicalDelete && (
        <ConfirmWithCommentDialog
          open={!!pendingPhysicalDelete}
          onOpenChange={(o) => !o && setPendingPhysicalDelete(null)}
          title="Eliminar activo"
          description={`"${pendingPhysicalDelete.name}" tiene balance $0 y será eliminado definitivamente.`}
          onConfirm={() => {
            onPhysicalDelete?.(pendingPhysicalDelete)
            setPendingPhysicalDelete(null)
          }}
        />
      )}

      {/* Delete group */}
      {pendingDeleteGroup && (
        <ConfirmWithCommentDialog
          open={!!pendingDeleteGroup}
          onOpenChange={(o) => !o && setPendingDeleteGroup(null)}
          title="Eliminar grupo"
          description={`El grupo "${pendingDeleteGroup.name}" se eliminará. Los activos del grupo quedarán sueltos (no se eliminan).`}
          onConfirm={() => {
            onDeleteGroup?.(pendingDeleteGroup)
            setPendingDeleteGroup(null)
          }}
        />
      )}
    </div>
  )
}
