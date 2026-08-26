import { handle, requireUserId } from "@/lib/api-helpers"
import { prisma } from "@/lib/db"
import { loadGastoGroups, loadIngresoGroups } from "@/lib/flow-group-actions"
import type { Currency, FinancialRecord, RecordType } from "@/lib/finance"

/**
 * GET /api/dashboard — todo lo que la pantalla principal necesita, en paralelo:
 * records (activos/pasivos/ingresos/gastos activos) + grupos de flujo.
 *
 * Distinto de /api/bootstrap: éste no trae obligaciones/marcadores/categorías
 * (ya cacheados por el shell) ni snapshots ni el conteo de auditoría.
 */
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId()

    const [dbRecords, gastoGroups, ingresoGroups] = await Promise.all([
      prisma.record.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { type: { not: { in: ["gasto", "ingreso"] } } },
            { type: "gasto", status: "ACTIVE" },
            { type: "ingreso", status: "ACTIVE" },
          ],
        },
        include: { _count: { select: { children: true } } },
      }),
      loadGastoGroups(),
      loadIngresoGroups(),
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

    return { records, gastoGroups, ingresoGroups }
  })
}
