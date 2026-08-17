"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { categoryName, type AssetCategory } from "@/lib/asset-categories"
import { ensureAssetCategories } from "@/lib/asset-category-actions"
import { useSettings } from "@/components/settings-store"

interface CategoriesContextValue {
  categories: AssetCategory[]
  /** Nombre visible de una categoría; resuelve también los ids legados */
  nameOf: (categoryId: string | null | undefined) => string
  reload: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  nameOf: (id) => id ?? "—",
  reload: async () => {},
})

/**
 * Categorías de activo, cargadas desde la DB.
 *
 * Al montar siembra las que falten a partir de los `assetType` legados y de los
 * tipos personalizados que hayan quedado en `localStorage`, de modo que ningún
 * activo existente pierda su etiqueta.
 */
export function AssetCategoriesProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [categories, setCategories] = useState<AssetCategory[]>([])

  const reload = useCallback(async () => {
    try {
      setCategories(await ensureAssetCategories(settings.customAssetTypes ?? []))
    } catch {
      // No crítico: sin categorías la app sigue funcionando, solo sin etiquetas
    }
  }, [settings.customAssetTypes])

  useEffect(() => { reload() }, [reload])

  const nameOf = useCallback(
    (categoryId: string | null | undefined) => categoryName(categoryId, categories),
    [categories],
  )

  return (
    <CategoriesContext.Provider value={{ categories, nameOf, reload }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useAssetCategories() {
  return useContext(CategoriesContext)
}
