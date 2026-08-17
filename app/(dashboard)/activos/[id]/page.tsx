import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { loadAsset } from "@/lib/assets-actions"
import { AssetTypeLabel } from "@/components/activos/asset-type-label"
import { AssetInfoSection } from "@/components/activos/asset-info-section"
import { AssetMovementsSection } from "@/components/activos/asset-movements-section"
import { AssetDetail } from "@/components/activos/asset-detail"
import { IncomeRulesSection } from "@/components/activos/income/income-rules-section"
import { BoardManager } from "@/components/activos/boards/board-manager"
import { UngroupButton } from "@/components/activos/ungroup-button"

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const asset = await loadAsset(id)

  if (!asset) notFound()

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
        <AssetTypeLabel
          assetType={asset.assetType}
          className="text-xs font-bold uppercase text-gray-400"
        />
        {asset.ticker && (
          <span className="font-mono text-sm text-gray-500">{asset.ticker}</span>
        )}
        {asset.isGroupParent && (
          <>
            <span className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-500">
              Grupo ({asset.children?.length ?? 0} activos)
            </span>
            <UngroupButton assetId={asset.id} />
          </>
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
                <AssetTypeLabel assetType={child.assetType} />
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

        {asset.isGroupParent ? (
          <>
            {/* GROUP: fixed order — Info → Members (above) → Movements */}
            <AssetMovementsSection asset={asset} />
          </>
        ) : (
          <>
            {/* 2. Panel tipo-específico */}
            <AssetDetail asset={asset} />

            {/* 3. Ingresos recurrentes — disponible en cualquier tipo de activo */}
            <IncomeRulesSection
              recordId={asset.id}
              assetCurrency={asset.currency}
              assetAmount={asset.amount}
            />

            {/* 4. Movimientos */}
            <AssetMovementsSection asset={asset} />

            {/* 5. Tableros opcionales (dividendos + personalizados) */}
            <BoardManager asset={asset} />
          </>
        )}
      </div>
    </div>
  )
}
