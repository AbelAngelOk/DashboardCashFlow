import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { loadGasto } from "@/lib/gasto-actions"
import { loadLinksForGasto } from "@/lib/link-actions"
import { formatAmount } from "@/lib/finance"
import { GastoIngresoLinksPanel } from "@/components/gastos/gasto-ingreso-links-panel"

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  HISTORICAL: "Histórico",
  ARCHIVED: "Archivado",
  PENDING: "Pendiente",
  CANCELLED: "Cancelado",
}

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  HISTORICAL: "bg-gray-100 text-gray-600",
  ARCHIVED: "bg-gray-100 text-gray-600",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-rose-100 text-rose-800",
}

export default async function GastoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [gasto, links] = await Promise.all([loadGasto(id), loadLinksForGasto(id)])
  if (!gasto) notFound()

  const statusLabel = STATUS_LABELS[gasto.status] ?? gasto.status
  const statusClass = STATUS_CLASSES[gasto.status] ?? "bg-gray-100 text-gray-600"

  const formattedDate = gasto.operationDate
    ? new Date(gasto.operationDate).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null

  return (
    <div className="mx-auto max-w-xl">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/gastos"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Gastos
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl font-bold">{gasto.name}</h1>
          <p className="text-sm text-gray-500">Gasto</p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* Main info panel */}
      <div className="mb-4 border-2 border-black">
        <div className="border-b-2 border-black bg-black px-4 py-2">
          <span className="text-sm font-bold uppercase tracking-wide text-white">Información</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-500">Monto</span>
            <span className="font-bold">
              {formatAmount(gasto.amount, gasto.currency)} {gasto.currency}
            </span>
          </div>
          {formattedDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-500">Fecha</span>
              <span>{formattedDate}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-500">Origen</span>
            <span>
              {gasto.source.type === "obligation" && (
                <Link
                  href={`/obligaciones/${gasto.source.obligationId}`}
                  className="font-medium hover:underline"
                >
                  {gasto.source.obligationName}
                </Link>
              )}
              {gasto.source.type === "asset" && (
                <Link
                  href={`/activos/${gasto.source.assetId}`}
                  className="font-medium hover:underline"
                >
                  {gasto.source.assetName}
                </Link>
              )}
              {gasto.source.type === "free" && (
                <span className="text-gray-400">Manual</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Version chain */}
      {(gasto.previousVersionId || gasto.nextVersionId) && (
        <div className="mb-4 border-2 border-black">
          <div className="border-b-2 border-black bg-black px-4 py-2">
            <span className="text-sm font-bold uppercase tracking-wide text-white">Historial de versiones</span>
          </div>
          <div className="flex flex-col gap-2 p-4 text-sm">
            {gasto.previousVersionId && (
              <Link
                href={`/gastos/${gasto.previousVersionId}`}
                className="flex items-center gap-1 text-gray-500 hover:text-black"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Ver versión anterior
              </Link>
            )}
            {gasto.nextVersionId && (
              <Link
                href={`/gastos/${gasto.nextVersionId}`}
                className="flex items-center gap-1 text-gray-500 hover:text-black"
              >
                Ver versión actual
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Links panel */}
      <GastoIngresoLinksPanel gastoId={gasto.id} gastoCurrency={gasto.currency} />
    </div>
  )
}
