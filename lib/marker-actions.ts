"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"
import type { EntityType, MarkerDefinition, EntityMarkerEntry } from "./marker-types"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

// ── Marker CRUD ───────────────────────────────────────────────────────────────

export async function loadMarkers(): Promise<MarkerDefinition[]> {
  const userId = await getUserId()
  const markers = await prisma.marker.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  })
  return markers.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    order: m.order,
    createdAt: m.createdAt.toISOString(),
  }))
}

export async function createMarker(data: {
  name: string
  color: string
  order?: number
}): Promise<MarkerDefinition> {
  const userId = await getUserId()
  const m = await prisma.marker.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      name: data.name,
      color: data.color,
      order: data.order ?? 0,
    },
  })
  return { id: m.id, name: m.name, color: m.color, order: m.order, createdAt: m.createdAt.toISOString() }
}

export async function updateMarker(
  id: string,
  data: Partial<{ name: string; color: string; order: number }>,
): Promise<void> {
  const userId = await getUserId()
  await prisma.marker.update({
    where: { id, userId },
    data,
  })
}

export async function deleteMarker(id: string): Promise<void> {
  const userId = await getUserId()
  await prisma.marker.delete({ where: { id, userId } })
}

// ── Entity Marker assignments ─────────────────────────────────────────────────

export async function setEntityMarker(
  entityId: string,
  entityType: EntityType,
  markerId: string,
): Promise<void> {
  const userId = await getUserId()
  await prisma.entityMarker.upsert({
    where: { entityId_entityType: { entityId, entityType } },
    create: { id: crypto.randomUUID(), markerId, entityId, entityType, userId },
    update: { markerId },
  })
}

export async function removeEntityMarker(
  entityId: string,
  entityType: EntityType,
): Promise<void> {
  const userId = await getUserId()
  await prisma.entityMarker.deleteMany({
    where: { entityId, entityType, userId },
  })
}

export async function loadEntityMarkersForIds(
  entityIds: string[],
  entityType: EntityType,
): Promise<Record<string, MarkerDefinition>> {
  if (entityIds.length === 0) return {}
  const userId = await getUserId()
  const entries = await prisma.entityMarker.findMany({
    where: { entityId: { in: entityIds }, entityType, userId },
    include: { marker: true },
  })
  const result: Record<string, MarkerDefinition> = {}
  for (const e of entries) {
    result[e.entityId] = {
      id: e.marker.id,
      name: e.marker.name,
      color: e.marker.color,
      order: e.marker.order,
      createdAt: e.marker.createdAt.toISOString(),
    }
  }
  return result
}

export async function loadEntityMarkerEntries(
  entityIds: string[],
  entityType: EntityType,
): Promise<EntityMarkerEntry[]> {
  if (entityIds.length === 0) return []
  const userId = await getUserId()
  const entries = await prisma.entityMarker.findMany({
    where: { entityId: { in: entityIds }, entityType, userId },
  })
  return entries.map((e) => ({
    id: e.id,
    markerId: e.markerId,
    entityId: e.entityId,
    entityType: e.entityType as EntityType,
  }))
}
