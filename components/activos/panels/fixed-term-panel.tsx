"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAmount } from "@/lib/finance"
import { type Asset, type FixedTermMetadata, calcFixedTermReturn } from "@/lib/assets"
import { collectFixedTerm } from "@/lib/assets-actions"

interface FixedTermPanelProps {
  asset: Asset
}

export function FixedTermPanel({ asset }: FixedTermPanelProps) {
  const router = useRouter()
  const [showCollectDialog, setShowCollectDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [collectedAmount, setCollectedAmount] = useState("")

  const metadata = asset.metadata as FixedTermMetadata | null

  const expectedReturn = metadata
    ? calcFixedTermReturn(metadata, asset.amount)
    : 0

  const handleCollect = () => {
    startTransition(async () => {
      await collectFixedTerm(
        asset.id,
        Number(collectedAmount) || asset.amount + expectedReturn,
        asset.currency,
        asset.name,
      )
      router.push("/activos")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Details panel */}
      <div className="border-2 border-black">
        <div className="border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Detalle del plazo fijo</span>
        </div>
        <div className="grid grid-cols-2 gap-6 p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-xs font-bold uppercase text-gray-500">Capital invertido</div>
            <div className="text-lg font-bold">
              {formatAmount(asset.amount, asset.currency)} {asset.currency}
            </div>
          </div>
          {metadata && (
            <>
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">Fecha inicio</div>
                <div>{new Date(metadata.startDate + "T12:00:00").toLocaleDateString("es-ES")}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">Fecha vencimiento</div>
                <div>{new Date(metadata.endDate + "T12:00:00").toLocaleDateString("es-ES")}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">Tasa anual</div>
                <div className="font-bold">{metadata.rate}%</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">Retorno estimado</div>
                <div className="font-bold text-emerald-700">
                  +{formatAmount(expectedReturn, asset.currency)} {asset.currency}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">Total esperado</div>
                <div className="text-lg font-bold">
                  {formatAmount(asset.amount + expectedReturn, asset.currency)} {asset.currency}
                </div>
              </div>
            </>
          )}
          {asset.description && (
            <div className="col-span-full">
              <div className="text-xs font-bold uppercase text-gray-500">Descripción</div>
              <div className="text-gray-700">{asset.description}</div>
            </div>
          )}
        </div>

        {metadata && (
          <div className="border-t-2 border-black px-4 py-3">
            <Button
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={() => {
                setCollectedAmount(String((asset.amount + expectedReturn).toFixed(2)))
                setShowCollectDialog(true)
              }}
            >
              Cobrar plazo fijo
            </Button>
          </div>
        )}
      </div>

      {showCollectDialog && (
        <Dialog open onOpenChange={(o) => !o && setShowCollectDialog(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Cobrar plazo fijo</DialogTitle>
            </DialogHeader>
            <div className="px-4 py-4">
              <Label className="text-xs font-bold uppercase">
                Monto cobrado ({asset.currency})
              </Label>
              <Input
                type="number"
                value={collectedAmount}
                onChange={(e) => setCollectedAmount(e.target.value)}
                className="mt-1 border-2 border-black"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">
                Se creará un ingreso &quot;Cobro plazo fijo: {asset.name}&quot; en el dashboard y
                el activo será eliminado.
              </p>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button
                variant="outline"
                onClick={() => setShowCollectDialog(false)}
                className="border-2 border-black"
              >
                Cancelar
              </Button>
              <Button
                className="bg-black text-white hover:bg-gray-800"
                onClick={handleCollect}
                disabled={isPending || !collectedAmount}
              >
                {isPending ? "Procesando..." : "Confirmar cobro"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
