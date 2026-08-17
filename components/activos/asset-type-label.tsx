"use client"

import { useAssetCategories } from "@/components/activos/asset-categories-store"

/**
 * Muestra la categoría de un activo.
 *
 * Desde v2.5.0 la categoría es una etiqueta libre guardada en `asset_categories`.
 * Los activos creados con el modelo viejo guardan el valor legado (`STOCK`, `BOND`…)
 * y se resuelven contra las categorías sembradas con ese mismo id.
 */
export function AssetTypeLabel({
  assetType,
  className,
}: {
  assetType: string | null | undefined
  className?: string
}) {
  const { nameOf } = useAssetCategories()
  return <span className={className}>{nameOf(assetType)}</span>
}
