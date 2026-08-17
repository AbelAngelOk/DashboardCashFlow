# Component IDs (`data-testid`)

All main visual component containers carry a `data-testid` attribute for automated testing, scraping, and debugging. Pattern: `{zona}-{componente}`.

## Global layout

| `data-testid` | Component | File |
|---|---|---|
| `app-header` | Global header bar | `components/app-header.tsx` |
| `app-sidebar` | Navigation sidebar | `components/app-sidebar.tsx` |
| `app-notifications-trigger` | Bell icon button | `components/notifications/notifications-popover.tsx` |
| `app-notifications-popover` | Notifications popover content | `components/notifications/notifications-popover.tsx` |

## Dashboard (`/`)

| `data-testid` | Component | File |
|---|---|---|
| `dashboard-income-table` | Ingresos section table | `components/dashboard-sheet.tsx` |
| `dashboard-expense-table` | Gastos section table | `components/dashboard-sheet.tsx` |
| `dashboard-assets-table` | Activos section table | `components/dashboard-sheet.tsx` |
| `dashboard-liabilities-table` | Pasivos section table | `components/dashboard-sheet.tsx` |
| `cutoff-button` | "Realizar corte de mes" (solo con período pendiente) | `components/cutoff/cutoff-banner.tsx` |

## Corte Mensual

| `data-testid` | Component | File |
|---|---|---|
| `cutoff-dialog` | Diálogo de confirmación del corte | `components/cutoff/cutoff-dialog.tsx` |
| `cutoff-preview` | Bloque de vista previa del impacto | `components/cutoff/cutoff-dialog.tsx` |
| `cutoff-switch-snapshot` | Switch "Guardar snapshot" | `components/cutoff/cutoff-dialog.tsx` |
| `cutoff-switch-keep-marked` | Switch "Mantener etiquetados" | `components/cutoff/cutoff-dialog.tsx` |
| `cutoff-switch-clear-markers` | Switch "Quitar etiquetas" | `components/cutoff/cutoff-dialog.tsx` |
| `cutoff-settings` | Sección "Corte Mensual" en `/configuracion` | `components/cutoff/cutoff-settings.tsx` |

## Activos list (`/activos`)

| `data-testid` | Component | File |
|---|---|---|
| `activos-list` | Full asset list container | `components/activos/asset-list.tsx` |
| `activos-row-{id}` | Regular asset row | `components/activos/asset-list.tsx` |
| `activos-group-row-{id}` | Group parent row (collapsible) | `components/activos/asset-list.tsx` |

## Asset detail (`/activos/[id]`)

| `data-testid` | Component | File |
|---|---|---|
| `asset-info-section` | Información general panel | `components/activos/asset-info-section.tsx` |
| `asset-movements-section` | Movimientos del activo panel | `components/activos/asset-movements-section.tsx` |
| `asset-tracking-section` | Seguimiento (custom table) panel | `components/activos/asset-tracking-section.tsx` |

### Paneles operativos (ruteados por `AssetDetail`)

Desde v2.5.0 **no se rutea por tipo**: el panel se elige por los datos del activo.

| `data-testid` | Se activa cuando | File |
|---|---|---|
| `asset-panel-rebalance-bot` | `metadata.assets[]` | `components/activos/panels/rebalance-bot-panel.tsx` |
| `asset-panel-bond` | `metadata.disbursements[]` | `components/activos/panels/bond-panel.tsx` |
| `asset-panel-fixed-term` | `metadata.rate` + `metadata.endDate` | `components/activos/panels/fixed-term-panel.tsx` |
| `asset-panel-trading-bot` | `metadata.totalGained` / `totalLost` | `components/activos/panels/trading-bot-panel.tsx` |
| `asset-panel-trading` | `metadata.totalObtained` | `components/activos/panels/trading-panel.tsx` |
| `asset-panel-futures` | `metadata.positionTracking` / `liquidated` | `components/activos/panels/futures-panel.tsx` |
| `asset-panel-stock` | capacidad `tracksQuantity` | `components/activos/panels/stock-panel.tsx` |
| `asset-panel-generic` | ninguna de las anteriores | `components/activos/panels/generic-asset-panel.tsx` |

## Activos — categorías y alta

| `data-testid` | Component | File |
|---|---|---|
| `asset-form-dialog` | Alta de activo (2 pasos, presets y capacidades) | `components/activos/asset-form-dialog.tsx` |
| `asset-categories-settings` | Gestión de categorías en `/configuracion` | `components/activos/asset-categories-settings.tsx` |

## Flujos de Ingresos

| `data-testid` | Component | File |
|---|---|---|
| `asset-income-rules` | Sección "Ingresos recurrentes" | `components/activos/income/income-rules-section.tsx` |
| `income-rule-dialog` | Alta / edición de regla | `components/activos/income/income-rule-dialog.tsx` |
| `income-collect-dialog` | Confirmación de cobro | `components/activos/income/collect-income-dialog.tsx` |

## Boards

| `data-testid` | Component | File |
|---|---|---|
| `asset-board-manager` | Board manager container | `components/activos/boards/board-manager.tsx` |
| `asset-board-dividends` | Dividendos board | `components/activos/boards/dividends-board.tsx` |
| `asset-board-custom-{boardId}` | Custom board instance | `components/activos/boards/custom-board.tsx` |
