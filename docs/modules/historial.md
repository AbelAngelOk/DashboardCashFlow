---
Versión: 2.0.0
Última actualización: 2026-06-30
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Historial (Auditoría)

## Objetivo

Mantener un log de auditoría de todas las operaciones CRUD realizadas sobre los registros financieros: creación, edición, y eliminación. Permite rastrear quién hizo qué y cuándo, con comentarios opcionales.

**Ruta**: `/historial`
**Página**: `app/(dashboard)/historial/page.tsx` (Server Component con Suspense)

---

## Entidades involucradas

| Entidad | Tabla DB | Rol |
|---------|----------|-----|
| `Movement` (AuditLog) | `movements` | Entrada de auditoría: acción + detalles + timestamp |

---

## Features

### 1. Lista de entradas de auditoría
- Paginación server-side (tamaños: 10/25/50/100 registros por página)
- Filtros URL-synced (persisten en la URL con `useSearchParams` + `router.replace`)

### 2. Filtros disponibles
- **Acción**: creado / editado / eliminado
- **Tipo de registro**: ingreso / gasto / activo / pasivo
- **Búsqueda de texto**: busca en nombre y comentario
- **Rango de fechas**: fecha desde / fecha hasta

### 3. Comentarios editables
- Cada entrada tiene un campo de comentario editable inline
- Debounce de 600ms antes de persistir en DB
- El comentario no altera la acción registrada, solo agrega contexto

### 4. Arquitectura con Suspense
- `page.tsx` (Server Component) → wrappea con `<Suspense>` el componente cliente
- Necesario porque el componente cliente usa `useSearchParams()` (requiere Suspense boundary en App Router)
- Hooks dedicados: `useHistorialFilters`, `usePagination`, `useHistorialQuery`

---

## Hooks

| Hook | Archivo | Propósito |
|------|---------|-----------|
| `useHistorialFilters` | `hooks/use-historial-filters.ts` | Estado de filtros URL-synced |
| `usePagination` | `hooks/use-pagination.ts` | Estado de página + pageSize URL-synced |
| `useHistorialQuery` | `hooks/use-historial-query.ts` | Fetch paginado con cancelación de requests obsoletos y debounce de comentarios |

---

## Reglas de negocio

- **RB-H01**: El historial es de solo lectura — no se pueden eliminar entradas de auditoría.
- **RB-H02**: La acción "eliminado" para ingresos/gastos registra el cambio a `status = "HISTORICAL"`, no un borrado físico.
- **RB-H03**: El debounce de 600ms para comentarios es para evitar múltiples writes por keystroke; el estado local se actualiza inmediatamente.
- **RB-H04**: Los filtros se serializan en la URL para que se puedan compartir y persistan en el refresco.
- **RB-H05**: La cancelación de requests usa un `reqId` ref: si llega una respuesta de un request obsoleto (filtro cambiado antes de que respondiera), se descarta.

---

## Server Actions

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `loadHistorial(filters, page, pageSize)` | `lib/actions.ts` | Carga paginada del audit log |
| `updateMovementComment(id, comment)` | `lib/actions.ts` | Actualizar comentario de una entrada |
