---
Versión: 2.2.0
Última actualización: 2026-08-26
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Activos

## Objetivo

Gestionar el portafolio de inversiones del usuario: crear, editar, agrupar y eliminar activos financieros de distintos tipos, ver el historial de movimientos por activo, y acceder a paneles especializados según el tipo de instrumento.

**v2.6.0** (ver `docs/CHANGELOG.md`): la columna "Tipo" en `/activos` resolvía el nombre de categoría contra el mapa legado `ASSET_TYPE_LABELS` en vez de `categoryName()` — categorías creadas por el usuario se mostraban como UUID crudo. Corregido.

**v2.7.0**: alta con posiciones LONG/SHORT en `AssetFormDialog`, advertencia de nombre duplicado, apalancamiento + liquidación individual por posición en `FuturesPanel`, y sugerencia de monto por porcentaje al cobrar un dividendo. Detalle en las secciones correspondientes más abajo.

**Ruta**: `/activos` (lista), `/activos/[id]` (detalle)
**Página lista**: `app/(dashboard)/activos/page.tsx` (Client Component)
**Página detalle**: `app/(dashboard)/activos/[id]/page.tsx` (Client Component — usa hooks internos)

---

## Entidades involucradas

| Entidad | Tabla DB | Rol |
|---------|----------|-----|
| `Record` (type="activo"/"GROUP") | `records` | Activo o grupo de activos |
| `FinancialMovement` | `financial_movements` | Historial de movimientos por activo |
| `JournalEntry` | `journal_entries` | Asientos contables generados |
| `Group` (groupType="ASSET") | `groups` | Grupos de activos (self-referencia vía parentId) |
| `RecordGroup` | `record_groups` | N:M activos↔grupos |
| `EntityMarker` | `entity_markers` | Marcador visual por activo |

---

## Tipos de activo

| Tipo | Descripción |
|------|-------------|
| `STOCK` | Acciones — seguimiento de dividendos estimado vs. real |
| `BOND` | Bonos — cronograma de desembolsos con seguimiento de cobros |
| `FIXED_TERM` | Plazo fijo — calcula retorno con tasa anual y vencimiento |
| `CRYPTO` | Criptomonedas — monto libre o qty × precio |
| `FUTURES` | Futuros — posición LONG/SHORT con qty y precio |
| `OPTIONS` | Opciones — qty y precio |
| `TRADING` | Trading manual — monto invertido y obtenido |
| `TRADING_BOT` | Bot de trading — ganado/perdido/extraído, cálculo de ROI |
| `REBALANCE_BOT` | Bot de rebalanceo — distribuye entre sub-activos |
| `GROUP` | Organizador — agrupa otros activos; no tiene valor propio |

Además: tipos personalizados definidos por el usuario en `/configuracion`.

---

## Features

### 1. Lista de activos
- Filtro multi-select por tipo (botones toggle; "Todos" limpia la selección)
- Activos en grupos: colapsables, mostrados con indentación
- Click en fila → `/activos/{id}`

### 2. Modo Agrupar
- Botón "Agrupar" → activa modo de selección
- Selección de ≥2 activos → "Crear nuevo grupo" o "Asignar a grupo existente"
- `createGroup(name, childIds, currency)` — crea GROUP + asigna parentId
- `assignToGroup(groupId, childIds)` — agrega a grupo existente

### 3. Operaciones de grupo
- `removeFromGroup(assetId)` — quita un activo del grupo (`parentId → null`)
- `deleteGroup(groupId)` — desconecta hijos + soft-delete del GROUP padre
- `ungroupAssets(parentId)` — alias de deleteGroup (usado en UngroupButton)

### 4. Soft-delete
- **Activos y pasivos** usan `deletedAt`: `dbDeleteRecord()` pone `deletedAt = now()`
- Las queries siempre filtran `deletedAt: null`
- A diferencia de ingresos/gastos, los activos SÍ usan soft-delete con `deletedAt`

### 5. Marcadores visuales
- MarkerPicker por fila de activo
- Fila marcada: borde izquierdo de color + fondo tenue

### 6. Navegación a detalle
- Click en fila o ícono Eye → `/activos/{id}`

---

## Página de detalle `/activos/[id]`

### Sección: Información General (`AssetInfoSection`)
- Campos inline editables: nombre, ticker, tipo de activo, descripción
- Click en campo → modo edición; blur → save (debounce 200ms)
- `description` usa editor TipTap (rich text JSON); fallback a plain text para valores legacy

### Sección: Panel por tipo
- Cada `AssetType` tiene un panel dedicado en `components/activos/panels/`
- `asset-detail.tsx` enruta al panel correcto según `asset.assetType`
- Paneles: StockPanel, BondPanel, FixedTermPanel, CryptoPanel, FuturesPanel, OptionsPanel, TradingPanel, TradingBotPanel, RebalanceBotPanel

### Panel de Futuros (`FuturesPanel`) — v2.7.0
- Cada posición (`FinancialMovement`, `metadata: FuturesMovementMetadata`) puede llevar `leverage` (apalancamiento, default 1x), fijado al abrir la posición en `AddPositionDialog`.
- **Liquidación individual**: botón "Cerrar" por fila abre `ClosePositionDialog`, pide precio de salida y calcula `P&L = (precioSalida − precioEntrada) × qty × leverage` (invertido para SHORT). Confirmar escribe `metadata.closed/closePrice/closeDate/pnl` vía `updateMovement()` — no borra ni reemplaza el movimiento original.
- El promedio de entrada (`avgEntry()`) y los contadores "Posiciones abiertas" filtran las posiciones con `metadata.closed !== true`; una posición cerrada sigue en el historial con su P&L visible y ya no cuenta para el promedio.
- Liquidar todas las posiciones juntas (botón "Liquidar" del panel) sigue existiendo aparte y es independiente de cerrar posiciones una por una.

### Sección: Movimientos (`AssetMovementsSection`)
- Historial de BUY/SELL/DEPOSIT/EXTRACT/ADJUSTMENT
- Edición inline del tipo y descripción (click lápiz → guardar con Enter o ✓)

### Sección: Tableros (`BoardManager`) — solo tipos no-GROUP
- "Agregar tablero" → Dividendos o Tablero personalizado
- **DividendsBoard**: seguimiento de dividendos con recurrencia (mensual/trimestral/semestral/anual), ventana de 12 meses. Cobrar dividendo → crea ingreso en dashboard
  - **v2.7.0**: cada entrada guarda un `percentage` opcional. `CollectDividendDialog` precalcula `(percentage / 100) × asset.amount` (valor actual del activo, no el de cuando se creó la entrada) y precarga "Ganancia obtenida" con ese valor — el usuario lo puede editar antes de confirmar. Antes `percentage` se guardaba pero nunca se usaba en ningún cálculo.
- **CustomBoard**: tabla configurable, título editable, columnas y filas

### Para tipo GROUP
Orden fijo de secciones:
1. AssetInfoSection (Información General)
2. Group children summary (Activos del Grupo)
3. AssetMovementsSection (Movimientos)
Sin BoardManager.

---

## Validación del formulario (`AssetFormDialog`)

- Para tipos con qty/precio (STOCK, CRYPTO, FUTURES, OPTIONS): cambiar qty o precio auto-calcula monto
- Si qty × precio ≠ monto (todos ingresados manualmente): warning + bloqueo de guardado
- Todos los campos numéricos usan `NumericInput` (soporte de expresiones `=expr`)
- **v2.7.0 — nombre duplicado**: si el nombre ingresado coincide (case-insensitive) con un activo `activo` ya existente en `records`, se muestra una advertencia ámbar bajo el campo Nombre y se bloquea "Crear activo". Comparación en memoria contra `FinanceProvider.records`, no una query aparte.
- **v2.7.0 — alta por operaciones LONG/SHORT**: checkbox "Cargar por operaciones" reemplaza los campos manuales de cantidad/precio promedio por una lista repetible de posiciones (tipo, cantidad, precio, fecha, nota). `netFromPositions()` calcula cantidad neta y precio promedio ponderado (solo LONG entra en el promedio; SHORT resta cantidad neta). Al guardar, `createAsset()` recibe `skipInitialMovement: true` (evita el movimiento "Inversión inicial" duplicado) y se crea un `FinancialMovement` por posición con `metadata: FuturesMovementMetadata` — mismo formato que usa `FuturesPanel`, así que cualquier activo con capability `quantity` cargado así puede liquidarse posición por posición desde el panel de futuros. Coexiste con el modo simple; no lo reemplaza.
  - **Cuidado con `NumericInput` en este flujo**: su `onChange` solo dispara en blur, no por tecla. El cálculo en vivo (`netFromPositions` vía `useEffect`) es solo para la vista previa — `handleSave` recalcula directo desde el array `positions` en el momento de guardar, para no depender de que el último campo tocado haya perdido el foco antes del click en "Crear activo".

---

## Reglas de negocio

- **RB-A01**: Activos y pasivos usan `deletedAt` para soft-delete. NUNCA usar `status = "HISTORICAL"` para activos.
- **RB-A02**: El tipo `GROUP` nunca aparece en selectores de tipo de activo.
- **RB-A03**: Tipos ocultos (`hiddenAssetTypes`) en configuración no aparecen en dropdowns.
- **RB-A04**: Creación de activo usa `createAsset()` (Server Action) + `reload()` — no `createRecord()` del contexto, para evitar doble insert.
- **RB-A05**: Eliminar activo desde `/activos` → soft-delete (`deletedAt`). Eliminar desde dashboard → `zeroOutAsset()` (monto=0, no soft-delete).
- **RB-A06**: Los tableros (Boards) se almacenan en `metadata.boards: BoardConfig[]` del Record. `extractBoards()` en `lib/assets.ts` maneja migración backwards desde `metadata.tracking` y `metadata.dividends`.
- **RB-A07**: Toda nueva función financiera (movimiento, dividendo) DEBE llamar `createJournalEntry()` desde `lib/journal-actions.ts`.

---

## Flujo funcional

```mermaid
flowchart TD
    A[/activos] --> B[Lista con filtro por tipo]
    B --> C[Click fila]
    C --> D[/activos/id]
    D --> E{Tipo de activo}
    E -->|GROUP| F[Info + Hijos + Movimientos]
    E -->|otros| G[Info + Panel específico + Movimientos + Boards]
    
    B --> H[Click Agrupar]
    H --> I[Modo selección]
    I --> J[≥2 seleccionados]
    J --> K{Opción}
    K -->|Nuevo grupo| L[createGroup]
    K -->|Existente| M[assignToGroup]
```

---

## Server Actions clave

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `createAsset(data)` | `lib/assets-actions.ts` | Crear nuevo activo |
| `updateAsset(id, data)` | `lib/assets-actions.ts` | Actualizar campos del activo |
| `deleteAsset(id)` | `lib/assets-actions.ts` | Soft-delete (`deletedAt`) |
| `addMovement(data)` | `lib/assets-actions.ts` | Registrar movimiento (BUY/SELL/etc.) |
| `zeroOutAsset(id, ...)` | `lib/assets-actions.ts` | Poner monto=0 + EXTRACT movement |
| `createGroup / assignToGroup / removeFromGroup / deleteGroup` | `lib/assets-actions.ts` | Gestión de grupos |
