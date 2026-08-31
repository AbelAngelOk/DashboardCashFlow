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
import { type Asset, type FuturesMovementMetadata, type FuturesMetadata } from "@/lib/assets"
import { addMovement, updateAsset, updateMovement } from "@/lib/assets-actions"
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
  const [leverage, setLeverage] = useState("1")
  const [currency, setCurrency] = useState<Currency>(defaultCurr)
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const handleSave = () => {
    if (!amount) return
    startTransition(async () => {
      const meta: FuturesMovementMetadata = {
        positionType,
        leverage: leverage ? Number(leverage) : undefined,
      }
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
              <NumericInput value={amount} onChange={setAmount} placeholder="0.00" className="border-2 border-black" />
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
              <NumericInput value={qty} onChange={setQty} placeholder="0" className="border-2 border-black" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Precio entrada</Label>
              <NumericInput value={unitPrice} onChange={setUnitPrice} placeholder="0.00" className="border-2 border-black" />
            </div>
            <div className="flex w-24 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Apalanc.</Label>
              <NumericInput value={leverage} onChange={setLeverage} placeholder="1" className="border-2 border-black" />
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

// ── ClosePositionDialog ────────────────────────────────────────────────────────
// Cierra UNA posición puntual con su propio precio de salida — independiente
// del "Liquidar" a nivel activo, que sigue existiendo para cerrar todo junto.

interface ClosePositionDialogProps {
  movementId: string
  positionType: "LONG" | "SHORT"
  currency: Currency
  entryPrice: number
  qty: number
  leverage: number
  onClose: () => void
}

function ClosePositionDialog({
  movementId,
  positionType,
  currency,
  entryPrice,
  qty,
  leverage,
  onClose,
}: ClosePositionDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [closePrice, setClosePrice] = useState("")

  const priceNum = Number(closePrice)
  const diff = positionType === "LONG" ? priceNum - entryPrice : entryPrice - priceNum
  const pnl = closePrice ? diff * qty * leverage : null

  const handleClose = () => {
    if (!closePrice) return
    startTransition(async () => {
      const meta: FuturesMovementMetadata = {
        positionType,
        leverage,
        closed: true,
        closePrice: priceNum,
        closeDate: new Date().toISOString(),
        pnl: pnl ?? 0,
      }
      await updateMovement(movementId, { metadata: meta })
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">
            Cerrar posición {positionType}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-xs text-gray-500">
            Entrada: {formatAmount(entryPrice, currency)} · Cantidad: {qty}
            {leverage !== 1 ? ` · Apalanc. ${leverage}x` : ""}
          </p>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Precio de salida</Label>
            <NumericInput
              value={closePrice}
              onChange={setClosePrice}
              placeholder="0.00"
              className="border-2 border-black"
              autoFocus
            />
          </div>
          {pnl !== null && (
            <p className={`text-sm font-bold ${pnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              P&amp;L: {pnl >= 0 ? "+" : ""}
              {formatAmount(pnl, currency)} {currency}
            </p>
          )}
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">Cancelar</Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleClose}
            disabled={isPending || !closePrice}
          >
            {isPending ? "Cerrando..." : "Confirmar cierre"}
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
  const [closingMovement, setClosingMovement] = useState<(typeof asset.movements)[number] | null>(null)

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

  const isOpen = (m: (typeof asset.movements)[number]) =>
    (m.metadata as FuturesMovementMetadata | undefined)?.closed !== true

  const longPositions = asset.movements.filter(
    (m) => (m.metadata as FuturesMovementMetadata | undefined)?.positionType === "LONG",
  )
  const shortPositions = asset.movements.filter(
    (m) => (m.metadata as FuturesMovementMetadata | undefined)?.positionType === "SHORT",
  )
  const otherMovements = asset.movements.filter(
    (m) => !(m.metadata as FuturesMovementMetadata | undefined)?.positionType,
  )

  // Promedio de entrada de las posiciones TODAVÍA ABIERTAS — una vez que una
  // posición se cierra individualmente, ya no forma parte de tu exposición
  // actual, así que no debería seguir pesando en el promedio.
  const avgEntry = (positions: typeof asset.movements) => {
    const open = positions.filter(isOpen)
    if (open.length === 0) return 0
    const totalQty = open.reduce((s, p) => s + (p.quantity ?? 0), 0)
    if (totalQty === 0) return 0
    return open.reduce((s, p) => s + (p.unitPrice ?? 0) * (p.quantity ?? 0), 0) / totalQty
  }

  const suggestedName = `${asset.ticker ?? asset.name} (${metadata?.liquidationSuffix ?? 2})`

  return (
    <div data-testid="asset-panel-futures" className="flex flex-col gap-6">
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
            <div className="text-xs font-bold uppercase text-gray-500">Posiciones LONG abiertas</div>
            <div className="font-bold text-emerald-700">
              {longPositions.filter(isOpen).length}
              {longPositions.length !== longPositions.filter(isOpen).length && (
                <span className="ml-1 text-xs font-normal text-gray-400">de {longPositions.length}</span>
              )}
            </div>
            {longPositions.filter(isOpen).length > 0 && (
              <div className="text-xs text-gray-500">Precio prom. entrada: {formatAmount(avgEntry(longPositions), asset.currency)}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Posiciones SHORT abiertas</div>
            <div className="font-bold text-rose-700">
              {shortPositions.filter(isOpen).length}
              {shortPositions.length !== shortPositions.filter(isOpen).length && (
                <span className="ml-1 text-xs font-normal text-gray-400">de {shortPositions.length}</span>
              )}
            </div>
            {shortPositions.filter(isOpen).length > 0 && (
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
            <div className="w-16 border-r border-black px-2 py-2">Tipo</div>
            <div className="w-28 border-r border-black px-2 py-2">Fecha</div>
            <div className="flex-1 border-r border-black px-2 py-2">Descripción</div>
            <div className="w-20 border-r border-black px-2 py-2 text-right">Precio</div>
            <div className="w-16 border-r border-black px-2 py-2 text-right">Qty</div>
            <div className="w-14 border-r border-black px-2 py-2 text-center">Apal.</div>
            <div className="w-28 border-r border-black px-2 py-2 text-right">Monto</div>
            <div className="w-28 border-r border-black px-2 py-2 text-right">P&amp;L</div>
            <div className="w-24 px-2 py-2 text-center">Acción</div>
          </div>
          {[...longPositions, ...shortPositions]
            .sort((a, b) => new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime())
            .map((m) => {
              const meta = m.metadata as FuturesMovementMetadata | undefined
              const closed = meta?.closed === true
              return (
                <div key={m.id} className={`flex border-b border-black text-sm ${closed ? "bg-gray-50" : ""}`}>
                  <div className={`w-16 border-r border-black px-2 py-2 text-xs font-bold ${meta?.positionType === "LONG" ? "text-emerald-700" : "text-rose-700"}`}>
                    {meta?.positionType ?? "—"}
                  </div>
                  <div className="w-28 border-r border-black px-2 py-2 text-xs text-gray-500">
                    {new Date(m.operationDate).toLocaleDateString("es-ES")}
                  </div>
                  <div className="flex-1 border-r border-black px-2 py-2 text-gray-600">{m.description ?? "—"}</div>
                  <div className="w-20 border-r border-black px-2 py-2 text-right font-mono text-xs">
                    {m.unitPrice ? formatAmount(m.unitPrice, m.currency) : "—"}
                  </div>
                  <div className="w-16 border-r border-black px-2 py-2 text-right font-mono text-xs">{m.quantity ?? "—"}</div>
                  <div className="w-14 border-r border-black px-2 py-2 text-center font-mono text-xs text-gray-500">
                    {meta?.leverage && meta.leverage !== 1 ? `${meta.leverage}x` : "—"}
                  </div>
                  <div className="w-28 border-r border-black px-2 py-2 text-right font-mono text-xs">
                    {formatAmount(m.amount, m.currency)}
                  </div>
                  <div className="w-28 border-r border-black px-2 py-2 text-right font-mono text-xs">
                    {closed && meta?.pnl !== undefined ? (
                      <span className={meta.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {meta.pnl >= 0 ? "+" : ""}
                        {formatAmount(meta.pnl, m.currency)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="flex w-24 items-center justify-center px-2 py-2">
                    {closed ? (
                      <span className="text-xs text-gray-400">Cerrada</span>
                    ) : meta?.positionType ? (
                      <button
                        className="text-xs font-bold hover:text-rose-700"
                        onClick={() => setClosingMovement(m)}
                      >
                        Cerrar
                      </button>
                    ) : (
                      "—"
                    )}
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
        />
      )}

      {closingMovement && (() => {
        const meta = closingMovement.metadata as FuturesMovementMetadata
        return (
          <ClosePositionDialog
            movementId={closingMovement.id}
            positionType={meta.positionType}
            currency={closingMovement.currency}
            entryPrice={closingMovement.unitPrice ?? 0}
            qty={closingMovement.quantity ?? 0}
            leverage={meta.leverage ?? 1}
            onClose={() => setClosingMovement(null)}
          />
        )
      })()}
    </div>
  )
}
