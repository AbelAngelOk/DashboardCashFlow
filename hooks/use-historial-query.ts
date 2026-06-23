"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadHistorial, dbUpdateComment } from "@/lib/actions"
import type { Movement } from "@/lib/finance"
import type { HistorialFilters } from "./use-historial-filters"

export function useHistorialQuery(
  filters: HistorialFilters,
  page: number,
  pageSize: number,
) {
  const [items, setItems] = useState<Movement[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const commentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)

    loadHistorial({
      page,
      pageSize,
      action: filters.action || undefined,
      recordType: filters.recordType || undefined,
      search: filters.search || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    })
      .then((result) => {
        if (id !== reqId.current) return
        setItems(result.items)
        setTotal(result.total)
      })
      .catch(console.error)
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [
    page,
    pageSize,
    filters.action,
    filters.recordType,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
  ])

  const updateLocalComment = useCallback((id: string, comment: string) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, comment } : m)))
    clearTimeout(commentTimers.current[id])
    commentTimers.current[id] = setTimeout(() => {
      dbUpdateComment(id, comment).catch(console.error)
    }, 600)
  }, [])

  return { items, total, loading, updateLocalComment }
}
