"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type RecordType = "activo" | "pasivo" | "ingreso" | "gasto"
type Currency = "USD" | "EUR" | "MXN" | "ARS" | "USDT"

interface FinancialRecord {
  id: string
  type: RecordType
  name: string
  amount: number
  currency: Currency
  linkedTo?: string
}

interface EditableRow {
  id: string
  name: string
  amount: string
  currency: Currency
  linkedTo: string
}

const currencySymbols: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  MXN: "$",
  ARS: "$",
  USDT: "₮",
}

const defaultCurrency: Currency = "USD"

export default function Home() {
  const [records, setRecords] = useState<FinancialRecord[]>([])

  // Editable rows for each section
  const [ingresoRows, setIngresoRows] = useState<EditableRow[]>([])
  const [gastoRows, setGastoRows] = useState<EditableRow[]>([])
  const [activoRows, setActivoRows] = useState<EditableRow[]>([])
  const [pasivoRows, setPasivoRows] = useState<EditableRow[]>([])

  const activos = records.filter((r) => r.type === "activo")
  const pasivos = records.filter((r) => r.type === "pasivo")
  const ingresos = records.filter((r) => r.type === "ingreso")
  const gastos = records.filter((r) => r.type === "gasto")

  // Calculate totals per currency
  const calculateTotals = (items: FinancialRecord[]) => {
    const totals: Record<Currency, number> = {
      USD: 0,
      EUR: 0,
      MXN: 0,
      ARS: 0,
      USDT: 0,
    }
    items.forEach((item) => {
      totals[item.currency] += item.amount
    })
    return totals
  }

  const totalIngresos = calculateTotals(ingresos)
  const totalGastos = calculateTotals(gastos)
  const totalActivos = calculateTotals(activos)
  const totalPasivos = calculateTotals(pasivos)

  // Calculate Flujo de Caja Mensual (Ingresos - Gastos)
  const flujoCaja: Record<Currency, number> = {
    USD: totalIngresos.USD - totalGastos.USD,
    EUR: totalIngresos.EUR - totalGastos.EUR,
    MXN: totalIngresos.MXN - totalGastos.MXN,
    ARS: totalIngresos.ARS - totalGastos.ARS,
    USDT: totalIngresos.USDT - totalGastos.USDT,
  }

  const createEmptyRow = (): EditableRow => ({
    id: crypto.randomUUID(),
    name: "",
    amount: "",
    currency: defaultCurrency,
    linkedTo: "",
  })

  const addNewRow = (type: RecordType) => {
    const newRow = createEmptyRow()
    switch (type) {
      case "ingreso":
        setIngresoRows([...ingresoRows, newRow])
        break
      case "gasto":
        setGastoRows([...gastoRows, newRow])
        break
      case "activo":
        setActivoRows([...activoRows, newRow])
        break
      case "pasivo":
        setPasivoRows([...pasivoRows, newRow])
        break
    }
  }

  const saveRow = (type: RecordType, row: EditableRow) => {
    if (!row.name || !row.amount) return

    const newRecord: FinancialRecord = {
      id: row.id,
      type,
      name: row.name,
      amount: parseFloat(row.amount),
      currency: row.currency,
      linkedTo: row.linkedTo && row.linkedTo !== "none" ? row.linkedTo : undefined,
    }

    setRecords([...records, newRecord])

    // Remove from editable rows
    switch (type) {
      case "ingreso":
        setIngresoRows(ingresoRows.filter((r) => r.id !== row.id))
        break
      case "gasto":
        setGastoRows(gastoRows.filter((r) => r.id !== row.id))
        break
      case "activo":
        setActivoRows(activoRows.filter((r) => r.id !== row.id))
        break
      case "pasivo":
        setPasivoRows(pasivoRows.filter((r) => r.id !== row.id))
        break
    }
  }

  const updateRow = (
    type: RecordType,
    rowId: string,
    field: keyof EditableRow,
    value: string
  ) => {
    const updateRows = (rows: EditableRow[]) =>
      rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))

    switch (type) {
      case "ingreso":
        setIngresoRows(updateRows(ingresoRows))
        break
      case "gasto":
        setGastoRows(updateRows(gastoRows))
        break
      case "activo":
        setActivoRows(updateRows(activoRows))
        break
      case "pasivo":
        setPasivoRows(updateRows(pasivoRows))
        break
    }
  }

  const formatAmount = (amount: number, currency: Currency) => {
    return `${currencySymbols[currency]}${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getLinkedName = (linkedId: string) => {
    const linked = records.find((r) => r.id === linkedId)
    return linked?.name || ""
  }

  const formatTotals = (totals: Record<Currency, number>) => {
    const activeCurrencies = (Object.keys(totals) as Currency[]).filter(
      (c) => totals[c] !== 0
    )
    if (activeCurrencies.length === 0) return "—"
    return activeCurrencies
      .map((c) => `${formatAmount(totals[c], c)} ${c}`)
      .join(" | ")
  }

  const formatFlujoCaja = () => {
    const activeCurrencies = (Object.keys(flujoCaja) as Currency[]).filter(
      (c) => totalIngresos[c] !== 0 || totalGastos[c] !== 0
    )
    if (activeCurrencies.length === 0) return "—"
    return activeCurrencies.map((c) => {
      const value = flujoCaja[c]
      const sign = value >= 0 ? "+" : ""
      return (
        <span
          key={c}
          className={value >= 0 ? "text-emerald-700" : "text-rose-700"}
        >
          {sign}
          {formatAmount(value, c)} {c}
        </span>
      )
    })
  }

  const CurrencySelect = ({
    value,
    onChange,
  }: {
    value: Currency
    onChange: (value: Currency) => void
  }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-6 w-16 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USD">USD</SelectItem>
        <SelectItem value="EUR">EUR</SelectItem>
        <SelectItem value="MXN">MXN</SelectItem>
        <SelectItem value="ARS">ARS</SelectItem>
        <SelectItem value="USDT">USDT</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <div className="min-h-screen bg-white p-4 font-sans text-black">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4 border-b-2 border-black pb-2">
          <div className="inline-block bg-black px-4 py-1 text-white">
            <span className="font-bold">Cash Flow Dashboard</span>
          </div>
        </div>

        {/* Estado de Resultados */}
        <div className="mb-6">
          <h2 className="mb-2 text-center text-xl font-bold italic">
            Estado de Resultados
          </h2>
          <div className="flex gap-4">
            {/* Left Side - Ingresos y Gastos */}
            <div className="flex-1">
              {/* Ingresos */}
              <div className="border-2 border-black">
                <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
                  <span className="font-bold italic text-white">Ingresos</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-white hover:bg-white/20"
                    onClick={() => addNewRow("ingreso")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
                  <div className="flex-1 border-r border-black px-2 py-1">
                    Descripcion
                  </div>
                  <div className="w-32 border-r border-black px-2 py-1 text-right">
                    Flujo de Caja
                  </div>
                  <div className="w-24 px-2 py-1 text-center">Activo</div>
                </div>
                {ingresos.map((record) => (
                  <div
                    key={record.id}
                    className="flex border-b border-black text-sm"
                  >
                    <div className="flex-1 border-r border-black px-2 py-1">
                      {record.name}
                    </div>
                    <div className="w-32 border-r border-black px-2 py-1 text-right">
                      {formatAmount(record.amount, record.currency)}{" "}
                      {record.currency}
                    </div>
                    <div className="w-24 px-2 py-1 text-center text-xs text-gray-500">
                      {record.linkedTo ? getLinkedName(record.linkedTo) : "—"}
                    </div>
                  </div>
                ))}
                {/* Editable rows */}
                {ingresoRows.map((row) => (
                  <div key={row.id} className="flex border-b border-black text-sm">
                    <div className="flex-1 border-r border-black px-1 py-0.5">
                      <Input
                        placeholder="Descripcion..."
                        value={row.name}
                        onChange={(e) =>
                          updateRow("ingreso", row.id, "name", e.target.value)
                        }
                        onKeyDown={(e) => e.key === "Enter" && saveRow("ingreso", row)}
                        className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex w-32 items-center gap-1 border-r border-black px-1 py-0.5">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={row.amount}
                        onChange={(e) =>
                          updateRow("ingreso", row.id, "amount", e.target.value)
                        }
                        onKeyDown={(e) => e.key === "Enter" && saveRow("ingreso", row)}
                        className="h-6 w-14 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
                      />
                      <CurrencySelect
                        value={row.currency}
                        onChange={(v) => updateRow("ingreso", row.id, "currency", v)}
                      />
                    </div>
                    <div className="flex w-24 items-center px-1 py-0.5">
                      {activos.length > 0 ? (
                        <Select
                          value={row.linkedTo}
                          onValueChange={(v) =>
                            updateRow("ingreso", row.id, "linkedTo", v)
                          }
                        >
                          <SelectTrigger className="h-6 w-full border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {activos.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Gastos */}
              <div className="mt-4 border-2 border-black">
                <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
                  <span className="font-bold italic text-white">Gastos</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-white hover:bg-white/20"
                    onClick={() => addNewRow("gasto")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
                  <div className="flex-1 border-r border-black px-2 py-1">
                    Descripcion
                  </div>
                  <div className="w-32 border-r border-black px-2 py-1 text-right">
                    Monto
                  </div>
                  <div className="w-24 px-2 py-1 text-center">Pasivo</div>
                </div>
                {gastos.map((record) => (
                  <div
                    key={record.id}
                    className="flex border-b border-black text-sm"
                  >
                    <div className="flex-1 border-r border-black px-2 py-1">
                      {record.name}
                    </div>
                    <div className="w-32 border-r border-black px-2 py-1 text-right">
                      {formatAmount(record.amount, record.currency)}{" "}
                      {record.currency}
                    </div>
                    <div className="w-24 px-2 py-1 text-center text-xs text-gray-500">
                      {record.linkedTo ? getLinkedName(record.linkedTo) : "—"}
                    </div>
                  </div>
                ))}
                {/* Editable rows */}
                {gastoRows.map((row) => (
                  <div key={row.id} className="flex border-b border-black text-sm">
                    <div className="flex-1 border-r border-black px-1 py-0.5">
                      <Input
                        placeholder="Descripcion..."
                        value={row.name}
                        onChange={(e) =>
                          updateRow("gasto", row.id, "name", e.target.value)
                        }
                        onKeyDown={(e) => e.key === "Enter" && saveRow("gasto", row)}
                        className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex w-32 items-center gap-1 border-r border-black px-1 py-0.5">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={row.amount}
                        onChange={(e) =>
                          updateRow("gasto", row.id, "amount", e.target.value)
                        }
                        onKeyDown={(e) => e.key === "Enter" && saveRow("gasto", row)}
                        className="h-6 w-14 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
                      />
                      <CurrencySelect
                        value={row.currency}
                        onChange={(v) => updateRow("gasto", row.id, "currency", v)}
                      />
                    </div>
                    <div className="flex w-24 items-center px-1 py-0.5">
                      {pasivos.length > 0 ? (
                        <Select
                          value={row.linkedTo}
                          onValueChange={(v) =>
                            updateRow("gasto", row.id, "linkedTo", v)
                          }
                        >
                          <SelectTrigger className="h-6 w-full border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {pasivos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side - Auditor */}
            <div className="w-72 border-2 border-black">
              <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                Auditor
              </div>
              <div className="space-y-4 p-3">
                <div>
                  <div className="text-sm font-bold">Total Ingresos:</div>
                  <div className="border-b border-black text-sm">
                    {formatTotals(totalIngresos)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold">Total Gastos:</div>
                  <div className="border-b border-black text-sm">
                    {formatTotals(totalGastos)}
                  </div>
                </div>
                <div className="border-t-2 border-black pt-3">
                  <div className="text-sm font-bold">Flujo de Caja Mensual:</div>
                  <div className="border-b-2 border-black text-sm font-bold">
                    <div className="flex flex-wrap gap-2">{formatFlujoCaja()}</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    (Ingresos - Gastos)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BALANCE */}
        <div>
          <h2 className="mb-2 text-center text-xl font-bold">BALANCE</h2>
          <div className="flex">
            {/* Activos */}
            <div className="flex-1 border-2 border-black">
              <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
                <span className="font-bold italic text-white">Activos</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={() => addNewRow("activo")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  Descripcion
                </div>
                <div className="w-36 px-2 py-1 text-right">Valor</div>
              </div>
              {activos.map((record) => (
                <div
                  key={record.id}
                  className="flex border-b border-black text-sm"
                >
                  <div className="flex-1 border-r border-black px-2 py-1">
                    {record.name}
                  </div>
                  <div className="w-36 px-2 py-1 text-right">
                    {formatAmount(record.amount, record.currency)}{" "}
                    {record.currency}
                  </div>
                </div>
              ))}
              {/* Editable rows */}
              {activoRows.map((row) => (
                <div key={row.id} className="flex border-b border-black text-sm">
                  <div className="flex-1 border-r border-black px-1 py-0.5">
                    <Input
                      placeholder="Descripcion..."
                      value={row.name}
                      onChange={(e) =>
                        updateRow("activo", row.id, "name", e.target.value)
                      }
                      onKeyDown={(e) => e.key === "Enter" && saveRow("activo", row)}
                      className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex w-36 items-center gap-1 px-1 py-0.5">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow("activo", row.id, "amount", e.target.value)
                      }
                      onKeyDown={(e) => e.key === "Enter" && saveRow("activo", row)}
                      className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
                    />
                    <CurrencySelect
                      value={row.currency}
                      onChange={(v) => updateRow("activo", row.id, "currency", v)}
                    />
                  </div>
                </div>
              ))}
              <div className="flex border-t-2 border-black bg-gray-100 text-sm font-bold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  Total Activos:
                </div>
                <div className="w-36 px-2 py-1 text-right">
                  {formatTotals(totalActivos)}
                </div>
              </div>
            </div>

            {/* Obligaciones (Pasivos) */}
            <div className="flex-1 border-2 border-l-0 border-black">
              <div className="flex items-center justify-between border-b-2 border-black bg-black px-2 py-1">
                <span className="font-bold italic text-white">Obligaciones</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={() => addNewRow("pasivo")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  Descripcion
                </div>
                <div className="w-36 px-2 py-1 text-right">Valor</div>
              </div>
              {pasivos.map((record) => (
                <div
                  key={record.id}
                  className="flex border-b border-black text-sm"
                >
                  <div className="flex-1 border-r border-black px-2 py-1">
                    {record.name}
                  </div>
                  <div className="w-36 px-2 py-1 text-right">
                    {formatAmount(record.amount, record.currency)}{" "}
                    {record.currency}
                  </div>
                </div>
              ))}
              {/* Editable rows */}
              {pasivoRows.map((row) => (
                <div key={row.id} className="flex border-b border-black text-sm">
                  <div className="flex-1 border-r border-black px-1 py-0.5">
                    <Input
                      placeholder="Descripcion..."
                      value={row.name}
                      onChange={(e) =>
                        updateRow("pasivo", row.id, "name", e.target.value)
                      }
                      onKeyDown={(e) => e.key === "Enter" && saveRow("pasivo", row)}
                      className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex w-36 items-center gap-1 px-1 py-0.5">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow("pasivo", row.id, "amount", e.target.value)
                      }
                      onKeyDown={(e) => e.key === "Enter" && saveRow("pasivo", row)}
                      className="h-6 w-16 border-0 bg-transparent p-0 text-right text-sm shadow-none focus-visible:ring-0"
                    />
                    <CurrencySelect
                      value={row.currency}
                      onChange={(v) => updateRow("pasivo", row.id, "currency", v)}
                    />
                  </div>
                </div>
              ))}
              <div className="flex border-t-2 border-black bg-gray-100 text-sm font-bold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  Total Obligaciones:
                </div>
                <div className="w-36 px-2 py-1 text-right">
                  {formatTotals(totalPasivos)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
