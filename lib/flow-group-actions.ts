"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./db"

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error("No autorizado")
  return session.user.id
}

export interface FlowGroupWithMembers {
  id: string
  name: string
  groupType: "EXPENSE" | "INCOME"
  memberIds: string[]
}

async function loadGroups(
  userId: string,
  groupType: "EXPENSE" | "INCOME",
): Promise<FlowGroupWithMembers[]> {
  const groups = await prisma.group.findMany({
    where: { userId, groupType },
    include: { records: { select: { recordId: true } } },
    orderBy: { createdAt: "asc" },
  })
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    groupType: g.groupType as "EXPENSE" | "INCOME",
    memberIds: g.records.map((r) => r.recordId),
  }))
}

export async function loadGastoGroups(): Promise<FlowGroupWithMembers[]> {
  const userId = await getUserId()
  return loadGroups(userId, "EXPENSE")
}

export async function loadIngresoGroups(): Promise<FlowGroupWithMembers[]> {
  const userId = await getUserId()
  return loadGroups(userId, "INCOME")
}

export async function createFlowGroup(
  name: string,
  groupType: "EXPENSE" | "INCOME",
  recordIds: string[],
): Promise<string> {
  const userId = await getUserId()
  const group = await prisma.group.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      name,
      groupType,
      records: {
        create: recordIds.map((recordId) => ({ recordId })),
      },
    },
  })
  return group.id
}

export async function renameFlowGroup(id: string, name: string): Promise<void> {
  const userId = await getUserId()
  await prisma.group.update({ where: { id, userId }, data: { name } })
}

export async function deleteFlowGroup(id: string): Promise<void> {
  const userId = await getUserId()
  // RecordGroup rows cascade-delete
  await prisma.group.delete({ where: { id, userId } })
}

export async function assignToFlowGroup(groupId: string, recordId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.group.findFirstOrThrow({ where: { id: groupId, userId } })
  await prisma.recordGroup.upsert({
    where: { recordId_groupId: { recordId, groupId } },
    create: { recordId, groupId },
    update: {},
  })
}

export async function removeFromFlowGroup(groupId: string, recordId: string): Promise<void> {
  const userId = await getUserId()
  await prisma.group.findFirstOrThrow({ where: { id: groupId, userId } })
  await prisma.recordGroup.deleteMany({ where: { recordId, groupId } })
}
