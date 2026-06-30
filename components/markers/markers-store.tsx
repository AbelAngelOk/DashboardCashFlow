"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { loadMarkers } from "@/lib/marker-actions"
import type { MarkerDefinition } from "@/lib/marker-types"

interface MarkersContextValue {
  markers: MarkerDefinition[]
  reload: () => Promise<void>
}

const MarkersContext = createContext<MarkersContextValue>({
  markers: [],
  reload: async () => {},
})

export function MarkersProvider({ children }: { children: ReactNode }) {
  const [markers, setMarkers] = useState<MarkerDefinition[]>([])

  const reload = useCallback(async () => {
    try {
      const data = await loadMarkers()
      setMarkers(data)
    } catch {
      // Not critical — markers are an enhancement
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  return <MarkersContext.Provider value={{ markers, reload }}>{children}</MarkersContext.Provider>
}

export function useMarkers() {
  return useContext(MarkersContext)
}
