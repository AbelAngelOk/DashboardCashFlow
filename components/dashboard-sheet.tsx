"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Network,
  Eye,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { MarkerPicker } from "@/components/markers/marker-picker"
import { loadEntityMarkersForIds } from "@/lib/marker-actions"
import type { MarkerDefinition } from "@/lib/marker-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type Currency,
  type FinancialRecord,
  type RecordType,
  activeCurrencies,
  calculateTotals,
  calculateTotalsConverted,
  convertAmount,
  currencies,
  defaultCurrency,
  formatAmount,
  ratesAgeDays,
  formatRatesAge,
  RATES_STALE_AFTER_DAYS,
} from "@/lib/finance"
import type { FlowGroupWithMembers } from "@/lib/flow-group-actions"
import { GroupValueDisplay } from "@/components/group-value-display"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useSettings } from "@/components/settings-store"
import { useObligations } from "@/components/obligations-store"
import { computeRecurringBreakdown } from "@/lib/obligations"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// ── Amount display helpers ────────────────────────────────────────────────────

function RecordAmount({ record }: { record: FinancialRecord }) {
  const { settings } = useSettings()
  const { convertCurrencies, showConvertedAmounts, baseCurrency, exchangeRates } = settings

  if (convertCurrencies && showConvertedAmounts && record.currency !== baseCurrency) {
    const converted = convertAmount(record.amount, record.currency, baseCurrency, exchangeRates)
    return (
      <div className="flex flex-col items-end leading-tight">
        <span>
          {formatAmount(converted, baseCurrency)} {baseCurrency}
        </span>
        <span className="text-[10px] text-gray-400">
          {formatAmount(record.amount, record.currency)} {record.currency}
        </span>
      </div>
    )
  }

  return (
    <span>
      {formatAmount(record.amount, record.currency)} {record.currency}
    </span>
  )
}

// Renders a block of totals — multi-currency lines OR single converted value
function TotalsBlock({
  records,
  className,
}: {
  records: FinancialRecord[]
  className?: string
}) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings
  const totals = calculateTotals(records)

  if (convertCurrencies) {
    const total = calculateTotalsConverted(records, baseCurrency, exchangeRates)
    return (
      <div className={className}>
        <span>
          {formatAmount(total, baseCurrency)} {baseCurrency}
        </span>
      </div>
    )
  }

  const active = activeCurrencies(totals)
  if (active.length === 0) return <div className={className}>—</div>

  return (
    <div className={`flex flex-col items-end gap-0.5 ${className ?? ""}`}>
      {active.map((c) => (
        <span key={c}>
          {formatAmount(totals[c], c)} {c}
        </span>
      ))}
    </div>
  )
}

// ── CurrencySelect ────────────────────────────────────────────────────────────

interface DraftRow {
  id: string
  name: string
  amount: string
  currency: Currency
  linkedTo: string
}

interface ExtraRow {
  id: string
  name: string
  href: string
  paused?: boolean
  valueNode: React.ReactNode
}

export type DashboardMovementType = "ADJUSTMENT" | "DEPOSIT" | "EXTRACT"

interface DashboardSheetProps {
  records: FinancialRecord[]
  /** Todavía no llegaron records/snapshots de la DB — cada tabla muestra su propio skeleton. */
  loading?: boolean
  readOnly?: boolean
  gastoGroups?: FlowGroupWithMembers[]
  ingresoGroups?: FlowGroupWithMembers[]
  onCreate?: (record: FinancialRecord) => void
  onEdit?: (record: FinancialRecord, previous: FinancialRecord) => void
  onDelete?: (record: FinancialRecord) => void
  onGroupAdjust?: (record: FinancialRecord, previous: FinancialRecord) => void
  onBreakdown?: (record: FinancialRecord) => void
  onDeleteWithComment?: (record: FinancialRecord, comment: string, createIngreso: boolean) => void
  onEditAmountWithComment?: (
    record: FinancialRecord,
    previous: FinancialRecord,
    comment: string,
    movementType: DashboardMovementType,
    createGasto: boolean,
    createIngreso: boolean,
  ) => void
  onAddObligation?: () => void
  onAddAsset?: () => void
}

function CurrencySelect({
  value,
  onChange,
}: {
  value: Currency
  onChange: (value: Currency) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger className="h-6 w-16 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── Loading / empty states (por tabla) ──────────────────────────────────────
//
// Antes AppShell tapaba TODO el dashboard con un spinner único hasta que
// records+snapshots+audit log completo llegaban de la DB. Ahora el shell y
// la estructura de cada tabla se pintan de inmediato; esto es lo que cada
// SectionTable muestra mientras espera SU parte de los datos, y cuando esos
// datos ya llegaron pero están genuinamente vacíos (dos casos distintos que
// antes se veían idénticos: una tabla vacía).

const EMPTY_STATE_ICON: Record<RecordType, typeof TrendingUp> = {
  ingreso: TrendingDown,
  gasto: ShoppingCart,
  activo: TrendingUp,
  pasivo: FileText,
}

const EMPTY_STATE_TEXT: Record<RecordType, string> = {
  ingreso: "Sin ingresos registrados",
  gasto: "Sin gastos registrados",
  activo: "Sin activos registrados",
  pasivo: "Sin obligaciones registradas",
}

function SectionTableSkeleton() {
  return (
    <div className="animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex border-b border-black/10 text-sm">
          <div className="flex-1 border-r border-black/10 px-2 py-2">
            <div className="h-3 rounded bg-gray-200" style={{ width: `${55 - i * 12}%` }} />
          </div>
          <div className="w-36 border-r border-black/10 px-2 py-2">
            <div className="ml-auto h-3 w-16 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionTableEmpty({ type }: { type: RecordType }) {
  const Icon = EMPTY_STATE_ICON[type]
  return (
    <div className="flex flex-col items-center gap-2 border-b border-black/10 py-8 text-center">
      <Icon className="h-8 w-8 text-gray-200" />
      <p className="text-xs text-gray-400">{EMPTY_STATE_TEXT[type]}</p>
    </div>
  )
}

// ── SectionTable ─────────────────────────────────────────────────────────────

interface SectionTableProps {
  title: string
  type: RecordType
  records: FinancialRecord[]
  allRecords: FinancialRecord[]
  /** Todavía no llegaron records de la DB: muestra skeleton en vez de "vacío". */
  loading?: boolean
  valueLabel: string
  linkType?: RecordType
  linkLabel?: string
  readOnly: boolean
  /** Override the records used for the totals footer (e.g. expanded children instead of stale group parent). */
  totalRecords?: FinancialRecord[]
  extraRows?: ExtraRow[]
  /** User-defined groups for gasto/ingreso types. When provided, records are rendered in groups. */
  flowGroups?: FlowGroupWithMembers[]
  /** Override the + button behavior. When provided, clicking + calls this instead of addNewRow. */
  onAddClick?: () => void
  onCreate?: (record: FinancialRecord) => void
  onEdit?: (record: FinancialRecord, previous: FinancialRecord) => void
  onDelete?: (record: FinancialRecord) => void
  onGroupAdjust?: (record: FinancialRecord, previous: FinancialRecord) => void
  onBreakdown?: (record: FinancialRecord) => void
  onDeleteWithComment?: (record: FinancialRecord, comment: string, createIngreso: boolean) => void
  onEditAmountWithComment?: (
    record: FinancialRecord,
    previous: FinancialRecord,
    comment: string,
    movementType: DashboardMovementType,
    createGasto: boolean,
    createIngreso: boolean,
  ) => void
}

function SectionTable({
  title,
  type,
  records,
  allRecords,
  loading,
  valueLabel,
  linkType,
  linkLabel,
  readOnly,
  totalRecords,
  extraRows,
  flowGroups,
  onAddClick,
  onCreate,
  onEdit,
  onDelete,
  onGroupAdjust,
  onBreakdown,
  onDeleteWithComment,
  onEditAmountWithComment,
}: SectionTableProps) {
  const [newRows, setNewRows] = useState<DraftRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DraftRow | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FinancialRecord | null>(null)
  const [deleteComment, setDeleteComment] = useState("")
  const [deleteCreateIngreso, setDeleteCreateIngreso] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<{
    record: FinancialRecord
    previous: FinancialRecord
  } | null>(null)
  const [editComment, setEditComment] = useState("")
  const [editMovementType, setEditMovementType] = useState<DashboardMovementType>("ADJUSTMENT")
  const [editCreateGasto, setEditCreateGasto] = useState(false)
  const [editCreateIngreso, setEditCreateIngreso] = useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())
  const [markerMap, setMarkerMap] = useState<Record<string, MarkerDefinition>>({})

  const refreshMarkers = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const map = await loadEntityMarkersForIds(ids, "RECORD")
      setMarkerMap(map)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    if (!readOnly) refreshMarkers(records.map((r) => r.id))
  }, [records, readOnly, refreshMarkers])

  const linkOptions = linkType
    ? allRecords.filter((r) => r.type === linkType)
    : []

  const getLinkedName = (id?: string) => {
    if (!id) return "—"
    return allRecords.find((r) => r.id === id)?.name || "—"
  }

  const toggleGroup = (id: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const getGroupChildren = (parentId: string) =>
    allRecords.filter((r) => r.parentId === parentId)


  const emptyDraft = (): DraftRow => ({
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    currency: defaultCurrency,
    linkedTo: "",
  })

  const addNewRow = () => setNewRows((rows) => [...rows, emptyDraft()])

  const updateNewRow = (id: string, field: keyof DraftRow, value: string) =>
    setNewRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    )

  const removeNewRow = (id: string) =>
    setNewRows((rows) => rows.filter((r) => r.id !== id))

  const saveNewRow = (row: DraftRow) => {
    if (!row.name || !row.amount) return
    onCreate?.({
      id: row.id,
      type,
      name: row.name,
      amount: Number.parseFloat(row.amount),
      currency: row.currency,
      linkedTo:
        row.linkedTo && row.linkedTo !== "none" ? row.linkedTo : undefined,
    })
    removeNewRow(row.id)
  }

  const startEdit = (record: FinancialRecord) => {
    setEditingId(record.id)
    setNameError(null)
    setEditDraft({
      id: record.id,
      name: record.name,
      amount: String(record.amount),
      currency: record.currency,
      linkedTo: record.linkedTo ?? "none",
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
    setNameError(null)
  }

  const saveEdit = (previous: FinancialRecord) => {
    if (!editDraft || !editDraft.name || !editDraft.amount) return

    // Validate name uniqueness for activos
    if (type === "activo" && editDraft.name !== previous.name) {
      const duplicate = allRecords.some(
        (r) => r.type === "activo" && r.id !== previous.id && r.name === editDraft.name,
      )
      if (duplicate) {
        setNameError(`Ya existe un activo con el nombre "${editDraft.name}"`)
        return
      }
    }

    const updated: FinancialRecord = {
      id: previous.id,
      type,
      name: editDraft.name,
      amount: Number.parseFloat(editDraft.amount),
      currency: editDraft.currency,
      linkedTo:
        editDraft.linkedTo && editDraft.linkedTo !== "none"
          ? editDraft.linkedTo
          : undefined,
      parentId: previous.parentId,
      assetType: previous.assetType,
      isGroupParent: previous.isGroupParent,
    }

    const amountChanged = updated.amount !== previous.amount

    // For activos with amount change: show comment dialog
    if (type === "activo" && amountChanged && onEditAmountWithComment) {
      setPendingEdit({ record: updated, previous })
      cancelEdit()
      return
    }

    // For group parent amount change
    if (previous.isGroupParent && onGroupAdjust && amountChanged) {
      onGroupAdjust(updated, previous)
    } else {
      onEdit?.(updated, previous)
    }
    cancelEdit()
  }

  const handleDeleteClick = (record: FinancialRecord) => {
    if (type === "activo" && onDeleteWithComment) {
      setPendingDelete(record)
    } else {
      onDelete?.(record)
    }
  }

  const hasLink = Boolean(linkType)
  const isActivo = type === "activo"

  // For activos: show only top-level (no parentId); children shown inline when group expanded
  const displayRecords = isActivo
    ? records.filter((r) => !r.parentId)
    : records

  const hasFlowGroupContent = Boolean(
    flowGroups && flowGroups.length > 0 && (type === "gasto" || type === "ingreso"),
  )
  // Genuinamente sin datos: no confundir con "todavía no llegó de la DB" (loading).
  const isEmpty =
    !loading &&
    displayRecords.length === 0 &&
    !hasFlowGroupContent &&
    !(extraRows && extraRows.length > 0) &&
    newRows.length === 0

  const testId =
    type === "ingreso"
      ? "dashboard-income-table"
      : type === "gasto"
        ? "dashboard-expense-table"
        : type === "activo"
          ? "dashboard-assets-table"
          : "dashboard-liabilities-table"

  return (
    <div data-testid={testId} className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
        <span className="font-bold italic text-white">{title}</span>
        {!readOnly && !loading && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
            onClick={onAddClick ?? addNewRow}
            aria-label={`Agregar fila a ${title}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Column headers */}
      <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
        <div className="flex-1 border-r border-black px-2 py-1">Descripción</div>
        <div className="w-36 border-r border-black px-2 py-1 text-right">
          {valueLabel}
        </div>
        {hasLink && (
          <div className="hidden w-24 border-r border-black px-2 py-1 text-center sm:block">
            {linkLabel}
          </div>
        )}
        {!readOnly && <div className="w-20 px-1 py-1 text-center">Acción</div>}
      </div>

      {loading ? (
        <SectionTableSkeleton />
      ) : isEmpty ? (
        <SectionTableEmpty type={type} />
      ) : (
        <>
      {/* Flow groups (gasto / ingreso user-defined groups) */}
      {flowGroups && flowGroups.length > 0 && (type === "gasto" || type === "ingreso") &&
        flowGroups.map((group) => {
          const members = displayRecords.filter((r) => group.memberIds.includes(r.id))
          if (members.length === 0) return null
          const isExpanded = expandedGroupIds.has(group.id)
          const totalByCurrency = members.reduce<Record<string, number>>((acc, r) => {
            acc[r.currency] = (acc[r.currency] ?? 0) + r.amount
            return acc
          }, {})
          return (
            <div key={group.id}>
              <div className="flex border-b border-black bg-gray-50 text-sm font-semibold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleGroup(group.id)} className="shrink-0 text-gray-400 hover:text-black" aria-label={isExpanded ? "Colapsar" : "Expandir"}>
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <span>{group.name}</span>
                    <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-normal text-gray-600">{members.length}</span>
                  </div>
                </div>
                <div className="w-36 border-r border-black px-2 py-1 text-right">
                  {Object.entries(totalByCurrency).map(([c, amt]) => (
                    <div key={c} className="text-xs">{formatAmount(amt, c as Currency)} {c}</div>
                  ))}
                </div>
                {hasLink && <div className="hidden w-24 border-r border-black sm:block" />}
                {!readOnly && <div className="w-20" />}
              </div>
              {isExpanded && members.map((member) => {
                const marker = markerMap[member.id] ?? null
                return editingId === member.id && editDraft ? (
                  <div key={member.id} className="flex flex-col border-b border-black text-sm">
                    <div className="flex">
                      <div className="flex-1 border-r border-black px-1 py-0.5">
                        <Input value={editDraft.name} onChange={(e) => { setEditDraft({ ...editDraft, name: e.target.value }); setNameError(null) }}
                          className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" />
                      </div>
                      <div className="flex w-36 items-center gap-1 border-r border-black px-1 py-0.5">
                        <NumericInput value={editDraft.amount} onChange={(v) => setEditDraft({ ...editDraft, amount: v })}
                          className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0" />
                        <CurrencySelect value={editDraft.currency} onChange={(v) => setEditDraft({ ...editDraft, currency: v })} />
                      </div>
                      {hasLink && <div className="hidden w-24 px-1 py-0.5 sm:block" />}
                      <div className="flex w-20 items-center justify-center gap-1 px-1">
                        <button onClick={() => saveEdit(member)} className="text-emerald-700 hover:text-emerald-900" aria-label="Guardar"><Check className="h-4 w-4" /></button>
                        <button onClick={cancelEdit} className="text-gray-500 hover:text-black" aria-label="Cancelar"><X className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={member.id}
                    className="group flex border-b border-black bg-gray-50/50 text-sm"
                    style={marker ? { borderLeft: `4px solid ${marker.color}`, backgroundColor: `${marker.color}18` } : undefined}
                  >
                    <div className="flex-1 border-r border-black py-1 pl-8 pr-2 text-gray-600">{member.name}</div>
                    <div className="w-36 border-r border-black px-2 py-1 text-right text-gray-600"><RecordAmount record={member} /></div>
                    {hasLink && <div className="hidden w-24 border-r border-black px-2 py-1 sm:block" />}
                    {!readOnly && (
                      <div className="flex w-20 items-center justify-center gap-1 px-1">
                        <MarkerPicker entityId={member.id} entityType="RECORD" currentMarker={marker} onChanged={() => refreshMarkers(records.map((r) => r.id))} />
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {type === "ingreso" && (
                            <Link href={`/ingresos/${member.id}`} className="text-gray-500 hover:text-black" aria-label="Ver ingreso"><Eye className="h-3.5 w-3.5" /></Link>
                          )}
                          {type === "gasto" && (
                            <Link href={`/gastos/${member.id}`} className="text-gray-500 hover:text-black" aria-label="Ver gasto"><Eye className="h-3.5 w-3.5" /></Link>
                          )}
                          <button onClick={() => startEdit(member)} className="text-gray-500 hover:text-black" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteClick(member)} className="text-gray-500 hover:text-rose-700" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      }

      {/* Existing records (ungrouped when flowGroups active) */}
      {(flowGroups && flowGroups.length > 0 && (type === "gasto" || type === "ingreso")
        ? displayRecords.filter((r) => !flowGroups.some((g) => g.memberIds.includes(r.id)))
        : displayRecords
      ).map((record) => {
        const marker = markerMap[record.id] ?? null
        return editingId === record.id && editDraft ? (
          <div key={record.id} className="flex flex-col border-b border-black text-sm">
            <div className="flex">
              <div className="flex-1 border-r border-black px-1 py-0.5">
                <Input
                  value={editDraft.name}
                  onChange={(e) => {
                    setEditDraft({ ...editDraft, name: e.target.value })
                    setNameError(null)
                  }}
                  className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex w-36 items-center gap-1 border-r border-black px-1 py-0.5">
                <NumericInput
                  value={editDraft.amount}
                  onChange={(v) => setEditDraft({ ...editDraft, amount: v })}
                  className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
                />
                <CurrencySelect
                  value={editDraft.currency}
                  onChange={(v) => setEditDraft({ ...editDraft, currency: v })}
                />
              </div>
              {hasLink && (
                <div className="hidden w-24 items-center px-1 py-0.5 sm:flex">
                  <Select
                    value={editDraft.linkedTo}
                    onValueChange={(v) =>
                      setEditDraft({ ...editDraft, linkedTo: v })
                    }
                  >
                    <SelectTrigger className="h-6 w-full border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {linkOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex w-20 items-center justify-center gap-1 px-1">
                <button
                  onClick={() => saveEdit(record)}
                  className="text-emerald-700 hover:text-emerald-900"
                  aria-label="Guardar"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-gray-500 hover:text-black"
                  aria-label="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {nameError && (
              <div className="px-2 py-1 text-xs text-rose-600">{nameError}</div>
            )}
          </div>
        ) : (
          <div key={record.id}>
            {/* Main row */}
            <div
              className={`group flex border-b border-black text-sm ${record.isGroupParent ? "bg-gray-50" : ""}`}
              style={marker ? {
                borderLeft: `4px solid ${marker.color}`,
                backgroundColor: `${marker.color}18`,
              } : undefined}
            >
              <div className="flex-1 border-r border-black px-2 py-1">
                <div className="flex items-center gap-1">
                  {record.isGroupParent && (
                    <button
                      onClick={() => toggleGroup(record.id)}
                      className="shrink-0 text-gray-400 hover:text-black"
                      aria-label={expandedGroupIds.has(record.id) ? "Colapsar" : "Expandir"}
                    >
                      {expandedGroupIds.has(record.id) ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  <span className={record.isGroupParent ? "font-semibold" : ""}>
                    {record.name}
                  </span>
                  {record.isGroupParent && (
                    <Network className="h-3 w-3 shrink-0 text-gray-300" />
                  )}
                </div>
              </div>
              <div className="w-36 border-r border-black px-2 py-1 text-right">
                {record.isGroupParent ? (
                  <GroupValueDisplay children={getGroupChildren(record.id)} />
                ) : (
                  <RecordAmount record={record} />
                )}
              </div>
              {hasLink && (
                <div className="hidden w-24 border-r border-black px-2 py-1 text-center text-xs text-gray-500 sm:block">
                  {getLinkedName(record.linkedTo)}
                </div>
              )}
              {!readOnly && (
                <div className="flex w-20 items-center justify-center gap-1 px-1">
                  <MarkerPicker
                    entityId={record.id}
                    entityType="RECORD"
                    currentMarker={marker}
                    onChanged={() => refreshMarkers(records.map((r) => r.id))}
                  />
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {isActivo && (
                      <Link
                        href={`/activos/${record.id}`}
                        className="text-gray-500 hover:text-black"
                        aria-label="Ver activo"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {type === "ingreso" && (
                      <Link
                        href={`/ingresos/${record.id}`}
                        className="text-gray-500 hover:text-black"
                        aria-label="Ver ingreso"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {type === "gasto" && (
                      <Link
                        href={`/gastos/${record.id}`}
                        className="text-gray-500 hover:text-black"
                        aria-label="Ver gasto"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {/* Groups: no edit/delete from dashboard */}
                    {!record.isGroupParent && (
                      <>
                        <button
                          onClick={() => startEdit(record)}
                          className="text-gray-500 hover:text-black"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(record)}
                          className="text-gray-500 hover:text-rose-700"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Expanded group children */}
            {record.isGroupParent && expandedGroupIds.has(record.id) &&
              getGroupChildren(record.id).map((child) => (
                <div key={child.id} className="group flex border-b border-black bg-gray-50/50 text-sm">
                  <div className="flex-1 border-r border-black py-1 pl-8 pr-2 text-gray-600">
                    {child.name}
                  </div>
                  <div className="w-36 border-r border-black px-2 py-1 text-right text-gray-600">
                    <RecordAmount record={child} />
                  </div>
                  {hasLink && <div className="hidden w-24 border-r border-black px-2 py-1 sm:block" />}
                  {!readOnly && (
                    <div className="flex w-20 items-center justify-center gap-1 px-1">
                      <MarkerPicker
                        entityId={child.id}
                        entityType="RECORD"
                        currentMarker={markerMap[child.id] ?? null}
                        onChanged={() => refreshMarkers(records.map((r) => r.id))}
                      />
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link
                          href={`/activos/${child.id}`}
                          className="text-gray-500 hover:text-black"
                          aria-label="Ver activo"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => startEdit(child)}
                          className="text-gray-500 hover:text-black"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {onDeleteWithComment && child.amount !== 0 && (
                          <button
                            onClick={() => { setPendingDelete(child); setDeleteComment(""); setDeleteCreateIngreso(false) }}
                            className="text-gray-500 hover:text-rose-700"
                            aria-label="Poner en cero"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )
      })}

      {/* Extra rows (e.g. obligations merged into pasivos) */}
      {extraRows?.map((row) => (
        <div key={row.id} className="group flex border-b border-black text-sm hover:bg-gray-50">
          <div className="flex flex-1 items-center gap-2 border-r border-black px-2 py-1">
            <Link href={row.href} className="font-medium hover:underline">
              {row.name}
            </Link>
            {row.paused && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Pausada
              </span>
            )}
          </div>
          <div className="w-36 border-r border-black px-2 py-1 text-right text-sm">
            {row.valueNode}
          </div>
          {hasLink && <div className="hidden w-24 border-r border-black px-2 py-1 sm:block" />}
          {!readOnly && (
            <div className="flex w-20 items-center justify-center px-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Link href={row.href} className="text-gray-400 hover:text-black" aria-label="Ver obligación">
                <Eye className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      ))}
        </>
      )}

      {/* New editable rows */}
      {!readOnly &&
        newRows.map((row) => (
          <div key={row.id} className="flex border-b border-black text-sm">
            <div className="flex-1 border-r border-black px-1 py-0.5">
              <Input
                placeholder="Descripción..."
                value={row.name}
                autoFocus
                onChange={(e) => updateNewRow(row.id, "name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveNewRow(row)}
                className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex w-36 items-center gap-1 border-r border-black px-1 py-0.5">
              <NumericInput
                placeholder="0.00"
                value={row.amount}
                onChange={(v) => updateNewRow(row.id, "amount", v)}
                onKeyDown={(e) => e.key === "Enter" && saveNewRow(row)}
                className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
              />
              <CurrencySelect
                value={row.currency}
                onChange={(v) => updateNewRow(row.id, "currency", v)}
              />
            </div>
            {hasLink && (
              <div className="hidden w-24 items-center px-1 py-0.5 sm:flex">
                <Select
                  value={row.linkedTo}
                  onValueChange={(v) => updateNewRow(row.id, "linkedTo", v)}
                >
                  <SelectTrigger className="h-6 w-full border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {linkOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex w-20 items-center justify-center gap-1 px-1">
              <button
                onClick={() => saveNewRow(row)}
                className="text-emerald-700 hover:text-emerald-900"
                aria-label="Guardar"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => removeNewRow(row.id)}
                className="text-gray-500 hover:text-black"
                aria-label="Descartar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

      {/* Totals footer */}
      <div className="flex items-center border-t-2 border-black bg-gray-100 text-sm font-bold">
        <div className="flex-1 border-r border-black px-2 py-1">
          Total {title}:
        </div>
        <div className="flex-1 px-2 py-1">
          {loading ? (
            <span className="block text-right text-gray-300">—</span>
          ) : (
            <TotalsBlock records={totalRecords ?? records} className="text-right" />
          )}
        </div>
      </div>

      {/* Delete asset dialog */}
      {pendingDelete && (
        <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) { setPendingDelete(null); setDeleteComment(""); setDeleteCreateIngreso(false) } }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <DialogPrimitive.Content className="fixed left-1/2 top-[12%] z-50 w-full max-w-sm -translate-x-1/2 border-2 border-black bg-white p-0">
              <div className="border-b-2 border-black bg-black px-4 py-3">
                <DialogPrimitive.Title className="font-bold italic text-white">Poner activo en cero</DialogPrimitive.Title>
              </div>
              <div className="flex flex-col gap-4 px-4 py-4">
                <p className="text-sm text-gray-600">
                  El valor de &quot;{pendingDelete.name}&quot; pasará a 0. Se registrará un movimiento de Egreso.
                </p>
                <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={deleteCreateIngreso}
                    onChange={(e) => setDeleteCreateIngreso(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    Crear ingreso asociado{" "}
                    <span className="text-xs text-gray-500">
                      ({formatAmount(pendingDelete.amount, pendingDelete.currency)} {pendingDelete.currency})
                    </span>
                  </span>
                </label>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">
                    Comentario <span className="font-normal normal-case text-gray-400">(opcional)</span>
                  </Label>
                  <Textarea
                    value={deleteComment}
                    onChange={(e) => setDeleteComment(e.target.value)}
                    placeholder="¿Por qué realizás este cambio?"
                    className="resize-none rounded-none border-2 border-black focus-visible:ring-0"
                    rows={2}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t-2 border-black px-4 py-3">
                <Button variant="outline" className="border-2 border-black" onClick={() => { setPendingDelete(null); setDeleteComment(""); setDeleteCreateIngreso(false) }}>
                  Cancelar
                </Button>
                <Button className="bg-black text-white hover:bg-gray-800" onClick={() => {
                  onDeleteWithComment?.(pendingDelete, deleteComment, deleteCreateIngreso)
                  setPendingDelete(null)
                  setDeleteComment("")
                  setDeleteCreateIngreso(false)
                }}>
                  Confirmar
                </Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Edit amount dialog */}
      {pendingEdit && (
        <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) { setPendingEdit(null); setEditComment(""); setEditMovementType("ADJUSTMENT"); setEditCreateGasto(false); setEditCreateIngreso(false) } }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <DialogPrimitive.Content className="fixed left-1/2 top-[12%] z-50 w-full max-w-sm -translate-x-1/2 border-2 border-black bg-white p-0">
              <div className="border-b-2 border-black bg-black px-4 py-3">
                <DialogPrimitive.Title className="font-bold italic text-white">Cambiar valor del activo</DialogPrimitive.Title>
              </div>
              <div className="flex flex-col gap-4 px-4 py-4">
                <p className="text-sm text-gray-600">
                  Nuevo valor: <strong>{formatAmount(pendingEdit.record.amount, pendingEdit.record.currency)} {pendingEdit.record.currency}</strong>
                </p>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Tipo de movimiento</Label>
                  <div className="flex gap-3">
                    {(["ADJUSTMENT", "DEPOSIT", "EXTRACT"] as DashboardMovementType[]).map((t) => (
                      <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name="movementType"
                          value={t}
                          checked={editMovementType === t}
                          onChange={() => {
                            setEditMovementType(t)
                            if (t !== "DEPOSIT") setEditCreateGasto(false)
                            if (t !== "EXTRACT") setEditCreateIngreso(false)
                          }}
                        />
                        {t === "ADJUSTMENT" ? "Ajuste" : t === "DEPOSIT" ? "Depósito" : "Egreso"}
                      </label>
                    ))}
                  </div>
                </div>
                {editMovementType === "DEPOSIT" && (
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={editCreateGasto}
                      onChange={(e) => setEditCreateGasto(e.target.checked)}
                      className="rounded"
                    />
                    <span>Crear gasto asociado</span>
                  </label>
                )}
                {editMovementType === "EXTRACT" && (
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={editCreateIngreso}
                      onChange={(e) => setEditCreateIngreso(e.target.checked)}
                      className="rounded"
                    />
                    <span>
                      Crear ingreso asociado{" "}
                      <span className="text-xs text-gray-500">
                        (&quot;Venta de {pendingEdit.record.name}&quot;)
                      </span>
                    </span>
                  </label>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">
                    Comentario <span className="font-normal normal-case text-gray-400">(opcional)</span>
                  </Label>
                  <Textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="¿Por qué realizás este cambio?"
                    className="resize-none rounded-none border-2 border-black focus-visible:ring-0"
                    rows={2}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t-2 border-black px-4 py-3">
                <Button variant="outline" className="border-2 border-black" onClick={() => { setPendingEdit(null); setEditComment(""); setEditMovementType("ADJUSTMENT"); setEditCreateGasto(false); setEditCreateIngreso(false) }}>
                  Cancelar
                </Button>
                <Button className="bg-black text-white hover:bg-gray-800" onClick={() => {
                  onEditAmountWithComment?.(pendingEdit.record, pendingEdit.previous, editComment, editMovementType, editCreateGasto, editCreateIngreso)
                  setPendingEdit(null)
                  setEditComment("")
                  setEditMovementType("ADJUSTMENT")
                  setEditCreateGasto(false)
                  setEditCreateIngreso(false)
                }}>
                  Confirmar
                </Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  )
}

// ── DashboardSheet ────────────────────────────────────────────────────────────

export function DashboardSheet({
  records,
  loading = false,
  readOnly = false,
  gastoGroups,
  ingresoGroups,
  onCreate,
  onEdit,
  onDelete,
  onGroupAdjust,
  onBreakdown,
  onDeleteWithComment,
  onEditAmountWithComment,
  onAddObligation,
  onAddAsset,
}: DashboardSheetProps) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates, ratesLastUpdated } = settings
  const { obligations, loading: obligationsLoading } = useObligations()
  const staleRates = convertCurrencies && (ratesAgeDays(ratesLastUpdated) === null || (ratesAgeDays(ratesLastUpdated) ?? 0) > RATES_STALE_AFTER_DAYS)

  const obligationExtraRows: ExtraRow[] = readOnly
    ? []
    : obligations
        .filter((o) => o.status === "ACTIVE" || o.status === "PAUSED")
        .map((o) => {
          let valueNode: React.ReactNode
          if (o.obligationType === "RECURRING") {
            const breakdown = computeRecurringBreakdown(o.rules)
            const entries = Object.entries(breakdown).filter(([, v]) => v > 0) as [Currency, number][]
            if (entries.length === 0) {
              valueNode = <span className="text-gray-400">—</span>
            } else if (convertCurrencies) {
              const total = entries.reduce(
                (s, [cur, val]) => s + convertAmount(val, cur, baseCurrency as Currency, exchangeRates),
                0,
              )
              valueNode = (
                <div className="flex flex-col items-end leading-tight">
                  <span>{formatAmount(total, baseCurrency as Currency)} {baseCurrency}</span>
                  <span className="text-[10px] text-gray-400">anual</span>
                </div>
              )
            } else {
              valueNode = (
                <div className="flex flex-col items-end gap-0.5 leading-tight">
                  {entries.map(([cur, val]) => (
                    <span key={cur}>{formatAmount(val, cur)} {cur}</span>
                  ))}
                  <span className="text-[10px] text-gray-400">anual</span>
                </div>
              )
            }
          } else {
            valueNode = <span>{formatAmount(o.amount, o.currency)} {o.currency}</span>
          }
          return {
            id: o.id,
            name: o.name,
            href: `/obligaciones/${o.id}`,
            paused: o.status === "PAUSED",
            valueNode,
          }
        })

  const ingresos = records.filter((r) => r.type === "ingreso")
  const gastos = records.filter((r) => r.type === "gasto")
  // Exclude child assets (parentId set) and zero-value assets
  const activos = records.filter((r) => r.type === "activo" && !r.parentId && r.amount !== 0)
  const pasivos = records.filter((r) => r.type === "pasivo")

  // For activos total: use individual children (correct amounts/currencies) and standalone activos.
  // Exclude group parents whose .amount is a stale DB cache.
  const activosForTotal = records.filter(
    (r) => r.type === "activo" && r.amount !== 0 && !r.isGroupParent,
  )

  // ── Auditor values ──────────────────────────────────────────────────────────
  const totalIngresos = calculateTotals(ingresos)
  const totalGastos = calculateTotals(gastos)

  // Multi-currency flujo (mode OFF)
  const flujoCajaCurrencies = activeCurrencies(totalIngresos).concat(
    activeCurrencies(totalGastos).filter(
      (c) => !activeCurrencies(totalIngresos).includes(c),
    ),
  )
  const flujoCaja = flujoCajaCurrencies.map((c) => ({
    currency: c,
    value: (totalIngresos[c] ?? 0) - (totalGastos[c] ?? 0),
  }))

  // Converted flujo (mode ON)
  const convertedIngresos = calculateTotalsConverted(ingresos, baseCurrency, exchangeRates)
  const convertedGastos = calculateTotalsConverted(gastos, baseCurrency, exchangeRates)
  const convertedFlujo = convertedIngresos - convertedGastos

  // ── Libertad Financiera ──────────────────────────────────────────────────────
  // La métrica central del formato CASHFLOW (Kiyosaki) en el que se basa este
  // dashboard: qué porción de tu gasto ya está cubierta por ingreso que viene
  // de activos (linkedTo -> un record type "activo", el mismo vínculo que ya
  // usa la columna "Activo" de la tabla Ingresos), no de tu trabajo. Ver
  // PRODUCT_REVIEW.md §3.1 — antes se calculaba implícitamente pero nunca se
  // mostraba en ningún lado.
  const activoIds = new Set(records.filter((r) => r.type === "activo").map((r) => r.id))
  const ingresosPasivos = ingresos.filter((r) => r.linkedTo && activoIds.has(r.linkedTo))
  const convertedIngresosPasivos = calculateTotalsConverted(ingresosPasivos, baseCurrency, exchangeRates)
  const libertadFinancieraPct =
    convertedGastos > 0 ? (convertedIngresosPasivos / convertedGastos) * 100 : null

  return (
    <div>
      {/* Estado de Resultados */}
      <div className="mb-6">
        <h2 className="mb-2 text-center text-xl font-bold italic">
          Estado de Resultados
        </h2>
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <SectionTable
              title="Ingresos"
              type="ingreso"
              records={ingresos}
              allRecords={records}
              loading={loading}
              valueLabel="Flujo de Caja"
              linkType="activo"
              linkLabel="Activo"
              readOnly={readOnly}
              flowGroups={ingresoGroups}
              onCreate={onCreate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            <SectionTable
              title="Gastos"
              type="gasto"
              records={gastos}
              allRecords={records}
              loading={loading}
              valueLabel="Monto"
              readOnly={readOnly}
              flowGroups={gastoGroups}
              onCreate={onCreate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>

          {/* Auditor */}
          <div className="h-fit w-full border-2 border-black lg:w-72">
            <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
              Auditor
            </div>
            {staleRates && (
              <div
                data-testid="stale-rates-warning"
                className="border-b-2 border-amber-500 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800"
              >
                Tipos de cambio actualizados {formatRatesAge(ratesLastUpdated)} — los totales
                convertidos de acá abajo pueden no reflejar la realidad. Actualizalos en
                Configuración.
              </div>
            )}
            <div className="space-y-4 p-3">
              {/* Libertad Financiera — % del gasto cubierto por ingreso de activos */}
              <div data-testid="libertad-financiera" className="border-2 border-black bg-gray-50 p-2">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-600">
                  Libertad Financiera
                </div>
                {loading ? (
                  <div className="mt-1 h-6 w-16 animate-pulse rounded bg-gray-200" />
                ) : libertadFinancieraPct === null ? (
                  <p className="mt-1 text-xs text-gray-400">
                    Sin gastos activos todavía — no hay contra qué medirlo.
                  </p>
                ) : (
                  <>
                    <div
                      className={`mt-1 text-2xl font-bold ${
                        libertadFinancieraPct >= 100 ? "text-emerald-700" : "text-black"
                      }`}
                    >
                      {libertadFinancieraPct.toFixed(0)}%
                    </div>
                    <div className="mt-1 h-2 w-full border border-black bg-white">
                      <div
                        className={`h-full ${libertadFinancieraPct >= 100 ? "bg-emerald-600" : "bg-black"}`}
                        style={{ width: `${Math.min(100, libertadFinancieraPct)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatAmount(convertedIngresosPasivos, baseCurrency)} {baseCurrency} de ingreso de
                      activos {" "}
                      {libertadFinancieraPct >= 100 ? "cubren y superan" : "cubren"} tu gasto total
                      {!convertCurrencies && (
                        <span className="text-gray-400"> (convertido a {baseCurrency} para poder comparar)</span>
                      )}
                    </p>
                  </>
                )}
              </div>

              {/* Total Ingresos */}
              <div>
                <div className="text-sm font-bold">Total Ingresos:</div>
                <div className="border-b border-black py-0.5 text-sm">
                  {convertCurrencies ? (
                    <span>
                      {formatAmount(convertedIngresos, baseCurrency)} {baseCurrency}
                    </span>
                  ) : (
                    <TotalsBlock records={ingresos} />
                  )}
                </div>
              </div>

              {/* Total Gastos */}
              <div>
                <div className="text-sm font-bold">Total Gastos:</div>
                <div className="border-b border-black py-0.5 text-sm">
                  {convertCurrencies ? (
                    <span>
                      {formatAmount(convertedGastos, baseCurrency)} {baseCurrency}
                    </span>
                  ) : (
                    <TotalsBlock records={gastos} />
                  )}
                </div>
              </div>

              {/* Flujo de Caja */}
              <div className="border-t-2 border-black pt-3">
                <div className="text-sm font-bold">Flujo de Caja Mensual:</div>
                <div className="border-b-2 border-black pb-1 text-sm font-bold">
                  {convertCurrencies ? (
                    <span
                      className={
                        convertedFlujo >= 0 ? "text-emerald-700" : "text-rose-700"
                      }
                    >
                      {convertedFlujo >= 0 ? "+" : ""}
                      {formatAmount(convertedFlujo, baseCurrency)} {baseCurrency}
                    </span>
                  ) : flujoCaja.length === 0 ? (
                    "—"
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {flujoCaja.map((f) => (
                        <span
                          key={f.currency}
                          className={
                            f.value >= 0 ? "text-emerald-700" : "text-rose-700"
                          }
                        >
                          {f.value >= 0 ? "+" : ""}
                          {formatAmount(f.value, f.currency)} {f.currency}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  (Ingresos - Gastos)
                  {convertCurrencies && (
                    <span className="ml-1 text-gray-400">≈ {baseCurrency}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BALANCE */}
      <div>
        <h2 className="mb-2 text-center text-xl font-bold">BALANCE</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <SectionTable
            title="Activos"
            type="activo"
            records={activos}
            allRecords={records}
            loading={loading}
            totalRecords={activosForTotal}
            valueLabel="Valor"
            readOnly={readOnly}
            onAddClick={onAddAsset}
            onCreate={onCreate}
            onEdit={onEdit}
            onDelete={onDelete}
            onGroupAdjust={onGroupAdjust}
            onBreakdown={onBreakdown}
            onDeleteWithComment={onDeleteWithComment}
            onEditAmountWithComment={onEditAmountWithComment}
          />
          <SectionTable
            title="Obligaciones"
            type="pasivo"
            records={pasivos}
            allRecords={records}
            // Esta tabla mezcla records (pasivos) con obligations (extraRows) —
            // dos fuentes independientes que cargan en paralelo; no se puede dar
            // por "lista" hasta que ambas resuelvan.
            loading={loading || obligationsLoading}
            valueLabel="Valor"
            readOnly={readOnly}
            extraRows={obligationExtraRows}
            onAddClick={onAddObligation}
            onCreate={onCreate}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  )
}
