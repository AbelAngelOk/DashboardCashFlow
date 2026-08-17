---
Versión: 2.5.0
Última actualización: 2026-08-17
Autor: Abel Cejas
Estado: Activo
---

# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [2.5.0] - 2026-08-17

**El tipo de activo dejó de existir como concepto con comportamiento.** Ahora es una etiqueta, y lo que un activo puede hacer se configura activo por activo.

### Added
- Modelo `AssetCategory` (`asset_categories`): etiquetas libres por usuario, con `@@unique([userId, name])`
- `Record.tracksQuantity`: capacidad de operar en unidades (cantidad + precio promedio)
- `lib/asset-categories.ts`: capacidades, presets de alta, resolución de nombres
- `lib/asset-category-actions.ts`: CRUD de categorías y siembra/migración idempotente desde los tipos legados
- `components/activos/asset-categories-store.tsx`: provider montado en el layout del dashboard
- `components/activos/asset-categories-settings.tsx`: gestión de categorías en `/configuracion`
- Diálogo de alta de activo reescrito con la estructura del de obligaciones: dos pasos, tarjetas de preset, capacidades editables y editor de reglas de ingreso
- Editor de capacidades en el detalle del activo

### Modified
- `lib/assets.ts`: `AssetType` degradado a `string` y marcado como deprecado; `ASSET_TYPE_LABELS` queda solo para resolver valores legados; `Asset.tracksQuantity`
- `components/activos/asset-detail.tsx`: **rutea por los datos del activo, no por su tipo**. Un activo con `metadata.disbursements` muestra el panel de bono, tenga la etiqueta que tenga
- `lib/assets-actions.ts`: `createAsset`/`updateAsset` aceptan `tracksQuantity`; los grupos nacen sin etiqueta (agrupar es estructural)
- `asset-list`, `asset-info-section`, `asset-type-label`, `gasto-form-dialog`: usan categorías de DB
- `/configuracion`: sección "Tipos de Activo" reemplazada por "Categorías de Activo"

### Removed
- `components/activos/panels/income-stream-panel.tsx` — quedó sin referencias

### Fixed
- **Colisión de PK entre usuarios**: la primera versión reutilizaba el valor legado como id de categoría, lo que rompía con más de un usuario. Ahora cada categoría tiene UUID propio y la siembra reapunta los registros
- **Regresión de panel**: al migrar el tipo, los activos que eran `STOCK` perdían su panel de compra en unidades. La siembra activa `tracksQuantity` antes de migrar, y se hizo backfill de los ya migrados

### Notas de despliegue
- Requiere `prisma db push`.
- **Incluye migración de datos**: la primera carga reapunta `assetType` de valores legados a ids de categoría. Es idempotente y no borra datos, pero no tiene rollback automático.

---

## [2.4.0] - 2026-08-17

Generalización del motor de reglas de ingreso, a partir de los análisis en `docs/analisis/`.

### Added
- **Monto porcentual** (`IncomeRule.amountMode = "PERCENTAGE"` + `percentage`): cada cobro se calcula sobre el valor del activo al generarse. Cubre dividendos en % y staking con APY
- **Ajuste periódico** (`adjustmentPct` + `adjustEveryN`): aumento compuesto cada N cobros, para sueldos y alquileres ajustados por inflación
- **Cronograma finito** (`installmentCount`): genera las N cuotas desde `startDate` con su `installmentNumber`, y marca la regla `COMPLETED` al agotarse
- **Liquidación en especie** (`settlement = "IN_KIND"`): el cobro sube el valor y la cantidad del activo en vez de generar efectivo; asienta `activos / ingresos`
- **Valuación por proyección** (`metadata.valueMode`): el `amount` de un activo puede ser su proyección anual de ingresos, espejo de cómo una obligación recurrente vale su costo anual. El preset Salario lo activa; el resto queda en `MANUAL`
- `IncomeRuleStatus` extendido con `COMPLETED`
- `IncomeOccurrence.installmentNumber` y `IncomeOccurrence.quantity`
- `lib/income-streams.ts`: `occurrenceAmount()`, `occurrenceIndexOf()`, `valueModeOf()`, `presetValueMode()`, `RULE_STATUS_LABELS`, `AMOUNT_MODE_LABELS`, `SETTLEMENT_LABELS`
- `lib/income-actions.ts`: `setIncomeStreamValueMode()`, `completeIfExhausted()`, `recalcularIncomeStream()`
- `components/activos/asset-type-label.tsx`: resuelve el nombre de los tipos de activo personalizados

### Modified
- `computeAnnualProjection(rules, occurrences?)`: con ocurrencias suma los montos reales de los próximos 12 meses. La fórmula `monto × ocurrenciasPorAño` mentía con ajuste, porcentaje o cronograma finito
- `ensureIncomeWindow()`: cronograma finito genera las N cuotas desde el inicio (incluidas las vencidas); el indefinido conserva la ventana móvil de 12 meses
- `collectIncomeOccurrence(id, amount, comment?, quantity?)`: soporta cobro en especie
- `IncomeRuleDialog`: modo de monto, ajuste periódico, cantidad de cuotas y forma de liquidación
- `AssetFormDialog`: cuotas para los presets Préstamo y Cuotas; ajuste para Salario; `valueMode` inicial
- `IncomeRulesSection`: badges de los modos nuevos, avance de cuotas y toggle de valuación por proyección
- Detalle de activo y `AssetInfoSection` usan `AssetTypeLabel`

### Fixed
- Los tipos de activo personalizados mostraban su UUID en la página de detalle en vez de su nombre
- **Bordes redondeados eliminados de los controles de formulario**: `input`, `numeric-input`, `textarea`, `select` (trigger, contenido e ítems) y `checkbox` pasaron de `rounded-md`/`rounded-sm`/`rounded-[4px]` a `rounded-none`, en línea con el diseño monocromo del proyecto

### Notas de despliegue
- Requiere `prisma db push`. Cambio aditivo: columnas nuevas con default sobre `income_rules` e `income_occurrences`.

---

## [2.3.0] - 2026-08-17

### Added
- **Módulo Flujos de Ingresos**: espejo del módulo de Obligaciones. Proyecta ganancia anual y genera ingresos por período
- `prisma/schema.prisma`: modelos `IncomeRule` (`income_rules`) e `IncomeOccurrence` (`income_occurrences`), ambos colgando de un `Record` type=`activo`
- Nuevo tipo de activo `INCOME_STREAM` ("Flujo de Ingresos") con cuatro presets: Salario, Préstamo otorgado, Cobro en cuotas, Personalizado
- `lib/income-streams.ts`: tipos y helpers puros (`computeAnnualProjection`, `buildPresetRules`, `presetHasNoPrincipal`, etiquetas)
- `lib/income-actions.ts`: `loadIncomeRules()`, `createIncomeRule()`, `updateIncomeRule()`, `pauseIncomeRule()`, `resumeIncomeRule()`, `deleteIncomeRule()`, `collectIncomeOccurrence()`, `rejectIncomeOccurrence()`, `refreshIncomeWindows()`
- Flag `reducesPrincipal` por regla: los cobros de capital bajan el valor del activo, crean un movimiento `EXTRACT` y asientan `efectivo / activos`; las rentas asientan `efectivo / ingresos`
- `components/activos/income/`: `IncomeRulesSection`, `IncomeRuleDialog`, `CollectIncomeDialog`
- `components/activos/panels/income-stream-panel.tsx`: panel del tipo `INCOME_STREAM`
- Sección "Ingresos recurrentes" en `/activos/[id]`, disponible para **cualquier** tipo de activo
- `AssetFormDialog`: selector de preset para `INCOME_STREAM` y opción "Ingreso recurrente asociado" para el resto de los tipos
- `lib/assets.ts`: `extendRecurringDividends()` — empuja las series de dividendos recurrentes hacia adelante
- `docs/modules/flujos-de-ingresos.md`: documentación del módulo

### Modified
- `lib/cutoff-actions.ts`:
  - Extiende las series de dividendos recurrentes hasta el período entrante antes de generar los ingresos (arregla que la serie se agotara a los 12 meses y el corte no encontrara nada que cobrar)
  - Activa los ingresos `PENDING` de las ocurrencias que vencen en el período entrante
  - Refresca la ventana de 12 meses de todas las reglas activas
  - `getCutoffPreview()` cuenta también los ingresos de flujos recurrentes
- `components/activos/asset-detail.tsx`: ruteo del tipo `INCOME_STREAM`
- `app/(dashboard)/activos/[id]/page.tsx`: monta `IncomeRulesSection`
- `docs/03-Modelo-de-Datos.md` → 2.3.0, `docs/10-Producto.md` → 2.3.0, `docs/modules/corte-mensual.md` → 2.3.0

### Notas de despliegue
- Requiere `prisma db push`. Cambio aditivo: dos tablas nuevas, sin modificar datos existentes.

---

## [2.2.0] - 2026-08-17

### Added
- **Módulo Corte Mensual**: cierre de período confirmado por el usuario que archiva los ingresos y gastos del mes que sale y prepara los del entrante
- `prisma/schema.prisma`: modelo `MonthlyCutoff` (`monthly_cutoffs`) con `@@unique([userId, period])`; campo `cutoffDay` en `User` (default 1)
- `lib/cutoff.ts`: helpers puros de período (`currentOpenPeriod`, `pendingCutoffPeriod`, `periodRange`, `nextCutoffDate`, `periodLabel`, `periodRangeLabel`, `isValidCutoffDay`) y tipos compartidos
- `lib/cutoff-actions.ts`: `getCutoffStatus()`, `getCutoffPreview()`, `executeCutoff()`, `setCutoffDay()`, `listCutoffs()`
- `components/cutoff/cutoff-dialog.tsx`: diálogo con vista previa del impacto y tres switches (snapshot / conservar etiquetados / limpiar etiquetas)
- `components/cutoff/cutoff-banner.tsx`: botón del Dashboard + pop-up automático, visible solo con período pendiente
- `components/cutoff/cutoff-settings.tsx`: sección "Corte Mensual" en `/configuracion` con día de corte (1–28), último corte y próximo corte
- Snapshot automático opcional del mes que sale, nombrado `Cierre {mes} {año}`
- Asientos contables por cada gasto e ingreso generado por el corte
- `docs/modules/corte-mensual.md`: documentación completa del módulo

### Modified
- `lib/assets-actions.ts` — `collectDividend()`: si el dividendo ya tiene `ingresoRecordId` (creado por un corte), **actualiza** ese ingreso en lugar de crear uno nuevo, y emite un asiento solo por la diferencia entre lo real y lo estimado. Ya no fuerza `status: "ACTIVE"`, para no reinyectar al mes en curso un ingreso ya archivado
- `app/(dashboard)/page.tsx`: monta `CutoffBanner` junto a "Tomar Snapshot" y recarga los datos tras un corte
- `app/(dashboard)/configuracion/page.tsx`: monta `CutoffSettings`
- `docs/03-Modelo-de-Datos.md` → 2.2.0: tabla `monthly_cutoffs` y campo `users.cutoff_day`
- `docs/10-Producto.md` → 2.2.0: entidad Corte Mensual, octavo tipo de relación (temporal), ciclo de vida del período, recorrido 7.7, reglas RP-16 a RP-20, matriz entidad × módulo

### Notas de despliegue
- Requiere aplicar el esquema a la base (`prisma db push`). El cambio es aditivo: una tabla nueva y una columna con default.

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
