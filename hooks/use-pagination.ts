"use client"

import { useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export { PAGE_SIZES }

export function usePagination() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const page = useMemo(() => {
    const p = parseInt(searchParams.get("page") ?? "1", 10)
    return isNaN(p) || p < 1 ? 1 : p
  }, [searchParams])

  const pageSize = useMemo(() => {
    const s = parseInt(searchParams.get("pageSize") ?? "25", 10)
    return (PAGE_SIZES as readonly number[]).includes(s) ? (s as PageSize) : 25
  }, [searchParams])

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", String(Math.max(1, p)))
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const setPageSize = useCallback(
    (s: PageSize) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("pageSize", String(s))
      params.set("page", "1")
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return { page, pageSize, setPage, setPageSize }
}
