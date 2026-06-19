"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { formatAmount } from "@/lib/finance"
import type { Asset } from "@/lib/assets"
import { updateAsset } from "@/lib/assets-actions"

interface AssetInfoSectionProps {
  asset: Asset
}

export function AssetInfoSection({ asset }: AssetInfoSectionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(asset.name)
  const [draftDesc, setDraftDesc] = useState(asset.description ?? "")
  const [draftTicker, setDraftTicker] = useState(asset.ticker ?? "")

  const startEdit = () => {
    setDraftName(asset.name)
    setDraftDesc(asset.description ?? "")
    setDraftTicker(asset.ticker ?? "")
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = () => {
    if (!draftName.trim()) return
    startTransition(async () => {
      await updateAsset(asset.id, {
        name: draftName.trim(),
        description: draftDesc.trim() || undefined,
        ticker: draftTicker.trim() || undefined,
      })
      router.refresh()
      setEditing(false)
    })
  }

  return (
    <div className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Información general</span>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
            onClick={startEdit}
            aria-label="Editar información"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <button
              onClick={saveEdit}
              disabled={isPending}
              className="text-emerald-400 hover:text-emerald-200"
              aria-label="Guardar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelEdit}
              className="text-gray-400 hover:text-white"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 text-sm md:grid-cols-2">
        {/* Valor actual — always read-only (changes via dashboard) */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Valor actual</div>
          <div className="font-bold">
            {formatAmount(asset.amount, asset.currency)}{" "}
            <span className="text-gray-500">{asset.currency}</span>
          </div>
        </div>

        {/* Ticker */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Ticker</div>
          {editing ? (
            <Input
              value={draftTicker}
              onChange={(e) => setDraftTicker(e.target.value)}
              placeholder="Ej: AAPL, BTCUSDT"
              className="border-2 border-black font-mono"
            />
          ) : (
            <div className="font-mono">
              {asset.ticker || <span className="italic text-gray-400">—</span>}
            </div>
          )}
        </div>

        {/* Nombre */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Nombre</div>
          {editing ? (
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="border-2 border-black"
              autoFocus
            />
          ) : (
            <div className="font-medium">{asset.name}</div>
          )}
        </div>

        {/* Descripción — full width */}
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Descripción</div>
          {editing ? (
            <Textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="Descripción del activo..."
              className="resize-none border-2 border-black focus-visible:ring-0"
              rows={3}
            />
          ) : (
            <div className="text-gray-700">
              {asset.description || <span className="italic text-gray-400">Sin descripción</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
