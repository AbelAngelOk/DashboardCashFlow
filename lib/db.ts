import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  // Use DIRECT_URL (session-mode pooler) for the client so that
  // interactive transactions ($transaction async) work correctly.
  // pgbouncer transaction mode (DATABASE_URL) doesn't support them.
  const connectionString =
    process.env.DIRECT_URL ?? process.env.DATABASE_URL!

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

export const prisma = global.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") global.prisma = prisma
