"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { type Asset, type FuturesMovementMetadata, type FuturesMetadata } from "@/lib/assets"
import { addMovement, updateAsset } from "@/lib/assets-actions"
import { AssetFormDialog } from "../asset-form-dialog"

interface AddPositionDialogProps {
  assetId: string
  currency: Currency
  currentAmount: number
  onClose: () => void
}

function AddPositionDialog({ assetId, currency: defaultCurr, currentAmount, onClose }: AddPositionDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [positionType, setPositionType] = useState<"LONG" | "SHORT">("LONG")
  const [amount, setAmount] = useState("")
  const [qty, setQty] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [currency, setCurrency] = useState<Currency>(defaultCurr)
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const handleSave = () => {
    if (!amount) return
    startTransition(async () => {
      const meta: FuturesMovementMetadata = { positionType }
      await addMovement({
        recordId: assetId,
        movementType: "BUY",
        amount: Number(amount),
        quantity: qty ? Number(qty) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        currency,
        description: description || `Posición ${positionType}`,
        operationDate: new Date(date + "T12:00:00"),
        metadata: meta,
      })
      await updateAsset(assetId, { amount: currentAmount + Number(amount) })
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Nueva posición</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Tipo de posición</Label>
            <Select value={positionType} onValueChange={(v) => setPositionType(v as "LONG" | "SHORT")}>
              <SelectTrigger className="border-2 border-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LONG">LONG</SelectItem>
                <SelectItem value="SHORT">SHORT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Monto</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="border-2 border-black" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-24 border-2 border-black"><SelectValue /></SelectTrigger>
                <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Cantidad</Label>
              <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="border-2 border-black" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Precio entrada</Label>
              <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className="border-2 border-black" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-2 border-black" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Notas..." className="border-2 border-black" />
          </div>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">Cancelar</Button>
          <Button className="bg-black text-white hover:bg-gray-800" onClick={handleSave} disabled={isPending || !amount}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface FuturesPanelProps {
  asset: Asset
}

export function FuturesPanel({ asset }: FuturesPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddPosition, setShowAddPosition] = useState(false)
  const [showNewFutures, setShowNewFutures] = useState(false)

  const metadata = asset.metadata as FuturesMetadata | null
  const isLiquidated = metadata?.liquidated === true

  const handleLiquidate = () => {
    startTransition(async () => {
      const current = (asset.metadata ?? {}) as Record<string, unknown>
      const nextSuffix = ((current.liquidationSuffix as number | undefined) ?? 1) + 1
      await updateAsset(asset.id, {
        metadata: { ...current, liquidated: true, liquidationSuffix: nextSuffix },
      })
      router.refresh()
    })
  }

  const longPositions = asset.movements.filter(
    (m) => (m.metadata as FuturesMovementMetadata | undefined)?.positionType === "LONG",
  )
  const shortPositions = asset.movements.filter(
    (m) => (m.metadata as FuturesMovementMetadata | undefined)?.positionType === "SHORT",
  )
  const otherMovements = asset.movements.filter(
    (m) => !(m.metadata as FuturesMovementMetadata | undefined)?.positionType,
  )

  const avgEntry = (positions: typeof asset.movements) => {
    if (positions.length === 0) return 0
    const totalQty = positions.reduce((s, p) => s + (p.quantity ?? 0), 0)
    if (totalQty === 0) return 0
    return positions.reduce((s, p) => s + (p.unitPrice ?? 0) * (p.quantity ?? 0), 0) / totalQty
  }

  const suggestedName = `${asset.ticker ?? asset.name} (${metadata?.liquidationSuffix ?? 2})`

  return (
    <div className="flex flex-col gap-6">
      {/* Info header */}
      <div className="border-2 border-black">
        <div className="border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Futuros — {asset.ticker ?? asset.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Valor actual</div>
            <div className="font-bold">{formatAmount(asset.amount, asset.currency)} {asset.currency}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Posiciones LONG</div>
            <div className="font-bold text-emerald-700">{longPositions.length}</div>
            {longPositions.length > 0 && (
              <div className="text-xs text-gray-500">Precio prom. entrada: {formatAmount(avgEntry(longPositions), asset.currency)}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Posiciones SHORT</div>
            <div className="font-bold text-rose-700">{shortPositions.length}</div>
            {shortPositions.length > 0 && (
              <div className="text-xs text-gray-500">Precio prom. entrada: {formatAmount(avgEntry(shortPositions), asset.currency)}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Estado</div>
            <div className={`font-bold ${isLiquidated ? "text-rose-700" : "text-emerald-700"}`}>
              {isLiquidated ? "Liquidado" : "Activo"}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t-2 border-black px-4 py-3">
          {!isLiquidated && (
            <>
              <Button
                size="sm"
                className="gap-1 bg-black text-white hover:bg-gray-800"
                onClick={() => setShowAddPosition(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva posición
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-2 border-black"
                onClick={handleLiquidate}
                disabled={isPending}
              >
                {isPending ? "Procesando..." : "Liquidar"}
              </Button>
            </>
          )}
          {isLiquidated && (
            <Button
              size="sm"
              className="gap-1 bg-black text-white hover:bg-gray-800"
              onClick={() => setShowNewFutures(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva operación en {asset.ticker ?? asset.name}
            </Button>
          )}
        </div>
      </div>

      {/* Positions table */}
      {(longPositions.length > 0 || shortPositions.length > 0) && (
        <div className="border-2 border-black">
          <div className="border-b-2 border-black bg-black px-3 py-2">
            <span className="font-bold italic text-white">Historial de posiciones</span>
          </div>
          <div className="flex bg-gray-100 text-xs font-bold">
            <div className="w-20 border-r border-black px-3 py-2">Tipo</div>
            <div className="w-32 border-r border-black px-3 py-2">Fecha</div>
            <div className="flex-1 border-r border-black px-3 py-2">Descripción</div>
            <div className="w-24 border-r border-black px-3 py-2 text-right">Precio</div>
            <div className="w-20 border-r border-black px-3 py-2 text-right">Qty</div>
            <div className="w-36 px-3 py-2 text-right">Monto</div>
          </div>
          {[...longPositions, ...shortPositions]
            .sort((a, b) => new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime())
            .map((m) => {
              const meta = m.metadata as FuturesMovementMetadata | undefined
              return (
                <div key={m.id} className="flex border-b border-black text-sm">
                  <div className={`w-20 border-r border-black px-3 py-2 text-xs font-bold ${meta?.positionType === "LONG" ? "text-emerald-700" : "text-rose-700"}`}>
                    {meta?.positionType ?? "—"}
                  </div>
                  <div className="w-32 border-r border-black px-3 py-2 text-xs text-gray-500">
                    {new Date(m.operationDate).toLocaleDateString("es-ES")}
                  </div>
                  <div className="flex-1 border-r border-black px-3 py-2 text-gray-600">{m.description ?? "—"}</div>
                  <div className="w-24 border-r border-black px-3 py-2 text-right font-mono text-xs">
                    {m.unitPrice ? formatAmount(m.unitPrice, m.currency) : "—"}
                  </div>
                  <div className="w-20 border-r border-black px-3 py-2 text-right font-mono text-xs">{m.quantity ?? "—"}</div>
                  <div className="w-36 px-3 py-2 text-right font-mono">
                    {formatAmount(m.amount, m.currency)} {m.currency}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Other movements */}
      {otherMovements.length > 0 && (
        <div className="border-2 border-black">
          <div className="border-b-2 border-black bg-black px-3 py-2">
            <span className="font-bold italic text-white">Otros movimientos</span>
          </div>
          {otherMovements.map((m) => (
            <div key={m.id} className="flex border-b border-black text-sm">
              <div className="w-24 border-r border-black px-3 py-2 text-xs">{m.movementType}</div>
              <div className="flex-1 border-r border-black px-3 py-2 text-gray-600">{m.description ?? "—"}</div>
              <div className="w-36 px-3 py-2 text-right font-mono">{formatAmount(m.amount, m.currency)} {m.currency}</div>
            </div>
          ))}
        </div>
      )}

      {showAddPosition && (
        <AddPositionDialog
          assetId={asset.id}
          currency={asset.currency}
          currentAmount={asset.amount}
          onClose={() => setShowAddPosition(false)}
        />
      )}

      {showNewFutures && (
        <AssetFormDialog
          open={showNewFutures}
          onOpenChange={setShowNewFutures}
          defaultName={suggestedName}
          defaultAssetType="FUTURES"
        />
      )}
    </div>
  )
}
