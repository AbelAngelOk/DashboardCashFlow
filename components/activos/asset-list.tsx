"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Network, Trash2 } from "lucide-react"
import { formatAmount, type FinancialRecord } from "@/lib/finance"
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/assets"
import { ConfirmWithCommentDialog } from "@/components/activos/confirm-with-comment-dialog"

interface AssetListProps {
  topLevel: FinancialRecord[]
  all: FinancialRecord[]
  onDelete?: (record: FinancialRecord, comment: string) => void
}

export function AssetList({ topLevel, all, onDelete }: AssetListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<AssetType | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FinancialRecord | null>(null)

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const getChildren = (parentId: string) => all.filter((r) => r.parentId === parentId)

  const filtered = filterType
    ? topLevel.filter((r) => r.assetType === filterType)
    : topLevel

  return (
    <div>
      {/* Type filter bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType(null)}
          className={`border-2 border-black px-3 py-1 text-xs font-bold ${!filterType ? "bg-black text-white" : "hover:bg-gray-100"}`}
        >
          Todos
        </button>
        {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`border-2 border-black px-3 py-1 text-xs font-bold ${filterType === type ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Asset table */}
      <div className="border-2 border-black">
        <div className="flex bg-black text-xs font-bold text-white">
          <div className="flex-1 px-3 py-2">Nombre</div>
          <div className="w-36 px-3 py-2">Tipo</div>
          <div className="w-44 px-3 py-2 text-right">Valor</div>
          <div className="w-14 px-3 py-2" />
        </div>

        {filtered.map((record) => {
          const children = getChildren(record.id)
          const expanded = expandedIds.has(record.id)
          const isGroup = record.isGroupParent || children.length > 0

          return (
            <div key={record.id}>
              <div className="group flex border-b border-black text-sm hover:bg-gray-50">
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
                  {formatAmount(record.amount, record.currency)}{" "}
                  <span className="text-xs text-gray-400">{record.currency}</span>
                </div>
                <div className="flex w-14 items-center justify-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/activos/${record.id}`}
                    className="text-gray-400 hover:text-black"
                    aria-label="Ver detalle"
                  >
                    →
                  </Link>
                  {onDelete && (
                    <button
                      onClick={() => setPendingDelete(record)}
                      className="text-gray-400 hover:text-rose-700"
                      aria-label="Eliminar activo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
                    <div className="flex w-14 items-center justify-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link
                        href={`/activos/${child.id}`}
                        className="text-gray-400 hover:text-black"
                        aria-label="Ver detalle"
                      >
                        →
                      </Link>
                      {onDelete && (
                        <button
                          onClick={() => setPendingDelete(child)}
                          className="text-gray-400 hover:text-rose-700"
                          aria-label="Eliminar activo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
            {filterType
              ? `No hay activos de tipo ${ASSET_TYPE_LABELS[filterType]}.`
              : "No hay activos. Creá el primero con el botón de arriba."}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmWithCommentDialog
          open={!!pendingDelete}
          onOpenChange={(o) => !o && setPendingDelete(null)}
          title="Eliminar activo"
          description={`"${pendingDelete.name}" se eliminará definitivamente.`}
          onConfirm={(comment) => {
            onDelete?.(pendingDelete, comment)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}
