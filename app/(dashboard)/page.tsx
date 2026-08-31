"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DashboardSheet } from "@/components/dashboard-sheet"
import { useFinance, currentPeriod } from "@/components/finance-store"
import { GroupBreakdownDialog } from "@/components/activos/group-breakdown-dialog"
import { ObligationFormDialog } from "@/components/obligations/obligation-form-dialog"
import { AssetFormDialog } from "@/components/activos/asset-form-dialog"
import { CutoffBanner } from "@/components/cutoff/cutoff-banner"
import { OnboardingCard } from "@/components/onboarding-card"
import { addMovement, zeroOutAsset, createExtractFromDashboard } from "@/lib/assets-actions"
import { loadGastoGroups, loadIngresoGroups, type FlowGroupWithMembers } from "@/lib/flow-group-actions"
import type { FinancialRecord } from "@/lib/finance"
import type { DashboardMovementType } from "@/components/dashboard-sheet"

export default function DashboardPage() {
  const router = useRouter()
  const { records, snapshots, loading, createRecord, editRecord, deleteRecord, takeSnapshot, reload } =
    useFinance()

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [breakdownRecord, setBreakdownRecord] = useState<FinancialRecord | null>(null)
  const [obligationFormOpen, setObligationFormOpen] = useState(false)
  const [assetFormOpen, setAssetFormOpen] = useState(false)
  const [gastoGroups, setGastoGroups] = useState<FlowGroupWithMembers[]>([])
  const [ingresoGroups, setIngresoGroups] = useState<FlowGroupWithMembers[]>([])

  useEffect(() => {
    Promise.all([loadGastoGroups(), loadIngresoGroups()])
      .then(([g, i]) => { setGastoGroups(g); setIngresoGroups(i) })
      .catch(console.error)
  }, [])

  // Tras un corte cambian registros, snapshots y auditoría: se recarga todo
  const handleCutoffDone = () => {
    reload()
    Promise.all([loadGastoGroups(), loadIngresoGroups()])
      .then(([g, i]) => { setGastoGroups(g); setIngresoGroups(i) })
      .catch(console.error)
  }

  const handleGroupAdjust = (record: FinancialRecord, previous: FinancialRecord) => {
    editRecord(record, previous)
    const diff = record.amount - previous.amount
    addMovement({
      recordId: record.id,
      movementType: "ADJUSTMENT",
      amount: diff,
      currency: record.currency,
    }).catch(console.error)
  }

  const handleActivoDelete = (record: FinancialRecord, comment: string, createIngreso: boolean) => {
    // Zero out the record optimistically
    const zeroed = { ...record, amount: 0 }
    editRecord(zeroed, record)
    zeroOutAsset(record.id, record.amount, record.currency, record.name, comment || undefined, createIngreso)
      .then((ingresoId) => {
        if (ingresoId) {
          reload()
        }
      })
      .catch(console.error)
  }

  const handleActivoEditAmount = (
    record: FinancialRecord,
    previous: FinancialRecord,
    comment: string,
    movementType: DashboardMovementType,
    createGasto: boolean,
    createIngreso: boolean,
  ) => {
    if (record.isGroupParent) {
      handleGroupAdjust(record, previous)
    } else if (movementType === "EXTRACT") {
      const egressAmount = previous.amount - record.amount
      editRecord(record, previous)
      createExtractFromDashboard(
        record.id,
        record.amount,
        egressAmount,
        record.currency,
        record.name,
        comment || undefined,
        createIngreso,
      )
        .then((ingresoId) => { if (ingresoId) reload() })
        .catch(console.error)
    } else {
      editRecord(record, previous)
      const diff = record.amount - previous.amount
      addMovement({
        recordId: record.id,
        movementType,
        amount: diff,
        currency: record.currency,
        description: comment || undefined,
      }).catch(console.error)
      if (movementType === "DEPOSIT" && createGasto) {
        createRecord({
          id: crypto.randomUUID(),
          type: "gasto",
          name: `Depósito en ${record.name}`,
          amount: diff,
          currency: record.currency,
        })
      }
    }
  }
  const [snapshotName, setSnapshotName] = useState("")
  const [snapshotPeriod, setSnapshotPeriod] = useState("")

  const openSnapshotDialog = () => {
    const today = new Date()
    setSnapshotName(`Snapshot ${snapshots.length + 1}`)
    setSnapshotPeriod(
      today.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    )
    setSnapshotDialogOpen(true)
  }

  const confirmSnapshot = () => {
    if (!snapshotName.trim()) return
    takeSnapshot(snapshotName, snapshotPeriod.trim())
    setSnapshotDialogOpen(false)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="inline-block bg-black px-4 py-1 text-white">
          <span className="font-bold">Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <CutoffBanner onDone={handleCutoffDone} />
          <Button
            size="sm"
            className="gap-2 bg-black text-white hover:bg-gray-800"
            onClick={openSnapshotDialog}
          >
            <Camera className="h-4 w-4" />
            Tomar Snapshot
          </Button>
        </div>
      </div>

      {!loading && records.length === 0 && <OnboardingCard />}

      <DashboardSheet
        records={records}
        loading={loading}
        gastoGroups={gastoGroups}
        ingresoGroups={ingresoGroups}
        onCreate={createRecord}
        onEdit={editRecord}
        onDelete={deleteRecord}
        onGroupAdjust={handleGroupAdjust}
        onBreakdown={setBreakdownRecord}
        onDeleteWithComment={(r, c, i) => handleActivoDelete(r, c, i)}
        onEditAmountWithComment={(r, p, c, t, g, i) => handleActivoEditAmount(r, p, c, t, g, i)}
        onAddObligation={() => setObligationFormOpen(true)}
        onAddAsset={() => setAssetFormOpen(true)}
      />

      <ObligationFormDialog
        open={obligationFormOpen}
        onOpenChange={setObligationFormOpen}
        onCreated={(id) => {
          reload()
          router.push(`/obligaciones/${id}`)
        }}
      />

      <AssetFormDialog
        open={assetFormOpen}
        onOpenChange={setAssetFormOpen}
        onCreate={() => router.refresh()}
      />

      {breakdownRecord && (
        <GroupBreakdownDialog
          parentRecord={breakdownRecord}
          allRecords={records}
          onClose={() => setBreakdownRecord(null)}
        />
      )}

      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tomar Snapshot</DialogTitle>
            <DialogDescription>
              Guarda una foto de <strong>todos</strong> tus registros actuales, tal como están ahora mismo, para consultarla más tarde.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="snap-name">Nombre</Label>
              <Input
                id="snap-name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Ej: Cierre de mes"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="snap-period">Período (solo una etiqueta, no filtra nada)</Label>
              <Input
                id="snap-period"
                value={snapshotPeriod}
                onChange={(e) => setSnapshotPeriod(e.target.value)}
                placeholder="Ej: Agosto 2026"
              />
              <p className="text-xs text-gray-400">
                Es solo el nombre con el que vas a identificar este snapshot en la lista — el snapshot siempre incluye todos los registros que ves ahora en el dashboard, sin importar qué escribas acá.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSnapshotDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white hover:bg-gray-800"
              onClick={confirmSnapshot}
            >
              Guardar Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
