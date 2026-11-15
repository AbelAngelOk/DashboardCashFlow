# Mejoras UI/UX Dashboard — v1.8

Documento de diseño e implementación para el conjunto de mejoras v1.8.

---

## Resumen de cambios

| # | Mejora | Complejidad | Archivos principales |
|---|--------|-------------|----------------------|
| 1 | Espaciado en Personalización | Baja | `configuracion/page.tsx` |
| 2 | Selector de colores Tailwind | Media | `ui/tailwind-color-picker.tsx`, `marker-manager-dialog.tsx`, `marker-picker.tsx` |
| 3 | Crear marcador desde Dashboard | Media | `marker-picker.tsx`, `marker-actions.ts` |
| 4 | Sidebar colapsable | Alta | `app-sidebar.tsx`, `app-shell.tsx` |
| 5 | Agrupación de Gastos | Alta | `flow-group-actions.ts`, `gastos/page.tsx`, `dashboard-sheet.tsx` |
| 6 | Agrupación de Ingresos | Alta | `flow-group-actions.ts`, `ingresos/page.tsx`, `dashboard-sheet.tsx` |
| 7 | Icono "Ver" en Dashboard | Media | `dashboard-sheet.tsx`, `gastos/[id]/page.tsx`, `ingresos/[id]/page.tsx` |

---

## Componentes afectados

### Componentes modificados
- `components/app-sidebar.tsx` — collapse/expand logic, localStorage persistence
- `components/app-shell.tsx` — layout adaptation for collapsed sidebar
- `components/markers/marker-manager-dialog.tsx` — replace `input[type=color]` with TailwindColorPicker
- `components/markers/marker-picker.tsx` — add "Nuevo marcador" inline form
- `components/dashboard-sheet.tsx` — group support for gastos/ingresos, "Ver" icon for all types
- `app/(dashboard)/configuracion/page.tsx` — section spacing

### Componentes creados
- `components/ui/tailwind-color-picker.tsx` — paleta de colores Tailwind predefinida
- `app/(dashboard)/gastos/[id]/page.tsx` — detalle individual de gasto
- `app/(dashboard)/ingresos/[id]/page.tsx` — detalle individual de ingreso

### Acciones creadas
- `lib/flow-group-actions.ts` — CRUD de grupos para gastos e ingresos

---

## Impacto sobre UX

### 1. Espaciado en Personalización
- Separa visualmente dos secciones independientes: Tipos de Activo y Marcadores Visuales
- El usuario percibe claramente el límite entre configuraciones distintas

### 2. Selector de colores Tailwind
- Elimina la ambigüedad de la paleta libre (cualquier color hexadecimal)
- Define ~22 colores semánticos con nombres reconocibles
- Garantiza consistencia visual: todos los marcadores usan colores del mismo sistema
- Tonos elegidos: shade 500 para la mayoría (buen contraste sobre fondo blanco)
- Se excluyen amarillos muy claros (yellow-300 etc.) por falta de contraste

### 3. Crear marcador desde Dashboard
- Elimina el flujo de: Dashboard → /configuracion → crear marcador → volver
- El marcador se crea y asigna en un solo popover
- Reduce el número de pasos de 5+ a 1

### 4. Sidebar colapsable
- Libera espacio horizontal en pantallas medianas
- Estado contraído: solo iconos + badges (64px de ancho)
- Estado expandido: comportamiento actual (224px)
- Tooltips en modo contraído para mantener la orientación
- Persistencia en localStorage key `cashflow:sidebar-collapsed`

### 5 & 6. Agrupación de Gastos e Ingresos
- Permite organizar gastos/ingresos en categorías lógicas
- Reutiliza la infraestructura DB existente (`Group` + `RecordGroup`)
- Dashboard: grupos colapsables con total y cantidad de ítems
- Páginas /gastos y /ingresos: modo selección para crear/asignar grupos

### 7. Icono "Ver" en Dashboard
- Consistencia entre todos los módulos del dashboard
- Activos ya tenían este comportamiento — se extiende a ingresos, gastos y obligaciones
- Crea páginas de detalle para `/gastos/[id]` e `/ingresos/[id]`

---

## Impacto sobre Responsive

| Componente | Mobile | Tablet | Desktop |
|------------|--------|--------|---------|
| Sidebar | No se muestra (usa BottomNav) | No afectado | Colapsa a 64px |
| Color picker | Se adapta (grid) | OK | OK |
| Marker quick-create | Popover nativo | OK | OK |
| Grupos dashboard | No visible (sheet es desktop) | OK | OK |
| Páginas /gastos/[id] | Responsive | OK | OK |

---

## Impacto sobre Navegación

### Nuevas rutas
- `/gastos/[id]` → Detalle de gasto individual
- `/ingresos/[id]` → Detalle de ingreso individual

### Rutas existentes
- `/configuracion` → Sin cambio de ruta, solo ajuste de layout
- `/gastos` → Nuevos grupos, sin cambio de ruta
- `/ingresos` → Nuevos grupos, sin cambio de ruta

---

## Decisiones de arquitectura

### Grupos de Gastos e Ingresos (Features 5 & 6)

**Decisión:** Reutilizar el modelo `Group` + `RecordGroup` ya existente en el schema.

**Razonamiento:** El schema ya define `Group { id, userId, name, groupType }` con `groupType: "INCOME" | "EXPENSE"` y la tabla junction `RecordGroup`. No se requiere migración DB.

**Alternativa descartada:** Usar `parentId` en Record (al estilo activos). Descartada porque no crea un "registro padre" con monto propio — los grupos de gastos/ingresos son contenedores lógicos sin valor propio.

**Regla:** Un registro puede pertenecer a máximo 1 grupo. Enforced en código (removeFromGroup antes de assignToGroup).

### Persistencia de Sidebar (Feature 4)

**Decisión:** localStorage key `cashflow:sidebar-collapsed`.

**Razonamiento:** Es una preferencia de UI local (cómo usa la pantalla el usuario en ese dispositivo), no configuración de cuenta. Similar al patrón de `cashflow:settings` ya en uso. No requiere viaje al servidor.

### Color de Marcadores (Feature 2)

**Tonos seleccionados:** shade 500 para todos los colores (equilibrio contraste/saturación). Excepciones:
- Slate/Gray/Zinc/Neutral/Stone: shade 600 (más oscuro para distinguirse del texto gris base)
- Yellow: shade 400 (el 500 es demasiado saturado y el 600 muy oscuro)

---

## Migraciones necesarias

**Ninguna.** El schema de Prisma ya incluye:
- `Group` con `groupType: "INCOME" | "EXPENSE"`
- `RecordGroup` junction table
- `Record.groups RecordGroup[]` relación

No se requiere `prisma db push`.
