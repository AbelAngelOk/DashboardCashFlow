---
Versión: 2.1.0
Última actualización: 2026-08-04
Autor: Abel Cejas
Estado: Activo
---

# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [2.1.0] - 2026-08-04

### Added
- `docs/10-Producto.md` — documentación de producto completa: propuesta de valor, mapa de capacidades, modelo de entidades de dominio, siete tipos de relación entre entidades, ciclos de vida, catálogo de funcionalidades por módulo, recorridos de usuario end-to-end, las tres capas de registro, 15 reglas transversales, matriz entidad × módulo y límites conocidos
- Diagramas Mermaid en `10-Producto.md`: mapa de capacidades, ER de dominio, 5 diagramas de estado (ingreso/gasto, activo, obligación, cuota, dividendo), 6 diagramas de recorrido de usuario
- Sección "Empezar por acá" en `docs/README.md`

### Modified
- `docs/README.md`: índice actualizado con `10-Producto.md` y release v2.1.0

**Sin cambios de código.** Esta versión es exclusivamente documental.

---

## [2.0.0] - 2026-06-30

### Added
- Sidebar colapsable: estado persistido en `localStorage:cashflow:sidebar-collapsed`
- Color picker nativo para marcadores en `/configuracion`
- Quick marker creation desde filas de gastos, ingresos y obligaciones (sin abrir settings)
- Módulo de agrupación para Gastos: crear/renombrar/eliminar grupos, asignar/quitar registros
- Módulo de agrupación para Ingresos: misma funcionalidad que Gastos
- Grupos de Gastos e Ingresos colapsables en el Dashboard (header con total + count)
- `lib/flow-group-actions.ts`: Server Actions para CRUD de FlowGroup usando tablas `groups` + `record_groups` existentes
- Ícono Eye (Ver) en Dashboard para Ingresos y Gastos (antes solo Activos lo tenía)
- Página detalle `/gastos/[id]` — Server Component con info, cadena de versiones y links
- Página detalle `/ingresos/[id]` — Server Component con info, cadena de versiones y links
- `loadGasto(id)` en `lib/gasto-actions.ts` — carga un gasto individual con fuente y versión siguiente
- `loadIngreso(id)` en `lib/ingreso-actions.ts` — carga un ingreso individual con fuente y versión siguiente
- Infraestructura documental completa: CHANGELOG, /docs/releases/, /docs/modules/
- Política de documentación obligatoria (este documento)

### Modified
- Dashboard: icono ExternalLink de obligaciones reemplazado por Eye con hover-opacity
- `components/dashboard-sheet.tsx`: prop `gastoGroups` y `ingresoGroups` en `DashboardSheetProps`; renderizado de grupos por encima de registros sueltos
- AppSidebar: comportamiento colapsable con ícono de toggle
- Marcadores: color picker actualizado a input nativo type="color"

### Removed
- `ExternalLink` de lucide-react en `dashboard-sheet.tsx` (reemplazado por `Eye`)

---

## [1.9.0] - 2026-06-XX

### Added
- Sistema completo de Marcadores visuales
- `lib/marker-actions.ts`: CRUD de marcadores + asignación a entidades
- `lib/marker-types.ts`: tipos `MarkerDefinition`, `EntityMarkerEntry`, `EntityType`
- `components/markers/markers-store.tsx`: Context provider `MarkersProvider`
- `components/markers/marker-picker.tsx`: Popover de selección de marcador por fila
- `components/markers/marker-manager-dialog.tsx`: CRUD de marcadores en `/configuracion`
- Integración de marcadores en: Dashboard, /activos, /gastos, /ingresos, /obligaciones
- Borde de color + fondo tenue (12% opacidad) en filas marcadas
- Un marcador por entidad a la vez (enforced por `@@unique([entityId, entityType])` en DB)
- Sección de Marcadores en `/configuracion`

### Modified
- `app/(dashboard)/layout.tsx`: montaje de `MarkersProvider`
- `app/(dashboard)/configuracion/page.tsx`: sección gestión de marcadores
- `app/(dashboard)/activos/page.tsx`: columna de marcador por fila
- `app/(dashboard)/gastos/page.tsx`: columna de marcador por fila
- `app/(dashboard)/ingresos/page.tsx`: columna de marcador por fila
- `app/(dashboard)/obligaciones/page.tsx`: columna de marcador por fila
- `components/dashboard-sheet.tsx`: indicador de marcador por fila (barra de color, position: absolute)

---

## [1.8.0] - 2026-06-XX

### Added
- `components/ui/numeric-input.tsx`: input numérico con soporte de expresiones matemáticas (`=expr`)
  - Soporte de `%` como porcentaje (`=1000*10%` → 100)
  - Parser seguro de recursive descent (nunca usa `eval`)
- `lib/versioning-actions.ts`: `editOrVersionRecord()` para editar o crear nuevo período
  - Modo "edit": actualiza en lugar; modo "new-period": crea nuevo registro + marca anterior HISTORICAL
  - Transacción atómica en modo "new-period"
- `components/shared/edit-or-version-dialog.tsx`: diálogo reutilizable para editar o versionar
- `lib/link-actions.ts`: CRUD de links N:M Gasto↔Ingreso
- `lib/link-types.ts`: tipo `GastoIngresoLink`
- `components/gastos/gasto-ingreso-links-panel.tsx`: panel de ingresos vinculados por gasto
- `components/ingresos/ingreso-gasto-links-panel.tsx`: panel de gastos vinculados por ingreso
- `archiveGasto()`, `restoreGasto()` en `lib/gasto-actions.ts`
- `archiveIngreso()`, `restoreIngreso()` en `lib/ingreso-actions.ts`
- Estado ARCHIVED + HISTORICAL en /gastos e /ingresos con filtros y badges

### Modified
- `prisma/schema.prisma`: campos `createdAt`, `effectiveDate`, `previousVersionId` en `Record`; nuevos modelos `GastoIngresoLink`, `Marker`, `EntityMarker`
- `lib/finance.ts`: `RecordStatus` extendido con "HISTORICAL" y "ARCHIVED"
- `lib/actions.ts`: `loadData()` filtra ingresos/gastos por `status="ACTIVE"`; `dbDeleteRecord()` diferencia por tipo (flow → status HISTORICAL; activo → deletedAt)
- `lib/gasto-actions.ts`: `loadGastos(statuses)` parametrizado; `nextVersionId` calculado en memoria
- `lib/ingreso-actions.ts`: igual que gasto
- Reemplazo de `<Input type="number">` por `<NumericInput>` en todos los formularios
- `app/(dashboard)/gastos/page.tsx`: filtro de status + edit/version por fila + links panel
- `app/(dashboard)/ingresos/page.tsx`: igual

### Fixed
- `loadData()` no filtraba ingresos por status — ahora excluye HISTORICAL y ARCHIVED del dashboard

---

## [1.7.0] - 2026-06-XX

### Added
- Módulo `/gastos` — vista de gastos agrupados por fuente (obligation/asset/libre)
- Módulo `/ingresos` — vista de ingresos agrupados por fuente
- Módulo `/libro-contable` — libro de doble entrada con vista de cuentas y asientos
- `lib/journal-actions.ts`: `createJournalEntry()` — toda operación financiera registra un asiento
- `lib/gasto-actions.ts`: `loadGastos()`, `GastoWithSource`
- `lib/ingreso-actions.ts`: `loadIngresos()`, `IngresoWithSource`
- Regla: toda nueva función financiera DEBE llamar `createJournalEntry()`

### Modified
- `components/dashboard-sheet.tsx`: botón "Ver" con ExternalLink para activos

---

## [1.6.0] - anterior

### Added
- BoardManager: tableros opcionales por activo (Dividendos + Tablero personalizado)
- DividendsBoard: dividendos con soporte recurrente (mensual/trimestral/semestral/anual), ventana de 12 meses pregenerada
- CustomBoard: tabla configurable con columnas y filas editables
- Notificaciones: `NotificationsProvider` + campana en `AppHeader`; dividendos pendientes generan notificaciones
- `components/ui/rich-editor.tsx`: editor TipTap v3 para campo `description` de activos

---

## [1.5.0] - anterior

### Added
- Sistema de Obligaciones completo: `Obligation`, `ObligationRule`, `ObligationInstallment`, `ObligationPayment`
- Páginas `/obligaciones` y `/obligaciones/[id]`
- Gastos PENDING y CANCELLED para cuotas de obligaciones
- `ObligationsProvider` (`components/obligations-store.tsx`)

---

## [1.4.0] - anterior

### Added
- Historial de auditoría (`/historial`) con paginación server-side y filtros URL-synced
- `useHistorialFilters`, `usePagination`, `useHistorialQuery` hooks
- Tabla `movements` (audit_log) con acciones creado/editado/eliminado

---

## [1.3.0] - anterior

### Added
- Sistema de Snapshots: captura periódica del estado del dashboard
- Páginas `/snapshots` y `/snapshots/[id]` (read-only)
- `DashboardSheet` con prop `readOnly` — reutilizado para snapshots

---

## [1.2.0] - anterior

### Added
- Módulo de Activos completo (`/activos`, `/activos/[id]`)
- 9 tipos de activo: STOCK, BOND, FIXED_TERM, CRYPTO, FUTURES, OPTIONS, TRADING, TRADING_BOT, REBALANCE_BOT
- Paneles por tipo en `components/activos/panels/`
- Sistema de grupos de activos (`GROUP` type con `parentId` self-referencia)
- `AssetMovementsSection`: historial de movimientos por activo (BUY/SELL/DEPOSIT/EXTRACT/ADJUSTMENT)
- `FinancialMovement` tabla en DB

---

## [1.1.0] - anterior

### Added
- Conversión multi-moneda: USD, EUR, MXN, ARS, USDT
- `SettingsProvider` con tasas de cambio manuales o automáticas vía API
- Tasas persistidas en `localStorage:cashflow:settings`
- Configuración en `/configuracion`

---

## [1.0.0] - inicial

### Added
- Dashboard financiero: Estado de Resultados + Balance
- Tipos de registro: ingreso, gasto, activo, pasivo
- Autenticación: NextAuth v4 con JWT + bcrypt
- Middleware de protección de rutas (`proxy.ts`)
- `FinanceProvider` con estado optimista y `fire(promise)` pattern
- Prisma ORM + PostgreSQL (Supabase)
- Monochrome design: black/white, border-2 border-black
