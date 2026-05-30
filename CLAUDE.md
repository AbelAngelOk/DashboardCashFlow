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

All application state lives in memory inside a single React Context. There is no database, no localStorage, no API — data resets on page refresh.

### State layer (`components/finance-store.tsx`)

`FinanceProvider` holds three state arrays:
- `records` — active `FinancialRecord[]` (shown on the dashboard)
- `snapshots` — `Snapshot[]`, each a frozen copy of `records` at a point in time
- `movements` — `Movement[]`, an audit log auto-generated on create/edit/delete

The context is mounted at the root in `app/layout.tsx`, wrapping the entire app. Any page or component calls `useFinance()` to read or mutate state.

### Data types (`lib/finance.ts`)

Four record types: `"ingreso"`, `"gasto"`, `"activo"`, `"pasivo"`. Each `FinancialRecord` has a `currency` (USD/EUR/MXN/ARS/USDT) and an optional `linkedTo` ID that links an ingreso → activo or gasto → pasivo.

`Snapshot` captures `{ id, name, period, createdAt, records[] }`. The `records` array is a shallow copy of state at snapshot time.

### UI layout

`app/layout.tsx` → `FinanceProvider` → `AppShell` → `AppSidebar` + `<main>{children}</main>`

`AppShell` and `AppSidebar` are client components that read from context. The sidebar shows live badge counts (snapshots.length, movements.length).

### Key reusable component

`components/dashboard-sheet.tsx` — renders the full financial dashboard (Estado de Resultados + Balance) as editable tables. Accepts a `readOnly` boolean prop: when `true`, hides add/edit/delete controls. Used both on the live dashboard (`/`) and in read-only snapshot views (`/snapshots/[id]`).

### Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Live editable dashboard + snapshot dialog |
| `/snapshots` | `app/snapshots/page.tsx` | List of saved snapshots |
| `/snapshots/[id]` | `app/snapshots/[id]/page.tsx` | Read-only view of a snapshot |
| `/movimientos` | `app/movimientos/page.tsx` | Audit log of all record changes |

### Styling conventions

- shadcn/ui (New York style) via `components/ui/` — add new components with `npx shadcn@latest add <component>`
- Tailwind CSS v4 (configured in `app/globals.css`, not `tailwind.config.js`)
- Monochrome design: black headers, white backgrounds, `border-2 border-black` for panels — no shadows, no color accents except status badges (emerald/amber/rose)
- Path alias `@/` maps to the project root
