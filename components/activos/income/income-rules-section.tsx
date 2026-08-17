"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Pause, Play, Trash2, Check, X, TrendingUp } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { formatAmount, type Currency } from "@/lib/finance"
import {
  INCOME_STATUS_LABELS,
  RECURRENCE_TYPE_LABELS,
  type IncomeOccurrence,
  type IncomeRule,
  type IncomeStreamData,
} from "@/lib/income-streams"
import {
  deleteIncomeRule,
  loadIncomeRules,
  pauseIncomeRule,
  rejectIncomeOccurrence,
  resumeIncomeRule,
  setIncomeStreamValueMode,
} from "@/lib/income-actions"
import { IncomeRuleDialog } from "./income-rule-dialog"
import { CollectIncomeDialog } from "./collect-income-dialog"

interface IncomeRulesSectionProps {
  recordId: string
  assetCurrency: Currency
  assetAmount: number
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "border-amber-500 text-amber-700",
  COLLECTED: "border-emerald-600 text-emerald-700",
  REJECTED: "border-rose-500 text-rose-700",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function IncomeRulesSection({
  recordId,
  assetCurrency,
  assetAmount,
}: IncomeRulesSectionProps) {
  const router = useRouter()
  const [data, setData] = useState<IncomeStreamData | null>(null)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<IncomeRule | null>(null)
  const [collecting, setCollecting] = useState<IncomeOccurrence | null>(null)
  const [showAllOccurrences, setShowAllOccurrences] = useState(false)

  const reload = useCallback(async () => {
    try {
      setData(await loadIncomeRules(recordId))
    } catch {
      setData(null)
    }
  }, [recordId])

  useEffect(() => { reload() }, [reload])

  const afterMutation = () => {
    reload()
    router.refresh()
  }

  const guard = async (fn: () => Promise<void>, errorTitle: string) => {
    try {
      await fn()
      afterMutation()
    } catch (e) {
      toast({
        variant: "destructive",
        title: errorTitle,
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    }
  }

  const handleDelete = (rule: IncomeRule) => {
    if (!confirm(`¿Eliminar "${rule.name}"? Los cobros pendientes se cancelan; los ya confirmados se conservan.`)) return
    guard(() => deleteIncomeRule(rule.id), "No se pudo eliminar la regla")
  }

  const handleReject = (occ: IncomeOccurrence) => {
    if (!confirm(`¿Rechazar el cobro de "${occ.ruleName}" del ${formatDate(occ.expectedDate)}?`)) return
    guard(() => rejectIncomeOccurrence(occ.id), "No se pudo rechazar el cobro")
  }

  const projectionEntries = data
    ? (Object.entries(data.annualProjection) as [Currency, number][]).filter(([, v]) => v > 0)
    : []

  const pending = data?.occurrences.filter((o) => o.status === "PENDING") ?? []
  const visibleOccurrences = showAllOccurrences
    ? (data?.occurrences ?? [])
    : pending.slice(0, 6)

  const hasPrincipalRule = data?.rules.some((r) => r.reducesPrincipal) ?? false

  return (
    <div data-testid="asset-income-rules" className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Ingresos recurrentes</span>
        <button
          onClick={() => { setEditingRule(null); setRuleDialogOpen(true) }}
          className="flex items-center gap-1 border border-white px-2 py-0.5 text-xs font-bold text-white hover:bg-white hover:text-black"
        >
          <Plus className="h-3 w-3" />
          Agregar
        </button>
      </div>

      {/* Proyección anual */}
      {projectionEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 border-b-2 border-black bg-gray-50 px-4 py-3">
          <div>
            <div className="flex items-center gap-1 text-xs font-bold uppercase text-gray-500">
              <TrendingUp className="h-3 w-3" />
              Ganancia anual proyectada
            </div>
            <div className="mt-0.5 flex flex-wrap gap-3">
              {projectionEntries.map(([currency, value]) => (
                <span key={currency} className="text-lg font-bold">
                  {formatAmount(value, currency)} {currency}
                </span>
              ))}
            </div>
          </div>
          {hasPrincipalRule && (
            <div>
              <div className="text-xs font-bold uppercase text-gray-500">Capital pendiente</div>
              <div className="mt-0.5 text-lg font-bold">
                {formatAmount(assetAmount, assetCurrency)} {assetCurrency}
              </div>
            </div>
          )}

          {/* Modo de valuación — espejo de cómo una obligación recurrente vale su costo anual */}
          {!hasPrincipalRule && (
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={data?.valueIsProjection ?? false}
                onChange={(e) =>
                  guard(
                    () => setIncomeStreamValueMode(recordId, e.target.checked ? "PROJECTION" : "MANUAL"),
                    "No se pudo cambiar el modo de valuación",
                  )
                }
                className="mt-0.5"
              />
              <span className="text-gray-600">
                El valor del activo <b>es</b> esta proyección anual
                <span className="block text-[11px] text-gray-500">
                  Para sueldos y rentas sin patrimonio propio. Apagado, el valor lo fijás vos.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Reglas */}
      {data && data.rules.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-gray-500">
          Sin ingresos recurrentes. Agregá uno para proyectar la ganancia anual y generar los cobros
          de cada período.
        </p>
      )}

      {data && data.rules.length > 0 && (
        <div className="border-b-2 border-black">
          {data.rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 text-sm last:border-b-0">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{rule.name}</span>
                  {rule.status === "PAUSED" && (
                    <span className="border border-gray-400 px-1 text-[10px] font-bold uppercase text-gray-500">
                      Pausada
                    </span>
                  )}
                  {rule.status === "COMPLETED" && (
                    <span className="border border-emerald-600 px-1 text-[10px] font-bold uppercase text-emerald-700">
                      Completada
                    </span>
                  )}
                  {rule.reducesPrincipal && (
                    <span className="border border-black px-1 text-[10px] font-bold uppercase">
                      Descuenta capital
                    </span>
                  )}
                  {rule.amountMode === "PERCENTAGE" && (
                    <span className="border border-black px-1 text-[10px] font-bold uppercase">
                      % del valor
                    </span>
                  )}
                  {rule.settlement === "IN_KIND" && (
                    <span className="border border-black px-1 text-[10px] font-bold uppercase">
                      En especie
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {RECURRENCE_TYPE_LABELS[rule.recurrenceType]} · desde {formatDate(rule.startDate)}
                  {rule.installmentCount != null &&
                    ` · cuota ${Math.min(rule.settledCount ?? 0, rule.installmentCount)} de ${rule.installmentCount}`}
                  {rule.adjustmentPct != null && rule.adjustEveryN != null &&
                    ` · +${rule.adjustmentPct}% cada ${rule.adjustEveryN}`}
                </div>
              </div>
              <div className="font-mono text-sm font-bold">
                {rule.amountMode === "PERCENTAGE"
                  ? `${rule.percentage ?? 0}%`
                  : `${formatAmount(rule.expectedAmount, rule.currency)} ${rule.currency}`}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingRule(rule); setRuleDialogOpen(true) }}
                  className="p-1 text-gray-400 hover:text-black"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() =>
                    guard(
                      () => (rule.status === "ACTIVE" ? pauseIncomeRule(rule.id) : resumeIncomeRule(rule.id)),
                      "No se pudo cambiar el estado de la regla",
                    )
                  }
                  className="p-1 text-gray-400 hover:text-black"
                  title={rule.status === "ACTIVE" ? "Pausar" : "Reanudar"}
                >
                  {rule.status === "ACTIVE"
                    ? <Pause className="h-3.5 w-3.5" />
                    : <Play className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(rule)}
                  className="p-1 text-gray-400 hover:text-rose-600"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ocurrencias */}
      {data && data.occurrences.length > 0 && (
        <div>
          <div className="flex items-center justify-between bg-gray-100 px-4 py-1.5">
            <span className="text-xs font-bold uppercase">
              {showAllOccurrences ? "Todos los cobros" : "Próximos cobros"}
            </span>
            <button
              onClick={() => setShowAllOccurrences((v) => !v)}
              className="text-xs font-semibold text-gray-500 underline hover:text-black"
            >
              {showAllOccurrences ? "Ver solo pendientes" : `Ver todos (${data.occurrences.length})`}
            </button>
          </div>

          {visibleOccurrences.map((occ) => (
            <div key={occ.id} className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 text-sm last:border-b-0">
              <div className="w-24 text-xs text-gray-500">{formatDate(occ.expectedDate)}</div>
              <div className="flex-1">
                <span className="font-medium">{occ.ruleName}</span>
                {occ.ingresoActive && occ.status === "PENDING" && (
                  <span className="ml-2 text-[10px] font-bold uppercase text-gray-400">
                    en el dashboard
                  </span>
                )}
                {occ.comment && (
                  <div className="text-xs text-gray-500">{occ.comment}</div>
                )}
              </div>
              <div className="text-right font-mono text-sm">
                {occ.status === "COLLECTED" && occ.actualAmount != null ? (
                  <>
                    <span className="font-bold">
                      {formatAmount(occ.actualAmount, occ.currency)}
                    </span>
                    {Math.abs(occ.actualAmount - occ.expectedAmount) > 0.001 && (
                      <span className="ml-1 text-xs text-gray-400 line-through">
                        {formatAmount(occ.expectedAmount, occ.currency)}
                      </span>
                    )}
                  </>
                ) : (
                  <span>{formatAmount(occ.expectedAmount, occ.currency)}</span>
                )}
              </div>
              <span
                className={`w-20 shrink-0 border px-1 text-center text-[10px] font-bold uppercase ${
                  STATUS_STYLES[occ.status] ?? "border-gray-400 text-gray-500"
                }`}
              >
                {INCOME_STATUS_LABELS[occ.status]}
              </span>
              <div className="flex w-14 shrink-0 items-center justify-end gap-1">
                {occ.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => setCollecting(occ)}
                      className="p-1 text-gray-400 hover:text-emerald-600"
                      title="Confirmar cobro"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleReject(occ)}
                      className="p-1 text-gray-400 hover:text-rose-600"
                      title="Rechazar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {!showAllOccurrences && pending.length === 0 && (
            <p className="px-4 py-4 text-center text-xs text-gray-500">
              No hay cobros pendientes.
            </p>
          )}
        </div>
      )}

      <IncomeRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        recordId={recordId}
        assetCurrency={assetCurrency}
        rule={editingRule}
        onSaved={afterMutation}
      />

      <CollectIncomeDialog
        occurrence={collecting}
        onOpenChange={(v) => { if (!v) setCollecting(null) }}
        assetAmount={assetAmount}
        onCollected={afterMutation}
      />
    </div>
  )
}
