"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export default function Home() {
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    type: "" as RecordType | "",
    name: "",
    amount: "",
    currency: "USD" as Currency,
    linkedTo: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.type || !formData.name || !formData.amount) return

    const newRecord: FinancialRecord = {
      id: crypto.randomUUID(),
      type: formData.type as RecordType,
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      linkedTo: formData.linkedTo || undefined,
    }

    setRecords([...records, newRecord])
    setFormData({
      type: "",
      name: "",
      amount: "",
      currency: "USD",
      linkedTo: "",
    })
    setIsDialogOpen(false)
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

  return (
    <div className="min-h-screen bg-white p-4 font-sans text-black">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
          <div className="flex items-center gap-4">
            <div className="bg-black px-4 py-1 text-white">
              <span className="font-bold">Cash Flow Dashboard</span>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-2 border-black">
                <Plus className="mr-2 h-4 w-4" />
                Crear Registro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nuevo Registro</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: RecordType) =>
                      setFormData({ ...formData, type: value, linkedTo: "" })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="pasivo">Pasivo</SelectItem>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="gasto">Gasto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Nombre del registro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value: Currency) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - Dolar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                      <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                      <SelectItem value="USDT">USDT - Tether</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "ingreso" && activos.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="linkedActivo">Asignar a Activo</Label>
                    <Select
                      value={formData.linkedTo}
                      onValueChange={(value) =>
                        setFormData({ ...formData, linkedTo: value })
                      }
                    >
                      <SelectTrigger id="linkedActivo">
                        <SelectValue placeholder="Seleccionar activo" />
                      </SelectTrigger>
                      <SelectContent>
                        {activos.map((activo) => (
                          <SelectItem key={activo.id} value={activo.id}>
                            {activo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.type === "gasto" && pasivos.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="linkedPasivo">Asignar a Pasivo</Label>
                    <Select
                      value={formData.linkedTo}
                      onValueChange={(value) =>
                        setFormData({ ...formData, linkedTo: value })
                      }
                    >
                      <SelectTrigger id="linkedPasivo">
                        <SelectValue placeholder="Seleccionar pasivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {pasivos.map((pasivo) => (
                          <SelectItem key={pasivo.id} value={pasivo.id}>
                            {pasivo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button type="submit" className="w-full">
                  Crear
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
                  <div className="w-32 px-2 py-1 text-right">Flujo de Caja</div>
                </div>
                {ingresos.length === 0 ? (
                  <div className="flex border-b border-black text-sm">
                    <div className="flex-1 border-r border-black px-2 py-1 text-gray-400">
                      Sin ingresos
                    </div>
                    <div className="w-32 px-2 py-1 text-right">—</div>
                  </div>
                ) : (
                  ingresos.map((record) => (
                    <div
                      key={record.id}
                      className="flex border-b border-black text-sm"
                    >
                      <div className="flex-1 border-r border-black px-2 py-1">
                        {record.name}
                        {record.linkedTo && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({getLinkedName(record.linkedTo)})
                          </span>
                        )}
                      </div>
                      <div className="w-32 px-2 py-1 text-right">
                        {formatAmount(record.amount, record.currency)}{" "}
                        {record.currency}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Gastos */}
              <div className="mt-4 border-2 border-black">
                <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                  Gastos
                </div>
                {gastos.length === 0 ? (
                  <div className="flex border-b border-black text-sm">
                    <div className="flex-1 border-r border-black px-2 py-1 text-gray-400">
                      Sin gastos
                    </div>
                    <div className="w-32 px-2 py-1 text-right">—</div>
                  </div>
                ) : (
                  gastos.map((record) => (
                    <div
                      key={record.id}
                      className="flex border-b border-black text-sm"
                    >
                      <div className="flex-1 border-r border-black px-2 py-1">
                        {record.name}
                        {record.linkedTo && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({getLinkedName(record.linkedTo)})
                          </span>
                        )}
                      </div>
                      <div className="w-32 px-2 py-1 text-right">
                        {formatAmount(record.amount, record.currency)}{" "}
                        {record.currency}
                      </div>
                    </div>
                  ))
                )}
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
              {activos.length === 0 ? (
                <div className="flex border-b border-black text-sm">
                  <div className="flex-1 px-2 py-1 text-gray-400">
                    Sin activos
                  </div>
                  <div className="w-32 px-2 py-1 text-right">—</div>
                </div>
              ) : (
                activos.map((record) => (
                  <div
                    key={record.id}
                    className="flex border-b border-black text-sm"
                  >
                    <div className="flex-1 border-r border-black px-2 py-1">
                      {record.name}
                    </div>
                    <div className="w-32 px-2 py-1 text-right">
                      {formatAmount(record.amount, record.currency)}{" "}
                      {record.currency}
                    </div>
                  </div>
                ))
              )}
              <div className="flex border-t-2 border-black bg-gray-100 text-sm font-bold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  Total Activos:
                </div>
                <div className="w-32 px-2 py-1 text-right">
                  {formatTotals(totalActivos)}
                </div>
              </div>
            </div>

            {/* Obligaciones (Pasivos) */}
            <div className="flex-1 border-2 border-l-0 border-black">
              <div className="border-b-2 border-black bg-black px-2 py-1 text-center font-bold italic text-white">
                Obligaciones
              </div>
              {pasivos.length === 0 ? (
                <div className="flex border-b border-black text-sm">
                  <div className="flex-1 px-2 py-1 text-gray-400">
                    Sin obligaciones
                  </div>
                  <div className="w-32 px-2 py-1 text-right">—</div>
                </div>
              ) : (
                pasivos.map((record) => (
                  <div
                    key={record.id}
                    className="flex border-b border-black text-sm"
                  >
                    <div className="flex-1 border-r border-black px-2 py-1">
                      {record.name}
                    </div>
                    <div className="w-32 px-2 py-1 text-right">
                      {formatAmount(record.amount, record.currency)}{" "}
                      {record.currency}
                    </div>
                  </div>
                ))
              )}
              <div className="flex border-t-2 border-black bg-gray-100 text-sm font-bold">
                <div className="flex-1 border-r border-black px-2 py-1">
                  Total Obligaciones:
                </div>
                <div className="w-32 px-2 py-1 text-right">
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
