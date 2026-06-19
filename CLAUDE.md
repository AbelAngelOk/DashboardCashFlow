# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build (also validates pages compile)
```

There are no tests. `npm run lint` references ESLint which is not installed — ignore it.

TypeScript is checked via `./node_modules/.bin/tsc --noEmit`. Note that `next.config.mjs` sets `ignoreBuildErrors: true`, so build passes even with TS errors — always run tsc manually to verify types.

## Architecture

**Stack**: Next.js App Router + React Context + Prisma + PostgreSQL (Supabase) + NextAuth v4

Data persists in PostgreSQL across sessions. There is no in-memory-only mode. Settings (currency preferences) persist in `localStorage` under the key `cashflow:settings`.

### Persistence layers

- **DB (Supabase/PostgreSQL)**: all financial records, snapshots, audit log, asset movements — accessed via Prisma ORM
- **Server Actions**: `lib/actions.ts` (records, snapshots, audit log) and `lib/assets-actions.ts` (assets, financial movements)
- **localStorage**: currency exchange settings — managed by `SettingsContext` in `components/settings-store.tsx`

### Authentication

NextAuth v4 with JWT strategy and bcrypt. Middleware in `proxy.ts` (not `middleware.ts`) protects dashboard routes. Session user ID is used for all DB queries (row-level isolation).

### State layer

Two React Contexts, both mounted in `app/(dashboard)/layout.tsx`:

**`FinanceProvider`** (`components/finance-store.tsx`) — financial data:
- `records` — active `FinancialRecord[]` (dashboard, activos)
- `snapshots` — `Snapshot[]`
- `movements` — `Movement[]`, audit log shown in `/movimientos`
- Mutations are **optimistic**: state updates immediately, DB write fires via `fire(promise)` in background. If the write fails, a toast error is shown (destructive variant).
- `reload()` — re-fetches all data from DB; used after Server Actions that bypass the context (e.g. asset creation).

**`SettingsProvider`** (`components/settings-store.tsx`) — configuration:
- Exchange rates, display preferences
- Persisted to `localStorage` key `cashflow:settings`

### Data types (`lib/finance.ts`)

Four record types: `"ingreso"`, `"gasto"`, `"activo"`, `"pasivo"`. Each `FinancialRecord` has a `currency` (USD/EUR/MXN/ARS/USDT).

`Snapshot` captures `{ id, name, period, createdAt, records[] }`.

### Asset types (`lib/assets.ts`)

`AssetType`: STOCK, BOND, FIXED_TERM, CRYPTO, FUTURES, OPTIONS, TRADING, TRADING_BOT, REBALANCE_BOT, OTHER.
Each asset type has a dedicated panel in `components/activos/panels/`. The dispatcher `components/activos/asset-detail.tsx` routes to the correct panel based on `asset.assetType`.

### UI layout

`app/layout.tsx` → `AuthProvider`
`app/(dashboard)/layout.tsx` → `SettingsProvider` → `FinanceProvider` → `AppShell` → `AppSidebar` + `<main>{children}</main>` + `Toaster`

### Key reusable component

`components/dashboard-sheet.tsx` — renders the full financial dashboard (Estado de Resultados + Balance) as editable tables. Accepts a `readOnly` boolean prop: when `true`, hides add/edit/delete controls. Used on the live dashboard (`/`) and in read-only snapshot views (`/snapshots/[id]`).

### Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | Live editable dashboard + snapshot dialog |
| `/activos` | `app/(dashboard)/activos/page.tsx` | Asset list with type filter |
| `/activos/[id]` | `app/(dashboard)/activos/[id]/page.tsx` | Asset detail + type-specific panel |
| `/snapshots` | `app/(dashboard)/snapshots/page.tsx` | List of saved snapshots |
| `/snapshots/[id]` | `app/(dashboard)/snapshots/[id]/page.tsx` | Read-only snapshot view |
| `/movimientos` | `app/(dashboard)/movimientos/page.tsx` | Audit log of all record changes |

### Patterns to know

- **Soft-delete**: assets and records use `deletedAt` timestamp; queries always filter `deletedAt: null`
- **Asset deletion**: both dashboard and `/activos` use soft-delete via `deleteRecord()` from context
- **Asset creation**: `AssetFormDialog` calls `createAsset()` (Server Action) then `reload()` — does NOT call `createRecord()` to avoid a duplicate DB insert
- **`fire(promise)`**: fires a promise in the background; shows a destructive toast on error
- **Debounce**: comment updates in `/movimientos` are debounced 600ms before DB write

### Styling conventions

- shadcn/ui (New York style) via `components/ui/` — add new components with `npx shadcn@latest add <component>`
- Tailwind CSS v4 (configured in `app/globals.css`, not `tailwind.config.js`)
- Monochrome design: black headers, white backgrounds, `border-2 border-black` for panels — no shadows, no color accents except status badges (emerald/amber/rose)
- Path alias `@/` maps to the project root
