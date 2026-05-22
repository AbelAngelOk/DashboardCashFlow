"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  // Calculate balance per currency
  const calculateBalance = () => {
    const balanceByCurrency: Record<Currency, number> = {
      USD: 0,
      EUR: 0,
      MXN: 0,
      ARS: 0,
      USDT: 0,
    }

    ingresos.forEach((ingreso) => {
      balanceByCurrency[ingreso.currency] += ingreso.amount
    })

    gastos.forEach((gasto) => {
      balanceByCurrency[gasto.currency] -= gasto.amount
    })

    return balanceByCurrency
  }

  const balance = calculateBalance()

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
    })} ${currency}`
  }

  const getLinkedName = (linkedId: string) => {
    const linked = records.find((r) => r.id === linkedId)
    return linked?.name || ""
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">
            Cash Flow Dashboard
          </h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
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
                      <SelectItem value="USD">USD - Dólar</SelectItem>
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Activos */}
          <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay activos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {activos.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-lg bg-background p-3 shadow-sm"
                    >
                      <span className="font-medium">{record.name}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatAmount(record.amount, record.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pasivos */}
          <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20">
            <CardHeader>
              <CardTitle className="text-rose-700 dark:text-rose-400">
                Pasivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pasivos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay pasivos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {pasivos.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-lg bg-background p-3 shadow-sm"
                    >
                      <span className="font-medium">{record.name}</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatAmount(record.amount, record.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ingresos */}
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400">
                Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ingresos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay ingresos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {ingresos.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col rounded-lg bg-background p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{record.name}</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {formatAmount(record.amount, record.currency)}
                        </span>
                      </div>
                      {record.linkedTo && (
                        <span className="mt-1 text-xs text-muted-foreground">
                          Asignado a: {getLinkedName(record.linkedTo)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gastos */}
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-amber-700 dark:text-amber-400">
                Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gastos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay gastos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {gastos.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col rounded-lg bg-background p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{record.name}</span>
                        <span className="text-amber-600 dark:text-amber-400">
                          {formatAmount(record.amount, record.currency)}
                        </span>
                      </div>
                      {record.linkedTo && (
                        <span className="mt-1 text-xs text-muted-foreground">
                          Asignado a: {getLinkedName(record.linkedTo)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Balance */}
        <Card className="mt-6 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/20">
          <CardHeader>
            <CardTitle className="text-slate-700 dark:text-slate-300">
              Balance (Ingresos - Gastos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {(Object.keys(balance) as Currency[]).map((currency) => {
                const value = balance[currency]
                const hasActivity =
                  ingresos.some((i) => i.currency === currency) ||
                  gastos.some((g) => g.currency === currency)

                if (!hasActivity) return null

                return (
                  <div
                    key={currency}
                    className="flex flex-col items-center rounded-lg bg-background p-4 shadow-sm"
                  >
                    <span className="text-sm font-medium text-muted-foreground">
                      {currency}
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        value >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {value >= 0 ? "+" : ""}
                      {currencySymbols[currency]}
                      {Math.abs(value).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )
              })}
              {!ingresos.length && !gastos.length && (
                <p className="col-span-full text-sm text-muted-foreground">
                  No hay ingresos ni gastos registrados
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
