"use client"

import { useState } from "react"
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
import { currencies, type Currency } from "@/lib/finance"
import { editOrVersionRecord } from "@/lib/versioning-actions"

interface EditOrVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: string
  recordType: "ingreso" | "gasto"
  initialName: string
  initialAmount: number
  initialCurrency: Currency
  onSaved: (newId: string) => void
}

type Mode = "edit" | "new-period"

export function EditOrVersionDialog({
  open,
  onOpenChange,
  recordId,
  recordType,
  initialName,
  initialAmount,
  initialCurrency,
  onSaved,
}: EditOrVersionDialogProps) {
  const [step, setStep] = useState<"mode" | "form">("mode")
  const [mode, setMode] = useState<Mode>("edit")
  const [name, setName] = useState(initialName)
  const [amount, setAmount] = useState(String(initialAmount))
  const [currency, setCurrency] = useState<Currency>(initialCurrency)
  const [effectiveDate, setEffectiveDate] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setStep("mode")
    setMode("edit")
    setName(initialName)
    setAmount(String(initialAmount))
    setCurrency(initialCurrency)
    setEffectiveDate("")
    setSaving(false)
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleSave = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    try {
      const result = await editOrVersionRecord(
        recordId,
        {
          name: name.trim(),
          amount: Number(amount),
          currency,
          effectiveDate: effectiveDate ? new Date(effectiveDate + "T12:00:00") : undefined,
        },
        mode,
        recordType,
      )
      onSaved(result.id)
      handleClose(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = recordType === "ingreso" ? "ingreso" : "gasto"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white capitalize">
            Editar {typeLabel}
          </DialogTitle>
        </DialogHeader>

        {step === "mode" ? (
          <>
            <div className="flex flex-col gap-3 px-4 py-4">
              <Label className="text-xs font-bold uppercase">¿Qué deseas hacer?</Label>
              {(
                [
                  [
                    "edit",
                    `Editar este ${typeLabel}`,
                    "Modifica el registro actual. El historial anterior se pierde.",
                  ],
                  [
                    "new-period",
                    "Crear nuevo período",
                    `Crea un nuevo ${typeLabel} activo y marca el actual como histórico.`,
                  ],
                ] as [Mode, string, string][]
              ).map(([value, label, desc]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded border-2 p-3 transition-colors ${
                    mode === value ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => handleClose(false)} className="border-2 border-black">
                Cancelar
              </Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={() => setStep("form")}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Nombre</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-2 border-black"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Monto</Label>
                  <NumericInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="0.00"
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
              {mode === "new-period" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">
                    Fecha efectiva <span className="font-normal text-gray-400">(opcional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="border-2 border-black"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setStep("mode")} className="border-2 border-black">
                Atrás
              </Button>
              <Button
                className="bg-black text-white hover:bg-gray-800"
                onClick={handleSave}
                disabled={saving || !name.trim() || !amount}
              >
                {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear nuevo período"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
