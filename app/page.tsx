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

export default function DashboardPage() {
  const { records, snapshots, createRecord, editRecord, deleteRecord, takeSnapshot } =
    useFinance()

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [snapshotName, setSnapshotName] = useState("")
  const [snapshotPeriod, setSnapshotPeriod] = useState("")

  const openSnapshotDialog = () => {
    setSnapshotName(`Snapshot ${snapshots.length + 1}`)
    setSnapshotPeriod(currentPeriod())
    setSnapshotDialogOpen(true)
  }

  const confirmSnapshot = () => {
    if (!snapshotName.trim()) return
    takeSnapshot(snapshotName, snapshotPeriod)
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
      />

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
            <div className="flex flex-col gap-2">
              <Label htmlFor="snap-period">Periodo de tiempo</Label>
              <Input
                id="snap-period"
                value={snapshotPeriod}
                onChange={(e) => setSnapshotPeriod(e.target.value)}
                placeholder="Ej: Enero 2026"
              />
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
