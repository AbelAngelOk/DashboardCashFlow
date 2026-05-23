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

  // Form states for each section
  const [ingresoForm, setIngresoForm] = useState({
    name: "",
    amount: "",
    currency: defaultCurrency,
    linkedTo: "",
  })
  const [gastoForm, setGastoForm] = useState({
    name: "",
    amount: "",
    currency: defaultCurrency,
    linkedTo: "",
  })
  const [activoForm, setActivoForm] = useState({
    name: "",
    amount: "",
    currency: defaultCurrency,
  })
  const [pasivoForm, setPasivoForm] = useState({
    name: "",
    amount: "",
    currency: defaultCurrency,
  })

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

  const addRecord = (type: RecordType, name: string, amount: string, currency: Currency, linkedTo?: string) => {
    if (!name || !amount) return false

    const newRecord: FinancialRecord = {
      id: crypto.randomUUID(),
      type,
      name,
      amount: parseFloat(amount),
      currency,
      linkedTo: linkedTo || undefined,
    }

    setRecords([...records, newRecord])
    return true
  }

  const handleAddIngreso = () => {
    if (addRecord("ingreso", ingresoForm.name, ingresoForm.amount, ingresoForm.currency, ingresoForm.linkedTo)) {
      setIngresoForm({ name: "", amount: "", currency: defaultCurrency, linkedTo: "" })
    }
  }

  const handleAddGasto = () => {
    if (addRecord("gasto", gastoForm.name, gastoForm.amount, gastoForm.currency, gastoForm.linkedTo)) {
      setGastoForm({ name: "", amount: "", currency: defaultCurrency, linkedTo: "" })
    }
  }

  const handleAddActivo = () => {
    if (addRecord("activo", activoForm.name, activoForm.amount, activoForm.currency)) {
      setActivoForm({ name: "", amount: "", currency: defaultCurrency })
    }
  }

  const handleAddPasivo = () => {
    if (addRecord("pasivo", pasivoForm.name, pasivoForm.amount, pasivoForm.currency)) {
      setPasivoForm({ name: "", amount: "", currency: defaultCurrency })
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
      <SelectTrigger className="h-7 w-20 border-black text-xs">
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
          <div className="bg-black px-4 py-1 text-white inline-block">
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
                <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                  Ingresos
                </div>
                <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
                  <div className="flex-1 border-r border-black px-2 py-1">
                    Descripcion
                  </div>
                  <div className="w-32 border-r border-black px-2 py-1 text-right">Flujo de Caja</div>
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
                {/* Input row for new ingreso */}
                <div className="flex border-b border-black bg-gray-50 text-sm">
                  <div className="flex flex-1 items-center gap-1 border-r border-black px-1 py-1">
                    <Input
                      placeholder="Nuevo ingreso..."
                      value={ingresoForm.name}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, name: e.target.value })}
                      className="h-7 border-black text-xs"
                    />
                  </div>
                  <div className="flex w-32 items-center gap-1 border-r border-black px-1 py-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={ingresoForm.amount}
                      onChange={(e) => setIngresoForm({ ...ingresoForm, amount: e.target.value })}
                      className="h-7 w-16 border-black text-xs"
                    />
                    <CurrencySelect
                      value={ingresoForm.currency}
                      onChange={(v) => setIngresoForm({ ...ingresoForm, currency: v })}
                    />
                  </div>
                  <div className="flex w-24 items-center gap-1 px-1 py-1">
                    {activos.length > 0 ? (
                      <Select
                        value={ingresoForm.linkedTo}
                        onValueChange={(v) => setIngresoForm({ ...ingresoForm, linkedTo: v })}
                      >
                        <SelectTrigger className="h-7 w-full border-black text-xs">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={handleAddIngreso}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Gastos */}
              <div className="mt-4 border-2 border-black">
                <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                  Gastos
                </div>
                <div className="flex border-b border-black bg-gray-100 text-sm font-bold">
                  <div className="flex-1 border-r border-black px-2 py-1">
                    Descripcion
                  </div>
                  <div className="w-32 border-r border-black px-2 py-1 text-right">Monto</div>
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
                {/* Input row for new gasto */}
                <div className="flex border-b border-black bg-gray-50 text-sm">
                  <div className="flex flex-1 items-center gap-1 border-r border-black px-1 py-1">
                    <Input
                      placeholder="Nuevo gasto..."
                      value={gastoForm.name}
                      onChange={(e) => setGastoForm({ ...gastoForm, name: e.target.value })}
                      className="h-7 border-black text-xs"
                    />
                  </div>
                  <div className="flex w-32 items-center gap-1 border-r border-black px-1 py-1">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={gastoForm.amount}
                      onChange={(e) => setGastoForm({ ...gastoForm, amount: e.target.value })}
                      className="h-7 w-16 border-black text-xs"
                    />
                    <CurrencySelect
                      value={gastoForm.currency}
                      onChange={(v) => setGastoForm({ ...gastoForm, currency: v })}
                    />
                  </div>
                  <div className="flex w-24 items-center gap-1 px-1 py-1">
                    {pasivos.length > 0 ? (
                      <Select
                        value={gastoForm.linkedTo}
                        onValueChange={(v) => setGastoForm({ ...gastoForm, linkedTo: v })}
                      >
                        <SelectTrigger className="h-7 w-full border-black text-xs">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={handleAddGasto}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
                    <div className="flex flex-wrap gap-2">
                      {formatFlujoCaja()}
                    </div>
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
              <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                Activos
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
              {/* Input row for new activo */}
              <div className="flex border-b border-black bg-gray-50 text-sm">
                <div className="flex flex-1 items-center gap-1 border-r border-black px-1 py-1">
                  <Input
                    placeholder="Nuevo activo..."
                    value={activoForm.name}
                    onChange={(e) => setActivoForm({ ...activoForm, name: e.target.value })}
                    className="h-7 border-black text-xs"
                  />
                </div>
                <div className="flex w-36 items-center gap-1 px-1 py-1">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={activoForm.amount}
                    onChange={(e) => setActivoForm({ ...activoForm, amount: e.target.value })}
                    className="h-7 w-16 border-black text-xs"
                  />
                  <CurrencySelect
                    value={activoForm.currency}
                    onChange={(v) => setActivoForm({ ...activoForm, currency: v })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleAddActivo}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
              <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                Obligaciones
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
              {/* Input row for new pasivo */}
              <div className="flex border-b border-black bg-gray-50 text-sm">
                <div className="flex flex-1 items-center gap-1 border-r border-black px-1 py-1">
                  <Input
                    placeholder="Nueva obligacion..."
                    value={pasivoForm.name}
                    onChange={(e) => setPasivoForm({ ...pasivoForm, name: e.target.value })}
                    className="h-7 border-black text-xs"
                  />
                </div>
                <div className="flex w-36 items-center gap-1 px-1 py-1">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={pasivoForm.amount}
                    onChange={(e) => setPasivoForm({ ...pasivoForm, amount: e.target.value })}
                    className="h-7 w-16 border-black text-xs"
                  />
                  <CurrencySelect
                    value={pasivoForm.currency}
                    onChange={(v) => setPasivoForm({ ...pasivoForm, currency: v })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleAddPasivo}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
