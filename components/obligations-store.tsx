"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Obligation } from "@/lib/obligations"
import { loadObligations } from "@/lib/obligation-actions"

interface ObligationsContextValue {
  obligations: Obligation[]
  loading: boolean
  reload: () => void
}

const ObligationsContext = createContext<ObligationsContextValue | null>(null)

export function ObligationsProvider({ children }: { children: ReactNode }) {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    loadObligations()
      .then(setObligations)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <ObligationsContext.Provider value={{ obligations, loading, reload: fetchData }}>
      {children}
    </ObligationsContext.Provider>
  )
}

export function useObligations() {
  const ctx = useContext(ObligationsContext)
  if (!ctx) throw new Error("useObligations must be used within ObligationsProvider")
  return ctx
}
