"use client"

import Link from "next/link"
import { Camera, ArrowRight } from "lucide-react"
import { useFinance } from "@/components/finance-store"

export default function SnapshotsPage() {
  const { snapshots } = useFinance()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <Camera className="h-5 w-5" />
        <span className="text-lg font-bold">Snapshots</span>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aún no hay snapshots guardados. Tomá uno desde el Dashboard.
        </p>
      ) : (
        <div className="border-2 border-black">
          <div className="flex border-b-2 border-black bg-gray-100 text-sm font-bold">
            <div className="flex-1 border-r border-black px-3 py-2">Nombre</div>
            <div className="w-40 border-r border-black px-3 py-2">Período</div>
            <div className="w-44 border-r border-black px-3 py-2">Fecha de creación</div>
            <div className="w-16 px-3 py-2 text-center">Acción</div>
          </div>

          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="group flex border-b border-black last:border-b-0 text-sm hover:bg-gray-50"
            >
              <div className="flex-1 border-r border-black px-3 py-2 font-medium">
                {snap.name}
              </div>
              <div className="w-40 border-r border-black px-3 py-2 text-gray-600 capitalize">
                {snap.period}
              </div>
              <div className="w-44 border-r border-black px-3 py-2 text-gray-500">
                {snap.createdAt}
              </div>
              <div className="flex w-16 items-center justify-center px-3 py-2">
                <Link
                  href={`/snapshots/${snap.id}`}
                  className="text-gray-400 transition-colors hover:text-black"
                  aria-label={`Ver snapshot ${snap.name}`}
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
