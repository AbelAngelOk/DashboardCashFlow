"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatAmount } from "@/lib/finance"
import {
  type Asset,
  type BoardConfig,
  type DividendEntry,
  type RecurringType,
  RECURRING_TYPE_LABELS,
  generateRecurringDividends,
} from "@/lib/assets"
import { collectDividend, updateBoards } from "@/lib/assets-actions"
import { useFinance } from "@/components/finance-store"

// ── AddDividendDialog ─────────────────────────────────────────────────────────

interface AddDividendDialogProps {
  asset: Asset
  board: BoardConfig
  onClose: () => void
}

function AddDividendDialog({ asset, board, onClose }: AddDividendDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [month, setMonth] = useState("")
  const [percentage, setPercentage] = useState("")
  const [estimatedGain, setEstimatedGain] = useState("")
  const [recurring, setRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState<RecurringType>("monthly")

  const handleSave = () => {
    if (!month) return
    startTransition(async () => {
      const seed: DividendEntry = {
        id: crypto.randomUUID(),
        month,
        percentage: Number(percentage) || 0,
        estimatedGain: Number(estimatedGain) || 0,
        ...(recurring && {
          recurring: {
            type: recurringType,
            expectedAmount: Number(estimatedGain) || undefined,
            isGenerated: false,
            seriesId: crypto.randomUUID(),
          },
        }),
      }

      const generated = recurring ? generateRecurringDividends(seed, 12) : []
      const newDividends = [...(board.dividends ?? []), seed, ...generated]

      const updatedBoard: BoardConfig = { ...board, dividends: newDividends }
      const updatedBoards = asset.boards.map((b) => (b.id === board.id ? updatedBoard : b))
      await updateBoards(asset.id, updatedBoards)
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Agregar dividendo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Mes de cobro</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-2 border-black"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Porcentaje (%)</Label>
              <NumericInput
                value={percentage}
                onChange={setPercentage}
                placeholder="0.00"
                className="border-2 border-black"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Ganancia estimada</Label>
              <NumericInput
                value={estimatedGain}
                onChange={setEstimatedGain}
                placeholder="0.00"
                className="border-2 border-black"
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex flex-col gap-2 rounded border border-gray-200 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="rounded"
              />
              <RefreshCw className="h-3.5 w-3.5" />
              Dividendo recurrente
            </label>
            {recurring && (
              <div className="flex flex-col gap-1 pl-5">
                <Label className="text-xs font-bold uppercase text-gray-500">Frecuencia</Label>
                <Select value={recurringType} onValueChange={(v) => setRecurringType(v as RecurringType)}>
                  <SelectTrigger className="border-2 border-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RECURRING_TYPE_LABELS) as [RecurringType, string][]).map(([type, label]) => (
                      <SelectItem key={type} value={type}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-500">
                  Se generarán 12 entradas futuras automáticamente.
                </p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleSave}
            disabled={isPending || !month}
          >
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── CollectDividendDialog ─────────────────────────────────────────────────────

interface CollectDialogProps {
  asset: Asset
  board: BoardConfig
  dividendId: string
  onClose: () => void
}

function CollectDividendDialog({ asset, board, dividendId, onClose }: CollectDialogProps) {
  const router = useRouter()
  const { reload } = useFinance()
  const [isPending, startTransition] = useTransition()
  const [actualGain, setActualGain] = useState("")

  const handleCollect = () => {
    if (!actualGain) return
    startTransition(async () => {
      await collectDividend(asset.id, dividendId, board.id, Number(actualGain), asset.currency, asset.name)
      await reload()
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Cobrar dividendo</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-4">
          <Label className="text-xs font-bold uppercase">
            Ganancia obtenida ({asset.currency})
          </Label>
          <NumericInput
            value={actualGain}
            onChange={setActualGain}
            placeholder="0.00"
            className="mt-1 border-2 border-black"
            autoFocus
          />
          <p className="mt-2 text-xs text-gray-500">
            Se creará un ingreso &quot;Ganancia dividendos {asset.name}&quot; en el dashboard.
          </p>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={onClose} className="border-2 border-black">
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={handleCollect}
            disabled={isPending || !actualGain}
          >
            {isPending ? "Procesando..." : "Confirmar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── DividendsBoard ────────────────────────────────────────────────────────────

interface DividendsBoardProps {
  asset: Asset
  board: BoardConfig
}

export function DividendsBoard({ asset, board }: DividendsBoardProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [collectingId, setCollectingId] = useState<string | null>(null)

  const dividends = board.dividends ?? []

  return (
    <div data-testid="asset-board-dividends" className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">{board.title}</span>
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
        <div className="w-28 border-r border-black px-3 py-2">Mes</div>
        <div className="w-20 border-r border-black px-3 py-2 text-right">%</div>
        <div className="flex-1 border-r border-black px-3 py-2 text-right">Est.</div>
        <div className="flex-1 border-r border-black px-3 py-2 text-right">Obtenida</div>
        <div className="w-24 px-3 py-2 text-center">Acción</div>
      </div>

      {dividends.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-500">
          Sin dividendos configurados.
        </div>
      )}

      {dividends.map((d) => (
        <div
          key={d.id}
          className={`flex border-b border-black text-sm ${d.recurring?.isGenerated ? "opacity-60" : ""}`}
        >
          <div className="flex w-28 items-center gap-1 border-r border-black px-3 py-2 text-xs">
            {d.month}
            {d.recurring && (
              <RefreshCw className="h-2.5 w-2.5 shrink-0 text-gray-400" aria-label={RECURRING_TYPE_LABELS[d.recurring.type]} />
            )}
          </div>
          <div className="w-20 border-r border-black px-3 py-2 text-right text-xs">
            {d.percentage ? `${d.percentage}%` : "—"}
          </div>
          <div className="flex-1 border-r border-black px-3 py-2 text-right text-xs">
            {d.estimatedGain
              ? `${formatAmount(d.estimatedGain, asset.currency)} ${asset.currency}`
              : "—"}
          </div>
          <div className="flex-1 border-r border-black px-3 py-2 text-right text-xs">
            {d.actualGain !== undefined ? (
              <span className="font-bold text-emerald-700">
                {formatAmount(d.actualGain, asset.currency)} {asset.currency}
              </span>
            ) : (
              "—"
            )}
          </div>
          <div className="flex w-24 items-center justify-center px-3 py-2">
            {d.actualGain === undefined ? (
              <button
                className="flex items-center gap-1 text-xs font-bold hover:text-emerald-700"
                onClick={() => setCollectingId(d.id)}
              >
                <Check className="h-3.5 w-3.5" />
                Cobrar
              </button>
            ) : (
              <span className="text-xs text-emerald-600">✓ Cobrado</span>
            )}
          </div>
        </div>
      ))}

      {showAdd && (
        <AddDividendDialog asset={asset} board={board} onClose={() => setShowAdd(false)} />
      )}
      {collectingId && (
        <CollectDividendDialog
          asset={asset}
          board={board}
          dividendId={collectingId}
          onClose={() => setCollectingId(null)}
        />
      )}
    </div>
  )
}
