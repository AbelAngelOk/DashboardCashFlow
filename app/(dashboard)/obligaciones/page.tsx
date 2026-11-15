"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ChevronRight, ChevronDown, Network, X, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CardsSkeleton, TableRowsSkeleton } from "@/components/ui/loading-skeleton"
import { InfoTip } from "@/components/ui/info-tip"
import { useObligations } from "@/components/obligations-store"
import { ObligationFormDialog } from "@/components/obligations/obligation-form-dialog"
import { ObligationChartsSection } from "@/components/charts/obligation-charts"
import { MarkerPicker } from "@/components/markers/marker-picker"
import { loadEntityMarkersForIds } from "@/lib/marker-actions"
import {
  assignObligationsToGroup,
  createObligationGroup,
  removeObligationFromGroup,
  ungroupObligations,
} from "@/lib/obligation-actions"
import type { MarkerDefinition } from "@/lib/marker-types"
import {
  type Obligation,
  type ObligationStatus,
  OBLIGATION_TYPE_LABELS,
  OBLIGATION_STATUS_LABELS,
  computeRecurringBreakdown,
  formatObligationDate,
} from "@/lib/obligations"
import { formatAmount, convertAmount, NAME_MAX_LENGTH } from "@/lib/finance"
import type { Currency } from "@/lib/finance"
import { useSettings } from "@/components/settings-store"

const STATUS_FILTERS: { label: string; value: ObligationStatus | "ALL" }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Activas", value: "ACTIVE" },
  { label: "Pausadas", value: "PAUSED" },
  { label: "Completadas", value: "COMPLETED" },
  { label: "Canceladas", value: "CANCELLED" },
]

/** Valor de una obligación por moneda: costo anual si es recurrente, monto si no. */
function valueByCurrency(o: Obligation): Partial<Record<Currency, number>> {
  if (o.obligationType === "RECURRING") return computeRecurringBreakdown(o.rules)
  return { [o.currency]: o.amount }
}

function ValueLines({ values, recurring }: { values: Partial<Record<Currency, number>>; recurring: boolean }) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings
  const entries = Object.entries(values).filter(([, v]) => (v ?? 0) > 0) as [Currency, number][]
  if (entries.length === 0) return <span className="text-gray-400">{recurring ? "Sin reglas" : "—"}</span>

  if (convertCurrencies) {
    const total = entries.reduce(
      (s, [cur, val]) => s + convertAmount(val, cur, baseCurrency as Currency, exchangeRates),
      0,
    )
    return (
      <div className="flex flex-col items-end leading-tight">
        <span>{formatAmount(total, baseCurrency as Currency)} {baseCurrency}</span>
        {recurring && <span className="text-[10px] text-gray-400">anual</span>}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-end gap-0.5 leading-tight">
      {entries.map(([cur, val]) => (
        <span key={cur}>{formatAmount(val, cur)} {cur}</span>
      ))}
      {recurring && <span className="text-[10px] text-gray-400">anual</span>}
    </div>
  )
}

function sumValues(list: Obligation[]): Partial<Record<Currency, number>> {
  const acc: Partial<Record<Currency, number>> = {}
  for (const o of list) {
    for (const [cur, v] of Object.entries(valueByCurrency(o)) as [Currency, number][]) {
      acc[cur] = (acc[cur] ?? 0) + v
    }
  }
  return acc
}

const STATUS_COLORS: Record<ObligationStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-rose-100 text-rose-800",
}

type Entry =
  | { kind: "single"; obligation: Obligation }
  | { kind: "group"; groupId: string; name: string; members: Obligation[] }

/** Agrupa en el orden en que aparece el primer miembro de cada grupo. */
function buildEntries(list: Obligation[]): Entry[] {
  const entries: Entry[] = []
  const groups = new Map<string, Extract<Entry, { kind: "group" }>>()
  for (const o of list) {
    if (!o.groupId) {
      entries.push({ kind: "single", obligation: o })
      continue
    }
    let g = groups.get(o.groupId)
    if (!g) {
      g = { kind: "group", groupId: o.groupId, name: o.groupName ?? "Grupo", members: [] }
      groups.set(o.groupId, g)
      entries.push(g)
    }
    g.members.push(o)
  }
  return entries
}

export default function ObligacionesPage() {
  const { obligations, loading, reload } = useObligations()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<ObligationStatus | "ALL">("ALL")
  const [formOpen, setFormOpen] = useState(false)
  const [markerMap, setMarkerMap] = useState<Record<string, MarkerDefinition>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [groupName, setGroupName] = useState("")
  const [groupTarget, setGroupTarget] = useState<"new" | string>("new")

  const refreshMarkers = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const map = await loadEntityMarkersForIds(ids, "OBLIGATION")
      setMarkerMap(map)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    refreshMarkers(obligations.map((o) => o.id))
  }, [obligations, refreshMarkers])

  const filtered = filter === "ALL" ? obligations : obligations.filter((o) => o.status === filter)
  const entries = buildEntries(filtered)
  const existingGroups = buildEntries(obligations).filter(
    (e): e is Extract<Entry, { kind: "group" }> => e.kind === "group",
  )

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setGroupName("")
    setGroupTarget("new")
  }

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn()
      await reload()
    })

  const canGroup = groupTarget === "new" ? selectedIds.size >= 2 : selectedIds.size >= 1

  const handleGroupAction = () => {
    const ids = [...selectedIds]
    if (groupTarget === "new") {
      if (!groupName.trim()) return
      run(async () => {
        await createObligationGroup(groupName, ids)
        exitSelectMode()
      })
    } else {
      run(async () => {
        await assignObligationsToGroup(groupTarget, ids)
        exitSelectMode()
      })
    }
  }

  const SelectBox = ({ id }: { id: string }) => (
    <input
      type="checkbox"
      checked={selectedIds.has(id)}
      onChange={() => toggleSelect(id)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Seleccionar"
      className="h-4 w-4 shrink-0 accent-black"
    />
  )

  const renderDesktopRow = (o: Obligation, nested: boolean) => {
    const marker = markerMap[o.id] ?? null
    return (
      <div
        key={o.id}
        className={`group relative flex items-center border-b border-black text-sm hover:bg-gray-50 ${nested ? "bg-gray-50/50" : ""}`}
        style={marker ? { borderLeft: `4px solid ${marker.color}`, backgroundColor: `${marker.color}18` } : undefined}
      >
        {selectMode && <div className="pl-3"><SelectBox id={o.id} /></div>}
        <Link href={`/obligaciones/${o.id}`} className="flex min-w-0 flex-1 items-center">
          <div className={`flex min-w-0 flex-1 items-center gap-1 py-2 pr-3 font-medium ${nested ? "pl-9" : "pl-3"}`}>
            <span className="truncate" title={o.name}>{o.name}</span>
            {o.description && <InfoTip label={`Descripción de ${o.name}`}>{o.description}</InfoTip>}
          </div>
          <div className="w-28 px-3 py-2 text-xs text-gray-500">{OBLIGATION_TYPE_LABELS[o.obligationType]}</div>
          <div className="w-44 px-3 py-2 text-right">
            <ValueLines values={valueByCurrency(o)} recurring={o.obligationType === "RECURRING"} />
          </div>
          <div className="w-28 px-3 py-2 text-center text-xs text-gray-600">
            {o.nextDueDate ? formatObligationDate(o.nextDueDate) : "—"}
          </div>
          <div className="w-24 px-3 py-2 text-center">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[o.status]}`}>
              {OBLIGATION_STATUS_LABELS[o.status]}
            </span>
          </div>
        </Link>
        <div className="flex w-16 items-center justify-center gap-1 px-1 py-2 text-gray-400">
          {nested && !selectMode && (
            <button
              onClick={() => run(() => removeObligationFromGroup(o.id))}
              disabled={isPending}
              className="opacity-0 transition-opacity hover:text-black group-hover:opacity-100"
              title="Quitar del grupo"
              aria-label="Quitar del grupo"
            >
              <Unlink className="h-3.5 w-3.5" />
            </button>
          )}
          <MarkerPicker
            entityId={o.id}
            entityType="OBLIGATION"
            currentMarker={marker}
            onChanged={() => refreshMarkers(obligations.map((x) => x.id))}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="inline-block bg-black px-4 py-1 text-white">
          <span className="font-bold">Obligaciones</span>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <Button size="sm" variant="outline" className="gap-2 border-2 border-black text-xs" onClick={exitSelectMode}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-2 border-black text-xs"
                onClick={() => setSelectMode(true)}
              >
                <Network className="h-3.5 w-3.5" />
                Agrupar
              </Button>
              <Button size="sm" className="gap-2 bg-black text-white hover:bg-gray-800" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="mb-4 flex flex-col gap-3 border-2 border-black bg-gray-50 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-bold">{selectedIds.size} seleccionadas</span>
          <Select value={groupTarget} onValueChange={setGroupTarget}>
            <SelectTrigger className="h-8 w-full border-2 border-black text-xs focus:ring-0 sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new" className="text-xs">Crear nuevo grupo</SelectItem>
              {existingGroups.map((g) => (
                <SelectItem key={g.groupId} value={g.groupId} className="text-xs">
                  Agregar a: {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groupTarget === "new" && (
            <Input
              value={groupName}
              maxLength={NAME_MAX_LENGTH}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canGroup && handleGroupAction()}
              placeholder="Nombre del grupo..."
              className="h-8 w-full border-2 border-black focus-visible:ring-0 sm:w-48"
              autoFocus
            />
          )}
          <Button
            size="sm"
            className="w-full bg-black text-white hover:bg-gray-800 sm:w-auto"
            onClick={handleGroupAction}
            disabled={!canGroup || (groupTarget === "new" && !groupName.trim()) || isPending}
          >
            {isPending ? "Procesando..." : groupTarget === "new" ? "Crear grupo" : "Asignar al grupo"}
          </Button>
          {!canGroup && (
            <span className="text-xs text-gray-500">
              {groupTarget === "new" ? "Seleccioná al menos 2 obligaciones." : "Seleccioná al menos 1 obligación."}
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`border-2 border-black px-3 py-1 text-xs font-bold ${filter === value ? "bg-black text-white" : "hover:bg-gray-100"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading && <CardsSkeleton rows={3} />}

        {!loading && entries.map((e) => {
          const list = e.kind === "group" ? e.members : [e.obligation]
          return (
            <div key={e.kind === "group" ? e.groupId : e.obligation.id} className="flex flex-col gap-2">
              {e.kind === "group" && (
                <button
                  onClick={() => toggleExpanded(e.groupId)}
                  className="flex items-center justify-between border-2 border-black bg-gray-50 px-3 py-2 text-left"
                >
                  <span className="flex items-center gap-1 font-semibold">
                    {expanded.has(e.groupId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {e.name}
                    <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-normal text-gray-600">{e.members.length}</span>
                  </span>
                  <span className="text-sm"><ValueLines values={sumValues(e.members)} recurring={false} /></span>
                </button>
              )}
              {(e.kind === "single" || expanded.has(e.groupId)) && list.map((o) => {
                const marker = markerMap[o.id] ?? null
                return (
                  <div key={o.id} className={`flex items-start gap-2 ${e.kind === "group" ? "pl-4" : ""}`}>
                    {selectMode && <div className="pt-4"><SelectBox id={o.id} /></div>}
                    <Link
                      href={`/obligaciones/${o.id}`}
                      className="block flex-1 border-2 border-black p-4 hover:bg-gray-50 active:bg-gray-100"
                      style={marker ? { borderLeft: `4px solid ${marker.color}`, backgroundColor: `${marker.color}18` } : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate font-semibold leading-snug" title={o.name}>{o.name}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[o.status]}`}>
                          {OBLIGATION_STATUS_LABELS[o.status]}
                        </span>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <span className="text-xs text-gray-500">{OBLIGATION_TYPE_LABELS[o.obligationType]}</span>
                        <div className="text-right text-sm">
                          <ValueLines values={valueByCurrency(o)} recurring={o.obligationType === "RECURRING"} />
                        </div>
                      </div>
                      {o.nextDueDate && (
                        <div className="mt-1.5 text-xs text-gray-400">Próx. venc.: {formatObligationDate(o.nextDueDate)}</div>
                      )}
                    </Link>
                  </div>
                )
              })}
            </div>
          )
        })}

        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">
            {filter === "ALL"
              ? "No hay obligaciones. Creá la primera con el botón de arriba."
              : `No hay obligaciones con estado "${OBLIGATION_STATUS_LABELS[filter as ObligationStatus]}".`}
          </p>
        )}
      </div>

      {/* Desktop: table */}
      <div data-testid="obligations-table" className="hidden border-2 border-black md:block">
        <div className="flex bg-black text-xs font-bold text-white">
          {selectMode && <div className="w-7" />}
          <div className="flex-1 px-3 py-2">Nombre</div>
          <div className="w-28 px-3 py-2">Tipo</div>
          <div className="w-44 px-3 py-2 text-right">Valor</div>
          <div className="w-28 px-3 py-2 text-center">Próx. venc.</div>
          <div className="w-24 px-3 py-2 text-center">Estado</div>
          <div className="w-16 px-1 py-2" />
        </div>

        {loading && <TableRowsSkeleton rows={5} />}

        {!loading && entries.map((e) => {
          if (e.kind === "single") return renderDesktopRow(e.obligation, false)
          const isOpen = expanded.has(e.groupId)
          return (
            <div key={e.groupId} data-testid="obligation-group">
              <div className="group flex items-center border-b border-black bg-gray-50 text-sm font-semibold">
                {selectMode && <div className="w-7" />}
                <button
                  onClick={() => toggleExpanded(e.groupId)}
                  className="flex min-w-0 flex-1 items-center gap-1 px-3 py-2 text-left"
                  aria-label={isOpen ? "Colapsar grupo" : "Expandir grupo"}
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate" title={e.name}>{e.name}</span>
                  <Network className="h-3 w-3 shrink-0 text-gray-300" />
                  <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-normal text-gray-600">{e.members.length}</span>
                </button>
                <div className="w-28 px-3 py-2 text-xs font-normal text-gray-500">Grupo</div>
                <div className="w-44 px-3 py-2 text-right font-normal">
                  <ValueLines values={sumValues(e.members)} recurring={false} />
                </div>
                <div className="w-28 px-3 py-2" />
                <div className="w-24 px-3 py-2" />
                <div className="flex w-16 items-center justify-center px-1 py-2">
                  {!selectMode && (
                    <button
                      onClick={() => run(() => ungroupObligations(e.groupId))}
                      disabled={isPending}
                      className="text-gray-400 opacity-0 transition-opacity hover:text-black group-hover:opacity-100"
                      title="Desagrupar"
                      aria-label="Desagrupar"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {isOpen && e.members.map((o) => renderDesktopRow(o, true))}
            </div>
          )
        })}

        {!loading && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {filter === "ALL"
              ? "No hay obligaciones. Creá la primera con el botón de arriba."
              : `No hay obligaciones con estado "${OBLIGATION_STATUS_LABELS[filter as ObligationStatus]}".`}
          </div>
        )}
      </div>

      {!loading && obligations.length > 0 && <ObligationChartsSection obligations={obligations} />}

      <ObligationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(id) => {
          reload()
          router.push(`/obligaciones/${id}`)
        }}
      />
    </div>
  )
}
