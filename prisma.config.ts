import { defineConfig } from "prisma/config"
import { readFileSync } from "fs"

function loadEnvFile(filename: string) {
  try {
    const content = readFileSync(filename, "utf-8")
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const idx = trimmed.indexOf("=")
      if (idx < 0) continue
      const key = trimmed.slice(0, idx).trim()
      // Strip surrounding quotes
      const raw = trimmed.slice(idx + 1).trim()
      const val = raw.replace(/^["']|["']$/g, "")
      if (key && !process.env[key]) process.env[key] = val
    }
  } catch {
    // file not found — ok
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

// Use DIRECT_URL (session-mode pooler) for migrations — pgbouncer transaction
// mode doesn't support DDL statements like CREATE TABLE
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL

export default defineConfig({
  datasource: {
    url: migrationUrl!,
  },
})
