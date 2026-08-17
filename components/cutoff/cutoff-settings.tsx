"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { getCutoffStatus, setCutoffDay } from "@/lib/cutoff-actions"
import { MAX_CUTOFF_DAY, MIN_CUTOFF_DAY, type CutoffStatus } from "@/lib/cutoff"

const DAYS = Array.from(
  { length: MAX_CUTOFF_DAY - MIN_CUTOFF_DAY + 1 },
  (_, i) => MIN_CUTOFF_DAY + i,
)

function formatDate(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function CutoffSettings() {
  const [status, setStatus] = useState<CutoffStatus | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCutoffStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  const handleChange = async (value: string) => {
    const day = Number(value)
    setSaving(true)
    try {
      await setCutoffDay(day)
      const next = await getCutoffStatus()
      setStatus(next)
      toast({
        title: "Día de corte actualizado",
        description: `El corte pasa a habilitarse el día ${day} de cada mes.`,
      })
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar el día de corte",
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-8 border-2 border-black" data-testid="cutoff-settings">
      <div className="border-b-2 border-black bg-black px-4 py-2">
        <h2 className="font-bold italic text-white">Corte Mensual</h2>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Día de corte</p>
            <p className="text-xs text-gray-500">
              El período va del día elegido de un mes al mismo día del siguiente.
              Se limita a 28 para que exista en todos los meses.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
            <Select
              value={status ? String(status.cutoffDay) : undefined}
              onValueChange={handleChange}
              disabled={!status || saving}
            >
              <SelectTrigger className="h-8 w-20 border-2 border-black text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {status && (
          <div className="border-t border-gray-200 pt-3 text-xs">
            <div className="flex justify-between py-0.5">
              <span className="text-gray-600">Último corte</span>
              <span className="font-semibold">
                {status.lastCutoffPeriod
                  ? `${status.lastCutoffPeriod} · ${formatDate(status.lastCutoffAt)}`
                  : "Ninguno todavía"}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-600">Período pendiente</span>
              <span className="font-semibold">
                {status.available
                  ? `${status.pendingPeriodLabel} · disponible desde ${formatDate(status.pendingSince)}`
                  : "Ninguno"}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-gray-600">Próximo corte</span>
              <span className="font-semibold">{formatDate(status.nextCutoffAt)}</span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-500">
          El corte nunca se ejecuta solo: cuando corresponde, aparece un aviso en el
          Dashboard y el botón «Realizar corte de mes».
        </p>
      </div>
    </div>
  )
}
