"use client"

import { useCallback, useEffect, useState } from "react"
import { Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CutoffDialog } from "./cutoff-dialog"
import { getCutoffStatus } from "@/lib/cutoff-actions"
import type { CutoffResult, CutoffStatus } from "@/lib/cutoff"

const DISMISS_KEY = "cashflow:cutoff-dismissed"

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

function writeDismissed(period: string) {
  try {
    localStorage.setItem(DISMISS_KEY, period)
  } catch {}
}

interface CutoffBannerProps {
  /** Se llama tras un corte exitoso para refrescar los datos del dashboard */
  onDone: () => void
}

/**
 * Botón de corte del Dashboard + pop-up automático.
 *
 * El botón solo se renderiza cuando hay un período pendiente (RB-C05), que es
 * lo que impide cortar todos los días. El pop-up se abre solo una vez por
 * período: "Ahora no" lo silencia sin consumir el corte (RB-C04).
 */
export function CutoffBanner({ onDone }: CutoffBannerProps) {
  const [status, setStatus] = useState<CutoffStatus | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const s = await getCutoffStatus()
      setStatus(s)
      return s
    } catch {
      setStatus(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    refresh().then((s) => {
      if (cancelled || !s || !s.available) return
      // Pop-up automático salvo que el usuario ya lo haya descartado este período
      if (readDismissed() !== s.pendingPeriod) setDialogOpen(true)
    })
    return () => { cancelled = true }
  }, [refresh])

  const handleDone = (_result: CutoffResult) => {
    refresh()
    onDone()
  }

  const handleDismiss = () => {
    if (status) writeDismissed(status.pendingPeriod)
  }

  if (!status || !status.available) return null

  return (
    <>
      <Button
        data-testid="cutoff-button"
        size="sm"
        variant="outline"
        className="gap-2 border-2 border-black font-bold hover:bg-gray-100"
        onClick={() => setDialogOpen(true)}
        title={`Cerrar ${status.pendingPeriodLabel} y preparar ${status.incomingPeriodLabel}`}
      >
        <Scissors className="h-4 w-4" />
        Realizar corte de mes
      </Button>

      <CutoffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        status={status}
        onDone={handleDone}
        onDismiss={handleDismiss}
      />
    </>
  )
}
