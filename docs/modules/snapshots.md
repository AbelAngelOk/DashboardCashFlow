---
Versión: 2.1.0
Última actualización: 2026-08-26
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Snapshots

## Objetivo

Capturar y persistir el estado financiero del usuario en un punto específico del tiempo para comparación histórica. Un snapshot congela el dashboard completo (ingresos, gastos, activos, pasivos) con sus valores al momento de la captura.

**v2.6.0** (ver `docs/CHANGELOG.md`): `/snapshots` suma un gráfico de tendencia (Patrimonio Neto y Flujo de Caja a través de los snapshots guardados), y el diálogo "Tomar Snapshot" del Dashboard reemplazó los campos de fecha inicio/fin — nunca filtraron nada, era solo texto del período — por un único campo de texto explícito.

**Ruta**: `/snapshots` (lista), `/snapshots/[id]` (vista read-only)
**Páginas**: `app/(dashboard)/snapshots/page.tsx` y `app/(dashboard)/snapshots/[id]/page.tsx`

---

## Entidades involucradas

| Entidad | Tabla DB | Rol |
|---------|----------|-----|
| `Snapshot` | `snapshots` | Metadatos: nombre, período, fecha |
| `SnapshotRecord` | `snapshot_records` | Copia de cada Record al momento del snapshot |

---

## Features

### 1. Tomar snapshot
- Botón "Tomar Snapshot" en el Dashboard (`/`)
- Diálogo con: nombre del snapshot + rango de fechas (inicio y fin)
- `takeSnapshot(name, period)` → crea `Snapshot` + copia todos los `Record` activos en `SnapshotRecord`
- Los registros HISTORICAL/ARCHIVED son excluidos del snapshot (solo se copian los ACTIVE)

### 2. Lista de snapshots
- Lista cronológica de todos los snapshots del usuario
- Por snapshot: nombre, período, fecha de creación
- Click → `/snapshots/{id}`

### 3. Vista read-only
- `DashboardSheet` con `readOnly={true}` — oculta botones de edición/creación/eliminación
- Muestra el estado exacto del dashboard al momento del snapshot
- Incluye saldos del Libro Contable al momento del snapshot

---

## Reglas de negocio

- **RB-S01**: Los snapshots son inmutables una vez creados. No se pueden editar registros dentro de un snapshot.
- **RB-S02**: La vista de snapshot usa `DashboardSheet readOnly` — el mismo componente que el dashboard activo, sin diferencias visuales excepto la ausencia de controles de edición.
- **RB-S03**: Los snapshots no se eliminan (no hay opción de borrado en la UI actual).

---

## Server Actions

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `takeSnapshot(name, period)` | `lib/actions.ts` | Crea snapshot + copia registros activos |
| `loadSnapshot(id)` | `lib/actions.ts` | Carga snapshot con sus records para la vista |
