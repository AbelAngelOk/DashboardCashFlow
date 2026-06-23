# DashboardCashFlow

Personal finance dashboard for tracking assets, liabilities, income, expenses, obligations, and net worth snapshots.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7 |
| UI | React 19 + shadcn/ui + Tailwind CSS v4 |
| ORM | Prisma 7 |
| Database | PostgreSQL (Supabase, São Paulo) |
| Auth | NextAuth v4 (JWT + bcrypt) |
| Icons | lucide-react |

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
./node_modules/.bin/tsc --noEmit   # Type check (build ignores TS errors)
npx prisma db push                  # Apply schema changes to DB
npx prisma generate                 # Regenerate Prisma client
```

## Architecture

- **State**: Three React contexts — `FinanceProvider` (financial data, DB), `ObligationsProvider` (obligations, DB), `SettingsProvider` (config, localStorage)
- **Mutations**: Optimistic — state updates immediately, DB write fires in background via `fire(promise)`. On error, shows a destructive toast.
- **Server Actions**: `lib/actions.ts`, `lib/assets-actions.ts`, `lib/obligation-actions.ts`, `lib/journal-actions.ts`
- **Auth middleware**: `proxy.ts` (not `middleware.ts`)
- **Design**: Monochrome — `border-2 border-black`, no shadows, emerald/amber/rose for status badges only

## Docs

See [docs/](docs/) for full documentation.

- [Architecture](docs/01-Arquitectura.md)
- [Data Model](docs/03-Modelo-de-Datos.md)
- [Main Flows](docs/04-Flujos-Principales.md)
- [Financial Domain Architecture](docs/financial-domain-architecture.md)
- [Historial Pagination](docs/historial-paginacion.md)
- [Technical Status](docs/estado-tecnico.md)
- [Risks & Technical Debt](docs/08-Riesgos-y-Deuda-Tecnica.md)
