# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Policy (mandatory, automatic)

**Every functional, architectural, or visual change MUST be documented. No exceptions.**

### Mandatory workflow (6 phases)
1. Analyze scope
2. Identify affected docs in `/docs`
3. Update/create docs **BEFORE** implementing
4. Implement
5. Update docs if implementation diverged from plan
6. Bump version in all affected docs

### Semantic versioning header — required on every doc
```
---
Versión: X.Y.Z
Última actualización: YYYY-MM-DD
Autor: Abel Cejas
Estado: Activo
---
```

### Required files
- `/docs/CHANGELOG.md` — complete change history (Added/Modified/Fixed/Removed)
- `/docs/releases/vX.Y.Z.md` — per-version release notes
- `/docs/modules/*.md` — per-module functional docs with Mermaid diagrams

### End-of-implementation report
After every task, report: docs created/modified with versions, code components changed, new/modified/removed functionality, architectural decisions and risks.

## Commands

```bash
npm run dev      # prisma generate + dev server at http://localhost:3000
npm run build    # prisma generate + production build (also validates pages compile)
```

**After changing `prisma/schema.prisma` you MUST restart the dev server.** `lib/db.ts` caches the client in `global.prisma`, which survives HMR, so a running server keeps a stale client and new models come back `undefined` (`Cannot read properties of undefined (reading 'create')`). Both `dev` and `build` run `prisma generate`, but only a restart picks it up. Schema changes also need `prisma db push` to reach Supabase.

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

Three React Contexts mounted in `app/(dashboard)/layout.tsx`, plus one inside `AppShell`:

**`FinanceProvider`** (`components/finance-store.tsx`) — financial data:
- `records` — active `FinancialRecord[]` (dashboard, activos)
- `snapshots` — `Snapshot[]`
- `movements` — `Movement[]`, audit log (used by `/movimientos`; `/historial` fetches server-side instead)
- Mutations are **optimistic**: state updates immediately, DB write fires via `fire(promise)` in background. If the write fails, a toast error is shown (destructive variant).
- `reload()` — re-fetches all data from DB; used after Server Actions that bypass the context (e.g. asset creation).

**`ObligationsProvider`** (`components/obligations-store.tsx`) — obligations data:
- `obligations` — `Obligation[]` with nested rules, installments, and payments
- `reload()` — re-fetches obligations from DB
- State is isolated from `FinanceProvider` to keep the obligations domain separate.

**`SettingsProvider`** (`components/settings-store.tsx`) — configuration:
- Exchange rates, display preferences, hidden/custom asset types
- Persisted to `localStorage` key `cashflow:settings`

### Data types (`lib/finance.ts`)

Four record types: `"ingreso"`, `"gasto"`, `"activo"`, `"pasivo"`. Each `FinancialRecord` has a `currency` (USD/EUR/MXN/ARS/USDT).

`Snapshot` captures `{ id, name, period, createdAt, records[] }`.

### Assets: categories + capabilities (`lib/asset-categories.ts`)

**There is no asset type enum anymore** (v2.5.0). `AssetType` is a deprecated `string` alias kept only so legacy imports compile.

- **Category** = a free label (`AssetCategory` table, `Record.assetType` holds its id). It determines **nothing**. Managed in `/configuracion`; `AssetCategoriesProvider` loads them and `ensureAssetCategories()` seeds/migrates legacy enum values idempotently on mount.
- **Capabilities** are what an asset can do. Only `quantity` needs its own column (`Record.tracksQuantity`); the other three are derived — `income` = has `IncomeRule`s, `boards` = has `metadata.boards`, `group` = has children.
- **`asset-detail.tsx` routes by DATA, never by category.** `metadata.assets[]` → rebalance panel, `metadata.disbursements[]` → bond panel, `metadata.rate + endDate` → fixed-term, `metadata.totalGained` → trading bot, `tracksQuantity` → units panel. This is what let the enum go without migrating any legacy asset's behavior — **do not reintroduce type-based branching.**
- Groups are collapsible in `/activos` and the dashboard. `isGroupParent` derives from having children, never from a type.

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
`app/(dashboard)/layout.tsx` → `SettingsProvider` → `FinanceProvider` → `ObligationsProvider` → `AppShell`

`AppShell` → `NotificationsProvider` → [column: `AppHeader` (full width) | row: `AppSidebar` + `<main>`] + `Toaster`

`AppHeader` shows user name (left) and notification bell (right). `AppSidebar` shows domain-grouped nav sections (Inicio / Patrimonio / Flujo de Caja / Control / Auditoría / Configuración) with badges.

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

### Monthly cutoff (`lib/cutoff.ts`, `lib/cutoff-actions.ts`)

Closes a period: archives the outgoing month's ingresos/gastos and prepares the incoming month's. Full spec at `docs/modules/corte-mensual.md`.

- **Period model**: `User.cutoffDay` (1–28, default 1) lives in the DB, NOT localStorage — the server decides eligibility. Period `P` spans day D of month `P` to day D of month `P+1`. `pendingCutoffPeriod()` is the period to close; `currentOpenPeriod()` is the incoming one.
- **Never runs automatically.** `CutoffBanner` shows a dialog on the dashboard when a period is pending. The button only renders when `status.available` — that is what prevents cutting every day.
- **`MonthlyCutoff` has `@@unique([userId, period])`** — this is the real guard against a double cutoff. `executeCutoff()` re-validates eligibility server-side; never trust the client.
- **Obligations**: the cutoff flips the pre-generated `PENDING` gasto to `ACTIVE`. It does NOT mark the ObligationPayment/Installment as `PAID` — accepting stays a manual user action.
- **Dividends**: the cutoff creates an ingreso for `estimatedGain` and writes its id into `dividend.ingresoRecordId`. `collectDividend()` therefore UPDATES that ingreso instead of creating a second one, and posts a journal entry only for the real-vs-estimated delta. If you touch `collectDividend()`, preserve that reconciliation.
- **The two marker switches do opposite things on purpose**: keep markers on ingresos/gastos (ephemeral, "pending to review"), clear them on activos/obligaciones (permanent, "already checked this month").

### Income streams (`lib/income-streams.ts`, `lib/income-actions.ts`)

Mirror of the Obligations module: `IncomeRule` + `IncomeOccurrence` hang off a `Record` of type `activo`. Full spec at `docs/modules/flujos-de-ingresos.md`.

- **Any asset type can have income rules** — not just `INCOME_STREAM`. `IncomeRulesSection` is mounted for every non-GROUP asset. `INCOME_STREAM` just exists as a container with presets (Salario / Préstamo / Cuotas / Personalizado) via `buildPresetRules()`.
- **A rule has four independent axes** (v2.4.0): `installmentCount` (indefinite vs. N finite instalments), `amountMode` (`FIXED` vs. `PERCENTAGE` of asset value), `adjustmentPct`+`adjustEveryN` (compound raise every N collections), and `settlement` (`CASH` vs. `IN_KIND`). `occurrenceAmount()` in `lib/income-streams.ts` resolves the amount; keep it pure and tested.
- **`reducesPrincipal` is the pivot flag.** Collecting a rule with it set lowers `asset.amount` (floor 0), writes an `EXTRACT` movement, and posts `efectivo / activos` — recovering principal is NOT income. Without it, the entry is `efectivo / ingresos`. `IN_KIND` posts `activos / ingresos` — no cash entered. Never collapse these three cases.
- **`metadata.valueMode` decides the asset's value semantics.** `PROJECTION` = `amount` is the annual income projection (mirrors how a RECURRING obligation is worth its annual cost); `MANUAL` = the user owns the value. **`MANUAL` is the default and `recalcularIncomeStream()` must never touch a MANUAL asset** — an apartment with a rent rule has its own market value, and deriving this from `reducesPrincipal` would overwrite it.
- **`computeAnnualProjection()` prefers real occurrences over the formula.** With adjustment, percentage or a finite schedule, `amount × occurrencesPerYear` lies. Only fall back to it when no occurrences exist.
- **The cutoff activates the PENDING ingreso but leaves the occurrence PENDING** and posts NO journal entry — the real amount is unknown until the user confirms, and the account depends on `reducesPrincipal`. The entry is written in `collectIncomeOccurrence()`.
- **`updateIncomeRule()` regenerates only PENDING occurrences whose ingreso is still PENDING.** Once a cutoff activated the ingreso it is in the user's current dashboard; rewriting it would move money under their feet.
- `extendRecurringDividends()` in `lib/assets.ts` pushes recurring dividend series forward at each cutoff; without it the 12-month seed window runs dry and dividends silently stop generating income.

### Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | Live editable dashboard + snapshot dialog |
| `/activos` | `app/(dashboard)/activos/page.tsx` | Asset list; "Agrupar" mode for creating groups |
| `/activos/[id]` | `app/(dashboard)/activos/[id]/page.tsx` | Asset detail: inline edit fields + panels + boards |
| `/gastos` | `app/(dashboard)/gastos/page.tsx` | Expense list grouped by source |
| `/ingresos` | `app/(dashboard)/ingresos/page.tsx` | Income list grouped by source |
| `/libro-contable` | `app/(dashboard)/libro-contable/page.tsx` | Double-entry ledger view with account balances |
| `/historial` | `app/(dashboard)/historial/page.tsx` | Audit log with server-side pagination + URL-synced filters (Server Component + Suspense wrapper) |
| `/snapshots` | `app/(dashboard)/snapshots/page.tsx` | List of saved snapshots |
| `/snapshots/[id]` | `app/(dashboard)/snapshots/[id]/page.tsx` | Read-only snapshot view with account balances |
| `/obligaciones` | `app/(dashboard)/obligaciones/page.tsx` | Obligations list |
| `/obligaciones/[id]` | `app/(dashboard)/obligaciones/[id]/page.tsx` | Obligation detail |
| `/configuracion` | `app/(dashboard)/configuracion/page.tsx` | Currency settings + configurable asset types + monthly cutoff day |

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

### Hooks (`hooks/`)

| Hook | File | Purpose |
|---|---|---|
| `useHistorialFilters` | `hooks/use-historial-filters.ts` | URL-synced filter state for `/historial` (action, recordType, search, dateFrom, dateTo) |
| `usePagination` | `hooks/use-pagination.ts` | URL-synced page + pageSize state; valid sizes are 10/25/50/100 |
| `useHistorialQuery` | `hooks/use-historial-query.ts` | Fetches paginated audit log from `loadHistorial()` server action; stale-request cancellation via `reqId` ref; debounced comment persistence |
| `useMobile` | `hooks/use-mobile.tsx` | Returns boolean based on `(max-width: 768px)` media query |
| `useToast` | `hooks/use-toast.ts` | Toast notification state management (shadcn/ui) |

### Patterns to know

- **Soft-delete (activos/pasivos)**: use `deletedAt` timestamp; queries always filter `deletedAt: null`. NEVER use `deletedAt` for ingresos or gastos.
- **Status model for ingresos/gastos**: ACTIVE | PENDING | CANCELLED | HISTORICAL | ARCHIVED.
  - `HISTORICAL`: set when (a) deleted from dashboard, or (b) superseded by a new period version.
  - `ARCHIVED`: explicitly archived by user from /ingresos or /gastos module pages.
  - NEVER set `deletedAt` on ingreso or gasto — use `status` instead.
  - `PENDING` and `CANCELLED` remain for obligation-linked gastos (no change).
- **Versioning (ingresos/gastos)**: when creating a "new period" version, always set `previousVersionId` on the new record and `status="HISTORICAL"` on the old record in the same DB transaction. Use `editOrVersionRecord()` from `lib/versioning-actions.ts`.
- **Asset deletion in dashboard**: calls `zeroOutAsset()` (sets amount=0, creates EXTRACT movement, optionally creates ingreso) — does NOT soft-delete the record
- **Asset deletion in /activos**: still calls `deleteRecord()` from context (soft-delete via `dbDeleteRecord`)
- **Asset creation**: `AssetFormDialog` calls `createAsset()` (Server Action) then `reload()` — does NOT call `createRecord()` to avoid a duplicate DB insert
- **`fire(promise)`**: fires a promise in the background; shows a destructive toast on error
- **Debounce**: comment updates are debounced 600ms before DB write (both `/movimientos` and `/historial`)
- **Multi-select filter**: `/activos` type filter is multi-select; buttons toggle, "Todos" clears selection
- **URL-synced state**: `/historial` uses `useSearchParams()` + `router.replace()` for filters and pagination — requires Suspense boundary, hence the Server Component `page.tsx` wrapper
- **Markers**: entity markers live in `entity_markers` table. One marker per entity at a time (`@@unique([entityId, entityType])`). Use `setEntityMarker()` from `lib/marker-actions.ts` — it upserts (replaces existing). Never delete a record just to remove its marker; delete only the `EntityMarker` row.
- **Gasto↔Ingreso links**: N:M relationship in `gasto_ingreso_links`. `attributedAmount` must be > 0. Validation of over-attribution is soft (warn, don't block). Links survive status changes (HISTORICAL gastos keep their links).
- **NumericInput**: all numeric inputs use `components/ui/numeric-input.tsx`. If user types `=expr`, it evaluates as math on blur. Only the numeric result is persisted. Uses a safe recursive descent parser — never `eval()`.

### Styling conventions

- shadcn/ui (New York style) via `components/ui/` — add new components with `npx shadcn@latest add <component>`
- Tailwind CSS v4 (configured in `app/globals.css`, not `tailwind.config.js`)
- Monochrome design: black headers, white backgrounds, `border-2 border-black` for panels — no shadows, no color accents except status badges (emerald/amber/rose)
- **No rounded corners on form controls.** `input`, `numeric-input`, `textarea`, `select` (trigger/content/items) and `checkbox` are pinned to `rounded-none`. shadcn/ui ships them as `rounded-md`, so when adding a component with `npx shadcn@latest add`, square its corners. Switches keep `rounded-full` on purpose.
- Path alias `@/` maps to the project root
