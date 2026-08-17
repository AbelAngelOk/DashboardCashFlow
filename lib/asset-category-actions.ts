"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import { LEGACY_TYPE_NAMES, type AssetCategory } from "./asset-categories"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

/** Tipos legados que se operaban en unidades (cantidad + precio promedio). */
const QUANTITY_LEGACY_TYPES = ["STOCK", "CRYPTO", "FUTURES", "OPTIONS"]

/**
 * Convierte en categorías los `assetType` legados que todavía usen los activos
 * del usuario, y reapunta esos activos a la categoría nueva.
 *
 * Cada categoría recibe un id propio en vez de reutilizar el valor legado: el id
 * es PK global, así que dos usuarios con activos `STOCK` colisionarían. Por eso
 * la siembra migra los registros en lugar de conservar el valor viejo.
 *
 * Es idempotente: solo actúa sobre los `assetType` que aún no son un id de
 * categoría del usuario.
 *
 * `extra` recibe los tipos personalizados que vivían en `localStorage`
 * (`settings.customAssetTypes`) para convertirlos también.
 */
export async function ensureAssetCategories(
  extra: { id: string; name: string }[] = [],
): Promise<AssetCategory[]> {
  const userId = await getUserId()

  const [existing, used] = await Promise.all([
    prisma.assetCategory.findMany({ where: { userId } }),
    prisma.record.findMany({
      where: { userId, type: "activo", assetType: { not: null } },
      select: { assetType: true },
      distinct: ["assetType"],
    }),
  ])

  const knownIds = new Set(existing.map((c) => c.id))
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]))
  let order = existing.length

  // Antes de perder el valor legado: los tipos que se operaban en unidades pasan
  // a llevar la capacidad `tracksQuantity`, para no perder su panel de compra.
  await prisma.record.updateMany({
    where: {
      userId,
      type: "activo",
      assetType: { in: QUANTITY_LEGACY_TYPES },
      tracksQuantity: false,
    },
    data: { tracksQuantity: true },
  })

  // Etiquetas pendientes: valores de assetType que no son una categoría conocida.
  // GROUP se descarta: agrupar es una capacidad estructural, no una categoría.
  const pending = used
    .map((r) => r.assetType!)
    .filter((t) => t !== "GROUP" && !knownIds.has(t))

  for (const legacy of pending) {
    const name =
      LEGACY_TYPE_NAMES[legacy] ?? extra.find((e) => e.id === legacy)?.name ?? legacy
    const key = name.toLowerCase()

    let categoryId = byName.get(key)
    if (!categoryId) {
      categoryId = crypto.randomUUID()
      await prisma.assetCategory.create({
        data: { id: categoryId, userId, name, order: order++ },
      })
      byName.set(key, categoryId)
      knownIds.add(categoryId)
    }

    // Reapunta los activos del usuario a la categoría nueva
    await prisma.record.updateMany({
      where: { userId, type: "activo", assetType: legacy },
      data: { assetType: categoryId },
    })
  }

  // Tipos propios de localStorage que todavía no tienen categoría
  for (const e of extra) {
    const key = e.name.trim().toLowerCase()
    if (!key || byName.has(key)) continue
    const id = crypto.randomUUID()
    await prisma.assetCategory.create({
      data: { id, userId, name: e.name.trim(), order: order++ },
    })
    byName.set(key, id)
  }

  return loadCategoriesFor(userId)
}

async function loadCategoriesFor(userId: string): Promise<AssetCategory[]> {
  const rows = await prisma.assetCategory.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })
  return rows.map((c) => ({ id: c.id, name: c.name, order: c.order }))
}

export async function loadAssetCategories(): Promise<AssetCategory[]> {
  const userId = await getUserId()
  return loadCategoriesFor(userId)
}

export async function createAssetCategory(name: string): Promise<AssetCategory> {
  const userId = await getUserId()
  const clean = name.trim()
  if (!clean) throw new Error("El nombre no puede estar vacío")

  const dup = await prisma.assetCategory.findFirst({
    where: { userId, name: { equals: clean, mode: "insensitive" } },
  })
  if (dup) throw new Error(`Ya existe una categoría llamada "${clean}"`)

  const count = await prisma.assetCategory.count({ where: { userId } })
  const c = await prisma.assetCategory.create({
    data: { id: crypto.randomUUID(), userId, name: clean, order: count },
  })
  return { id: c.id, name: c.name, order: c.order }
}

export async function renameAssetCategory(id: string, name: string): Promise<void> {
  const userId = await getUserId()
  const clean = name.trim()
  if (!clean) throw new Error("El nombre no puede estar vacío")

  const dup = await prisma.assetCategory.findFirst({
    where: { userId, name: { equals: clean, mode: "insensitive" }, id: { not: id } },
  })
  if (dup) throw new Error(`Ya existe una categoría llamada "${clean}"`)

  await prisma.assetCategory.update({ where: { id, userId }, data: { name: clean } })
}

/**
 * Elimina la categoría y deja sin etiqueta a los activos que la usaban.
 * Nunca elimina activos: la etiqueta es solo organización.
 */
export async function deleteAssetCategory(id: string): Promise<number> {
  const userId = await getUserId()
  const affected = await prisma.record.updateMany({
    where: { userId, type: "activo", assetType: id },
    data: { assetType: null },
  })
  await prisma.assetCategory.delete({ where: { id, userId } })
  return affected.count
}

/** Cuántos activos usan cada categoría — para avisar antes de borrar. */
export async function assetCountByCategory(): Promise<Record<string, number>> {
  const userId = await getUserId()
  const rows = await prisma.record.groupBy({
    by: ["assetType"],
    where: { userId, type: "activo", deletedAt: null, assetType: { not: null } },
    _count: { _all: true },
  })
  const out: Record<string, number> = {}
  for (const r of rows) if (r.assetType) out[r.assetType] = r._count._all
  return out
}
