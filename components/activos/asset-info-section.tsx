"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { RichEditor } from "@/components/ui/rich-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatAmount } from "@/lib/finance"
import { type Asset, type AssetType, ASSET_TYPE_LABELS } from "@/lib/assets"
import { updateAsset } from "@/lib/assets-actions"
import { useSettings } from "@/components/settings-store"
import { GroupValueDisplay } from "@/components/group-value-display"

type EditableField = "name" | "ticker" | "assetType" | "description"

interface AssetInfoSectionProps {
  asset: Asset
}

export function AssetInfoSection({ asset }: AssetInfoSectionProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { settings } = useSettings()
  const { hiddenAssetTypes = [], customAssetTypes = [] } = settings
  const visibleSystemTypes = (Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).filter(
    ([t]) => t !== "GROUP" && !hiddenAssetTypes.includes(t),
  )
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [draft, setDraft] = useState("")
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startEdit = (field: EditableField) => {
    const value =
      field === "name" ? asset.name
      : field === "ticker" ? (asset.ticker ?? "")
      : field === "assetType" ? (asset.assetType ?? "")
      : (asset.description ?? "")
    setDraft(value)
    setEditingField(field)
  }

  const save = (field: EditableField, value: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        if (field === "name" && !value.trim()) return
        const patch: Parameters<typeof updateAsset>[1] = {}
        if (field === "name") patch.name = value.trim()
        else if (field === "ticker") patch.ticker = value.trim() || undefined
        else if (field === "assetType") patch.assetType = (value as AssetType) || undefined
        else if (field === "description") patch.description = value.trim() || undefined
        await updateAsset(asset.id, patch)
        router.refresh()
      })
    }, 200)
  }

  const handleBlur = (field: EditableField) => {
    save(field, draft)
    setEditingField(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: EditableField) => {
    if (e.key === "Escape") {
      setEditingField(null)
    } else if (e.key === "Enter" && field !== "description") {
      e.preventDefault()
      save(field, draft)
      setEditingField(null)
    }
  }

  return (
    <div data-testid="asset-info-section" className="border-2 border-black">
      <div className="border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Información general</span>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 text-sm md:grid-cols-2">
        {/* Valor actual — always read-only */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Valor actual</div>
          <div className="font-bold">
            {asset.isGroupParent && asset.children && asset.children.length > 0 ? (
              <GroupValueDisplay children={asset.children} />
            ) : (
              <>
                {formatAmount(asset.amount, asset.currency)}{" "}
                <span className="text-gray-500">{asset.currency}</span>
              </>
            )}
          </div>
        </div>

        {/* Tipo de activo */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Tipo de activo</div>
          {editingField === "assetType" ? (
            <Select
              value={draft}
              onValueChange={(v) => {
                setDraft(v)
                save("assetType", v)
                setEditingField(null)
              }}
              open
              onOpenChange={(open) => {
                if (!open) setEditingField(null)
              }}
            >
              <SelectTrigger className="h-8 border-2 border-black focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleSystemTypes.map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
                {customAssetTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              onClick={() => startEdit("assetType")}
              className="group flex items-center gap-1 text-left"
            >
              <span className="font-medium">
                {asset.assetType
                  ? ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType
                  : <span className="italic text-gray-400">—</span>}
              </span>
              <Pencil className="h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* Ticker */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Ticker</div>
          {editingField === "ticker" ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => handleBlur("ticker")}
              onKeyDown={(e) => handleKeyDown(e, "ticker")}
              placeholder="Ej: AAPL, BTCUSDT"
              className="h-8 border-2 border-black font-mono focus-visible:ring-0"
            />
          ) : (
            <button
              onClick={() => startEdit("ticker")}
              className="group flex items-center gap-1 text-left"
            >
              <span className="font-mono">
                {asset.ticker || <span className="italic text-gray-400">—</span>}
              </span>
              <Pencil className="h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* Nombre */}
        <div>
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Nombre</div>
          {editingField === "name" ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => handleBlur("name")}
              onKeyDown={(e) => handleKeyDown(e, "name")}
              className="h-8 border-2 border-black focus-visible:ring-0"
            />
          ) : (
            <button
              onClick={() => startEdit("name")}
              className="group flex items-center gap-1 text-left"
            >
              <span className="font-medium">{asset.name}</span>
              <Pencil className="h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* Descripción — full width */}
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-bold uppercase text-gray-500">Descripción</div>
          {editingField === "description" ? (
            <RichEditor
              value={draft}
              onChange={(json) => setDraft(json)}
              onBlur={() => handleBlur("description")}
              placeholder="Descripción del activo..."
            />
          ) : (
            <button
              onClick={() => startEdit("description")}
              className="group flex w-full items-start gap-1 text-left"
            >
              <div className="flex-1 text-gray-700">
                {asset.description ? (
                  <RichEditor value={asset.description} readOnly />
                ) : (
                  <span className="italic text-gray-400">Sin descripción — click para editar</span>
                )}
              </div>
              <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
