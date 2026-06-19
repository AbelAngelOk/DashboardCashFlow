import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { loadAsset } from "@/lib/assets-actions"
import { ASSET_TYPE_LABELS } from "@/lib/assets"
import { AssetInfoSection } from "@/components/activos/asset-info-section"
import { AssetMovementsSection } from "@/components/activos/asset-movements-section"
import { AssetTrackingSection } from "@/components/activos/asset-tracking-section"
import { AssetDetail } from "@/components/activos/asset-detail"

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const asset = await loadAsset(id)

  if (!asset) notFound()

  const typeLabel = ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-3 border-b-2 border-black pb-2">
        <Link
          href="/activos"
          className="text-gray-400 transition-colors hover:text-black"
          aria-label="Volver a activos"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="inline-block bg-black px-4 py-1">
          <span className="font-bold italic text-white">{asset.name}</span>
        </div>
        <span className="text-xs font-bold uppercase text-gray-400">{typeLabel}</span>
        {asset.ticker && (
          <span className="font-mono text-sm text-gray-500">{asset.ticker}</span>
        )}
        {asset.isGroupParent && (
          <span className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500">
            Grupo ({asset.children?.length ?? 0} activos)
          </span>
        )}
      </div>

      {/* Group children summary */}
      {asset.isGroupParent && asset.children && asset.children.length > 0 && (
        <div className="mb-6 border-2 border-black">
          <div className="border-b-2 border-black bg-gray-100 px-3 py-2">
            <span className="text-sm font-bold">Activos del grupo</span>
          </div>
          {asset.children.map((child) => (
            <div key={child.id} className="flex items-center border-b border-black text-sm">
              <div className="flex-1 px-3 py-2">
                <Link href={`/activos/${child.id}`} className="font-medium hover:underline">
                  {child.name}
                </Link>
              </div>
              <div className="w-32 px-3 py-2 text-xs text-gray-500">
                {ASSET_TYPE_LABELS[child.assetType] ?? child.assetType}
              </div>
              <div className="w-40 px-3 py-2 text-right font-mono text-sm">
                {child.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {child.currency}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* 1. Información general */}
        <AssetInfoSection asset={asset} />

        {/* 2. Panel tipo-específico */}
        <AssetDetail asset={asset} />

        {/* 3. Movimientos (cambios en el precio del activo) */}
        <AssetMovementsSection asset={asset} />

        {/* 4. Seguimiento (tabla configurable) */}
        <AssetTrackingSection asset={asset} />

      </div>
    </div>
  )
}
