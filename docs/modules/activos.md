---
Versión: 2.0.0
Última actualización: 2026-06-30
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Activos

## Objetivo

Gestionar el portafolio de inversiones del usuario: crear, editar, agrupar y eliminar activos financieros de distintos tipos, ver el historial de movimientos por activo, y acceder a paneles especializados según el tipo de instrumento.

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

### Sección: Movimientos (`AssetMovementsSection`)
- Historial de BUY/SELL/DEPOSIT/EXTRACT/ADJUSTMENT
- Edición inline del tipo y descripción (click lápiz → guardar con Enter o ✓)

### Sección: Tableros (`BoardManager`) — solo tipos no-GROUP
- "Agregar tablero" → Dividendos o Tablero personalizado
- **DividendsBoard**: seguimiento de dividendos con recurrencia (mensual/trimestral/semestral/anual), ventana de 12 meses. Cobrar dividendo → crea ingreso en dashboard
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
