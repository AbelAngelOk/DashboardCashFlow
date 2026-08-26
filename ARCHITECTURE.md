# ARCHITECTURE.md — Estado actual de DashboardCashFlow

---
Versión: 1.0.0
Última actualización: 2026-08-17
Autor: Abel Cejas
Estado: Activo — Fase 1 de la migración a HTML/CSS/JS vanilla
---

> **Corrección de premisa**: el pedido de migración describía este proyecto como **Expo / React Native**. No lo es. Es **Next.js 16 + React 19 + Prisma + NextAuth**, sin ninguna dependencia de Expo ni React Native. El proyecto Expo del usuario es `training-app`, fuera de alcance.

---

## 1. Stack real

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| UI | React 19.2.4 + React DOM |
| Estilos | Tailwind CSS v4 (configurado en `app/globals.css`) + shadcn/ui (New York) |
| ORM | Prisma 7.8 con `@prisma/adapter-pg` sobre `pg` |
| Base de datos | PostgreSQL (Supabase) |
| Auth | NextAuth v4, estrategia JWT, bcryptjs |
| Middleware | `proxy.ts` (no `middleware.ts`) |
| Analytics | `@vercel/analytics` |

### Superficie

| Métrica | Valor |
|---|---|
| Rutas | 19 (14 estáticas, 5 dinámicas) |
| Archivos `.tsx` | 131 — **68 con `"use client"` (52 %)** |
| Líneas de TSX | 21.867 |
| Server Actions | **110** en 13 archivos |
| Rutas HTTP reales | **1** (`app/api/auth/[...nextauth]/route.ts`) |
| Dependencias runtime | **70** |
| Contexts globales | 5 |
| Tablas en DB | 15 |

---

## 2. Pantallas

| Ruta | Tipo | Contenido |
|---|---|---|
| `/` | Client | Dashboard: Estado de Resultados + Balance, edición en línea, corte mensual, snapshots |
| `/activos` | Client | Lista con filtro multi-selección por categoría, modo "Agrupar" |
| `/activos/[id]` | **Server** | Detalle: info, panel operativo, ingresos recurrentes, movimientos, tableros |
| `/gastos` | Client | Lista agrupada por fuente, filtro de estado, versionado, vínculos, marcadores |
| `/gastos/[id]` | **Server** | Detalle con fuente, cadena de versiones y vínculos |
| `/ingresos` | Client | Ídem gastos |
| `/ingresos/[id]` | **Server** | Ídem gastos |
| `/obligaciones` | Client | Lista con marcadores |
| `/obligaciones/[id]` | **Server** | Reglas, cuotas, pagos, aceptar/rechazar |
| `/libro-contable` | Client | Asientos de doble entrada + saldos por cuenta |
| `/snapshots` | Client | Listado de capturas |
| `/snapshots/[id]` | **Server** | Vista congelada de solo lectura |
| `/historial` | Server + Client | Auditoría paginada server-side, filtros sincronizados con la URL |
| `/configuracion` | Client | Monedas, categorías de activo, marcadores, día de corte |
| `/movimientos` | Client | Vista legacy del audit log — **fuera de la navegación lateral** |
| `/login`, `/register` | Client | Autenticación |

---

## 3. Componentes

| Grupo | Archivos | Notas |
|---|---|---|
| `components/ui/` | **59** | shadcn/ui — **solo 13 se usan** (ver §7, P1) |
| `components/activos/` | 20 | Lista, detalle, formulario, info, movimientos, categorías |
| `components/activos/panels/` | 8 | Paneles operativos, ruteados **por datos** desde v2.5.0 |
| `components/activos/boards/` | 3 | Manager, dividendos, tablero personalizado |
| `components/activos/income/` | 3 | Reglas de ingreso, alta/edición, confirmación de cobro |
| `components/obligations/` | 3 | Detalle (830 líneas), formulario, sección de dashboard |
| `components/cutoff/` | 3 | Diálogo, banner, configuración |
| `components/gastos/`, `components/ingresos/` | 4 | Formularios y paneles de vínculos |
| `components/markers/` | 3 | Store, picker, gestor |
| `components/notifications/` | 2 | Store y popover |
| Raíz de `components/` | 8 | Shell, header, sidebar, dashboard-sheet, stores |

### Los cinco más grandes

| Archivo | Líneas |
|---|---|
| `components/dashboard-sheet.tsx` | **1250** |
| `components/obligations/obligation-detail.tsx` | 830 |
| `components/ui/sidebar.tsx` | 726 *(sin uso)* |
| `components/activos/asset-form-dialog.tsx` | 677 |
| `app/(dashboard)/gastos/page.tsx` | 559 |

---

## 4. Estado

Cinco Contexts anidados en `app/(dashboard)/layout.tsx`:

```
SettingsProvider
└── FinanceProvider
    └── ObligationsProvider
        └── MarkersProvider
            └── AssetCategoriesProvider
                └── AppShell (→ NotificationsProvider)
```

| Provider | Fuente | Carga al montar |
|---|---|---|
| `SettingsProvider` | `localStorage` | Sin red |
| `FinanceProvider` | `loadData()` | records + snapshots + **todo el audit log** |
| `ObligationsProvider` | `loadObligations()` | Obligaciones con reglas, cuotas y pagos |
| `MarkersProvider` | `loadMarkers()` | Marcadores del usuario |
| `AssetCategoriesProvider` | `ensureAssetCategories()` | Categorías — **además escribe** (siembra/migra) |
| `NotificationsProvider` | Derivado de `records` | Sin red; calcula en cliente |

**Mutaciones optimistas**: `FinanceProvider` actualiza el estado de inmediato y dispara la escritura en segundo plano con `fire(promise)`; si falla, muestra un toast destructivo.

---

## 5. Server Actions — inventario completo (110)

> **Ninguna de estas es un endpoint HTTP.** Son RPC de Next.js: POST serializados, no cacheables por el navegador.

| Archivo | N | Acciones |
|---|---|---|
| `actions.ts` | 8 | `registerUser`, `loadData`, `dbCreateRecord`, `dbEditRecord`, `dbDeleteRecord`, `dbTakeSnapshot`, `dbUpdateComment`, `loadHistorial` |
| `assets-actions.ts` | 23 | `loadAssets`, `loadAsset`, `createAsset`, `updateAsset`, `updateBoards`, `ungroupAssets`, `deleteAsset`, `addMovement`, `updateMovement`, `deleteMovement`, `collectDividend`, `collectFixedTerm`, `zeroOutAsset`, `createAdjustmentMovement`, `updateTracking`, `createGroup`, `removeFromGroup`, `deleteGroup`, `assignToGroup`, `groupAssets`, `liquidarActivo`, `physicalDeleteAsset`, `createExtractFromDashboard` |
| `obligation-actions.ts` | 16 | `loadObligations`, `loadObligation`, `createObligation`, `addObligationRule`, `deleteObligationRule`, `pauseObligationRule`, `resumeObligationRule`, `acceptObligationPayment`, `rejectObligationPayment`, `acceptInstallmentPayment`, `rejectInstallmentPayment`, `registerManualPayment`, `updateObligationStatus`, `updateObligationInfo`, `deleteObligation`, `finalizeObligation` |
| `income-actions.ts` | 10 | `refreshIncomeWindows`, `loadIncomeRules`, `setIncomeStreamValueMode`, `createIncomeRule`, `updateIncomeRule`, `pauseIncomeRule`, `resumeIncomeRule`, `deleteIncomeRule`, `collectIncomeOccurrence`, `rejectIncomeOccurrence` |
| `gasto-actions.ts` | 9 | `loadGastos`, `loadGasto`, `archiveGasto`, `restoreGasto`, `editGasto`, `createFreeGasto`, `createLinkedGasto`, `createGastoForExistingAsset`, `createGastoAndNewAsset` |
| `marker-actions.ts` | 8 | `loadMarkers`, `createMarker`, `updateMarker`, `deleteMarker`, `setEntityMarker`, `removeEntityMarker`, `loadEntityMarkersForIds`, `loadEntityMarkerEntries` |
| `ingreso-actions.ts` | 7 | `loadIngresos`, `loadIngreso`, `archiveIngreso`, `restoreIngreso`, `editIngreso`, `createFreeIngreso`, `createIngresoFromAsset` |
| `flow-group-actions.ts` | 7 | `loadGastoGroups`, `loadIngresoGroups`, `createFlowGroup`, `renameFlowGroup`, `deleteFlowGroup`, `assignToFlowGroup`, `removeFromFlowGroup` |
| `asset-category-actions.ts` | 6 | `ensureAssetCategories`, `loadAssetCategories`, `createAssetCategory`, `renameAssetCategory`, `deleteAssetCategory`, `assetCountByCategory` |
| `link-actions.ts` | 6 | `createGastoIngresoLink`, `deleteGastoIngresoLink`, `loadLinksForGasto`, `loadLinksForIngreso`, `loadIngresoOptions`, `loadGastoOptions` |
| `cutoff-actions.ts` | 5 | `setCutoffDay`, `getCutoffStatus`, `listCutoffs`, `getCutoffPreview`, `executeCutoff` |
| `journal-actions.ts` | 4 | `createJournalEntry` ⚠️, `loadJournalEntries`, `getAccountBalances`, `initializeAccountBalances` |
| `versioning-actions.ts` | 1 | `editOrVersionRecord` |

### Mapa pantalla → módulos de datos

| Pantalla | Módulos que consume |
|---|---|
| `/` | `assets-actions`, `flow-group-actions`, + los 5 providers |
| `/activos` | `assets-actions` |
| `/activos/[id]` | `assets-actions`, `income-actions` |
| `/gastos` | `gasto-actions`, `flow-group-actions`, `marker-actions`, `link-actions`, `versioning-actions` |
| `/ingresos` | `ingreso-actions`, `flow-group-actions`, `marker-actions`, `link-actions`, `versioning-actions` |
| `/obligaciones` | `obligation-actions`, `marker-actions` |
| `/obligaciones/[id]` | `obligation-actions` |
| `/libro-contable` | `journal-actions` |
| `/historial` | `actions` (`loadHistorial`, `dbUpdateComment`) |
| `/configuracion` | `asset-category-actions`, `marker-actions`, `cutoff-actions` |
| `/register` | `actions` (`registerUser`) |

---

## 6. Autenticación, sesión y almacenamiento

### Auth

- **NextAuth v4**, estrategia **JWT**, hashing con **bcryptjs**
- `proxy.ts` protege las rutas del dashboard
- Todas las acciones llaman `getServerSession(authOptions)` y derivan `userId` de la sesión — **aislamiento por fila en cada consulta**
- Secretos server-side: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`

### Almacenamiento local

| Clave | Contenido |
|---|---|
| `cashflow:settings` | Moneda base, tasas de cambio, preferencias de conversión |
| `cashflow:notifications` | Estado de lectura de notificaciones |
| `cashflow:sidebar-collapsed` | Sidebar colapsado |
| `cashflow:cutoff-dismissed` | Período de corte descartado |

---

## 7. Assets y animaciones

- **No existe carpeta `public/`.** Sin imágenes ni iconos propios.
- Iconografía: `lucide-react` (SVG inline en JS).
- Fuentes: `next/font`, 10 archivos `.woff2` subseteados.
- **Sin librería de animación.** Solo utilidades Tailwind (`transition-*`, `animate-spin`). `globals.css` = 125 líneas.

**Conclusión**: la superficie de assets es mínima y no representa un problema de rendimiento.

---

## 8. Problemas de rendimiento

### P1 — 46 de 59 componentes UI no se usan · **alto**

Solo **13 de 59** componentes de `components/ui/` están referenciados. Y **cada dependencia pesada cuelga exactamente de uno de los muertos**:

| Dependencia | Único consumidor | ¿Se usa? |
|---|---|---|
| `recharts` | `ui/chart.tsx` | ❌ |
| `embla-carousel-react` | `ui/carousel.tsx` | ❌ |
| `react-day-picker` | `ui/calendar.tsx` | ❌ |
| `vaul` | `ui/drawer.tsx` | ❌ |
| `cmdk` | `ui/command.tsx` | ❌ |
| `react-resizable-panels` | `ui/resizable.tsx` | ❌ |
| `input-otp` | `ui/input-otp.tsx` | ❌ |
| `next-themes` + `sonner` | `ui/sonner.tsx` | ❌ |
| `react-hook-form` | `ui/form.tsx` | ❌ |

Más 5 dependencias sin ningún consumidor: **`zod`**, **`@hookform/resolvers`**, **`date-fns`**, **`playwright`**, **`postgres`** (duplica `pg`).

Sumando los 27 paquetes `@radix-ui/*`, la mayoría del árbol de dependencias del cliente es peso muerto.

### P2 — `loadData()` trae el audit log completo, sin límite · **alto**

`lib/actions.ts:82-85`:

```ts
prisma.auditLog.findMany({ where: { userId }, orderBy: { date: "desc" } })
```

Sin `take`. Se ejecuta en **cada montaje del dashboard**, y su único consumo real es el badge numérico del sidebar (`movements.length`).

Volumen medido: **130 filas de auditoría · 153 records · 95 filas de snapshot ≈ 378 filas por montaje**. Crece con cada CRUD y nunca se poda.

### P3 — Cinco cargas en cascada, sin paralelizar · **alto**

Cada provider dispara su propio `useEffect`. No hay `Promise.all` entre ellos. `AssetCategoriesProvider` además **escribe** en la base durante el montaje.

### P4 — `dashboard-sheet.tsx`: 1250 líneas · **medio-alto**

Renderiza Estado de Resultados y Balance completos. Editar un solo monto re-renderiza toda la planilla.

### P5 — TipTap (13 paquetes) para un solo campo · **medio**

Usado únicamente en `description` del detalle de activo.

### P6 — Server Actions: un POST por acción, sin cache · **medio**

Una Server Action es un POST serializado que el navegador **no puede cachear**. Sin paralelización entre lecturas independientes.

### P7 — 52 % de los componentes son de cliente · **medio**

68 de 131 archivos con `"use client"`, arrastrando React + Radix al bundle.

---

## 9. ⚠️ Hallazgo de seguridad (preexistente, no introducido por la migración)

**`createJournalEntry(userId, data)` acepta un `userId` provisto por quien la llama y está exportada desde un archivo `"use server"`.**

En Next.js, **todo export de un archivo `"use server"` queda expuesto como endpoint RPC invocable desde el navegador**. Las otras 109 acciones derivan `userId` de `getServerSession()`; esta lo recibe como parámetro.

| Aspecto | Detalle |
|---|---|
| Archivo | `lib/journal-actions.ts:51` |
| Impacto | Un cliente autenticado puede escribir asientos contables en el libro de **cualquier** usuario |
| Lectura ajena | No — la acción solo escribe, no devuelve datos de otros usuarios |
| Severidad | **Media-alta**: corrompe la contabilidad de terceros, sin fuga de datos |
| Alcance | Es la **única** de las 110 con esta forma |

**Corrección aplicada** (Fase 3): movida a `lib/journal-internal.ts`, un módulo **sin** `"use server"`. Los 7 archivos que la importaban ahora la traen de ahí. Verificado que ninguna de las 110 acciones acepta ya un `userId` provisto por el cliente.

En la migración: **no recibe endpoint HTTP**; es un helper interno.

---

## 9-bis. ⚠️ El middleware redirigía las llamadas de API al login

`proxy.ts` excluía del matcher únicamente `api/auth`, así que cualquier otra ruta bajo `/api/*` era interceptada por `withAuth` y respondía **307 hacia `/login`**.

| Aspecto | Detalle |
|---|---|
| Síntoma | Un cliente `fetch` recibe HTML de la página de login donde espera JSON |
| Consecuencia | Imposible distinguir "sesión vencida" de cualquier otro fallo |
| Severidad | **Media** — bloquea por completo un frontend desacoplado |

**Corrección aplicada** (Fase 3): `api` sale del matcher. Antes de hacerlo se verificó ruta por ruta que **cada** handler valida la sesión por su cuenta (`requireUserId()` o el `getUserId()` de las acciones). La única ruta pública es `/api/auth/*`. Comprobado: los 7 endpoints devuelven **401 con cuerpo JSON** sin sesión, y **200** con ella.

---

## 9-ter. ℹ️ `registerUser` reclama registros huérfanos

`lib/actions.ts:43-48` asigna al usuario recién creado todos los `records`, `snapshots` y `auditLog` con `userId: null`.

Hoy es inocuo —no quedan huérfanos, verificado creando y eliminando un usuario de prueba: reclamó 0 filas— pero **el primer usuario que se registre se apropiaría de cualquiera que apareciera**. Conviene revisarlo antes de abrir el registro a terceros. Es un remanente de la migración que introdujo la autenticación.

---

## 10. Funcionalidad que debe preservarse

Lista de comportamientos no obvios que la migración no puede perder:

| # | Comportamiento |
|---|---|
| 1 | Aislamiento por usuario en **todas** las consultas (`userId` de sesión) |
| 2 | Ingresos y gastos nunca se borran: cambian de `status` (`HISTORICAL`/`ARCHIVED`), reversible |
| 3 | Activos usan `deletedAt`; eliminación física solo con saldo 0 |
| 4 | Versionado atómico: nueva versión + anterior a `HISTORICAL` en una transacción |
| 5 | Toda operación financiera genera asiento de doble entrada |
| 6 | `reducesPrincipal` decide la cuenta: capital → `activos`, renta → `ingresos`, especie → `activos/ingresos` |
| 7 | Corte mensual: nunca automático, un período una sola vez (`@@unique`), revalidado en servidor |
| 8 | Los dos switches de etiquetas del corte hacen cosas opuestas a propósito |
| 9 | `collectDividend` concilia el ingreso estimado en vez de duplicarlo |
| 10 | Ventana móvil de 12 meses en obligaciones y reglas de ingreso |
| 11 | Paneles de activo ruteados **por datos**, nunca por categoría |
| 12 | Un marcador por entidad (`@@unique([entityId, entityType])`) |
| 13 | Mutaciones optimistas con reversión visible ante error |
| 14 | `NumericInput`: expresiones `=1000*10%` evaluadas con parser propio, nunca `eval()` |
| 15 | Filtros y paginación de `/historial` sincronizados con la URL |
| 16 | Conversión multi-moneda con desglose o total según configuración |

---

## 11. Reutilizable vs. a reimplementar

| Capa | Veredicto |
|---|---|
| `prisma/schema.prisma` | ✅ **Intacto** |
| `lib/*-actions.ts` (lógica de negocio) | ✅ **Se reutiliza** como capa de servicio detrás de la API |
| `lib/auth.ts`, NextAuth, bcrypt | ✅ **Intacto** |
| Helpers puros (`finance.ts`, `cutoff.ts`, `income-streams.ts`, `obligations.ts`, `assets.ts`, `asset-categories.ts`) | ✅ **Se reutilizan tal cual** — son TS sin dependencia de React |
| `app/api/auth/[...nextauth]/route.ts` | ✅ **Intacto** |
| Rutas HTTP del resto del dominio | 🔨 **A construir** — no existen |
| `components/**` (React) | 🔨 **A reimplementar** en DOM |
| `app/(dashboard)/**` (páginas React) | 🔨 **A reimplementar** |
| Los 5 Contexts | 🔨 **A reemplazar** por módulos + cache + DOM |
| `components/ui/**` | ❌ **A eliminar** (46 sin uso; 13 se reescriben en CSS) |
| TipTap | ❓ **A decidir**: `contenteditable` propio o textarea + Markdown |
| Tailwind | 🔨 **A reemplazar** por CSS propio (125 líneas de base) |

---

## Referencias

- Plan de migración: `MIGRATION_PLAN.md`
- Documentación de producto: `docs/10-Producto.md`
- Modelo de datos: `docs/03-Modelo-de-Datos.md`
- Instrucciones del repo: `CLAUDE.md`
