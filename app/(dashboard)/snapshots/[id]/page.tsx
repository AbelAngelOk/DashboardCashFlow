"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Camera } from "lucide-react"
import { useFinance } from "@/components/finance-store"
import { DashboardSheet } from "@/components/dashboard-sheet"

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

      <DashboardSheet records={snapshot.records} readOnly />
    </div>
  )
}
