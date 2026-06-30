"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { currencies } from "@/lib/finance"
import type { Currency } from "@/lib/finance"
import {
  type ObligationType,
  type RecurrenceType,
  OBLIGATION_TYPE_LABELS,
  RECURRENCE_TYPE_LABELS,
} from "@/lib/obligations"
import { createObligation, addObligationRule } from "@/lib/obligation-actions"

interface RuleDraft {
  id: string
  name: string
  recurrenceType: RecurrenceType
  startDate: string
  expectedAmount: string
  currency: Currency
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (id: string) => void
}

export function ObligationFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<"type" | "details">("type")
  const [obligationType, setObligationType] = useState<ObligationType>("RECURRING")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [saving, setSaving] = useState(false)

  // FIXED
  const [fixedAmount, setFixedAmount] = useState("")

  // INSTALLMENT
  const [installmentCount, setInstallmentCount] = useState("12")
  const [installmentAmount, setInstallmentAmount] = useState("")
  const [firstDueDate, setFirstDueDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })

  // RECURRING
  const [rules, setRules] = useState<RuleDraft[]>([
    {
      id: crypto.randomUUID(),
      name: "",
      recurrenceType: "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
      expectedAmount: "",
      currency: "ARS",
    },
  ])

  const reset = () => {
    setStep("type")
    setObligationType("RECURRING")
    setName("")
    setDescription("")
    setCurrency("ARS")
    setFixedAmount("")
    setInstallmentCount("12")
    setInstallmentAmount("")
    setFirstDueDate(() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      d.setDate(1)
      return d.toISOString().slice(0, 10)
    })
    setRules([{
      id: crypto.randomUUID(),
      name: "",
      recurrenceType: "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
      expectedAmount: "",
      currency: "ARS",
    }])
    setSaving(false)
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const id = await createObligation({
        name: name.trim(),
        description: description.trim() || undefined,
        obligationType,
        currency,
        ...(obligationType === "FIXED" && fixedAmount
          ? { fixedAmount: parseFloat(fixedAmount) }
          : {}),
        ...(obligationType === "INSTALLMENT"
          ? {
              installmentCount: parseInt(installmentCount),
              installmentAmount: parseFloat(installmentAmount),
              firstDueDate,
            }
          : {}),
      })

      if (obligationType === "RECURRING") {
        for (const rule of rules) {
          if (!rule.name.trim() || !rule.expectedAmount) continue
          await addObligationRule(id, {
            name: rule.name.trim(),
            recurrenceType: rule.recurrenceType,
            startDate: rule.startDate,
            expectedAmount: parseFloat(rule.expectedAmount),
            currency: rule.currency,
          })
        }
      }

      onCreated(id)
      handleClose(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const addRule = () =>
    setRules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        recurrenceType: "MONTHLY",
        startDate: new Date().toISOString().slice(0, 10),
        expectedAmount: "",
        currency: "ARS",
      },
    ])

  const updateRule = (id: string, field: keyof RuleDraft, value: string) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const removeRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id))

  const canSave =
    name.trim() &&
    (obligationType === "RECURRING"
      ? rules.some((r) => r.name.trim() && r.expectedAmount)
      : obligationType === "INSTALLMENT"
      ? installmentAmount && installmentCount && firstDueDate
      : fixedAmount)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Nueva obligación</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4" style={{ maxHeight: "70vh" }}>
          {step === "type" && (
            <div className="flex flex-col gap-3">
              <Label className="text-xs font-bold uppercase">Tipo de obligación</Label>
              <div className="flex flex-col gap-2">
                {(["RECURRING", "INSTALLMENT", "FIXED"] as ObligationType[]).map((t) => (
                  <label key={t} className={`flex cursor-pointer items-start gap-3 rounded border-2 p-3 transition-colors ${obligationType === t ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}>
                    <input
                      type="radio"
                      name="obligation-type"
                      value={t}
                      checked={obligationType === t}
                      onChange={() => setObligationType(t)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">{OBLIGATION_TYPE_LABELS[t]}</p>
                      <p className="text-xs text-gray-500">
                        {t === "RECURRING" && "Alquiler, servicios, gastos periódicos. Muestra costo anual proyectado."}
                        {t === "INSTALLMENT" && "Financiaciones, cuotas. Monto fijo dividido en N cuotas."}
                        {t === "FIXED" && "Préstamos, deudas de monto conocido. El saldo se reduce con cada pago."}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button className="bg-black text-white hover:bg-gray-800" onClick={() => setStep("details")}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="flex flex-col gap-4">
              {/* Common fields */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Nombre *</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Alquiler departamento"
                  className="border-2 border-black rounded-none focus-visible:ring-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Descripción <span className="font-normal text-gray-400">(opcional)</span></Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="resize-none rounded-none border-2 border-black focus-visible:ring-0"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Moneda principal</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger className="rounded-none border-2 border-black focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* FIXED fields */}
              {obligationType === "FIXED" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Monto pendiente inicial *</Label>
                  <NumericInput
                    value={fixedAmount}
                    onChange={setFixedAmount}
                    placeholder="0.00"
                    className="border-2 border-black rounded-none focus-visible:ring-0"
                  />
                </div>
              )}

              {/* INSTALLMENT fields */}
              {obligationType === "INSTALLMENT" && (
                <>
                  <div className="flex gap-3">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs font-bold uppercase">Cantidad de cuotas *</Label>
                      <Input
                        type="number"
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                        placeholder="12"
                        className="border-2 border-black rounded-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs font-bold uppercase">Monto por cuota *</Label>
                      <NumericInput
                        value={installmentAmount}
                        onChange={setInstallmentAmount}
                        placeholder="0.00"
                        className="border-2 border-black rounded-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-bold uppercase">Vencimiento primera cuota *</Label>
                    <Input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      className="border-2 border-black rounded-none focus-visible:ring-0"
                    />
                  </div>
                  {installmentCount && installmentAmount && (
                    <p className="text-xs text-gray-500">
                      Total: {parseInt(installmentCount) * parseFloat(installmentAmount || "0")} {currency}
                    </p>
                  )}
                </>
              )}

              {/* RECURRING: rules */}
              {obligationType === "RECURRING" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase">Reglas de gasto</Label>
                    <button
                      onClick={addRule}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-black"
                    >
                      <Plus className="h-3 w-3" /> Agregar regla
                    </button>
                  </div>
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="flex flex-col gap-2 rounded border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">Regla {idx + 1}</span>
                        {rules.length > 1 && (
                          <button onClick={() => removeRule(rule.id)} className="text-gray-400 hover:text-rose-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Input
                        value={rule.name}
                        onChange={(e) => updateRule(rule.id, "name", e.target.value)}
                        placeholder="Nombre (ej: Alquiler)"
                        className="h-8 border border-gray-300 rounded focus-visible:ring-0 text-sm"
                      />
                      <div className="flex gap-2">
                        <Select value={rule.recurrenceType} onValueChange={(v) => updateRule(rule.id, "recurrenceType", v)}>
                          <SelectTrigger className="h-8 flex-1 border border-gray-300 text-xs focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <NumericInput
                          value={rule.expectedAmount}
                          onChange={(v) => updateRule(rule.id, "expectedAmount", v)}
                          placeholder="Monto"
                          className="h-8 w-28 border border-gray-300 rounded focus-visible:ring-0 text-sm"
                        />
                        <Select value={rule.currency} onValueChange={(v) => updateRule(rule.id, "currency", v)}>
                          <SelectTrigger className="h-8 w-20 border border-gray-300 text-xs focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] font-semibold uppercase text-gray-400">Fecha inicio</Label>
                        <Input
                          type="date"
                          value={rule.startDate}
                          onChange={(e) => updateRule(rule.id, "startDate", e.target.value)}
                          className="h-8 border border-gray-300 rounded focus-visible:ring-0 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          {step === "details" && (
            <Button variant="outline" onClick={() => setStep("type")} className="border-2 border-black">
              Atrás
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)} className="border-2 border-black">
            Cancelar
          </Button>
          {step === "details" && (
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-black text-white hover:bg-gray-800"
            >
              {saving ? "Guardando..." : "Crear obligación"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
