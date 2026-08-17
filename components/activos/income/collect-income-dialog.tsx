"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { toast } from "@/components/ui/use-toast"
import { formatAmount } from "@/lib/finance"
import type { IncomeOccurrence } from "@/lib/income-streams"
import { collectIncomeOccurrence } from "@/lib/income-actions"

interface CollectIncomeDialogProps {
  occurrence: IncomeOccurrence | null
  onOpenChange: (open: boolean) => void
  /** Capital actual del activo, para avisar cuando el cobro lo supera */
  assetAmount: number
  onCollected: () => void
}

export function CollectIncomeDialog({
  occurrence,
  onOpenChange,
  assetAmount,
  onCollected,
}: CollectIncomeDialogProps) {
  const [amount, setAmount] = useState("")
  const [quantity, setQuantity] = useState("")
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (occurrence) {
      setAmount(String(occurrence.expectedAmount))
      setQuantity("")
      setComment("")
    }
  }, [occurrence])

  if (!occurrence) return null

  const value = Number(amount)
  const valid = value > 0
  const diff = value - occurrence.expectedAmount
  const exceedsPrincipal = occurrence.reducesPrincipal && value > assetAmount
  const inKind = occurrence.settlement === "IN_KIND"

  const handleCollect = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await collectIncomeOccurrence(
        occurrence.id,
        value,
        comment.trim() || undefined,
        inKind && Number(quantity) > 0 ? Number(quantity) : undefined,
      )
      toast({
        title: "Cobro registrado",
        description: `${occurrence.ruleName}: ${formatAmount(value, occurrence.currency)} ${occurrence.currency}`,
      })
      onOpenChange(false)
      onCollected()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar el cobro",
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!occurrence} onOpenChange={(v) => { if (!saving) onOpenChange(v) }}>
      <DialogContent data-testid="income-collect-dialog" className="max-w-md rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">
            Confirmar cobro — {occurrence.ruleName}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-300">
            Esperado: {formatAmount(occurrence.expectedAmount, occurrence.currency)}{" "}
            {occurrence.currency} · {new Date(occurrence.expectedDate).toLocaleDateString("es-AR")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Monto realmente cobrado</Label>
            <NumericInput
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              className="border-2 border-black"
            />
            {Math.abs(diff) > 0.001 && (
              <p className="text-xs text-gray-600">
                {diff > 0 ? "+" : ""}
                {formatAmount(diff, occurrence.currency)} respecto de lo esperado
              </p>
            )}
          </div>

          {inKind && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Unidades recibidas (opcional)</Label>
                <NumericInput
                  value={quantity}
                  onChange={setQuantity}
                  placeholder="0.00000000"
                  className="border-2 border-black"
                />
              </div>
              <div className="border-2 border-black bg-gray-50 p-3 text-xs">
                <p className="font-bold uppercase">Cobro en especie</p>
                <p className="mt-1 text-gray-600">
                  No entra efectivo. El valor del activo sube de{" "}
                  {formatAmount(assetAmount, occurrence.currency)} a{" "}
                  {formatAmount(assetAmount + (valid ? value : 0), occurrence.currency)}, y las
                  unidades se suman a la cantidad del activo.
                </p>
              </div>
            </>
          )}

          {occurrence.reducesPrincipal && (
            <div className="border-2 border-black bg-gray-50 p-3 text-xs">
              <p className="font-bold uppercase">Descuenta del capital</p>
              <p className="mt-1 text-gray-600">
                El valor del activo baja de {formatAmount(assetAmount, occurrence.currency)} a{" "}
                {formatAmount(Math.max(0, assetAmount - (valid ? value : 0)), occurrence.currency)}.
                Se registra como conversión de activo, no como ganancia.
              </p>
              {exceedsPrincipal && (
                <p className="mt-1 font-semibold text-amber-700">
                  El cobro supera el capital pendiente: el activo queda en 0.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Comentario (opcional)</Label>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: incluye ajuste por inflación"
              className="border-2 border-black"
            />
          </div>
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black" disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleCollect}
            disabled={!valid || saving}
          >
            {saving ? "Registrando..." : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
