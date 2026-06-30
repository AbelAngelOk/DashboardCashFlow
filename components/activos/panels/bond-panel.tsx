"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAmount, currencies, defaultCurrency, type Currency } from "@/lib/finance"
import { type Asset, type BondMetadata, type BondDisbursement } from "@/lib/assets"
import { updateAsset } from "@/lib/assets-actions"

interface BondPanelProps {
  asset: Asset
}

export function BondPanel({ asset }: BondPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addCurrency, setAddCurrency] = useState<Currency>(asset.currency ?? defaultCurrency)

  const metadata = (asset.metadata as BondMetadata | null) ?? { disbursements: [] }
  const disbursements = metadata.disbursements ?? []

  const totalPending = disbursements
    .filter((d) => !d.collected && d.currency === asset.currency)
    .reduce((s, d) => s + d.amount, 0)

  const handleAddDisbursement = () => {
    if (!addDate || !addAmount) return
    startTransition(async () => {
      const newEntry: BondDisbursement = {
        id: crypto.randomUUID(),
        dueDate: addDate,
        amount: Number(addAmount),
        currency: addCurrency,
        collected: false,
      }
      await updateAsset(asset.id, {
        metadata: { disbursements: [...disbursements, newEntry] },
      })
      setShowAdd(false)
      setAddDate("")
      setAddAmount("")
      router.refresh()
    })
  }

  const handleToggleCollected = (id: string) => {
    startTransition(async () => {
      const updated = disbursements.map((d) =>
        d.id === id ? { ...d, collected: !d.collected } : d,
      )
      await updateAsset(asset.id, { metadata: { disbursements: updated } })
      router.refresh()
    })
  }

  return (
    <div data-testid="asset-panel-bond" className="flex flex-col gap-6">
      {/* Info header */}
      <div className="border-2 border-black">
        <div className="border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Bonos — {asset.ticker ?? asset.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Valor actual</div>
            <div className="font-bold">{formatAmount(asset.amount, asset.currency)} {asset.currency}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Desembolsos pendientes</div>
            <div className="font-bold text-amber-700">
              {formatAmount(totalPending, asset.currency)} {asset.currency}
            </div>
          </div>
          {asset.description && (
            <div className="col-span-full">
              <div className="text-xs font-bold uppercase text-gray-500">Descripción</div>
              <div className="text-gray-700">{asset.description}</div>
            </div>
          )}
        </div>
      </div>

      {/* Disbursements table */}
      <div className="border-2 border-black">
        <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Cronograma de desembolsos</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-xs text-white hover:bg-white/20"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        <div className="flex bg-gray-100 text-xs font-bold">
          <div className="w-36 border-r border-black px-3 py-2">Fecha</div>
          <div className="flex-1 border-r border-black px-3 py-2 text-right">Monto</div>
          <div className="w-28 px-3 py-2 text-center">Estado</div>
        </div>

        {disbursements.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            Sin desembolsos configurados.
          </div>
        )}

        {disbursements
          .slice()
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map((d) => (
            <div key={d.id} className={`flex border-b border-black text-sm ${d.collected ? "bg-gray-50 opacity-60" : ""}`}>
              <div className="w-36 border-r border-black px-3 py-2">
                {new Date(d.dueDate + "T12:00:00").toLocaleDateString("es-ES")}
              </div>
              <div className="flex-1 border-r border-black px-3 py-2 text-right font-mono">
                {formatAmount(d.amount, d.currency)} {d.currency}
              </div>
              <div className="flex w-28 items-center justify-center px-3 py-2">
                <button
                  onClick={() => handleToggleCollected(d.id)}
                  disabled={isPending}
                  className={`text-xs font-bold ${d.collected ? "text-emerald-600" : "hover:text-emerald-700"}`}
                >
                  {d.collected ? "✓ Cobrado" : "Marcar cobrado"}
                </button>
              </div>
            </div>
          ))}
      </div>

      {showAdd && (
        <Dialog open onOpenChange={(o) => !o && setShowAdd(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Agregar desembolso</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Fecha de pago</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="border-2 border-black" />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Monto</Label>
                  <NumericInput value={addAmount} onChange={setAddAmount} placeholder="0.00" className="border-2 border-black" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Moneda</Label>
                  <Select value={addCurrency} onValueChange={(v) => setAddCurrency(v as Currency)}>
                    <SelectTrigger className="w-24 border-2 border-black"><SelectValue /></SelectTrigger>
                    <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="border-2 border-black">Cancelar</Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={handleAddDisbursement} disabled={isPending || !addDate || !addAmount}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
