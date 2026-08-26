import { prisma } from "@/lib/db"
import { handle, requireUserId, jsonBody, badRequest } from "@/lib/api-helpers"
import { dbTakeSnapshot } from "@/lib/actions"
import type { Currency, RecordType, Snapshot } from "@/lib/finance"

/** GET /api/snapshots — listado con sus filas congeladas */
export async function GET() {
  return handle(async () => {
    const userId = await requireUserId()
    const rows = await prisma.snapshot.findMany({
      where: { userId },
      include: { snapshotRecords: true },
      orderBy: { createdAt: "desc" },
    })
    return {
      snapshots: rows.map((s) => ({
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
      })),
    }
  })
}

/** POST /api/snapshots — congela el estado actual */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await jsonBody<Partial<Snapshot>>(req)
    if (!b.name?.trim()) throw badRequest("El nombre es obligatorio", "name")
    const snapshot: Snapshot = {
      id: b.id ?? crypto.randomUUID(),
      name: b.name.trim(),
      period: b.period ?? "",
      createdAt:
        b.createdAt ??
        new Date().toLocaleString("es-ES", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
      records: b.records ?? [],
    }
    await dbTakeSnapshot(snapshot)
    return { id: snapshot.id }
  })
}
