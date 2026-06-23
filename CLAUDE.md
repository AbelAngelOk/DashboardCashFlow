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
- Exchange rates, display preferences, hidden/custom asset types
- Persisted to `localStorage` key `cashflow:settings`

### Data types (`lib/finance.ts`)

Four record types: `"ingreso"`, `"gasto"`, `"activo"`, `"pasivo"`. Each `FinancialRecord` has a `currency` (USD/EUR/MXN/ARS/USDT).

`Snapshot` captures `{ id, name, period, createdAt, records[] }`.

### Asset types (`lib/assets.ts`)

`AssetType`: STOCK, BOND, FIXED_TERM, CRYPTO, FUTURES, OPTIONS, TRADING, TRADING_BOT, REBALANCE_BOT, GROUP.
Each type has a dedicated panel in `components/activos/panels/`. `components/activos/asset-detail.tsx` routes to the correct panel based on `asset.assetType`.

`GROUP` type is an organizer record that groups children. Groups are collapsible in both `/activos` and the dashboard.

### Board system (`components/activos/boards/`)

Optional boards rendered below the required Info + Movements sections on the asset detail page.

- **`BoardManager`** — renders all `asset.boards` and shows "Agregar tablero" dropdown (Dividendos | Tablero personalizado)
- **`DividendsBoard`** — dividend entries with recurring support (monthly/quarterly/semi-annual/annual); 12-month window pre-generated. Collecting a dividend auto-creates an ingreso in the dashboard.
- **`CustomBoard`** — configurable table (columns + rows); title is editable inline

Board data lives in `metadata.boards: BoardConfig[]` on the Record. `extractBoards()` in `lib/assets.ts` handles backwards migration from legacy `metadata.tracking` and `metadata.dividends`.

### Notifications (`components/notifications/`)

`NotificationsProvider` wraps `AppShell` and computes `AppNotification[]` client-side from `records`. Dividend pending notifications fire when `dividend.month === currentYYYYMM && !dividend.actualGain`. Read state persists in `localStorage: "cashflow:notifications"`.

### Rich text editor (`components/ui/rich-editor.tsx`)

TipTap v3 wrapper used for the `description` field in `AssetInfoSection`. Stores JSON in `description String?`. Falls back to plain text for legacy string values. Decision doc at `docs/decision-editor-rico.md`.

### Inline editing (`AssetInfoSection`)

Per-field editing (name, ticker, assetType, description). Click field → edit mode; blur → save (200ms debounce). No global edit mode.

### UI layout

`app/layout.tsx` → `AuthProvider`
`app/(dashboard)/layout.tsx` → `SettingsProvider` → `FinanceProvider` → `AppShell`

`AppShell` → `NotificationsProvider` → [column: `AppHeader` (full width) | row: `AppSidebar` + `<main>`] + `Toaster`

`AppHeader` shows user name (left) and notification bell (right). `AppSidebar` shows nav links + sign-out button.

### Key reusable component

`components/dashboard-sheet.tsx` — renders the full financial dashboard (Estado de Resultados + Balance) as editable tables. Accepts a `readOnly` boolean prop: when `true`, hides add/edit/delete controls. Used on the live dashboard (`/`) and in read-only snapshot views (`/snapshots/[id]`). Group activos in the assets table are collapsible — click chevron to expand children. Groups are not editable/deletable from the dashboard.

### Financial recording layers

Three parallel layers — do not confuse them:

| Layer | DB table | Purpose | Server actions file |
|-------|----------|---------|---------------------|
| **JournalEntry** (Libro Contable) | `journal_entries` | Double-entry ledger: every financial event → debit/credit pair | `lib/journal-actions.ts` |
| **AuditLog** (Historial) | `movements` | CRUD audit trail: creado/editado/eliminado | `lib/actions.ts` |
| **FinancialMovement** | `financial_movements` | Per-asset transaction log: BUY/SELL/DEPOSIT/EXTRACT | `lib/assets-actions.ts` |

**RULE: Every new financial function MUST call `createJournalEntry()` from `lib/journal-actions.ts`.** See `docs/financial-domain-architecture.md` for the full operations → accounts mapping.

### Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | Live editable dashboard + snapshot dialog |
| `/activos` | `app/(dashboard)/activos/page.tsx` | Asset list; "Agrupar" mode for creating groups |
| `/activos/[id]` | `app/(dashboard)/activos/[id]/page.tsx` | Asset detail: inline edit fields + panels + boards |
| `/gastos` | `app/(dashboard)/gastos/page.tsx` | Expense list grouped by source |
| `/ingresos` | `app/(dashboard)/ingresos/page.tsx` | Income list grouped by source |
| `/libro-contable` | `app/(dashboard)/libro-contable/page.tsx` | Double-entry ledger view with account balances |
| `/historial` | `app/(dashboard)/historial/page.tsx` | Audit log of CRUD events (renamed from /movimientos) |
| `/snapshots` | `app/(dashboard)/snapshots/page.tsx` | List of saved snapshots |
| `/snapshots/[id]` | `app/(dashboard)/snapshots/[id]/page.tsx` | Read-only snapshot view with account balances |
| `/obligaciones` | `app/(dashboard)/obligaciones/page.tsx` | Obligations list |
| `/obligaciones/[id]` | `app/(dashboard)/obligaciones/[id]/page.tsx` | Obligation detail |
| `/configuracion` | `app/(dashboard)/configuracion/page.tsx` | Currency settings + configurable asset types |

### Component IDs (`data-testid`)

All main visual containers have `data-testid` attributes. Full list at `docs/ComponentIds.md`.

### Dashboard dialogs for activos

Editing an activo's value from the dashboard shows a custom dialog with:
- **Movement type** selector: Ajuste (ADJUSTMENT) | Depósito (DEPOSIT)
- When Depósito: optional "Crear gasto asociado" switch → creates a linked gasto record
- Optional comment
The dialog calls `onEditAmountWithComment(record, previous, comment, movementType, createGasto)`.

Deleting (zeroing out) an activo from the dashboard shows a dialog with:
- Optional "Crear ingreso asociado" switch → creates a linked ingreso record
- Optional comment
Calls `zeroOutAsset()` server action (sets amount=0 + creates EXTRACT movement).

GROUP children in the expanded view also show the zero-out delete button.

### Asset form validation

`AssetFormDialog`: for types with qty/price (STOCK, CRYPTO, FUTURES, OPTIONS), changing qty or price auto-calculates amount. If all three are manually set and `qty × price ≠ amount`, a warning is shown and save is blocked.

### Asset movements editing

`AssetMovementsSection`: click pencil icon on a movement row → inline edit for `movementType` + `description` (comment). Save on Enter or ✓ button.

### Group management

- `createGroup(name, childIds, currency)` — creates new GROUP + sets parentId on children
- `assignToGroup(groupId, childIds)` — adds assets to existing group
- `removeFromGroup(assetId)` — removes one asset from its group (parentId → null)
- `deleteGroup(groupId)` — detaches all children + soft-deletes group parent
- `ungroupAssets(parentId)` — same as deleteGroup (alias used in UngroupButton)

In `/activos` "Agrupar" mode: select ≥ 2 assets → choose "Crear nuevo grupo" or "Asignar a grupo existente" → confirm.

### Configurable asset types

`DashboardSettings` (in `cashflow:settings` localStorage) includes:
- `hiddenAssetTypes: AssetType[]` — system types toggled off; hidden from all dropdowns
- `customAssetTypes: { id, name }[]` — user-defined types; appear in all selectors

Managed in `/configuracion` under "Tipos de Activo". `GROUP` is never shown in type selectors anywhere.

### GROUP asset detail

For GROUP assets in `/activos/[id]`, the section order is fixed:
1. AssetInfoSection (Información General)
2. Group children summary (Activos del Grupo)
3. AssetMovementsSection (Movimientos)
No BoardManager for GROUP type.

### Patterns to know

- **Soft-delete**: assets and records use `deletedAt` timestamp; queries always filter `deletedAt: null`
- **Asset deletion in dashboard**: calls `zeroOutAsset()` (sets amount=0, creates EXTRACT movement, optionally creates ingreso) — does NOT soft-delete the record
- **Asset deletion in /activos**: still calls `deleteRecord()` from context (soft-delete via `dbDeleteRecord`)
- **Asset creation**: `AssetFormDialog` calls `createAsset()` (Server Action) then `reload()` — does NOT call `createRecord()` to avoid a duplicate DB insert
- **`fire(promise)`**: fires a promise in the background; shows a destructive toast on error
- **Debounce**: comment updates in `/movimientos` are debounced 600ms before DB write
- **Multi-select filter**: `/activos` type filter is multi-select; buttons toggle, "Todos" clears selection

### Styling conventions

- shadcn/ui (New York style) via `components/ui/` — add new components with `npx shadcn@latest add <component>`
- Tailwind CSS v4 (configured in `app/globals.css`, not `tailwind.config.js`)
- Monochrome design: black headers, white backgrounds, `border-2 border-black` for panels — no shadows, no color accents except status badges (emerald/amber/rose)
- Path alias `@/` maps to the project root
