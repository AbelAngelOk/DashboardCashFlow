"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { currencies, type Currency } from "@/lib/finance"
import {
  AMOUNT_MODE_LABELS,
  RECURRENCE_TYPE_LABELS,
  SETTLEMENT_LABELS,
  type AmountMode,
  type IncomeRule,
  type RecurrenceType,
  type Settlement,
} from "@/lib/income-streams"
import { createIncomeRule, updateIncomeRule } from "@/lib/income-actions"

interface IncomeRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: string
  assetCurrency: Currency
  /** Si viene, el diálogo edita en vez de crear */
  rule?: IncomeRule | null
  onSaved: () => void
}

export function IncomeRuleDialog({
  open,
  onOpenChange,
  recordId,
  assetCurrency,
  rule,
  onSaved,
}: IncomeRuleDialogProps) {
  const [name, setName] = useState("")
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("MONTHLY")
  const [startDate, setStartDate] = useState("")
  const [expectedAmount, setExpectedAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>(assetCurrency)
  const [reducesPrincipal, setReducesPrincipal] = useState(false)
  const [amountMode, setAmountMode] = useState<AmountMode>("FIXED")
  const [percentage, setPercentage] = useState("")
  const [adjustmentPct, setAdjustmentPct] = useState("")
  const [adjustEveryN, setAdjustEveryN] = useState("")
  const [settlement, setSettlement] = useState<Settlement>("CASH")
  const [finite, setFinite] = useState(false)
  const [installmentCount, setInstallmentCount] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (rule) {
      setName(rule.name)
      setRecurrenceType(rule.recurrenceType)
      setStartDate(rule.startDate.slice(0, 10))
      setExpectedAmount(String(rule.expectedAmount))
      setCurrency(rule.currency)
      setReducesPrincipal(rule.reducesPrincipal)
      setAmountMode(rule.amountMode)
      setPercentage(rule.percentage != null ? String(rule.percentage) : "")
      setAdjustmentPct(rule.adjustmentPct != null ? String(rule.adjustmentPct) : "")
      setAdjustEveryN(rule.adjustEveryN != null ? String(rule.adjustEveryN) : "")
      setSettlement(rule.settlement)
      setFinite(rule.installmentCount != null)
      setInstallmentCount(rule.installmentCount != null ? String(rule.installmentCount) : "")
    } else {
      setName("")
      setRecurrenceType("MONTHLY")
      setStartDate(new Date().toISOString().slice(0, 10))
      setExpectedAmount("")
      setCurrency(assetCurrency)
      setReducesPrincipal(false)
      setAmountMode("FIXED")
      setPercentage("")
      setAdjustmentPct("")
      setAdjustEveryN("")
      setSettlement("CASH")
      setFinite(false)
      setInstallmentCount("")
    }
  }, [open, rule, assetCurrency])

  const isPct = amountMode === "PERCENTAGE"
  const amountOk = isPct ? Number(percentage) > 0 : Number(expectedAmount) > 0
  const finiteOk = !finite || Number(installmentCount) > 0
  const adjustOk =
    !adjustmentPct || Number(adjustEveryN) > 0
  const valid = name.trim() !== "" && startDate !== "" && amountOk && finiteOk && adjustOk

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        recurrenceType,
        startDate,
        expectedAmount: isPct ? 0 : Number(expectedAmount),
        currency,
        reducesPrincipal,
        amountMode,
        percentage: isPct ? Number(percentage) : undefined,
        adjustmentPct: !isPct && adjustmentPct ? Number(adjustmentPct) : undefined,
        adjustEveryN: !isPct && adjustmentPct ? Number(adjustEveryN) : undefined,
        settlement,
        installmentCount: finite ? Number(installmentCount) : undefined,
      }
      if (rule) {
        await updateIncomeRule(rule.id, data)
        toast({
          title: "Regla actualizada",
          description: "Los cobros pendientes que aún no llegaron al dashboard se regeneraron con el monto nuevo.",
        })
      } else {
        await createIncomeRule(recordId, data)
        toast({ title: "Ingreso recurrente creado", description: "Se generaron los próximos 12 meses." })
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar la regla",
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v) }}>
      <DialogContent data-testid="income-rule-dialog" className="max-w-md rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">
            {rule ? "Editar ingreso recurrente" : "Nuevo ingreso recurrente"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Sueldo, Capital, Interés"
              className="border-2 border-black"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Frecuencia</Label>
              <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}>
                <SelectTrigger className="border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Primer cobro</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-2 border-black"
              />
            </div>
          </div>

          {/* Modo de monto */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Cómo se calcula el monto</Label>
            <Select value={amountMode} onValueChange={(v) => setAmountMode(v as AmountMode)}>
              <SelectTrigger className="border-2 border-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(AMOUNT_MODE_LABELS) as [AmountMode, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isPct && (
              <p className="text-xs text-gray-500">
                Cada cobro se calcula sobre el valor del activo al generarse. Si el activo sube, el
                ingreso sube con él.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">
                {isPct ? "Porcentaje (%)" : "Monto esperado"}
              </Label>
              <NumericInput
                value={isPct ? percentage : expectedAmount}
                onChange={isPct ? setPercentage : setExpectedAmount}
                placeholder={isPct ? "5.00" : "0.00"}
                className="border-2 border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-24 border-2 border-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ajuste periódico — solo tiene sentido en monto fijo */}
          {!isPct && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Ajuste periódico (opcional)</Label>
              <div className="flex items-center gap-2">
                <NumericInput
                  value={adjustmentPct}
                  onChange={setAdjustmentPct}
                  placeholder="0"
                  className="w-24 border-2 border-black"
                />
                <span className="text-xs text-gray-500">% cada</span>
                <NumericInput
                  value={adjustEveryN}
                  onChange={setAdjustEveryN}
                  placeholder="3"
                  className="w-20 border-2 border-black"
                />
                <span className="text-xs text-gray-500">cobros</span>
              </div>
              <p className="text-xs text-gray-500">
                Aumento compuesto: con 10 % cada 3 cobros, los primeros tres van al monto base, los
                siguientes tres un 10 % arriba, y así. Para sueldos y alquileres ajustados por
                inflación.
              </p>
            </div>
          )}

          {/* Cronograma finito */}
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={finite}
                onChange={(e) => setFinite(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">Cantidad de cobros limitada</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Para préstamos y cobros en cuotas. Al agotarse, la regla se marca completada sola.
                </div>
              </div>
            </label>
            {finite && (
              <div className="flex items-center gap-2 pl-6">
                <NumericInput
                  value={installmentCount}
                  onChange={setInstallmentCount}
                  placeholder="12"
                  className="w-24 border-2 border-black"
                />
                <span className="text-xs text-gray-500">cuotas en total</span>
              </div>
            )}
          </div>

          {/* Liquidación */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Cómo se cobra</Label>
            <Select value={settlement} onValueChange={(v) => setSettlement(v as Settlement)}>
              <SelectTrigger className="border-2 border-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SETTLEMENT_LABELS) as [Settlement, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {settlement === "IN_KIND" && (
              <p className="text-xs text-gray-500">
                No entra efectivo: crece el propio activo. Para staking o dividendos reinvertidos.
                Contablemente se asienta contra activos, no contra caja.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 p-3 text-sm hover:border-gray-400">
            <input
              type="checkbox"
              checked={reducesPrincipal}
              onChange={(e) => setReducesPrincipal(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium">Descuenta del capital</div>
              <div className="mt-0.5 text-xs text-gray-500">
                Activalo para cuotas que devuelven capital (préstamos). El valor del activo baja con
                cada cobro y contablemente es conversión de activo, no ganancia. Dejalo apagado para
                sueldos, intereses y alquileres.
              </div>
            </div>
          </label>
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black" disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleSave}
            disabled={!valid || saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
