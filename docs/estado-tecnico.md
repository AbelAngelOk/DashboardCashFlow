# Estado Técnico

Resumen consolidado del estado actual de issues, código muerto, e inconsistencias identificadas. Los archivos originales detallados están en `docs/analisis/`.

Última actualización: 2026-06-23

---

## Inconsistencias

| ID | Descripción | Estado |
|---|---|---|
| I-01 | CLAUDE.md describía arquitectura inexistente (sin DB, sin auth) | ✅ RESUELTO |
| I-02 | `AssetDetail` no estaba conectado a la página `/activos/[id]` | ✅ RESUELTO |
| I-03 | Doble creación de activo en `AssetFormDialog` → AuditLog nunca se crea | 🔴 PENDIENTE |
| I-04 | Eliminar activo desde Dashboard vs desde `/activos` tienen comportamientos radicalmente distintos | 🔴 PENDIENTE |
| I-05 | Comentario en `ConfirmWithCommentDialog` de `AssetList` es ignorado | 🟡 PENDIENTE |
| I-06 | `linkedTo` existe en modelo y tipos pero sin UI para usarlo | 🟡 PENDIENTE |
| I-07 | `FixedTermMetadata.collected` nunca se marca como `true` | 🟡 PENDIENTE |
| I-08 | `FuturesMetadata.liquidationSuffix` nunca se incrementaba | ✅ RESUELTO |
| I-09 | Dos archivos `globals.css` idénticos (uno no importado) | 🟢 BAJA |
| I-10 | `ThemeProvider` existe pero nunca montado en ningún layout | 🟢 BAJA |

---

## Refactorizaciones

| ID | Descripción | Estado |
|---|---|---|
| R-01 | Conectar `AssetDetail` a la página de detalle de activo | ✅ RESUELTO |
| R-02 | Eliminar doble creación en `AssetFormDialog` | 🔴 PENDIENTE |
| R-03 | Unificar comportamiento de eliminación de activo | 🔴 PENDIENTE |
| R-04 | Corregir cálculo `amount` en `TradingPanel` (falsy 0 bug) | 🔴 PENDIENTE |
| R-05 | Corregir acumulación de posiciones en `FuturesPanel` | 🔴 PENDIENTE |
| R-06 | Corregir closure obsoleto de `totalInvested` en `RebalanceBotPanel` | 🟠 PENDIENTE |
| R-07 | Advertencia en `GroupBreakdownDialog` para activos multi-moneda excluidos | 🟡 PENDIENTE |
| R-08 | Corregir `collectFixedTerm()` para actualizar `metadata.collected` | 🟡 PENDIENTE |
| R-09 | Incrementar `liquidationSuffix` al liquidar futuro | ✅ RESUELTO |
| R-10 | Propagar comentario en eliminación de activos desde `/activos` | 🟡 PENDIENTE |
| R-11 | `fire()` mostrar toast de error en lugar de solo `console.error` | ✅ RESUELTO |
| R-12 | Limpiar paquetes npm sin uso (postgres, recharts, etc.) | 🟢 BAJA |
| R-13 | Eliminar archivos duplicados/muertos (styles/globals.css, theme-provider, etc.) | 🟢 BAJA |
| R-14 | Limpiar modelos `Group`/`RecordGroup` del schema (reemplazados por `parentId`) | 🟡 PENDIENTE |
| R-15 | Migrar `AuditLog.date` + `Snapshot.createdAt` de String a DateTime | ⚠️ PARCIAL — AuditLog tiene `createdAt DateTime` real; Snapshot pendiente |
| R-16 | Actualizar `CLAUDE.md` | ✅ RESUELTO |

---

## Código muerto / sin uso

| ID | Archivo / Elemento | Descripción | Estado |
|---|---|---|---|
| CM-01 | `components/activos/asset-detail.tsx` | Era orphaned, nunca importado | ✅ RESUELTO — ahora conectado |
| CM-02 | Bugs financieros en paneles | FuturesPanel acumulación, TradingPanel falsy, RebalanceBotPanel closure | 🔴 PENDIENTE (R-04/05/06) |
| CM-04 | `styles/globals.css` | Copia exacta de `app/globals.css`, no importada | 🟢 PENDIENTE |
| CM-05 | `components/theme-provider.tsx` | Nunca montado | 🟢 PENDIENTE |
| CM-06 | `hooks/use-toast.ts` + `hooks/use-mobile.ts` | Duplican los de `components/ui/` | 🟢 PENDIENTE |
| CM-07 | `FuturesMetadata.liquidationSuffix` | No se incrementaba | ✅ RESUELTO |
| CM-09 | Modelos `Group`/`RecordGroup` en schema | Sin uso activo en la UI | 🟡 PENDIENTE (R-14) |
| CM-10..14 | Paquetes npm sin uso (`postgres`, `recharts`, `playwright`, etc.) | Instalados pero sin imports | 🟢 PENDIENTE (R-12) |

---

## Issues activos prioritarios (orden de impacto)

1. **R-04** — `TradingPanel` muestra el capital invertido cuando `obtained = 0` (falsy 0 bug)
2. **R-05** — `FuturesPanel` sobreescribe el monto en lugar de acumular posiciones
3. **R-02** — `AssetFormDialog` doble creación → AuditLog nunca se crea para activos
4. **R-03** — Eliminar activo: comportamiento inconsistente Dashboard vs `/activos`
5. **R-06** — `RebalanceBotPanel` closure obsoleto puede calcular `totalInvested` incorrecto

Para detalles completos, ver `docs/analisis/Inconsistencias.md`, `docs/analisis/Refactorizaciones-Recomendadas.md`, y `docs/analisis/Codigo-Muerto.md`.
