"use client"

import { useEffect, useState } from "react"
import { History, X, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { recordTypeLabels, type Movement } from "@/lib/finance"
import { useHistorialFilters } from "@/hooks/use-historial-filters"
import { usePagination, PAGE_SIZES, type PageSize } from "@/hooks/use-pagination"
import { useHistorialQuery } from "@/hooks/use-historial-query"

const ACTION_LABELS = {
  creado: "Creado",
  editado: "Editado",
  eliminado: "Eliminado",
} as const

const actionStyles: Record<string, string> = {
  creado: "bg-emerald-100 text-emerald-800",
  editado: "bg-amber-100 text-amber-800",
  eliminado: "bg-rose-100 text-rose-800",
}

// ── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel() {
  const { filters, setFilter, clearFilters, isFiltered } = useHistorialFilters()

  // Debounce text search to avoid URL update on every keystroke
  const [searchInput, setSearchInput] = useState(filters.search)
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])
  useEffect(() => {
    const t = setTimeout(() => setFilter("search", searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {/* Text search */}
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar en nombre o detalle..."
            className="h-9 pl-8 text-sm"
          />
        </div>

        {/* Action filter */}
        <Select
          value={filters.action || "all"}
          onValueChange={(v) => setFilter("action", v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            <SelectItem value="creado">Creado</SelectItem>
            <SelectItem value="editado">Editado</SelectItem>
            <SelectItem value="eliminado">Eliminado</SelectItem>
          </SelectContent>
        </Select>

        {/* Category (recordType) filter */}
        <Select
          value={filters.recordType || "all"}
          onValueChange={(v) => setFilter("recordType", v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(Object.entries(recordTypeLabels) as [string, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Desde
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter("dateFrom", e.target.value)}
            className="h-9 rounded-md border-2 border-black bg-white px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Hasta
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter("dateTo", e.target.value)}
            className="h-9 rounded-md border-2 border-black bg-white px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Clear */}
        {isFiltered && (
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-9 w-full gap-1.5 border-2 border-black text-xs font-semibold"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pagination controls ───────────────────────────────────────────────────────

function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: PageSize) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-xs text-gray-500">
        {total === 0
          ? "Sin resultados"
          : `Mostrando ${from}–${to} de ${total} registros`}
      </p>

      <div className="flex items-center gap-2">
        {/* Page size selector */}
        <div className="flex items-center gap-1">
          {PAGE_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => onPageSizeChange(s)}
              className={cn(
                "rounded px-2 py-1 text-xs font-semibold transition-colors",
                pageSize === s
                  ? "bg-black text-white"
                  : "text-gray-500 hover:bg-gray-100",
              )}
            >
              {s}
            </button>
          ))}
          <span className="ml-1 text-xs text-gray-400">por pág.</span>
        </div>

        {/* Previous / page indicator / next */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-2 border-black"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[5rem] text-center text-xs font-semibold">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-2 border-black"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Movement card ─────────────────────────────────────────────────────────────

function MovementCard({
  movement,
  onCommentChange,
}: {
  movement: Movement
  onCommentChange: (id: string, comment: string) => void
}) {
  return (
    <li className="rounded-lg border-2 border-black p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-bold uppercase",
            actionStyles[movement.action],
          )}
        >
          {ACTION_LABELS[movement.action] ?? movement.action}
        </span>
        <span className="text-xs font-semibold uppercase text-gray-500">
          {recordTypeLabels[movement.recordType]}
        </span>
        <span className="ml-auto text-xs text-gray-500">{movement.date}</span>
      </div>
      <p className="mt-2 text-sm">{movement.detail}</p>
      <Input
        value={movement.comment}
        onChange={(e) => onCommentChange(movement.id, e.target.value)}
        placeholder="Agregar comentario (opcional)..."
        className="mt-2 h-8 text-sm"
      />
    </li>
  )
}

// ── Main content ──────────────────────────────────────────────────────────────

export function HistorialContent() {
  const { filters, isFiltered } = useHistorialFilters()
  const { page, pageSize, setPage, setPageSize } = usePagination()
  const { items, total, loading, updateLocalComment } = useHistorialQuery(
    filters,
    page,
    pageSize,
  )

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <History className="h-5 w-5" />
        <span className="text-lg font-bold">Historial</span>
      </div>

      {/* Filters */}
      <FilterPanel />

      {/* Results */}
      <div className={cn("transition-opacity duration-150", loading && "opacity-50")}>
        {!loading && items.length === 0 ? (
          <div className="rounded-lg border-2 border-black p-8 text-center">
            <p className="text-sm font-semibold text-gray-500">
              {isFiltered
                ? "No hay registros que coincidan con los filtros aplicados."
                : "Aún no hay movimientos registrados. Crea, edita o elimina un registro para verlo aquí."}
            </p>
            {isFiltered && (
              <p className="mt-1 text-xs text-gray-400">
                Probá ajustar o limpiar los filtros.
              </p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((m) => (
              <MovementCard
                key={m.id}
                movement={m}
                onCommentChange={updateLocalComment}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {(total > 0 || loading) && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}
