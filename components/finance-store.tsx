"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  type FinancialRecord,
  type Movement,
  type Snapshot,
  formatAmount,
  recordTypeLabels,
} from "@/lib/finance"
import {
  dbCreateRecord,
  dbDeleteRecord,
  dbEditRecord,
  dbTakeSnapshot,
  dbUpdateComment,
  loadData,
} from "@/lib/actions"
import { toast } from "@/components/ui/use-toast"

function now() {
  return new Date().toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function currentPeriod() {
  return new Date().toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

function fire(p: Promise<unknown>) {
  p.catch((err: unknown) => {
    console.error(err)
    const message = err instanceof Error ? err.message : ""
    toast({
      title: "Error al guardar",
      description: message.includes("No autorizado")
        ? "Tu sesión expiró. Recargá la página para volver a ingresar."
        : "No se pudo guardar el cambio. Comprobá tu conexión.",
      variant: "destructive",
    })
  })
}

interface FinanceContextValue {
  records: FinancialRecord[]
  snapshots: Snapshot[]
  movements: Movement[]
  loading: boolean
  createRecord: (record: FinancialRecord) => void
  editRecord: (record: FinancialRecord, previous: FinancialRecord) => void
  deleteRecord: (record: FinancialRecord) => void
  takeSnapshot: (name: string, period: string) => void
  updateComment: (id: string, comment: string) => void
  getSnapshot: (id: string) => Snapshot | undefined
  reload: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
      .then((data) => {
        setRecords(data.records)
        setSnapshots(data.snapshots)
        setMovements(data.movements)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const logMovement = (
    action: Movement["action"],
    record: FinancialRecord,
    detail: string,
  ): Movement => {
    const movement: Movement = {
      id: crypto.randomUUID(),
      date: now(),
      action,
      recordType: record.type,
      recordName: record.name,
      detail,
      comment: "",
    }
    setMovements((prev) => [movement, ...prev])
    return movement
  }

  const createRecord = (record: FinancialRecord) => {
    setRecords((prev) => [...prev, record])
    const movement = logMovement(
      "creado",
      record,
      `${recordTypeLabels[record.type]} "${record.name}" por ${formatAmount(
        record.amount,
        record.currency,
      )} ${record.currency}`,
    )
    fire(dbCreateRecord(record, movement))
  }

  const editRecord = (record: FinancialRecord, previous: FinancialRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)))
    const changes: string[] = []
    if (previous.name !== record.name)
      changes.push(`nombre: "${previous.name}" → "${record.name}"`)
    if (
      previous.amount !== record.amount ||
      previous.currency !== record.currency
    )
      changes.push(
        `monto: ${formatAmount(previous.amount, previous.currency)} ${
          previous.currency
        } → ${formatAmount(record.amount, record.currency)} ${record.currency}`,
      )
    const movement = logMovement(
      "editado",
      record,
      changes.length ? changes.join(", ") : "sin cambios de valor",
    )
    fire(dbEditRecord(record, movement))
  }

  const deleteRecord = (record: FinancialRecord) => {
    setRecords((prev) => prev.filter((r) => r.id !== record.id))
    const movement = logMovement(
      "eliminado",
      record,
      `${recordTypeLabels[record.type]} "${record.name}" (${formatAmount(
        record.amount,
        record.currency,
      )} ${record.currency})`,
    )
    fire(dbDeleteRecord(record, movement))
  }

  const takeSnapshot = (name: string, period: string) => {
    const snapshot: Snapshot = {
      id: crypto.randomUUID(),
      name: name.trim(),
      period: period.trim() || currentPeriod(),
      createdAt: now(),
      records: records.map((r) => ({ ...r })),
    }
    setSnapshots((prev) => [snapshot, ...prev])
    fire(dbTakeSnapshot(snapshot))
  }

  // Debounce DB writes to avoid a round-trip on every keystroke
  const commentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const updateComment = (id: string, comment: string) => {
    setMovements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, comment } : m)),
    )
    clearTimeout(commentTimers.current[id])
    commentTimers.current[id] = setTimeout(() => {
      fire(dbUpdateComment(id, comment))
    }, 600)
  }

  const getSnapshot = (id: string) => snapshots.find((s) => s.id === id)

  const reload = useCallback(() => {
    loadData()
      .then((data) => {
        setRecords(data.records)
        setSnapshots(data.snapshots)
        setMovements(data.movements)
      })
      .catch(console.error)
  }, [])

  return (
    <FinanceContext.Provider
      value={{
        records,
        snapshots,
        movements,
        loading,
        createRecord,
        editRecord,
        deleteRecord,
        takeSnapshot,
        updateComment,
        getSnapshot,
        reload,
      }}
    >
      {children}
    </FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}
