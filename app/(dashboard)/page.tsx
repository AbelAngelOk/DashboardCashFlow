"use client"

import { useState } from "react"
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
import { createAdjustmentMovement } from "@/lib/assets-actions"
import type { FinancialRecord } from "@/lib/finance"

export default function DashboardPage() {
  const { records, snapshots, createRecord, editRecord, deleteRecord, takeSnapshot } =
    useFinance()

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [breakdownRecord, setBreakdownRecord] = useState<FinancialRecord | null>(null)

  const handleGroupAdjust = (record: FinancialRecord, previous: FinancialRecord) => {
    editRecord(record, previous)
    const diff = record.amount - previous.amount
    createAdjustmentMovement(record.id, diff, record.currency).catch(console.error)
  }

  const handleActivoDelete = (record: FinancialRecord) => {
    deleteRecord(record)
  }

  const handleActivoEditAmount = (
    record: FinancialRecord,
    previous: FinancialRecord,
    comment: string,
  ) => {
    if (record.isGroupParent) {
      handleGroupAdjust(record, previous)
    } else {
      editRecord(record, previous)
      const diff = record.amount - previous.amount
      createAdjustmentMovement(
        record.id,
        diff,
        record.currency,
        comment || undefined,
      ).catch(console.error)
    }
  }
  const [snapshotName, setSnapshotName] = useState("")
  const [snapshotDateFrom, setSnapshotDateFrom] = useState("")
  const [snapshotDateTo, setSnapshotDateTo] = useState("")

  const openSnapshotDialog = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    setSnapshotName(`Snapshot ${snapshots.length + 1}`)
    setSnapshotDateFrom(firstDay.toISOString().slice(0, 10))
    setSnapshotDateTo(lastDay.toISOString().slice(0, 10))
    setSnapshotDialogOpen(true)
  }

  const formatDate = (iso: string) =>
    iso
      ? new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : ""

  const confirmSnapshot = () => {
    if (!snapshotName.trim()) return
    const period = `${formatDate(snapshotDateFrom)} - ${formatDate(snapshotDateTo)}`
    takeSnapshot(snapshotName, period)
    setSnapshotDialogOpen(false)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="inline-block bg-black px-4 py-1 text-white">
          <span className="font-bold">Dashboard</span>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-black text-white hover:bg-gray-800"
          onClick={openSnapshotDialog}
        >
          <Camera className="h-4 w-4" />
          Tomar Snapshot
        </Button>
      </div>

      <DashboardSheet
        records={records}
        onCreate={createRecord}
        onEdit={editRecord}
        onDelete={deleteRecord}
        onGroupAdjust={handleGroupAdjust}
        onBreakdown={setBreakdownRecord}
        onDeleteWithComment={handleActivoDelete}
        onEditAmountWithComment={handleActivoEditAmount}
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
              Guarda el estado actual del dashboard para consultarlo más tarde.
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
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="snap-from">Fecha inicio</Label>
                <Input
                  id="snap-from"
                  type="date"
                  value={snapshotDateFrom}
                  onChange={(e) => setSnapshotDateFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="snap-to">Fecha fin</Label>
                <Input
                  id="snap-to"
                  type="date"
                  value={snapshotDateTo}
                  onChange={(e) => setSnapshotDateTo(e.target.value)}
                />
              </div>
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
