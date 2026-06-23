"use client"

import { useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { MovementAction, RecordType } from "@/lib/finance"

export interface HistorialFilters {
  action: MovementAction | ""
  recordType: RecordType | ""
  search: string
  dateFrom: string
  dateTo: string
}

const FILTER_KEYS: (keyof HistorialFilters)[] = [
  "action",
  "recordType",
  "search",
  "dateFrom",
  "dateTo",
]

export function useHistorialFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters: HistorialFilters = useMemo(
    () => ({
      action: (searchParams.get("action") ?? "") as MovementAction | "",
      recordType: (searchParams.get("recordType") ?? "") as RecordType | "",
      search: searchParams.get("search") ?? "",
      dateFrom: searchParams.get("dateFrom") ?? "",
      dateTo: searchParams.get("dateTo") ?? "",
    }),
    [searchParams],
  )

  const setFilter = useCallback(
    (key: keyof HistorialFilters, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.set("page", "1")
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS.forEach((k) => params.delete(k))
    params.set("page", "1")
    router.replace(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const isFiltered = FILTER_KEYS.some((k) => !!filters[k])

  return { filters, setFilter, clearFilters, isFiltered }
}
