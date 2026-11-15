# Referencia de código

Material de consulta que no hace falta tener cargado en cada sesión (vive fuera de `CLAUDE.md` a propósito). Las reglas que evitan bugs siguen en `CLAUDE.md`.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | Live editable dashboard + snapshot dialog + cutoff banner |
| `/graficos` | `app/(dashboard)/graficos/page.tsx` | All charts in one view (flow projection, obligations, assets) |
| `/activos` | `app/(dashboard)/activos/page.tsx` | Asset list; "Agrupar" mode for creating groups |
| `/activos/[id]` | `app/(dashboard)/activos/[id]/page.tsx` | Asset detail: inline edit fields + panels + income rules + boards |
| `/obligaciones` | `app/(dashboard)/obligaciones/page.tsx` | Obligations list; "Agrupar" mode |
| `/obligaciones/[id]` | `app/(dashboard)/obligaciones/[id]/page.tsx` | Obligation detail: rules, installments, payments |
| `/ingresos` | `app/(dashboard)/ingresos/page.tsx` | Income list grouped by source + projection chart |
| `/gastos` | `app/(dashboard)/gastos/page.tsx` | Expense list grouped by source + projection chart |
| `/libro-contable` | `app/(dashboard)/libro-contable/page.tsx` | Double-entry ledger with account balances |
| `/historial` | `app/(dashboard)/historial/page.tsx` | Audit log, server-side pagination + URL-synced filters (Server Component + Suspense) |
| `/movimientos` | `app/(dashboard)/movimientos/page.tsx` | Legacy audit view (not in the sidebar) |
| `/snapshots`, `/snapshots/[id]` | `app/(dashboard)/snapshots/...` | Snapshot list + read-only view |
| `/configuracion` | `app/(dashboard)/configuracion/page.tsx` | Currencies, asset categories, markers, cutoff day, CSV export |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | `app/...` | Auth (excluded from the `proxy.ts` matcher) |

## UI layout

`app/layout.tsx` → `AuthProvider`
`app/(dashboard)/layout.tsx` → `SettingsProvider` → `FinanceProvider` → `ObligationsProvider` → `MarkersProvider` → `AssetCategoriesProvider` → `AppShell`

`AppShell` → `NotificationsProvider` → [`AppHeader` | `AppSidebar` + `<main>`] + `Toaster`. The sidebar groups nav by domain (Inicio / Patrimonio / Flujo de Caja / Control / Auditoría / Configuración).

`components/dashboard-sheet.tsx` renders Estado de Resultados + Balance as editable tables. `readOnly` hides all controls — used live on `/` and frozen on `/snapshots/[id]`.

## Hooks (`hooks/`)

| Hook | Purpose |
|---|---|
| `useHistorialFilters` | URL-synced filters for `/historial` |
| `usePagination` | URL-synced page + pageSize (10/25/50/100) |
| `useHistorialQuery` | Paginated audit log via `loadHistorial()`; stale-request cancellation via `reqId` ref |
| `useMobile` | `(max-width: 768px)` media query |
| `useToast` | shadcn toast state |

## Assets

- **Boards** (`components/activos/boards/`): `BoardManager` renders `metadata.boards` + "Agregar tablero". `DividendsBoard` = recurring dividends, 12-month window; collecting creates/updates an ingreso. `CustomBoard` = configurable table. `extractBoards()` migrates legacy `metadata.tracking` / `metadata.dividends`.
- **Inline editing** (`AssetInfoSection`): per-field (name, ticker, category, description); blur saves (200 ms debounce). `description` is TipTap JSON (`components/ui/rich-editor.tsx`), plain text fallback for legacy values.
- **Movements** (`AssetMovementsSection`): pencil → inline edit of `movementType` + `description`.
- **Group detail**: an asset with children shows Info → children summary → Movements; no boards.
- **Form**: when the `quantity` capability is on, qty × price auto-computes amount; a manual mismatch warns and blocks save. "Cargar por operaciones" builds the position from LONG/SHORT rows.

### Group API (`lib/assets-actions.ts`)

- `createGroup(name, childIds, currency)` — new parent + `parentId` on children
- `assignToGroup(groupId, childIds)` / `removeFromGroup(assetId)`
- `deleteGroup(groupId)` (= `ungroupAssets`) — detaches children + soft-deletes the parent

## Dashboard dialogs for activos

- **Edit value**: movement type Ajuste (ADJUSTMENT) | Depósito (DEPOSIT); Depósito can create a linked gasto; optional comment → `onEditAmountWithComment(...)`.
- **Delete** = zero out: optional linked ingreso + comment → `zeroOutAsset()` (amount 0 + EXTRACT movement, no soft-delete). Group children expose it too.

## Misc

- Comments in `/movimientos` and `/historial` are debounced 600 ms before writing.
- `/historial` uses `useSearchParams()` + `router.replace()` → needs the Suspense wrapper in its `page.tsx`.
- `/activos` category filter is multi-select; "Todos" clears it.
- Notifications are computed client-side from `records` (dividend pending when `month === currentYYYYMM && !actualGain`); read state in `localStorage: "cashflow:notifications"`.
- Every main container has a `data-testid` — list in `docs/ComponentIds.md`.
- Legacy: `settings.hiddenAssetTypes` / `customAssetTypes` in localStorage are only read once, to migrate into the `AssetCategory` table (`ensureAssetCategories()`).
