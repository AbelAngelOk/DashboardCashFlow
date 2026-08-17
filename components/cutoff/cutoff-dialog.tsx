"use client"

import { useEffect, useState } from "react"
import { Scissors, Loader2, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { executeCutoff, getCutoffPreview } from "@/lib/cutoff-actions"
import type { CutoffPreview, CutoffResult, CutoffStatus } from "@/lib/cutoff"

interface CutoffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: CutoffStatus
  /** Se llama tras un corte exitoso, para refrescar el dashboard */
  onDone: (result: CutoffResult) => void
  /** Se llama al elegir "Ahora no" */
  onDismiss: () => void
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <button
        data-testid={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative mt-1 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "border-black bg-black" : "border-gray-400 bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  )
}

export function CutoffDialog({
  open,
  onOpenChange,
  status,
  onDone,
  onDismiss,
}: CutoffDialogProps) {
  const [preview, setPreview] = useState<CutoffPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [running, setRunning] = useState(false)

  const [takeSnapshot, setTakeSnapshot] = useState(true)
  const [keepMarked, setKeepMarked] = useState(false)
  const [clearEntityMarkers, setClearEntityMarkers] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingPreview(true)
    getCutoffPreview()
      .then((p) => { if (!cancelled) setPreview(p) })
      .catch(() => { if (!cancelled) setPreview(null) })
      .finally(() => { if (!cancelled) setLoadingPreview(false) })
    return () => { cancelled = true }
  }, [open])

  const handleConfirm = async () => {
    setRunning(true)
    try {
      const result = await executeCutoff({ takeSnapshot, keepMarked, clearEntityMarkers })
      toast({
        title: `Corte de ${status.pendingPeriodLabel} realizado`,
        description:
          `${result.ingresosArchived} ingresos y ${result.gastosArchived} gastos a histórico. ` +
          `${result.gastosGenerated} gastos y ${result.ingresosGenerated} ingresos generados para ${status.incomingPeriodLabel}.`,
      })
      onOpenChange(false)
      onDone(result)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo realizar el corte",
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setRunning(false)
    }
  }

  const handleDismiss = () => {
    onDismiss()
    onOpenChange(false)
  }

  const archiveTotal = preview
    ? preview.ingresosToArchive + preview.gastosToArchive - (keepMarked ? preview.markedToArchive : 0)
    : 0

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!running) onOpenChange(v) }}>
      <DialogContent data-testid="cutoff-dialog" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Corte de mes — {status.pendingPeriodLabel}
          </DialogTitle>
          <DialogDescription>
            Los ingresos y gastos activos pasan a histórico, y se preparan los de{" "}
            {status.incomingPeriodLabel} a partir de tus obligaciones y activos.
          </DialogDescription>
        </DialogHeader>

        {/* Vista previa del impacto */}
        <div
          data-testid="cutoff-preview"
          className="border-2 border-black bg-gray-50 p-3"
        >
          {loadingPreview ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Calculando impacto…
            </div>
          ) : preview ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                <span>{status.pendingPeriodLabel}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{status.incomingPeriodLabel}</span>
              </div>
              <div className="flex flex-col gap-1">
                <PreviewRow label="Ingresos a histórico" value={preview.ingresosToArchive} />
                <PreviewRow label="Gastos a histórico" value={preview.gastosToArchive} />
                {preview.markedToArchive > 0 && (
                  <PreviewRow
                    label={keepMarked ? "Se conservan por etiqueta" : "Con etiqueta (se archivan)"}
                    value={preview.markedToArchive}
                  />
                )}
                <div className="my-1 border-t border-gray-300" />
                <PreviewRow label="Gastos de obligaciones a generar" value={preview.gastosToGenerate} />
                <PreviewRow label="Ingresos de dividendos a generar" value={preview.ingresosToGenerate} />
                {clearEntityMarkers && (
                  <PreviewRow
                    label="Etiquetas a quitar"
                    value={preview.entityMarkersToClear}
                  />
                )}
              </div>
              <p className="text-[11px] text-gray-500">
                {archiveTotal} registros dejarán el dashboard.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No se pudo calcular el impacto.</p>
          )}
        </div>

        {/* Switches */}
        <div className="flex flex-col gap-5 py-1">
          <SwitchRow
            id="cutoff-switch-snapshot"
            label="Guardar snapshot del mes que sale"
            description={`Toma una foto del dashboard antes de archivar, con el nombre "Cierre ${status.pendingPeriodLabel}".`}
            checked={takeSnapshot}
            onCheckedChange={setTakeSnapshot}
            disabled={running}
          />
          <SwitchRow
            id="cutoff-switch-keep-marked"
            label="Mantener los ingresos y gastos con etiqueta"
            description="Los registros etiquetados cruzan el corte y siguen activos. Útil si usás etiquetas como “revisar” para marcar lo que quedó pendiente."
            checked={keepMarked}
            onCheckedChange={setKeepMarked}
            disabled={running}
          />
          <SwitchRow
            id="cutoff-switch-clear-markers"
            label="Quitar las etiquetas a activos y obligaciones"
            description="Como activos y obligaciones sobreviven al corte, sus etiquetas suelen ser del mes que cierra. Los marcadores no se borran, solo se desasignan."
            checked={clearEntityMarkers}
            onCheckedChange={setClearEntityMarkers}
            disabled={running}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDismiss} disabled={running}>
            Ahora no
          </Button>
          <Button
            className="gap-2 bg-black text-white hover:bg-gray-800"
            onClick={handleConfirm}
            disabled={running || loadingPreview}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
            {running ? "Realizando corte…" : "Confirmar corte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
