import { Suspense } from "react"
import { History } from "lucide-react"
import { HistorialContent } from "./content"

function HistorialSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2 border-b-2 border-black pb-2">
        <History className="h-5 w-5" />
        <span className="text-lg font-bold">Historial</span>
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border-2 border-gray-200 bg-gray-100"
          />
        ))}
      </div>
    </div>
  )
}

export default function HistorialPage() {
  return (
    <Suspense fallback={<HistorialSkeleton />}>
      <HistorialContent />
    </Suspense>
  )
}
