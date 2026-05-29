"use client"

import { useMemo, useState } from "react"
import { Camera, History } from "lucide-react"
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
import { AppSidebar, type View } from "@/components/app-sidebar"
import { DashboardSheet } from "@/components/dashboard-sheet"
import {
  type FinancialRecord,
  type Movement,
  type Snapshot,
  formatAmount,
  recordTypeLabels,
} from "@/lib/finance"

function now() {
  return new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function currentPeriod() {
  return new Date().toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

const actionStyles: Record<Movement["action"], string> = {
  creado: "bg-emerald-100 text-emerald-800",
  editado: "bg-amber-100 text-amber-800",
  eliminado: "bg-rose-100 text-rose-800",
}

export default function Home() {
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [view, setView] = useState<View>({ kind: "dashboard" })

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [snapshotName, setSnapshotName] = useState("")
  const [snapshotPeriod, setSnapshotPeriod] = useState("")

  const logMovement = (
    action: Movement["action"],
    record: FinancialRecord,
    detail: string,
  ) => {
    setMovements((prev) => [
      {
        id: crypto.randomUUID(),
        date: now(),
        action,
        recordType: record.type,
        recordName: record.name,
        detail,
        comment: "",
      },
      ...prev,
    ])
  }

  const handleCreate = (record: FinancialRecord) => {
    setRecords((prev) => [...prev, record])
    logMovement(
      "creado",
      record,
      `${recordTypeLabels[record.type]} "${record.name}" por ${formatAmount(
        record.amount,
        record.currency,
      )} ${record.currency}`,
    )
  }

  const handleEdit = (record: FinancialRecord, previous: FinancialRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)))
    const changes: string[] = []
    if (previous.name !== record.name)
      changes.push(`nombre: "${previous.name}" → "${record.name}"`)
    if (previous.amount !== record.amount || previous.currency !== record.currency)
      changes.push(
        `monto: ${formatAmount(previous.amount, previous.currency)} ${
          previous.currency
        } → ${formatAmount(record.amount, record.currency)} ${record.currency}`,
      )
    logMovement(
      "editado",
      record,
      changes.length ? changes.join(", ") : "sin cambios de valor",
    )
  }

  const handleDelete = (record: FinancialRecord) => {
    setRecords((prev) => prev.filter((r) => r.id !== record.id))
    logMovement(
      "eliminado",
      record,
      `${recordTypeLabels[record.type]} "${record.name}" (${formatAmount(
        record.amount,
        record.currency,
      )} ${record.currency})`,
    )
  }

  const openSnapshotDialog = () => {
    setSnapshotName(`Snapshot ${snapshots.length + 1}`)
    setSnapshotPeriod(currentPeriod())
    setSnapshotDialogOpen(true)
  }

  const confirmSnapshot = () => {
    if (!snapshotName.trim()) return
    setSnapshots((prev) => [
      {
        id: crypto.randomUUID(),
        name: snapshotName.trim(),
        period: snapshotPeriod.trim() || currentPeriod(),
        createdAt: now(),
        records: records.map((r) => ({ ...r })),
      },
      ...prev,
    ])
    setSnapshotDialogOpen(false)
  }

  const updateComment = (id: string, comment: string) =>
    setMovements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, comment } : m)),
    )

  const activeSnapshot = useMemo(
    () =>
      view.kind === "snapshot"
        ? snapshots.find((s) => s.id === view.id)
        : undefined,
    [view, snapshots],
  )

  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      <AppSidebar
        view={view}
        onSelectDashboard={() => setView({ kind: "dashboard" })}
        onSelectMovimientos={() => setView({ kind: "movimientos" })}
        onOpenSnapshot={(id) => setView({ kind: "snapshot", id })}
        onTakeSnapshot={openSnapshotDialog}
        snapshots={snapshots}
        movementsCount={movements.length}
      />

      <main className="flex-1 overflow-x-auto p-6">
        {view.kind === "dashboard" && (
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
              onCreate={handleCreate}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        )}

        {view.kind === "snapshot" && activeSnapshot && (
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
              <div className="flex items-center gap-3">
                <div className="inline-block bg-black px-4 py-1 text-white">
                  <span className="font-bold">{activeSnapshot.name}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {activeSnapshot.period} · creado {activeSnapshot.createdAt}
                </span>
              </div>
              <span className="rounded-md border border-black px-2 py-1 text-xs font-semibold">
                Solo lectura
              </span>
            </div>
            <DashboardSheet records={activeSnapshot.records} readOnly />
          </div>
        )}

        {view.kind === "snapshot" && !activeSnapshot && (
          <p className="text-sm text-gray-500">Snapshot no encontrado.</p>
        )}

        {view.kind === "movimientos" && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
              <History className="h-5 w-5" />
              <span className="text-lg font-bold">Movimientos</span>
            </div>
            {movements.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aún no hay movimientos registrados. Crea, edita o elimina un
                registro para verlo aquí.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {movements.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border-2 border-black p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${actionStyles[m.action]}`}
                      >
                        {m.action}
                      </span>
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        {recordTypeLabels[m.recordType]}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">
                        {m.date}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{m.detail}</p>
                    <Input
                      value={m.comment}
                      onChange={(e) => updateComment(m.id, e.target.value)}
                      placeholder="Agregar comentario (opcional)..."
                      className="mt-2 h-8 text-sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* Snapshot dialog */}
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
