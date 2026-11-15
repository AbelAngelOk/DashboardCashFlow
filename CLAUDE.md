# CLAUDE.md

Guidance for Claude Code in this repo. Reference material (pages, hooks, dialogs, group API) lives in `docs/REFERENCIA.md` — read it on demand, don't copy it back here.

## Documentation

- Every functional change gets an entry in `docs/CHANGELOG.md` (Added / Changed / Fixed / Removed). A version bump also gets `docs/releases/vX.Y.Z.md`.
- Update a `docs/modules/*.md` only where the behavior it describes changed, and do it **after** implementing — docs describe what the code does, not the plan.
- Version headers (`Versión / Última actualización / Autor: Abel Cejas / Estado`) only on CHANGELOG and release notes. Don't bump other docs' headers.
- `docs/archive/` is historical (implemented proposals, one-off analyses). Don't treat it as current.

## Commands

```bash
npm run dev      # prisma generate + dev server at http://localhost:3000
npm run build    # prisma generate + production build
./node_modules/.bin/tsc --noEmit   # the only type check: next.config sets ignoreBuildErrors
```

- No tests. `npm run lint` references an ESLint that isn't installed — ignore it.
- After changing `prisma/schema.prisma`: restart the dev server (`lib/db.ts` caches the client in `global.prisma`, which survives HMR — new models come back `undefined`) and run `prisma db push` to reach Supabase.
- A server started with `npm start` serves the last `build`; code edits do nothing until you rebuild. Prefer `npm run dev` for iterating.

## Data safety

- **`.env.local` points at the same Supabase database as production (Vercel).** Local testing writes real data.
- Test with disposable users created via Prisma and delete them (and their rows) afterwards. Never touch the real users' data.

## Architecture

Next.js App Router + React Context + Prisma + PostgreSQL (Supabase) + NextAuth v4 (JWT + bcrypt). Auth middleware is `proxy.ts` (not `middleware.ts`); every query is scoped by the session user id. There is no REST API: data goes through `"use server"` files in `lib/` (a `"use server"` file can only export async functions — pure helpers go in the sibling non-action file, e.g. `income-streams.ts` next to `income-actions.ts`).

**State**: `FinanceProvider` (`records`, `snapshots`, `movements`; mutations are optimistic via `fire(promise)` with a destructive toast on failure; `reload()` after server actions that bypass the context), `ObligationsProvider`, `MarkersProvider`, `AssetCategoriesProvider`, `SettingsProvider` (exchange rates / display prefs in `localStorage: cashflow:settings`). `User.cutoffDay` lives in the DB, not localStorage.

**Record types**: `ingreso`, `gasto`, `activo`, `pasivo`. Currencies USD/EUR/MXN/ARS/USDT.

### Assets: categories + capabilities (`lib/asset-categories.ts`)

There is no asset type enum (v2.5.0). A **category** (`AssetCategory`, id stored in `Record.assetType`) is a free label that decides nothing. **Capabilities** decide behavior: `quantity` = `Record.tracksQuantity`; `income` = has `IncomeRule`s; `boards` = has `metadata.boards`; `group` = has children. `asset-detail.tsx` routes panels by DATA (`metadata.assets[]`, `metadata.disbursements[]`, `metadata.rate + endDate`, `metadata.totalGained`, `tracksQuantity`) — **never reintroduce type-based branching**. `isGroupParent` derives from having children.

### Financial recording layers — don't confuse them

| Layer | Table | Purpose | Actions |
|---|---|---|---|
| JournalEntry (Libro Contable) | `journal_entries` | Double entry: every financial event → debit/credit | `lib/journal-actions.ts` |
| AuditLog (Historial) | `movements` | CRUD trail | `lib/actions.ts` |
| FinancialMovement | `financial_movements` | Per-asset BUY/SELL/DEPOSIT/EXTRACT | `lib/assets-actions.ts` |

**Every new financial function MUST call `createJournalEntry()`.** Mapping of operations → accounts: `docs/financial-domain-architecture.md`.

### Monthly cutoff (`lib/cutoff.ts`, `lib/cutoff-actions.ts`) — spec: `docs/modules/corte-mensual.md`

- Period `P` spans day D of month P to day D of month P+1. `pendingCutoffPeriod()` = the one to close; `currentOpenPeriod()` = incoming.
- Never automatic. `MonthlyCutoff @@unique([userId, period])` is the real double-cutoff guard; `executeCutoff()` revalidates server-side.
- Obligations: the cutoff moves the pre-generated `PENDING` gasto to `REVIEW` and posts **no** journal entry; paying (dashboard "Pagar" or obligation detail) marks the installment/payment `PAID`, sets the gasto `ACTIVE` and journals the real amount. Journaling at the cutoff too double-counts the expense.
- Generated income (rule occurrences, dividends) also enters as `REVIEW`. `confirmReviewRecord()` (`lib/review-actions.ts`) routes Pagar/Cobrar to the right origin action. `keepUnconfirmed` lets `REVIEW` records cross the cutoff.
- Dividends: the cutoff creates an ingreso for `estimatedGain` and stores its id in `dividend.ingresoRecordId`; `collectDividend()` UPDATES that ingreso and journals only the real-vs-estimated delta. Preserve that reconciliation.
- Marker switches are opposite on purpose: keep markers on ingresos/gastos (ephemeral), clear them on activos/obligaciones (monthly check).

### Income streams (`lib/income-streams.ts`, `lib/income-actions.ts`) — spec: `docs/modules/flujos-de-ingresos.md`

Mirror of Obligations: `IncomeRule` + `IncomeOccurrence` hang off any non-group `activo`.
- Four independent rule axes: `installmentCount`, `amountMode` (FIXED/PERCENTAGE), `adjustmentPct`+`adjustEveryN`, `settlement` (CASH/IN_KIND). `occurrenceAmount()` resolves the amount — keep it pure.
- `reducesPrincipal` is the pivot: collecting lowers `asset.amount`, writes EXTRACT, posts `efectivo / activos` (principal recovery is not income). Otherwise `efectivo / ingresos`; `IN_KIND` posts `activos / ingresos`. Never collapse these cases.
- `metadata.valueMode`: `MANUAL` (default) = user owns the value, and `recalcularIncomeStream()` must never touch it; `PROJECTION` = amount is the annual projection.
- `computeAnnualProjection()` prefers real occurrences over `amount × frequency`.
- The cutoff activates the ingreso but leaves the occurrence PENDING and posts no journal entry — that happens in `collectIncomeOccurrence()`.
- `updateIncomeRule()` regenerates only PENDING occurrences whose ingreso is still PENDING.
- `formatOccurrenceName()` ("Cuota N/total — nombre") is applied at generation, cutoff activation, collection and in `loadIncomeRules` — keep all four consistent.
- `extendRecurringDividends()` rolls dividend series forward at each cutoff.

### Patterns

- **Soft-delete** only for activos/pasivos (`deletedAt`, always filter `deletedAt: null`). Ingresos/gastos never get `deletedAt` — they use `status`.
- **Ingreso/gasto status**: `ACTIVE` | `REVIEW` (generated by the cutoff, "Por revisar") → `CONFIRMED` (validated, "Pendiente" / "Por cobrar") → `ACTIVE` (paid/collected) — anything that means "in the current period" must include REVIEW and CONFIRMED, see `LIVE_FLOW_STATUSES`; `UNSETTLED_FLOW_STATUSES` = not yet paid/collected | `PENDING` (pre-generated, not yet in the dashboard) | `CANCELLED` | `HISTORICAL` (deleted from dashboard, archived by the cutoff, or superseded by a new version) | `ARCHIVED` (archived by the user from /ingresos or /gastos).
- **Libertad Financiera** counts only income of assets with `Record.generatesIncome` (business/rent), never loans receivable or accumulated capital.
- **Obligation recurrence** has `WEEKLY` (`ObligationRecurrence`); income rules do not — don't merge the two types.
- **Timezone**: `next.config.mjs` forces `TZ=UTC` (Vercel is UTC, the DB is shared). Calendar dates are stored at UTC midnight and displayed with `timeZone: "UTC"`.
- **Editing a generated record's amount** propagates to its origin (`syncIngresoAmount` / `syncGastoAmount`, called from `dbEditRecord`).
- **Names** are capped at `NAME_MAX_LENGTH` (30) in every input; descriptions show as an `InfoTip`. Asset descriptions are TipTap JSON — never write them from the plain-text path.
- **Versioning**: a new-period version sets `previousVersionId` on the new record and `HISTORICAL` on the old one in one transaction — `editOrVersionRecord()` in `lib/versioning-actions.ts`.
- **Assets from the dashboard**: delete = `zeroOutAsset()` (no soft-delete); creation = `createAsset()` + `reload()`, never `createRecord()` (duplicate insert).
- **Markers**: one per entity (`@@unique([entityId, entityType])`); `setEntityMarker()` upserts. Delete the `EntityMarker` row, never the record.
- **Gasto↔Ingreso links**: N:M in `gasto_ingreso_links`, `attributedAmount > 0`, over-attribution warns but doesn't block, links survive status changes.
- **`NumericInput`**: `=expr` evaluates on blur with a safe parser (never `eval`). Its `onChange` fires **only on blur**, so a click right after typing can read stale state — compute save-time values from the source state inside the handler, not from state derived in a `useEffect`.

## Styling

- shadcn/ui (New York) in `components/ui/`; Tailwind v4 configured in `app/globals.css`. Path alias `@/` = repo root.
- Monochrome: black headers, white backgrounds, `border-2 border-black` panels, no shadows; color only for status badges (emerald/amber/rose).
- Form controls are `rounded-none` (input, numeric-input, textarea, select, checkbox) — square any newly added shadcn component. Switches keep `rounded-full`.
