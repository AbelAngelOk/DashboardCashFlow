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

### Type-specific panels (rendered by `AssetDetail`)

| `data-testid` | Asset type | File |
|---|---|---|
| `asset-panel-generic` | Fallback / generic | `components/activos/panels/generic-asset-panel.tsx` |
| `asset-panel-stock` | STOCK / ETF / CRYPTO | `components/activos/panels/stock-panel.tsx` |
| `asset-panel-futures` | FUTURES | `components/activos/panels/futures-panel.tsx` |
| `asset-panel-bond` | BOND | `components/activos/panels/bond-panel.tsx` |
| `asset-panel-fixed-term` | FIXED_TERM | `components/activos/panels/fixed-term-panel.tsx` |
| `asset-panel-trading` | TRADING | `components/activos/panels/trading-panel.tsx` |
| `asset-panel-trading-bot` | TRADING_BOT | `components/activos/panels/trading-bot-panel.tsx` |
| `asset-panel-rebalance-bot` | REBALANCE_BOT | `components/activos/panels/rebalance-bot-panel.tsx` |

## Boards

| `data-testid` | Component | File |
|---|---|---|
| `asset-board-manager` | Board manager container | `components/activos/boards/board-manager.tsx` |
| `asset-board-dividends` | Dividendos board | `components/activos/boards/dividends-board.tsx` |
| `asset-board-custom-{boardId}` | Custom board instance | `components/activos/boards/custom-board.tsx` |
