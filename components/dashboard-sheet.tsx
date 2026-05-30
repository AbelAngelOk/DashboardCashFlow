"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "@/lib/finance"
import { useSettings } from "@/components/settings-store"

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

interface DashboardSheetProps {
  records: FinancialRecord[]
  readOnly?: boolean
  onCreate?: (record: FinancialRecord) => void
  onEdit?: (record: FinancialRecord, previous: FinancialRecord) => void
  onDelete?: (record: FinancialRecord) => void
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

// ── SectionTable ─────────────────────────────────────────────────────────────

interface SectionTableProps {
  title: string
  type: RecordType
  records: FinancialRecord[]
  allRecords: FinancialRecord[]
  valueLabel: string
  linkType?: RecordType
  linkLabel?: string
  readOnly: boolean
  onCreate?: (record: FinancialRecord) => void
  onEdit?: (record: FinancialRecord, previous: FinancialRecord) => void
  onDelete?: (record: FinancialRecord) => void
}

function SectionTable({
  title,
  type,
  records,
  allRecords,
  valueLabel,
  linkType,
  linkLabel,
  readOnly,
  onCreate,
  onEdit,
  onDelete,
}: SectionTableProps) {
  const [newRows, setNewRows] = useState<DraftRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DraftRow | null>(null)

  const linkOptions = linkType
    ? allRecords.filter((r) => r.type === linkType)
    : []

  const getLinkedName = (id?: string) => {
    if (!id) return "—"
    return allRecords.find((r) => r.id === id)?.name || "—"
  }

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
  }

  const saveEdit = (previous: FinancialRecord) => {
    if (!editDraft || !editDraft.name || !editDraft.amount) return
    onEdit?.(
      {
        id: previous.id,
        type,
        name: editDraft.name,
        amount: Number.parseFloat(editDraft.amount),
        currency: editDraft.currency,
        linkedTo:
          editDraft.linkedTo && editDraft.linkedTo !== "none"
            ? editDraft.linkedTo
            : undefined,
      },
      previous,
    )
    cancelEdit()
  }

  const hasLink = Boolean(linkType)

  return (
    <div className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
        <span className="font-bold italic text-white">{title}</span>
        {!readOnly && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
            onClick={addNewRow}
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
          <div className="w-24 border-r border-black px-2 py-1 text-center">
            {linkLabel}
          </div>
        )}
        {!readOnly && <div className="w-14 px-1 py-1 text-center">Acción</div>}
      </div>

      {/* Existing records */}
      {records.map((record) =>
        editingId === record.id && editDraft ? (
          <div key={record.id} className="flex border-b border-black text-sm">
            <div className="flex-1 border-r border-black px-1 py-0.5">
              <Input
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, name: e.target.value })
                }
                className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex w-36 items-center gap-1 border-r border-black px-1 py-0.5">
              <Input
                type="number"
                value={editDraft.amount}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, amount: e.target.value })
                }
                className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
              />
              <CurrencySelect
                value={editDraft.currency}
                onChange={(v) => setEditDraft({ ...editDraft, currency: v })}
              />
            </div>
            {hasLink && (
              <div className="flex w-24 items-center px-1 py-0.5">
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
            <div className="flex w-14 items-center justify-center gap-1 px-1">
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
        ) : (
          <div
            key={record.id}
            className="group flex border-b border-black text-sm"
          >
            <div className="flex-1 border-r border-black px-2 py-1">
              {record.name}
            </div>
            <div className="w-36 border-r border-black px-2 py-1 text-right">
              <RecordAmount record={record} />
            </div>
            {hasLink && (
              <div className="w-24 border-r border-black px-2 py-1 text-center text-xs text-gray-500">
                {getLinkedName(record.linkedTo)}
              </div>
            )}
            {!readOnly && (
              <div className="flex w-14 items-center justify-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(record)}
                  className="text-gray-500 hover:text-black"
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete?.(record)}
                  className="text-gray-500 hover:text-rose-700"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ),
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
              <Input
                type="number"
                placeholder="0.00"
                value={row.amount}
                onChange={(e) => updateNewRow(row.id, "amount", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveNewRow(row)}
                className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
              />
              <CurrencySelect
                value={row.currency}
                onChange={(v) => updateNewRow(row.id, "currency", v)}
              />
            </div>
            {hasLink && (
              <div className="flex w-24 items-center px-1 py-0.5">
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
            <div className="flex w-14 items-center justify-center gap-1 px-1">
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
          <TotalsBlock records={records} className="text-right" />
        </div>
      </div>
    </div>
  )
}

// ── DashboardSheet ────────────────────────────────────────────────────────────

export function DashboardSheet({
  records,
  readOnly = false,
  onCreate,
  onEdit,
  onDelete,
}: DashboardSheetProps) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings

  const ingresos = records.filter((r) => r.type === "ingreso")
  const gastos = records.filter((r) => r.type === "gasto")
  const activos = records.filter((r) => r.type === "activo")
  const pasivos = records.filter((r) => r.type === "pasivo")

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
              valueLabel="Flujo de Caja"
              readOnly={readOnly}
              onCreate={onCreate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            <SectionTable
              title="Gastos"
              type="gasto"
              records={gastos}
              allRecords={records}
              valueLabel="Monto"
              readOnly={readOnly}
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
            <div className="space-y-4 p-3">
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
            valueLabel="Valor"
            readOnly={readOnly}
            onCreate={onCreate}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <SectionTable
            title="Obligaciones"
            type="pasivo"
            records={pasivos}
            allRecords={records}
            valueLabel="Valor"
            readOnly={readOnly}
            onCreate={onCreate}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  )
}
