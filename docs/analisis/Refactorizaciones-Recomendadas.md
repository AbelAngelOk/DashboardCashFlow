# Refactorizaciones Recomendadas — Segunda Pasada

Las siguientes refactorizaciones están ordenadas por impacto potencial y urgencia. Las críticas afectan funcionalidad visible por el usuario. Las altas afectan integridad de datos. Las medias y bajas son deuda técnica o mantenibilidad.

---

## R-01: Conectar `AssetDetail` a la página de detalle de activo

**Severidad**: Crítica
**Relacionado con**: I-02, CM-01, CM-02

**Problema**: La página `app/(dashboard)/activos/[id]/page.tsx` no importa `AssetDetail`, por lo que los 7 paneles tipo-específico (StockPanel, BondPanel, FuturesPanel, etc.) nunca se renderizan. El usuario no puede interactuar con ninguna funcionalidad avanzada de sus activos.

**Cambio mínimo requerido**:

```tsx
// app/(dashboard)/activos/[id]/page.tsx

// 1. Agregar import:
import { AssetDetail } from "@/components/activos/asset-detail"

// 2. En el JSX, luego de <AssetInfoSection>:
<AssetDetail asset={asset} />
```

**Verificación post-cambio**: Navegar a un activo de tipo STOCK, FIXED_TERM, BOND, etc. y verificar que el panel tipo-específico aparece debajo de la información general.

---

## R-02: Eliminar la doble creación de activo en `AssetFormDialog`

**Severidad**: Alta
**Relacionado con**: I-03

**Problema**: `AssetFormDialog.handleSave()` llama a `createAsset()` (Server Action → inserta en DB) y luego llama a `onCreate()` → `createRecord()` → `dbCreateRecord()` → segundo intento de inserción con la misma PK → falla silenciosamente → el AuditLog nunca se crea.

**Solución**: Separar el flujo de "crear en DB" del flujo de "actualizar estado local". `createAsset()` ya devuelve el record creado; usarlo para actualizar el estado del contexto directamente, sin pasar por `createRecord()`.

```tsx
// components/activos/asset-form-dialog.tsx

// Opción A: que createAsset() también persista el AuditLog
// En lib/assets-actions.ts → createAsset():
await tx.auditLog.create({
  data: {
    action: "creado",
    recordType: "activo",
    recordName: name,
    date: new Date().toLocaleString("es-AR"),
    userId,
    recordId: id,
  },
})

// Opción B: que el formulario llame a reload() en lugar de onCreate(record)
// En AssetFormDialog.handleSave():
await createAsset(...)
reload()  // recarga desde DB, evita la doble inserción
onSuccess?.()
```

**Opción B** es la más simple: elimina la race condition sin tocar la lógica de `createAsset()`.

---

## R-03: Unificar el comportamiento de "eliminar activo"

**Severidad**: Alta
**Relacionado con**: I-04

**Problema**: Eliminar un activo desde el Dashboard (pone amount=0 + ADJUSTMENT) y desde la página de Activos (soft-delete) producen efectos radicalmente distintos sin que el usuario lo sepa.

**Solución recomendada**: Usar soft-delete en ambos casos (el comportamiento más correcto financieramente). La variante "poner en cero" fue posiblemente un vestigio de cuando no había DB.

```tsx
// app/(dashboard)/page.tsx — reemplazar handleActivoDelete por:
const handleActivoDelete = (id: string, comment: string) => {
  deleteRecord(id, comment)  // ya existe y hace soft-delete
}
```

Si se prefiere mantener el comportamiento del Dashboard (ADJUSTMENT financiero), entonces implementar ese mismo flujo en `AssetList` para que el comentario de confirmación se pase correctamente.

---

## R-04: Corregir cálculo de `amount` en `TradingPanel`

**Severidad**: Alta
**Relacionado con**: hallazgo de bug financiero en CM-02

**Problema**:
```typescript
// trading-panel.tsx — lógica incorrecta
amount: Number(obtained) || Number(invested)
```

Cuando `obtained = 0` (el trading aún no tuvo retornos), `Number(0)` es falsy y el `||` usa `Number(invested)` como fallback. Esto hace que el `amount` del activo sea el capital invertido, no 0.

**Corrección**:
```typescript
// Reemplazar por:
amount: Number(obtained)
// o si se quiere el capital neto:
amount: Math.max(0, Number(obtained) - Number(invested))
```

**Impacto**: El monto del activo se calcula incorrectamente mientras `obtained === 0`. Afecta el total del Balance.

---

## R-05: Corregir la acumulación de posiciones en `FuturesPanel`

**Severidad**: Alta
**Relacionado con**: hallazgo de bug financiero en CM-02

**Problema**: Al agregar una posición en `FuturesPanel.AddPositionDialog.handleSave()`:
```typescript
// Comportamiento actual — REEMPLAZA el monto
await updateAsset(assetId, { amount: Number(amount) })
```

Cada nueva posición sobreescribe el monto anterior en lugar de acumularlo.

**Corrección**:
```typescript
// Acumular correctamente
const currentAmount = asset.amount ?? 0
await updateAsset(assetId, {
  amount: currentAmount + Number(amount)
})
```

**Impacto**: Un activo de futuros con múltiples posiciones siempre muestra solo el monto de la última posición agregada.

---

## R-06: Corregir el cierre obsoleto de `totalInvested` en `RebalanceBotPanel`

**Severidad**: Alta
**Relacionado con**: hallazgo de bug financiero en CM-02

**Problema**: En `rebalance-bot-panel.tsx`, `totalInvested` se calcula en el render como `Σ(asset.invested)`. La función `saveMetadata` se define como closure y captura ese valor. Cuando el usuario agrega una nueva posición y el estado se actualiza, el closure `saveMetadata` sigue usando el `totalInvested` calculado en el render anterior.

**Corrección**:
```typescript
// Opción A: calcular totalInvested dentro de saveMetadata (no como closure)
const saveMetadata = useCallback(async (newAssets: BotAsset[]) => {
  const currentTotal = newAssets.reduce((sum, a) => sum + a.invested, 0)
  await updateAsset(assetId, {
    amount: currentTotal,
    metadata: { assets: newAssets, totalInvested: currentTotal }
  })
}, [assetId])

// Opción B: usar useRef para mantener totalInvested actualizado
const totalInvestedRef = useRef(totalInvested)
useEffect(() => { totalInvestedRef.current = totalInvested }, [totalInvested])
```

La Opción A es preferible porque no introduce efectos secundarios.

---

## R-07: Corregir `GroupBreakdownDialog` para advertir sobre exclusión multi-moneda

**Severidad**: Media
**Relacionado con**: hallazgo de bug en CM-02

**Problema**: Al mostrar el total de un grupo de activos, `GroupBreakdownDialog` solo suma los activos en la misma moneda:
```typescript
const sameCurrencyChildren = children.filter(c => c.currency === mainCurrency)
const total = sameCurrencyChildren.reduce(...)
```

Los activos en otras monedas se excluyen silenciosamente del total sin ninguna advertencia.

**Corrección**: Mostrar un aviso cuando hay activos excluidos del total.

```tsx
{children.some(c => c.currency !== mainCurrency) && (
  <p className="text-sm text-amber-600">
    ⚠ Activos en otras monedas no incluidos en el total.
    Activá la conversión de divisas para ver el total consolidado.
  </p>
)}
```

---

## R-08: Corregir `collectFixedTerm()` para actualizar `metadata.collected`

**Severidad**: Media
**Relacionado con**: I-07

**Problema**: `collectFixedTerm()` hace soft-delete del activo pero nunca actualiza `metadata.collected = true`. El badge "✓ Este plazo fijo ya fue cobrado" en `FixedTermPanel` nunca se muestra.

**Corrección** (si se quiere el badge antes del soft-delete, que es el flujo más correcto UX):
```typescript
// lib/assets-actions.ts → collectFixedTerm()
await prisma.$transaction([
  prisma.record.create({...ingreso...}),
  prisma.record.update({
    where: { id: assetId },
    data: {
      metadata: { ...currentMetadata, collected: true },
      deletedAt: new Date()
    }
  }),
  // ... resto de la transacción
])
```

**Alternativa simplificada**: Si el activo queda soft-deleted de todas formas (y `loadAsset` devuelve null), el badge no tiene caso. Simplemente eliminar `metadata?.collected` del panel como condición de display y mostrar siempre el panel activo o redirigir al index si el activo está eliminado.

---

## R-09: Corregir el incremento de `liquidationSuffix` en `FuturesPanel`

**Severidad**: Media
**Relacionado con**: I-08, CM-07

**Problema**: Al liquidar un futuro, se crea un nuevo activo con nombre `"TICKER (2)"`. El `liquidationSuffix` nunca se actualiza, por lo que todas las liquidaciones sucesivas siempre serán `(2)`.

**Corrección** en `handleLiquidate()`:
```typescript
// futures-panel.tsx
const nextSuffix = (metadata?.liquidationSuffix ?? 1) + 1

await updateAsset(assetId, {
  metadata: {
    ...metadata,
    liquidated: true,
    liquidationSuffix: nextSuffix
  }
})

// Usar nextSuffix en el nombre del nuevo activo:
const suggestedName = `${asset.ticker ?? asset.name} (${nextSuffix})`
```

---

## R-10: Propagar el comentario en `AssetList.ConfirmWithCommentDialog`

**Severidad**: Media
**Relacionado con**: I-05

**Problema**: El campo de comentario en el diálogo de confirmación de eliminación de activos en `/activos` captura el texto del usuario pero nunca lo pasa a `onDelete()`. El comentario se pierde.

**Corrección**:
```typescript
// components/activos/asset-list.tsx
// Cambiar de:
onConfirm={() => {
  onDelete?.(pendingDelete)
  setPendingDelete(null)
}}

// A:
onConfirm={(comment) => {
  onDelete?.(pendingDelete, comment)
  setPendingDelete(null)
}}
```

Y actualizar `onDelete` en la firma del componente para aceptar el segundo parámetro `comment: string`, propagándolo hasta `deleteRecord()`.

---

## R-11: Agregar notificación de error cuando `fire()` falla

**Severidad**: Alta
**Relacionado con**: RD-01, DT-06 (08-Riesgos-y-Deuda-Tecnica.md)

**Problema**: La función `fire()` en `finance-store.tsx` captura errores silenciosamente:
```typescript
const fire = (p: Promise<unknown>) => p.catch(console.error)
```

Si una mutación falla (sesión expirada, error de red, error de DB), el usuario no recibe ninguna indicación. En la próxima recarga, sus cambios habrán desaparecido.

**Corrección mínima**:
```typescript
// components/finance-store.tsx
const fire = (p: Promise<unknown>) =>
  p.catch((err) => {
    console.error(err)
    toast({
      title: "Error al guardar",
      description: err?.message?.includes("No autorizado")
        ? "Tu sesión expiró. Recargá la página para volver a ingresar."
        : "No se pudo guardar el cambio. Comprobá tu conexión.",
      variant: "destructive",
    })
  })
```

---

## R-12: Limpiar paquetes npm sin uso

**Severidad**: Baja (pero impacta tamaño de bundle y seguridad)
**Relacionado con**: CM-10, CM-11, CM-12, CM-13, CM-14

**Paquetes a remover**:

```bash
# Completamente sin uso en el código de la aplicación:
npm uninstall postgres         # solo pg es usado
npm uninstall recharts         # no hay gráficos

# Verificar antes de remover (pueden ser peer deps de otros paquetes):
npm uninstall date-fns         # verificar si react-day-picker lo requiere
npm uninstall playwright       # mover a devDependencies o remover

# Componentes shadcn/ui con deps pesadas que probablemente no se usan:
npm uninstall embla-carousel-react    # para Carousel
npm uninstall vaul                    # para Drawer
npm uninstall react-resizable-panels  # para Resizable
npm uninstall input-otp               # para InputOTP
npm uninstall cmdk                    # para Command/Combobox
```

**Proceso recomendado**: Ejecutar `npx depcheck` para obtener un reporte exacto de qué está instalado pero no importado, y proceder de a un paquete a la vez verificando que el build no se rompa.

---

## R-13: Eliminar archivos y componentes duplicados / muertos

**Severidad**: Baja
**Relacionado con**: CM-04, CM-05, CM-06

**Archivos a eliminar**:

| Archivo | Razón |
|---|---|
| `styles/globals.css` | Copia exacta de `app/globals.css`, no importado |
| `components/theme-provider.tsx` | Nunca montado, modo oscuro no disponible |
| `hooks/use-toast.ts` | Duplica `components/ui/use-toast.ts` |
| `hooks/use-mobile.ts` | Duplica `components/ui/use-mobile.tsx` |

```bash
rm styles/globals.css
rm components/theme-provider.tsx
rm hooks/use-toast.ts
rm hooks/use-mobile.ts
```

Verificar con `grep -r "theme-provider\|hooks/use-toast\|hooks/use-mobile" app/ components/` que nada los importa antes de borrar.

---

## R-14: Limpiar modelos `Group`/`RecordGroup` del schema de Prisma

**Severidad**: Media
**Relacionado con**: CM-09, RD-05 (08-Riesgos-y-Deuda-Tecnica.md)

**Problema**: Los modelos `Group` y `RecordGroup` están en el schema pero ninguna parte de la aplicación los usa. La agrupación real usa `parentId` en `Record`.

**Acción**:
1. Confirmar que las tablas están vacías en producción:
   ```sql
   SELECT COUNT(*) FROM groups;
   SELECT COUNT(*) FROM record_groups;
   ```
2. Si están vacías, eliminar los modelos del schema.
3. Generar una migración Prisma para `DROP TABLE record_groups; DROP TABLE groups;`
4. Eliminar la relación `groups RecordGroup[]` del modelo `Record` en el schema.

---

## R-15: Migrar campos de fecha string a `DateTime` en DB

**Severidad**: Media (impacta ordenación y queries futuras)
**Relacionado con**: RD-04 (08-Riesgos-y-Deuda-Tecnica.md)

**Problema**: `AuditLog.date` y `Snapshot.createdAt` son strings (`"19/06/2026, 14:30"`). Esto impide ordenar correctamente por fecha en la DB y filtrar por rangos.

**Migración gradual**:
1. Agregar columnas `date_ts DateTime?` y `created_at_ts DateTime?` en el schema.
2. Hacer una migración de backfill que parsee los strings existentes a DateTime.
3. Actualizar el código para escribir en la nueva columna.
4. Cuando todos los registros tengan la nueva columna poblada, eliminar las columnas string.

Este es un cambio riesgoso — requiere hacerlo en fases para no perder datos existentes.

---

## R-16: Actualizar `CLAUDE.md` para reflejar la arquitectura real

**Severidad**: Media (afecta productividad del equipo)
**Relacionado con**: I-01, DT-01 (08-Riesgos-y-Deuda-Tecnica.md)

**Problema**: `CLAUDE.md` describe incorrectamente el sistema como "sin base de datos, sin localStorage, sin API". La arquitectura actual tiene PostgreSQL (Supabase), NextAuth, Prisma, Server Actions, y localStorage para configuración.

**Acción**: Reescribir la sección "Architecture" de `CLAUDE.md` para incluir:
- Stack: Next.js App Router + React Context + Prisma + PostgreSQL (Supabase) + NextAuth
- Dos contextos: `FinanceContext` (datos financieros, DB) y `SettingsContext` (configuración, localStorage)
- Server Actions en `lib/actions.ts` y `lib/assets-actions.ts`
- Autenticación: NextAuth v4, JWT, bcrypt, middleware en `proxy.ts`
- Persistencia de configuración: `localStorage` key `cashflow:settings`
- Patrones importantes: mutaciones optimistas con `fire()`, debounce de comentarios, soft-delete

---

## Resumen de prioridades

| Prioridad | ID | Refactorización | Esfuerzo estimado |
|---|---|---|---|
| 🔴 Crítica | R-01 | Conectar `AssetDetail` a la página (activa 7 paneles) | 5 min |
| 🔴 Crítica | R-04 | Corregir cálculo `amount` en TradingPanel | 5 min |
| 🔴 Crítica | R-05 | Corregir acumulación de posiciones en FuturesPanel | 10 min |
| 🔴 Alta | R-02 | Eliminar doble creación en `AssetFormDialog` | 30 min |
| 🔴 Alta | R-11 | Agregar notificación de error en `fire()` | 20 min |
| 🟠 Alta | R-03 | Unificar comportamiento de eliminación de activo | 30 min |
| 🟠 Alta | R-06 | Corregir closure obsoleto en `RebalanceBotPanel` | 20 min |
| 🟡 Media | R-07 | Advertencia en `GroupBreakdownDialog` multi-moneda | 10 min |
| 🟡 Media | R-08 | Corregir `collectFixedTerm()` | 15 min |
| 🟡 Media | R-09 | Incrementar `liquidationSuffix` en liquidación | 10 min |
| 🟡 Media | R-10 | Propagar comentario en eliminación de activos | 10 min |
| 🟡 Media | R-14 | Limpiar schema `Group`/`RecordGroup` | 1 hora |
| 🟡 Media | R-15 | Migrar fechas string a DateTime | 2-4 horas |
| 🟡 Media | R-16 | Actualizar CLAUDE.md | 30 min |
| 🟢 Baja | R-12 | Limpiar paquetes npm sin uso | 1 hora |
| 🟢 Baja | R-13 | Eliminar archivos duplicados/muertos | 15 min |
