import { prisma } from "@/lib/db"
import { handle, requireUserId } from "@/lib/api-helpers"
import { loadObligations } from "@/lib/obligation-actions"
import { loadMarkers } from "@/lib/marker-actions"
import { loadAssetCategories } from "@/lib/asset-category-actions"
import type { Currency, FinancialRecord, RecordType, Snapshot } from "@/lib/finance"

/**
 * GET /api/bootstrap — todo lo que el shell necesita para arrancar, en una request.
 *
 * Reemplaza las cinco cargas en cascada que hoy hacen los providers de React
 * (`loadData`, `loadObligations`, `loadMarkers`, `ensureAssetCategories`), que se
 * disparan desde `useEffect` independientes y por lo tanto no se paralelizan.
 *
 * Dos correcciones de rendimiento respecto del comportamiento actual:
 *
 *  1. Devuelve `auditCount` (un COUNT) en lugar de las filas completas del audit
 *     log. `loadData()` las trae TODAS sin `take`, en cada montaje del dashboard,
 *     y su único consumo es el badge numérico del sidebar.
 *  2. No siembra categorías. `ensureAssetCategories()` escribe en la base durante
 *     el arranque; acá solo se leen. La siembra queda para su propio endpoint.
 */
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId()

    const [dbRecords, dbSnapshots, auditCount, obligations, markers, categories] =
      await Promise.all([
        prisma.record.findMany({
          where: {
            userId,
            deletedAt: null,
            // Mismo filtro que loadData(): los gastos/ingresos PENDING son internos
            // del módulo de obligaciones; HISTORICAL y ARCHIVED no van al dashboard.
            OR: [
              { type: { not: { in: ["gasto", "ingreso"] } } },
              { type: "gasto", status: "ACTIVE" },
              { type: "ingreso", status: "ACTIVE" },
            ],
          },
          include: { _count: { select: { children: true } } },
        }),
        prisma.snapshot.findMany({
          where: { userId },
          include: { snapshotRecords: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.auditLog.count({ where: { userId } }),
        loadObligations(),
        loadMarkers(),
        loadAssetCategories(),
      ])

    const records: FinancialRecord[] = dbRecords.map((r) => ({
      id: r.id,
      type: r.type as RecordType,
      name: r.name,
      amount: Number(r.amount),
      currency: r.currency as Currency,
      ...(r.linkedTo ? { linkedTo: r.linkedTo } : {}),
      ...(r.parentId ? { parentId: r.parentId } : {}),
      ...(r.assetType ? { assetType: r.assetType } : {}),
      ...(r._count.children > 0 ? { isGroupParent: true } : {}),
    }))

    const snapshots: Snapshot[] = dbSnapshots.map((s) => ({
      id: s.id,
      name: s.name,
      period: s.period,
      createdAt: s.createdAt,
      data: (s.data as Record<string, unknown>) ?? undefined,
      records: s.snapshotRecords.map((sr) => ({
        id: sr.id,
        type: sr.type as RecordType,
        name: sr.name,
        amount: Number(sr.amount),
        currency: sr.currency as Currency,
        ...(sr.linkedTo ? { linkedTo: sr.linkedTo } : {}),
      })),
    }))

    return { records, snapshots, auditCount, obligations, markers, categories }
  })
}
