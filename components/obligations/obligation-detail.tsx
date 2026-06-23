"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { currencies, formatAmount } from "@/lib/finance"
import type { Currency } from "@/lib/finance"
import {
  type Obligation,
  type PaymentType,
  type RecurrenceType,
  OBLIGATION_TYPE_LABELS,
  OBLIGATION_STATUS_LABELS,
  RECURRENCE_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
  INSTALLMENT_STATUS_LABELS,
  computeRecurringBreakdown,
  pendingInstallmentsTotal,
  formatObligationDate,
  isOverdue,
} from "@/lib/obligations"
import {
  addObligationRule,
  deleteObligationRule,
  pauseObligationRule,
  resumeObligationRule,
  updateObligationStatus,
  updateObligationInfo,
  finalizeObligation,
  registerManualPayment,
  acceptInstallmentPayment,
} from "@/lib/obligation-actions"
import { useObligations } from "@/components/obligations-store"

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteObligationDialog({
  obligation,
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  obligation: Obligation
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (generateExpenses: boolean) => void
  loading: boolean
}) {
  const [generateExpenses, setGenerateExpenses] = useState(false)

  const isInstallment = obligation.obligationType === "INSTALLMENT"
  const pendingInstallments = obligation.installments.filter(
    (i) => i.status === "PENDING" || i.status === "OVERDUE",
  )
  const pendingAmount = pendingInstallments.reduce((s, i) => s + i.expectedAmount, 0)
  const hasPendingInstallments = isInstallment && pendingInstallments.length > 0

  const confirmLabel = hasPendingInstallments && generateExpenses
    ? "Finalizar y registrar gastos"
    : "Cancelar obligación"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v) }}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Finalizar obligación</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4">
          <p className="text-sm">
            <span className="font-semibold">{obligation.name}</span>
          </p>

          {hasPendingInstallments && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Saldo pendiente</span>
                <span className="font-semibold text-black">
                  {formatAmount(pendingAmount, obligation.currency)} {obligation.currency}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>Cuotas pendientes</span>
                <span className="font-semibold text-black">{pendingInstallments.length}</span>
              </div>
            </div>
          )}

          {hasPendingInstallments && (
            <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={generateExpenses}
                onChange={(e) => setGenerateExpenses(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <div>
                <div className="font-medium">Generar gastos por cuotas pendientes</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Se registrará un gasto por cada cuota pendiente.
                  La obligación quedará como <strong>Completada</strong>.
                </div>
              </div>
            </label>
          )}

          <p className="text-xs text-gray-400">
            El historial de pagos se conservará. Esta acción no se puede deshacer.
          </p>
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button
            variant="outline"
            className="border-2 border-black"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={() => onConfirm(hasPendingInstallments && generateExpenses)}
            disabled={loading}
          >
            {loading ? "Procesando..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Payments board ────────────────────────────────────────────────────────────

function PaymentsBoard({
  obligation,
  onReload,
}: {
  obligation: Obligation
  onReload?: () => void
}) {
  const [payingId, setPayingId] = useState<string | null>(null)
  const canPay = obligation.status === "ACTIVE" || obligation.status === "PAUSED"

  const handlePayInstallment = async (installmentId: string, installmentNumber: number) => {
    setPayingId(installmentId)
    try {
      await acceptInstallmentPayment(
        installmentId,
        `Cuota ${installmentNumber} — ${obligation.name}`,
      )
      onReload?.()
    } catch (err) {
      console.error(err)
    } finally {
      setPayingId(null)
    }
  }

  if (obligation.obligationType === "INSTALLMENT") {
    const insts = obligation.installments
    const paidCount = insts.filter((i) => i.status === "PAID").length
    return (
      <div data-testid="obligation-installments-board" className="border-2 border-black">
        <div className="border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">
            Cuotas ({paidCount}/{insts.length} pagadas)
          </span>
        </div>
        <div className="flex border-b border-black bg-gray-100 text-xs font-bold">
          <div className="w-12 px-2 py-1 text-center">#</div>
          <div className="flex-1 px-2 py-1">Vencimiento</div>
          <div className="w-40 px-2 py-1 text-right">Monto</div>
          <div className="w-24 px-2 py-1 text-center">Estado</div>
          <div className="hidden w-24 px-2 py-1 text-center lg:block">Gasto ID</div>
          {canPay && <div className="w-20 px-2 py-1 text-center">Acción</div>}
        </div>
        {insts.map((inst) => {
          const overdue = inst.status === "PENDING" && isOverdue(inst.dueDate)
          const isPendingOrOverdue = inst.status === "PENDING" || inst.status === "OVERDUE"
          const statusColors: Record<string, string> = {
            PENDING: overdue ? "text-rose-700" : "text-amber-700",
            OVERDUE: "text-rose-700",
            PAID: "text-emerald-700",
            REJECTED: "text-gray-400",
          }
          return (
            <div key={inst.id} className="flex border-b border-black text-sm">
              <div className="w-12 px-2 py-1.5 text-center text-gray-500">
                {inst.installmentNumber}
              </div>
              <div className={`flex-1 px-2 py-1.5 ${overdue ? "font-medium text-rose-700" : ""}`}>
                {formatObligationDate(inst.dueDate)}
                {overdue && <span className="ml-1 text-xs">(vencida)</span>}
              </div>
              <div className="w-40 px-2 py-1.5 text-right">
                {formatAmount(inst.expectedAmount, obligation.currency)} {obligation.currency}
              </div>
              <div className={`w-24 px-2 py-1.5 text-center text-xs font-semibold ${statusColors[inst.status]}`}>
                {INSTALLMENT_STATUS_LABELS[inst.status]}
              </div>
              <div className="hidden w-24 items-center justify-center px-2 py-1.5 lg:flex">
                {inst.gastoRecordId ? (
                  <span
                    title={inst.gastoRecordId}
                    className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500"
                  >
                    {inst.gastoRecordId.slice(0, 8)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>
              {canPay && (
                <div className="flex w-20 items-center justify-center px-2 py-1">
                  {isPendingOrOverdue && (
                    <button
                      onClick={() => handlePayInstallment(inst.id, inst.installmentNumber)}
                      disabled={payingId === inst.id}
                      className="rounded border-2 border-black px-2 py-0.5 text-xs font-semibold hover:bg-black hover:text-white disabled:opacity-50"
                    >
                      {payingId === inst.id ? "..." : "Pagar"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div className="flex border-t-2 border-black bg-gray-100 text-sm font-bold">
          <div className="flex-1 px-2 py-1.5">Saldo pendiente</div>
          <div className="w-40 px-2 py-1.5 text-right">
            {formatAmount(pendingInstallmentsTotal(insts), obligation.currency)} {obligation.currency}
          </div>
          <div className="w-24" />
          <div className="hidden w-24 lg:block" />
          {canPay && <div className="w-20" />}
        </div>
      </div>
    )
  }

  // RECURRING or FIXED: show payment history
  const payments = obligation.payments
  return (
    <div data-testid="obligation-payments-board" className="border-2 border-black">
      <div className="border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Pagos</span>
      </div>
      {payments.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Sin pagos registrados.</div>
      ) : (
        <>
          <div className="flex border-b border-black bg-gray-100 text-xs font-bold">
            <div className="flex-1 px-2 py-1">Fecha esperada</div>
            <div className="w-36 px-2 py-1 text-right">Monto esperado</div>
            <div className="w-36 px-2 py-1 text-right">Pago realizado</div>
            <div className="w-20 px-2 py-1 text-center">Tipo</div>
            <div className="w-20 px-2 py-1 text-center">Estado</div>
            <div className="hidden w-24 px-2 py-1 text-center lg:block">Gasto ID</div>
          </div>
          {payments.map((p) => (
            <div key={p.id} className="flex border-b border-black text-sm">
              <div className="flex-1 px-2 py-1.5 text-gray-700">
                {p.expectedDate ? formatObligationDate(p.expectedDate) : "—"}
                {p.comment && (
                  <span className="ml-2 text-xs text-gray-400">{p.comment}</span>
                )}
              </div>
              <div className="w-36 px-2 py-1.5 text-right">
                {p.expectedAmount != null
                  ? `${formatAmount(p.expectedAmount, p.currency)} ${p.currency}`
                  : "—"}
              </div>
              <div className="w-36 px-2 py-1.5 text-right">
                {p.actualAmount != null
                  ? `${formatAmount(p.actualAmount, p.currency)} ${p.currency}`
                  : p.status === "PAID" ? "—" : ""}
              </div>
              <div className="w-20 px-2 py-1.5 text-center text-xs text-gray-500">
                {PAYMENT_TYPE_LABELS[p.paymentType]}
              </div>
              <div className="w-20 px-2 py-1.5 text-center text-xs">
                <span className={
                  p.status === "PAID"
                    ? "font-semibold text-emerald-700"
                    : p.status === "REJECTED"
                      ? "text-gray-400"
                      : "text-amber-700"
                }>
                  {p.status === "PAID" ? "Pagado" : p.status === "REJECTED" ? "Rechazado" : "Pendiente"}
                </span>
              </div>
              <div className="hidden w-24 items-center justify-center px-2 py-1.5 lg:flex">
                {p.gastoRecordId ? (
                  <span
                    title={p.gastoRecordId}
                    className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500"
                  >
                    {p.gastoRecordId.slice(0, 8)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Rules board (RECURRING) ───────────────────────────────────────────────────

function RulesBoard({ obligation, onReload }: { obligation: Obligation; onReload: () => void }) {
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState("")
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("MONTHLY")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("ARS")
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const handleAdd = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    try {
      await addObligationRule(obligation.id, {
        name: name.trim(),
        recurrenceType,
        startDate,
        expectedAmount: parseFloat(amount),
        currency,
      })
      setName(""); setAmount(""); setAddOpen(false)
      onReload()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleDelete = (ruleId: string) => {
    startTransition(async () => {
      await deleteObligationRule(ruleId, obligation.id)
      onReload()
    })
  }

  const handlePause = (ruleId: string, currentStatus: string) => {
    startTransition(async () => {
      if (currentStatus === "ACTIVE") await pauseObligationRule(ruleId, obligation.id)
      else await resumeObligationRule(ruleId, obligation.id)
      onReload()
    })
  }

  const breakdown = computeRecurringBreakdown(obligation.rules)

  return (
    <div data-testid="obligation-rules-board" className="border-2 border-black">
      <div className="flex items-center justify-between border-b-2 border-black bg-black px-3 py-2">
        <span className="font-bold italic text-white">Reglas de gasto</span>
        {obligation.status === "ACTIVE" && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        )}
      </div>

      {obligation.rules.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Sin reglas. Agrega la primera.</div>
      )}

      {obligation.rules.map((rule) => (
        <div key={rule.id} className="group flex items-center border-b border-black px-3 py-2 text-sm hover:bg-gray-50">
          <div className="flex-1">
            <span className={rule.status === "PAUSED" ? "text-gray-400 line-through" : "font-medium"}>
              {rule.name}
            </span>
            <span className="ml-2 text-xs text-gray-400">
              {RECURRENCE_TYPE_LABELS[rule.recurrenceType]} · desde {formatObligationDate(rule.startDate)}
            </span>
          </div>
          <div className="w-36 text-right">
            {formatAmount(rule.expectedAmount, rule.currency)} {rule.currency}
          </div>
          {obligation.status === "ACTIVE" && (
            <div className="ml-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => handlePause(rule.id, rule.status)}
                className="px-1 text-xs text-gray-400 hover:text-black"
                title={rule.status === "ACTIVE" ? "Pausar regla" : "Reanudar regla"}
              >
                {rule.status === "ACTIVE" ? "⏸" : "▶"}
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                className="text-gray-400 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Annual projection footer */}
      {Object.keys(breakdown).length > 0 && (
        <div className="border-t-2 border-black bg-gray-100 px-3 py-2 text-xs text-gray-600">
          <span className="font-semibold">Proyección anual:</span>{" "}
          {(Object.entries(breakdown) as [Currency, number][]).map(([cur, val]) => (
            <span key={cur} className="mr-3">{formatAmount(val, cur)} {cur}</span>
          ))}
        </div>
      )}

      {/* Add rule dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
          <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
            <DialogTitle className="font-bold italic text-white">Agregar regla de gasto</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-4 py-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Nombre *</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Alquiler" className="rounded-none border-2 border-black focus-visible:ring-0" />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Monto *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="rounded-none border-2 border-black focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger className="w-20 rounded-none border-2 border-black focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Recurrencia</Label>
              <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}>
                <SelectTrigger className="rounded-none border-2 border-black focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">Fecha inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-none border-2 border-black focus-visible:ring-0" />
            </div>
          </div>
          <DialogFooter className="border-t-2 border-black px-4 py-3">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-2 border-black">Cancelar</Button>
            <Button onClick={handleAdd} disabled={!name.trim() || !amount || saving} className="bg-black text-white hover:bg-gray-800">
              {saving ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Manual payment dialog (FIXED) ─────────────────────────────────────────────

function ManualPaymentDialog({
  obligation,
  open,
  onOpenChange,
  onDone,
}: {
  obligation: Obligation
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentType>("PAYMENT")
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => { setAmount(""); setComment(""); setPaymentType("PAYMENT"); setSaving(false) }

  const handleSave = async () => {
    if (!amount) return
    setSaving(true)
    try {
      const prefix = paymentType === "INTEREST" ? "Intereses" : paymentType === "FEE" ? "Comisión" : "Pago"
      await registerManualPayment(obligation.id, {
        amount: parseFloat(amount),
        paymentType,
        comment: comment || undefined,
        gastoName: `${prefix} — ${obligation.name}`,
      })
      reset()
      onOpenChange(false)
      onDone()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Registrar pago</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Tipo</Label>
            <div className="flex gap-3">
              {(["PAYMENT", "INTEREST", "FEE"] as PaymentType[]).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input type="radio" name="payment-type" value={t} checked={paymentType === t} onChange={() => setPaymentType(t)} />
                  {PAYMENT_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Monto ({obligation.currency}) *</Label>
            <Input autoFocus type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="rounded-none border-2 border-black focus-visible:ring-0" />
          </div>
          {paymentType === "PAYMENT" && obligation.amount > 0 && (
            <p className="text-xs text-gray-500">
              Saldo actual: {formatAmount(obligation.amount, obligation.currency)} {obligation.currency}
              {amount && parseFloat(amount) > 0 && (
                <> → {formatAmount(Math.max(0, obligation.amount - parseFloat(amount)), obligation.currency)} {obligation.currency} después del pago</>
              )}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-bold uppercase">Comentario <span className="font-normal text-gray-400">(opcional)</span></Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notas..." rows={2} className="resize-none rounded-none border-2 border-black focus-visible:ring-0" />
          </div>
        </div>
        <DialogFooter className="border-t-2 border-black px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black">Cancelar</Button>
          <Button onClick={handleSave} disabled={!amount || saving} className="bg-black text-white hover:bg-gray-800">
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main detail component ─────────────────────────────────────────────────────

export function ObligationDetail({ initialObligation }: { initialObligation: Obligation }) {
  const router = useRouter()
  const { reload } = useObligations()
  const [obligation, setObligation] = useState(initialObligation)
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(obligation.name)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(obligation.description ?? "")
  const [, startTransition] = useTransition()

  const refresh = () => {
    reload()
    router.refresh()
  }

  const handleStatusChange = async (status: Obligation["status"]) => {
    startTransition(async () => {
      await updateObligationStatus(obligation.id, status)
      refresh()
    })
  }

  const handleFinalize = async (generateExpenses: boolean) => {
    setDeleting(true)
    try {
      await finalizeObligation(obligation.id, generateExpenses)
      reload()
      router.push("/obligaciones")
    } catch (err) {
      console.error(err)
      setDeleting(false)
    }
  }

  const saveName = async () => {
    if (!nameDraft.trim()) { setNameDraft(obligation.name); setEditingName(false); return }
    await updateObligationInfo(obligation.id, { name: nameDraft.trim() })
    setEditingName(false)
    refresh()
  }

  const saveDesc = async () => {
    await updateObligationInfo(obligation.id, { description: descDraft.trim() || undefined })
    setEditingDesc(false)
    refresh()
  }

  const canEdit = obligation.status === "ACTIVE" || obligation.status === "PAUSED"
  const isPaused = obligation.status === "PAUSED"

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 border-b-2 border-black pb-2">
        <Link href="/obligaciones" className="flex items-center gap-1 text-sm text-gray-500 hover:text-black">
          <ArrowLeft className="h-4 w-4" />
          Obligaciones
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-bold">{obligation.name}</span>
      </div>

      {/* Info panel */}
      <div data-testid="obligation-info-section" className="mb-4 border-2 border-black">
        <div className="border-b-2 border-black bg-black px-3 py-2">
          <span className="font-bold italic text-white">Información general</span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 text-sm md:grid-cols-2">
          {/* Name */}
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-gray-500">Nombre</div>
            {editingName ? (
              <div className="flex gap-1">
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName()
                    if (e.key === "Escape") { setNameDraft(obligation.name); setEditingName(false) }
                  }}
                  className="h-7 rounded-none border-2 border-black text-sm focus-visible:ring-0"
                />
                <button onClick={saveName} className="text-emerald-700"><Check className="h-4 w-4" /></button>
                <button onClick={() => { setNameDraft(obligation.name); setEditingName(false) }} className="text-gray-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => canEdit && setEditingName(true)}
                className="group flex items-center gap-1 text-left font-medium"
              >
                {obligation.name}
                {canEdit && <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
              </button>
            )}
          </div>

          {/* Type */}
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-gray-500">Tipo</div>
            <span>{OBLIGATION_TYPE_LABELS[obligation.obligationType]}</span>
          </div>

          {/* Status */}
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-gray-500">Estado</div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                {
                  ACTIVE: "bg-emerald-100 text-emerald-800",
                  PAUSED: "bg-amber-100 text-amber-800",
                  COMPLETED: "bg-gray-100 text-gray-600",
                  CANCELLED: "bg-rose-100 text-rose-800",
                }[obligation.status]
              }`}>
                {OBLIGATION_STATUS_LABELS[obligation.status]}
              </span>
              {canEdit && (
                <button
                  onClick={() => handleStatusChange(isPaused ? "ACTIVE" : "PAUSED")}
                  className="text-xs text-gray-400 underline hover:text-black"
                >
                  {isPaused ? "Reanudar" : "Pausar"}
                </button>
              )}
            </div>
          </div>

          {/* Value */}
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-gray-500">
              {obligation.obligationType === "RECURRING" ? "Proyección anual" : "Saldo pendiente"}
            </div>
            <span className="text-base font-bold">
              {obligation.obligationType === "RECURRING" ? (
                (() => {
                  const bd = computeRecurringBreakdown(obligation.rules)
                  const entries = Object.entries(bd).filter(([, v]) => v > 0) as [Currency, number][]
                  if (entries.length === 0) return <span className="font-normal text-gray-400">Sin reglas activas</span>
                  return entries.map(([cur, val]) => (
                    <span key={cur} className="mr-3">{formatAmount(val, cur)} {cur}</span>
                  ))
                })()
              ) : (
                <>{formatAmount(obligation.amount, obligation.currency)} {obligation.currency}</>
              )}
            </span>
          </div>

          {/* Next due date */}
          {obligation.nextDueDate && (
            <div>
              <div className="mb-1 text-xs font-bold uppercase text-gray-500">Próximo vencimiento</div>
              <span>{formatObligationDate(obligation.nextDueDate)}</span>
            </div>
          )}

          {/* Currency */}
          <div>
            <div className="mb-1 text-xs font-bold uppercase text-gray-500">Moneda</div>
            <span>{obligation.currency}</span>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-bold uppercase text-gray-500">Descripción</div>
            {editingDesc ? (
              <div className="flex flex-col gap-1">
                <Textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  className="resize-none rounded-none border-2 border-black text-sm focus-visible:ring-0"
                />
                <div className="flex gap-1">
                  <button onClick={saveDesc} className="text-emerald-700"><Check className="h-4 w-4" /></button>
                  <button onClick={() => { setDescDraft(obligation.description ?? ""); setEditingDesc(false) }} className="text-gray-500"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => canEdit && setEditingDesc(true)}
                className="group flex w-full items-start gap-1 text-left text-gray-700"
              >
                {obligation.description || <span className="italic text-gray-400">Sin descripción — click para editar</span>}
                {canEdit && <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 opacity-0 group-hover:opacity-100" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="mb-4 flex flex-wrap gap-2">
          {obligation.obligationType === "FIXED" && (
            <Button size="sm" className="gap-1 bg-black text-white hover:bg-gray-800" onClick={() => setManualPaymentOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Registrar pago
            </Button>
          )}

          {/* Eliminar → abre diálogo */}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-2 border-rose-700 text-rose-700 hover:bg-rose-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Eliminar
          </Button>
        </div>
      )}

      {/* Rules board (RECURRING only) */}
      {obligation.obligationType === "RECURRING" && (
        <div className="mb-4">
          <RulesBoard obligation={obligation} onReload={refresh} />
        </div>
      )}

      {/* Payments/Installments board */}
      <PaymentsBoard obligation={obligation} onReload={refresh} />

      {/* Manual payment dialog (FIXED) */}
      <ManualPaymentDialog
        obligation={obligation}
        open={manualPaymentOpen}
        onOpenChange={setManualPaymentOpen}
        onDone={refresh}
      />

      {/* Delete confirmation dialog */}
      <DeleteObligationDialog
        obligation={obligation}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleFinalize}
        loading={deleting}
      />
    </div>
  )
}
