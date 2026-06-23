# Inconsistencias — Segunda Pasada

## I-01: CLAUDE.md describe una arquitectura que no existe

> ✅ **RESUELTO** (2026-06-23): `CLAUDE.md` fue reescrito completamente. Ahora documenta el stack real (Next.js App Router, PostgreSQL/Supabase, Prisma, NextAuth v4), los tres context providers (`FinanceProvider`, `ObligationsProvider`, `SettingsProvider`), los patrones de mutación optimista con `fire()`, las capas de persistencia, y las convenciones de estilos.

---

## I-02: `AssetDetail` (componente dispatcher) no es usado por la página

> ✅ **RESUELTO**: `components/activos/asset-detail.tsx` está correctamente importado y renderizado en `app/(dashboard)/activos/[id]/page.tsx`. Los 7 paneles tipo-específico (StockPanel, BondPanel, FuturesPanel, etc.) se renderizan según el `assetType` del activo. Los `BoardManager` y boards (Dividendos, Tablero personalizado) también están conectados.

---

## I-03: Doble creación de activo en `AssetFormDialog` — el AuditLog nunca se crea

**Severidad**: Alta

**Evidencia**:
Cuando el usuario crea un activo desde el dialog en `/activos`:

1. `AssetFormDialog.handleSave()` llama a `createAsset()` (Server Action) — esto **inserta el registro en la DB** vía `prisma.record.create()` con un ID definido, y además crea el `FinancialMovement` de tipo DEPOSIT.

2. Luego llama a `onCreate({id, type: "activo", ...})` que es `createRecord()` del `FinanceProvider`.

3. `createRecord()` genera un `Movement` de auditoría y dispara `dbCreateRecord(record, movement)` — que intenta **insertar el mismo registro nuevamente** con el mismo ID (PK duplicada).

4. El constraint de PK viola y lanza excepción. La función `fire()` captura el error silenciosamente con `p.catch(console.error)`.

**Resultado**: El activo se crea correctamente en la DB, el DEPOSIT financiero se registra, pero **el AuditLog (entrada en la tabla `movements`) nunca se crea** para esa operación. El log de auditoría en `/movimientos` nunca mostrará la creación de activos hechos desde el formulario.

**Archivos involucrados**:
- `components/activos/asset-form-dialog.tsx` → `handleSave()` (líneas 96-119)
- `lib/assets-actions.ts` → `createAsset()`
- `lib/actions.ts` → `dbCreateRecord()`
- `components/finance-store.tsx` → `createRecord()`, `fire()`

**Recomendación**: Separar los dos flujos. `AssetFormDialog` debería llamar a `createAsset()` y luego actualizar el estado local con `setRecords()` directamente, sin pasar por `createRecord()`. O bien, `createAsset()` debería también crear el AuditLog.

---

## I-04: El "eliminar activo" tiene comportamientos radicalmente distintos según desde dónde se lo hace

**Severidad**: Alta

**Evidencia**:
El mismo activo puede ser "eliminado" por dos caminos con efectos totalmente distintos:

**Desde el Dashboard** (`/`, `DashboardSheet`):
- Comportamiento: El monto se pone en 0, se crea un `FinancialMovement` de tipo `ADJUSTMENT` con valor negativo, se genera un AuditLog con acción "editado".
- El record sigue en la DB con `amount = 0` y `deletedAt = null`.

**Desde la página de Activos** (`/activos`, `AssetList`):
- Comportamiento: Se llama a `deleteRecord()` → `dbDeleteRecord()` que hace soft-delete (establece `deletedAt = now()`), y crea un AuditLog con acción "eliminado".
- El record queda con `deletedAt` seteado y desaparece de todas las queries.
- Los `FinancialMovements` asociados quedan huérfanos en la DB (no se eliminan).

**Archivos involucrados**:
- `app/(dashboard)/page.tsx` → `handleActivoDelete()`
- `components/dashboard-sheet.tsx` → `handleDeleteClick()`
- `app/(dashboard)/activos/page.tsx` → `handleDelete()`
- `components/activos/asset-list.tsx` → `ConfirmWithCommentDialog` → `onDelete?.(pendingDelete)`
- `lib/actions.ts` → `dbDeleteRecord()`

**Recomendación**: Unificar el comportamiento o, al menos, documentarlo claramente en la UI. Lo más coherente financieramente sería que desde `/activos` también se llame a `handleActivoDelete` (poner en cero), no a `dbDeleteRecord`.

---

## I-05: El comentario en `ConfirmWithCommentDialog` de `AssetList` es ignorado

**Severidad**: Media

**Evidencia**:
En `components/activos/asset-list.tsx`, el diálogo de confirmación para eliminar activos incluye un campo de comentario. Pero el callback `onConfirm` ignora el parámetro:

```typescript
onConfirm={() => {
  onDelete?.(pendingDelete)   // comment NOT passed
  setPendingDelete(null)
}}
```

El `ConfirmWithCommentDialog` firma `onConfirm: (comment: string) => void`, pero en `AssetList` el comentario capturado nunca se usa ni se propaga.

Por contraste, en `DashboardSheet` el comentario SÍ se pasa correctamente:
```typescript
onConfirm={(comment) => {
  onDeleteWithComment?.(pendingDelete, comment)
}}
```

**Archivos involucrados**:
- `components/activos/asset-list.tsx` (líneas 184-187)
- `components/activos/confirm-with-comment-dialog.tsx`
- `components/dashboard-sheet.tsx` (implementación correcta, líneas ~540-549)

**Recomendación**: Propagar el comentario a `deleteRecord()` o bien cambiar a un diálogo de confirmación simple sin campo de comentario si no se va a usar.

---

## I-06: `linkedTo` existe en el modelo de datos y los tipos pero no hay UI para usarlo

**Severidad**: Media

**Evidencia**:
El campo `linkedTo` en `FinancialRecord` está descrito como vínculo entre ingresos → activos y gastos → pasivos. Existe en la tabla `records`, en el tipo TypeScript, y el código de `SectionTable` tiene la infraestructura para mostrar una columna de vinculación (`linkType`, `linkLabel`, `linkOptions`).

Sin embargo, ninguna de las cuatro secciones del `DashboardSheet` pasa `linkType`:
```tsx
<SectionTable title="Ingresos" ... />     // sin linkType
<SectionTable title="Gastos" ... />       // sin linkType
<SectionTable title="Activos" ... />      // sin linkType
<SectionTable title="Obligaciones" ... /> // sin linkType
```

Por lo tanto, la columna de vinculación nunca aparece, no se pueden crear vínculos desde la UI, y el campo `linkedTo` de los records existentes (si los hubiera) nunca se muestra.

**Archivos involucrados**:
- `lib/finance.ts` (campo `linkedTo` en `FinancialRecord`)
- `components/dashboard-sheet.tsx` (prop `linkType` definida pero no usada)
- `prisma/schema.prisma` (campo `linked_to`)

**Recomendación**: Decidir si la funcionalidad de vinculación es parte del roadmap activo. Si no lo es, limpiar el código de `SectionTable` para eliminar la prop `linkType` y la lógica asociada.

---

## I-07: `FixedTermMetadata.collected` nunca se marca como `true`

**Severidad**: Media

**Evidencia**:
El tipo `FixedTermMetadata` tiene un campo `collected: boolean`. `FixedTermPanel` muestra el badge "✓ Este plazo fijo ya fue cobrado" cuando `metadata?.collected === true`.

Sin embargo, la función `collectFixedTerm()` en `lib/assets-actions.ts` hace soft-delete del activo pero **nunca actualiza `metadata.collected` a `true`**:

```typescript
await prisma.$transaction([
  prisma.record.create({...ingreso...}),
  prisma.record.update({
    where: { id: assetId },
    data: { deletedAt: new Date() }  // ← solo soft delete, no toca metadata
  }),
])
```

El resultado es que el estado "cobrado" del `FixedTermPanel` es código muerto: como el activo queda con `deletedAt` establecido, `loadAsset()` devuelve `null`, y el panel nunca se vuelve a mostrar. El badge "ya fue cobrado" nunca se vería aunque el código exista.

**Archivos involucrados**:
- `lib/assets-actions.ts` → `collectFixedTerm()` (línea ~237-262)
- `components/activos/panels/fixed-term-panel.tsx` (línea ~111)

**Recomendación**: Eliminar la verificación `metadata?.collected` del panel (es código muerto), o alternativamente hacer que `collectFixedTerm()` actualice el metadata a `{...current, collected: true}` antes del soft-delete.

---

## I-08: `FuturesMetadata.liquidationSuffix` nunca se incrementa

> ✅ **RESUELTO**: `futures-panel.tsx` ya calcula e incrementa `liquidationSuffix` correctamente al liquidar una posición. El próximo sufijo se escribe en el metadata junto con `liquidated: true`.

---

## I-09: Dos archivos `globals.css` idénticos

**Severidad**: Baja

**Evidencia**:
Existen dos archivos CSS idénticos:
- `app/globals.css` — importado en `app/layout.tsx`
- `styles/globals.css` — **no importado en ningún lugar**

Verificado con `diff`: los archivos son byte-a-byte idénticos.

**Archivos involucrados**: `app/globals.css`, `styles/globals.css`

**Recomendación**: Eliminar `styles/globals.css`. Es una copia obsoleta probablemente de cuando el proyecto migró de la estructura de carpetas de Next.js Pages Router a App Router.

---

## I-10: `ThemeProvider` existe pero no está montado en ningún layout

**Severidad**: Baja

**Evidencia**:
El archivo `components/theme-provider.tsx` exporta `ThemeProvider` (wrapper de `next-themes`). El CSS en `globals.css` define variables para el tema `.dark`. La dependencia `next-themes` está instalada.

Sin embargo, `ThemeProvider` **no aparece en ningún layout** (`app/layout.tsx` ni `app/(dashboard)/layout.tsx`). No hay toggle de tema en la UI. El modo oscuro definido en el CSS es inaccessible.

**Archivos involucrados**: `components/theme-provider.tsx`, `app/layout.tsx`, `styles/globals.css`

**Recomendación**: Si el modo oscuro es parte del roadmap, montarlo en el layout raíz. Si no, eliminar el `ThemeProvider`, remover `next-themes` de `package.json`, y limpiar las variables `.dark` del CSS.
