# 01 — Arquitectura

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework principal | Next.js (App Router) | 16.2.6 |
| Lenguaje | TypeScript | 5.7.3 |
| UI Library | React | 19.2.4 |
| ORM | Prisma | 7.8.0 |
| Base de datos | PostgreSQL (Supabase) | — |
| Driver PG | `pg` + `@prisma/adapter-pg` | 8.21 / 7.8 |
| Autenticación | NextAuth v4 | 4.24.14 |
| Hash de contraseñas | bcryptjs | 3.0.3 |
| Componentes UI | shadcn/ui (Radix UI) + Tailwind CSS v4 | — |
| Íconos | lucide-react | 0.564.0 |
| Analíticas | Vercel Analytics | 1.6.1 |
| Formularios | react-hook-form + zod | 7.54 / 3.24 |
| Gráficos | recharts | 2.15.0 |

## Frontend

### Modelo de capas

```
app/layout.tsx                  ← RootLayout: AuthProvider + Vercel Analytics
  └── app/(dashboard)/layout.tsx ← DashboardLayout: SettingsProvider + FinanceProvider + AppShell
        ├── components/app-shell.tsx       ← Layout con sidebar y área de contenido
        ├── components/app-sidebar.tsx     ← Navegación lateral con badges dinámicos
        └── app/(dashboard)/<ruta>/page.tsx ← Páginas de cada sección
```

### Gestión de estado

El estado de la aplicación se gestiona mediante dos React Context providers anidados:

**`FinanceProvider`** (`components/finance-store.tsx`):
- Carga los datos del usuario desde la base de datos al montar (`loadData()`).
- Expone `records`, `snapshots`, `movements`.
- Mutaciones optimistas: actualiza el estado local inmediatamente y dispara la escritura a la DB en segundo plano (`fire(promise)`). Los errores se loguean a la consola pero no revierten el estado.
- Los comentarios en el log de movimientos se persisten con debounce de 600ms.

**`SettingsProvider`** (`components/settings-store.tsx`):
- Persiste la configuración del dashboard en `localStorage` bajo la clave `cashflow:settings`.
- Gestiona: modo de conversión de monedas, moneda base, tasas de cambio manuales, y timestamp de última actualización.
- Las tasas de cambio se obtienen bajo demanda desde `https://open.er-api.com/v6/latest/{base}`.

### Páginas y rutas

| Ruta | Archivo | Tipo |
|---|---|---|
| `/login` | `app/login/page.tsx` | Client Component |
| `/register` | `app/register/page.tsx` | Client Component |
| `/` | `app/(dashboard)/page.tsx` | Client Component |
| `/activos` | `app/(dashboard)/activos/page.tsx` | Client Component |
| `/activos/[id]` | `app/(dashboard)/activos/[id]/page.tsx` | Server Component (async) |
| `/snapshots` | `app/(dashboard)/snapshots/page.tsx` | Client Component |
| `/snapshots/[id]` | `app/(dashboard)/snapshots/[id]/page.tsx` | Client Component |
| `/movimientos` | `app/(dashboard)/movimientos/page.tsx` | Client Component |
| `/configuracion` | `app/(dashboard)/configuracion/page.tsx` | Client Component |

> **Nota**: `/activos/[id]` es un Server Component que llama directamente a `loadAsset()` (Server Action). El resto de las páginas del dashboard consumen datos a través del `FinanceContext`.

## Backend

Next.js unifica frontend y backend. No existe un servidor API separado.

### Server Actions

Las funciones de mutación de datos son Server Actions de Next.js (marcadas con `"use server"`), lo que significa que se ejecutan en el servidor pero pueden ser llamadas directamente desde componentes cliente.

**`lib/actions.ts`** — Operaciones sobre registros financieros y snapshots:
- `loadData()` — Carga registros, snapshots y movimientos del usuario autenticado
- `registerUser()` — Registro de nuevo usuario con hash bcrypt (factor 12)
- `dbCreateRecord()` — Crear registro financiero + log de auditoría (transacción atómica)
- `dbEditRecord()` — Editar registro + log de auditoría (transacción atómica)
- `dbDeleteRecord()` — Soft delete de registro + log de auditoría (transacción atómica)
- `dbTakeSnapshot()` — Crear snapshot con copia de todos los registros actuales
- `dbUpdateComment()` — Actualizar comentario en log de auditoría

**`lib/assets-actions.ts`** — Operaciones sobre activos financieros:
- `loadAssets()` — Lista activos de tipo "activo" con hijos y movimientos financieros
- `loadAsset(id)` — Carga un activo individual con todos sus detalles
- `createAsset()` — Crea activo y registra movimiento DEPOSIT inicial automáticamente
- `updateAsset()` — Actualiza campos del activo (parcialmente)
- `deleteAsset()` — Soft delete de activo
- `addMovement()` — Registra movimiento financiero (BUY, SELL, etc.)
- `updateMovement()` — Actualiza movimiento financiero
- `deleteMovement()` — Elimina movimiento financiero (hard delete)
- `collectDividend()` — Cobra dividendo: crea ingreso en dashboard y actualiza metadata
- `collectFixedTerm()` — Cobra plazo fijo: crea ingreso y soft-delete del activo
- `createAdjustmentMovement()` — Registra ajuste manual de valor
- `updateTracking()` — Actualiza tabla de seguimiento configurable del activo
- `groupAssets()` — Agrupa activos bajo un padre

### Middleware de autenticación

`proxy.ts` implementa el middleware de NextAuth que protege todas las rutas excepto `/login`, `/register`, y la ruta de API de auth. Los usuarios sin sesión válida son redirigidos a `/login`.

```
Rutas protegidas: todo excepto login | register | /api/auth/* | _next/* | favicon | icon
```

## Base de datos

**PostgreSQL** alojado en **Supabase** (región: `aws-1-sa-east-1`, São Paulo).

Dos strings de conexión:
- `DATABASE_URL` — Conexión via PgBouncer en modo transacción (puerto 6543), para queries normales.
- `DIRECT_URL` — Conexión directa al servidor (puerto 5432), usada para transacciones interactivas (`$transaction` async) que no son compatibles con PgBouncer en modo transacción.

El cliente Prisma se instancia una vez y se reutiliza globalmente (patrón singleton en `lib/db.ts`).

## Integraciones externas

| Servicio | Uso | Autenticación |
|---|---|---|
| Supabase (PostgreSQL) | Base de datos principal | Credenciales en `DATABASE_URL` y `DIRECT_URL` |
| open.er-api.com | Tasas de cambio en tiempo real | Sin API key (tier gratuito) |
| Vercel Analytics | Analíticas de uso (solo en producción) | Automático por plataforma Vercel |
| Google Fonts (Geist) | Tipografías (Geist Sans y Geist Mono) | Sin autenticación |

## Flujo de datos

```
Usuario (browser)
  │
  ├─ Navegación a ruta protegida
  │     └─ proxy.ts (NextAuth middleware) verifica JWT
  │           ├─ Sin token → redirect a /login
  │           └─ Con token → permite acceso
  │
  ├─ Carga inicial del dashboard
  │     └─ FinanceProvider.useEffect → loadData() [Server Action]
  │           └─ Prisma queries → Supabase PostgreSQL
  │                 └─ setState(records, snapshots, movements)
  │
  ├─ Mutación (ej: crear registro)
  │     ├─ setState optimista (UI actualiza inmediatamente)
  │     └─ fire(dbCreateRecord()) [Server Action, async, sin await]
  │           └─ Prisma $transaction → Supabase
  │
  ├─ Activos detallados (/activos/[id])
  │     └─ Server Component → loadAsset() [Server Action directo]
  │           └─ Prisma query con includes → datos frescos del servidor
  │
  └─ Configuración de monedas
        └─ SettingsProvider → localStorage (persistencia local)
              └─ fetch("https://open.er-api.com/...") [browser fetch, bajo demanda]
```

## Estructura de carpetas

```
DashboardCashFlow/
├── app/
│   ├── (dashboard)/          ← Grupo de rutas protegidas (layout compartido)
│   │   ├── activos/          ← Lista de activos y detalle por ID
│   │   ├── configuracion/    ← Personalización y tasas de cambio
│   │   ├── movimientos/      ← Log de auditoría
│   │   ├── snapshots/        ← Lista y vista de snapshots
│   │   ├── layout.tsx        ← SettingsProvider + FinanceProvider + AppShell
│   │   └── page.tsx          ← Dashboard principal
│   ├── api/auth/[...nextauth]/  ← Handler de NextAuth
│   ├── login/                ← Página de inicio de sesión
│   ├── register/             ← Página de registro
│   └── layout.tsx            ← RootLayout (AuthProvider, Analytics)
├── components/
│   ├── activos/              ← Componentes del módulo de activos
│   │   └── panels/           ← Panel específico por tipo de activo
│   ├── ui/                   ← Componentes shadcn/ui
│   ├── app-shell.tsx         ← Layout principal con sidebar
│   ├── app-sidebar.tsx       ← Barra de navegación lateral
│   ├── dashboard-sheet.tsx   ← Tabla de Estado de Resultados y Balance
│   ├── finance-store.tsx     ← Context de finanzas (estado global)
│   ├── settings-store.tsx    ← Context de configuración
│   ├── session-provider.tsx  ← Wrapper de NextAuth SessionProvider
│   └── theme-provider.tsx    ← Proveedor de tema (next-themes)
├── lib/
│   ├── actions.ts            ← Server Actions: registros y snapshots
│   ├── assets-actions.ts     ← Server Actions: activos financieros
│   ├── assets.ts             ← Tipos y utilidades de activos
│   ├── auth.ts               ← Configuración NextAuth
│   ├── db.ts                 ← Cliente Prisma singleton
│   ├── finance.ts            ← Tipos base y funciones de cálculo
│   └── utils.ts              ← Utilidad cn() para clases CSS
├── prisma/
│   └── schema.prisma         ← Esquema de base de datos
├── hooks/                    ← Hooks utilitarios (use-mobile, use-toast)
├── types/                    ← (carpeta presente, posiblemente vacía o con extensiones de tipos)
├── proxy.ts                  ← Middleware de autenticación NextAuth
├── .env / .env.local         ← Variables de entorno
└── prisma.config.ts          ← Configuración de Prisma CLI
```
