"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
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

export function currentPeriod() {
  return new Date().toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

interface FinanceContextValue {
  records: FinancialRecord[]
  snapshots: Snapshot[]
  movements: Movement[]
  createRecord: (record: FinancialRecord) => void
  editRecord: (record: FinancialRecord, previous: FinancialRecord) => void
  deleteRecord: (record: FinancialRecord) => void
  takeSnapshot: (name: string, period: string) => void
  updateComment: (id: string, comment: string) => void
  getSnapshot: (id: string) => Snapshot | undefined
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [movements, setMovements] = useState<Movement[]>([])

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

  const createRecord = (record: FinancialRecord) => {
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
    logMovement(
      "editado",
      record,
      changes.length ? changes.join(", ") : "sin cambios de valor",
    )
  }

  const deleteRecord = (record: FinancialRecord) => {
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

  const takeSnapshot = (name: string, period: string) => {
    setSnapshots((prev) => [
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        period: period.trim() || currentPeriod(),
        createdAt: now(),
        records: records.map((r) => ({ ...r })),
      },
      ...prev,
    ])
  }

  const updateComment = (id: string, comment: string) =>
    setMovements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, comment } : m)),
    )

  const getSnapshot = (id: string) => snapshots.find((s) => s.id === id)

  return (
    <FinanceContext.Provider
      value={{
        records,
        snapshots,
        movements,
        createRecord,
        editRecord,
        deleteRecord,
        takeSnapshot,
        updateComment,
        getSnapshot,
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
