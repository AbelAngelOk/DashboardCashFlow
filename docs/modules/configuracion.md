---
Versión: 2.1.0
Última actualización: 2026-08-26
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Configuración

## Objetivo

Centralizar las preferencias del usuario: conversión de monedas, tipos de activo personalizados u ocultos, y gestión de marcadores visuales.

**v2.6.0** (ver `docs/CHANGELOG.md`): la sección de tasas de cambio ahora avisa cuando están desactualizadas (`ratesLastUpdated` pasó a ISO, antes era un string ya formateado sin poder calcular antigüedad). Nueva sección "Exportar Datos" — CSV de records actuales y de historial de movimientos, 100% client-side.

**Ruta**: `/configuracion`
**Página**: `app/(dashboard)/configuracion/page.tsx`

---

## Features

### 1. Tasas de cambio
- Selección de **moneda base** para totales consolidados
- Por cada moneda (USD, EUR, MXN, ARS, USDT): elegir entre tasa manual o automática
- Tasa automática: obtenida de API externa (definida en `SettingsProvider`)
- Tasa manual: input numérico editable
- Persiste en `localStorage:cashflow:settings` bajo la clave `DashboardSettings`

### 2. Tipos de activo configurables
- **Tipos ocultos**: seleccionar tipos de sistema para esconder de todos los dropdowns (`hiddenAssetTypes: AssetType[]`)
- **Tipos personalizados**: crear nuevos tipos con nombre libre (`customAssetTypes: { id, name }[]`)
- `GROUP` nunca aparece en esta lista (es un tipo interno)
- Los cambios se aplican inmediatamente en todos los selectores de tipo de activo del sistema

### 3. Gestión de marcadores
- Lista de marcadores del usuario con nombre, color y orden
- **Crear**: input nombre + color picker (`<input type="color">`) → `createMarker()`
- **Editar**: click en nombre o color → edición inline → `updateMarker()`
- **Reordenar**: botones ↑↓ → `updateMarker({ order })` + re-render
- **Eliminar**: botón papelera → `deleteMarker(id)` (cascade elimina todos los EntityMarker asociados)

---

## Persistencia

| Dato | Mecanismo | Clave |
|------|-----------|-------|
| Tasas de cambio | `localStorage` | `cashflow:settings` |
| Moneda base | `localStorage` | `cashflow:settings` |
| Tipos ocultos | `localStorage` | `cashflow:settings` |
| Tipos personalizados | `localStorage` | `cashflow:settings` |
| Marcadores | PostgreSQL (tabla `markers`) | — |
| Asignaciones de marcador | PostgreSQL (tabla `entity_markers`) | — |

---

## Reglas de negocio

- **RB-C01**: Los cambios de tasas de cambio y tipos de activo solo afectan al cliente actual (localStorage). No hay sincronización entre dispositivos para estas preferencias.
- **RB-C02**: Eliminar un marcador elimina en cascada todos sus `EntityMarker` — las filas vinculadas vuelven al estilo sin marcador.
- **RB-C03**: El tipo personalizado creado en configuración aparece en TODOS los selectores de tipo de activo del sistema, incluyendo el formulario de creación y el detalle de activo.
- **RB-C04**: Los tipos ocultos no aparecen en los dropdowns pero si un activo existente tiene ese tipo, sigue mostrándose con ese tipo en la lista.

---

## Contextos involucrados

| Contexto | Archivo | Datos gestionados |
|---------|---------|-------------------|
| `SettingsProvider` | `components/settings-store.tsx` | Tasas de cambio, tipos ocultos/personalizados |
| `MarkersProvider` | `components/markers/markers-store.tsx` | Definición de marcadores del usuario |

---

## Server Actions

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `createMarker(data)` | `lib/marker-actions.ts` | Crear marcador con nombre y color |
| `updateMarker(id, data)` | `lib/marker-actions.ts` | Actualizar nombre, color u orden |
| `deleteMarker(id)` | `lib/marker-actions.ts` | Eliminar marcador (cascade EntityMarker) |
| `loadMarkers()` | `lib/marker-actions.ts` | Lista de marcadores del usuario |
