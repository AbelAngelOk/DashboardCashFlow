"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Camera } from "lucide-react"
import { useFinance } from "@/components/finance-store"
import { DashboardSheet } from "@/components/dashboard-sheet"
import { formatAmount, type Currency } from "@/lib/finance"
import type { AccountType, AccountBalances } from "@/lib/journal-actions"

const ACCOUNT_LABELS: Record<AccountType, string> = {
  activos: "Activos",
  pasivos: "Pasivos",
  ingresos: "Ingresos",
  gastos: "Gastos",
  efectivo: "Efectivo",
  obligaciones: "Obligaciones",
}

function SnapshotBalancesPanel({ data }: { data?: Record<string, unknown> }) {
  const balances = data?.accountBalances as AccountBalances | undefined
  if (!balances) return null

  const accounts = Object.keys(balances) as AccountType[]
  const hasSomeBalance = accounts.some((a) =>
    Object.values(balances[a]).some((v) => v !== 0),
  )
  if (!hasSomeBalance) return null

  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
        Balances Contables al Snapshot
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {accounts.map((account) => {
          const currencies = balances[account]
          const entries = Object.entries(currencies).filter(([, v]) => v !== 0)
          if (entries.length === 0) return null
          return (
            <div key={account} className="border-2 border-black p-3">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                {ACCOUNT_LABELS[account]}
              </div>
              {entries.map(([cur, val]) => (
                <div
                  key={cur}
                  className={`text-sm font-semibold ${val >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {val >= 0 ? "+" : ""}
                  {formatAmount(Math.abs(val), cur as Currency)} {cur}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { getSnapshot } = useFinance()
  const snapshot = getSnapshot(id)

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
          <Link
            href="/snapshots"
            className="text-gray-400 hover:text-black transition-colors"
            aria-label="Volver a snapshots"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-lg font-bold">Snapshot no encontrado</span>
        </div>
        <p className="text-sm text-gray-500">
          Este snapshot no existe o fue eliminado.{" "}
          <Link href="/snapshots" className="underline hover:text-black">
            Volver a la lista
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/snapshots"
            className="text-gray-400 hover:text-black transition-colors"
            aria-label="Volver a snapshots"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="inline-block bg-black px-4 py-1 text-white">
            <span className="font-bold">{snapshot.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="capitalize">{snapshot.period}</span>
          <span className="flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" />
            {snapshot.createdAt}
          </span>
        </div>
      </div>

      <SnapshotBalancesPanel data={snapshot.data} />
      <DashboardSheet records={snapshot.records} readOnly />
    </div>
  )
}
