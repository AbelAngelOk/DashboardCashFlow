# Código Muerto — Segunda Pasada

## CM-01: `components/activos/asset-detail.tsx` — componente orphaned

**Severidad**: Crítica

**Descripción**: `AssetDetail` es el dispatcher central que enruta al panel específico según `asset.assetType`. Contiene el `switch` que lleva a todos los paneles especializados. Pero la página `app/(dashboard)/activos/[id]/page.tsx` lo ignoró y conectó las secciones directamente.

**Evidencia**:
```typescript
// asset-detail.tsx — nunca importado por nadie excepto por sí mismo
export function AssetDetail({ asset }: AssetDetailProps) {
  switch (asset.assetType) {
    case "STOCK": return <StockPanel asset={asset} />
    case "FIXED_TERM": return <FixedTermPanel asset={asset} />
    // ... etc
  }
}
```

```bash
grep -r "AssetDetail" app/ components/activos/
# Solo aparece dentro del propio archivo asset-detail.tsx
```

**Archivos involucrados**: `components/activos/asset-detail.tsx`

**Recomendación**: Conectar `AssetDetail` a la página (ver `I-02`), o si la decisión es mantener las secciones separadas, eliminar `asset-detail.tsx`.

---

## CM-02: Todos los paneles tipo-específico son inalcanzables

**Severidad**: Crítica

**Descripción**: Como consecuencia de `CM-01`, los siguientes paneles existen, compilan, e incluso tienen lógica de negocio compleja — pero **nunca se renderizan**:

| Componente | Funcionalidad afectada |
|---|---|
| `panels/stock-panel.tsx` | Dividendos, cobro de dividendos, precio promedio |
| `panels/fixed-term-panel.tsx` | Cobro de plazo fijo, retorno esperado |
| `panels/bond-panel.tsx` | Cronograma de desembolsos, marcar cobrado |
| `panels/trading-bot-panel.tsx` | Agregados del bot, ROI |
| `panels/rebalance-bot-panel.tsx` | Aportes/extracciones proporcionales |
| `panels/trading-panel.tsx` | Cartera de trading, ROI |
| `panels/futures-panel.tsx` | Posiciones LONG/SHORT, liquidación |

**Archivos involucrados**: `components/activos/panels/*.tsx` (todos)

**Recomendación**: Agregar `<AssetDetail asset={asset} />` en `app/(dashboard)/activos/[id]/page.tsx` para activar todos estos paneles. Verificar que la funcionalidad de cada panel siga siendo correcta después de integrarla.

---

## CM-03: `handleBuyFromHistory` en `StockPanel` — función definida y suprimida

**Severidad**: Alta

**Descripción**: En `stock-panel.tsx` existe una función completa `handleBuyFromHistory` que:
1. Calcula nuevo precio promedio ponderado
2. Actualiza cantidad del activo
3. Agrega un movimiento BUY
4. Actualiza el activo

Sin embargo, nunca se llama desde el JSX y se suprime explícitamente con `void handleBuyFromHistory`. El comentario dice "used conceptually via GenericAssetPanel", pero `GenericAssetPanel` no acepta callbacks ni usa esta función.

**Evidencia**:
```typescript
// stock-panel.tsx, línea 218
void handleBuyFromHistory // suppress unused warning — used conceptually via GenericAssetPanel
```

**Archivos involucrados**: `components/activos/panels/stock-panel.tsx` (líneas 201-218)

**Recomendación**: Eliminar la función o conectarla a un botón en el panel (por ejemplo, "Registrar compra" en el historial de movimientos del stock).

---

## CM-04: `styles/globals.css` — archivo duplicado sin importar

**Severidad**: Baja

**Descripción**: `styles/globals.css` es una copia exacta byte-a-byte de `app/globals.css`. No está importado en ningún archivo del proyecto.

**Evidencia**:
```bash
diff app/globals.css styles/globals.css
# (sin diferencias)

grep -r "styles/globals" app/ components/
# (sin resultados)
```

**Archivos involucrados**: `styles/globals.css`

**Recomendación**: Eliminar `styles/globals.css`.

---

## CM-05: `components/theme-provider.tsx` — componente nunca montado

**Severidad**: Baja

**Descripción**: `ThemeProvider` importa y re-exporta `NextThemesProvider`. No está montado en `app/layout.tsx` ni en `app/(dashboard)/layout.tsx`. Tampoco hay UI de toggle de tema en ninguna página.

**Evidencia**:
```bash
grep -r "ThemeProvider" app/
# (sin resultados)
```

**Archivos involucrados**: `components/theme-provider.tsx`

**Recomendación**: Eliminar el archivo si el modo oscuro no está en el roadmap inmediato. Si sí lo está, montarlo en el `RootLayout`.

---

## CM-06: `hooks/use-toast.ts` y `hooks/use-mobile.ts` — duplicados no usados

**Severidad**: Baja

**Descripción**: Estos hooks existen duplicados:
- `hooks/use-toast.ts` ↔ `components/ui/use-toast.ts` (mismo contenido)
- `hooks/use-mobile.ts` ↔ `components/ui/use-mobile.tsx` (equivalente)

Los que están en `hooks/` no son importados por ningún archivo de la aplicación. Los componentes `shadcn/ui` que necesitan estos hooks los importan desde sus propias rutas en `components/ui/`.

**Evidencia**:
```bash
grep -r "from '@/hooks/use-toast'\|from '@/hooks/use-mobile'" app/ components/
# (sin resultados)
```

**Archivos involucrados**: `hooks/use-toast.ts`, `hooks/use-mobile.ts`

**Recomendación**: Eliminar `hooks/use-toast.ts` y `hooks/use-mobile.ts`. Si se necesitan en componentes de la aplicación (no de ui/), importar desde `@/components/ui/use-toast` o mover a `hooks/` con redirección.

---

## CM-07: `FuturesMetadata.liquidationSuffix` — campo que nunca se escribe

**Severidad**: Baja

**Descripción**: El tipo `FuturesMetadata` define `liquidationSuffix?: number` que se lee con `?? 2` como fallback. Nunca se escribe en ningún lugar del código (ni en `handleLiquidate`, ni en ningún `updateAsset` dentro de `futures-panel.tsx`).

**Evidencia**:
```typescript
// assets.ts
export interface FuturesMetadata {
  liquidated?: boolean
  liquidationSuffix?: number  // ← nunca se asigna
}

// futures-panel.tsx línea 168
const suggestedName = `${asset.ticker ?? asset.name} (${(metadata?.liquidationSuffix ?? 2)})`
// siempre mostrará "(2)" porque liquidationSuffix nunca existe en el metadata
```

**Archivos involucrados**: `lib/assets.ts`, `components/activos/panels/futures-panel.tsx`

**Recomendación**: Implementar el incremento del sufijo en `handleLiquidate()`, o eliminar `liquidationSuffix` del tipo si la funcionalidad de numeración progresiva no es requerida.

---

## CM-08: `Snapshot.startDate`, `Snapshot.endDate`, `Snapshot.data` — campos de schema sin uso

**Severidad**: Baja

**Descripción**: El modelo `Snapshot` en Prisma tiene tres campos que no aparecen en ningún código de la aplicación:
- `startDate DateTime?` — nunca se escribe al crear snapshots
- `endDate DateTime?` — nunca se escribe al crear snapshots
- `data Json?` — marcado con comentario "jsonb: estado consolidado (Fase 4)"

**Evidencia**:
```typescript
// actions.ts → dbTakeSnapshot() — solo persiste id, name, period, createdAt, userId
await tx.snapshot.create({
  data: {
    id: snapshot.id,
    name: snapshot.name,
    period: snapshot.period,
    createdAt: snapshot.createdAt,
    userId,
    // startDate, endDate, data: NUNCA incluidos
  },
})
```

**Archivos involucrados**: `prisma/schema.prisma` (modelo `Snapshot`), `lib/actions.ts`

**Recomendación**: Si la "Fase 4" mencionada en el comentario del schema no está en el roadmap próximo, eliminar estos campos del schema en una migración de limpieza para reducir la deuda técnica.

---

## CM-09: Tabla `groups` y `record_groups` — completamente sin uso

**Severidad**: Media

**Descripción**: Los modelos `Group` y `RecordGroup` están en el schema de Prisma, tienen sus relaciones definidas, y `Record` tiene una relación `groups` hacia `RecordGroup`. Sin embargo:
- No existe ningún query que lea de `prisma.group` o `prisma.recordGroup`
- No existe ninguna mutación que escriba en estas tablas
- La agrupación real en la UI usa el campo `parentId` auto-referencial de `records`

**Evidencia**:
```bash
grep -r "prisma\.group\|prisma\.recordGroup" lib/
# (sin resultados)
```

**Archivos involucrados**: `prisma/schema.prisma` (modelos `Group`, `RecordGroup`)

**Recomendación**: Eliminar los modelos `Group` y `RecordGroup` del schema y crear una migración que elimine las tablas `groups` y `record_groups` de la DB. Si las tablas están vacías (probable), no hay riesgo de pérdida de datos.

---

## CM-10: `postgres` — paquete instalado pero no usado

**Severidad**: Baja

**Descripción**: El paquete `postgres` (^3.4.9) aparece en `package.json` pero no hay ningún `import from 'postgres'` ni `require('postgres')` en el código. El cliente de base de datos usa exclusivamente `pg` (driver oficial de PostgreSQL) a través del adaptador de Prisma.

**Evidencia**:
```bash
grep -r "from 'postgres'\|require('postgres')" lib/ app/ components/
# (sin resultados)
```

`package.json` línea con `"postgres": "^3.4.9"`

**Archivos involucrados**: `package.json`

**Recomendación**: Ejecutar `npm uninstall postgres` para reducir el tamaño del bundle y las dependencias innecesarias.

---

## CM-11: `date-fns` — paquete instalado pero no importado en el código de la aplicación

**Severidad**: Baja

**Descripción**: `date-fns` (4.1.0) está en `package.json` como dependencia de producción. No hay ningún `import from 'date-fns'` en `app/`, `lib/`, ni `components/` (excepto posiblemente dentro de `react-day-picker` que lo usa internamente).

**Evidencia**:
```bash
grep -r "from 'date-fns'\|from \"date-fns\"" app/ lib/ components/
# (sin resultados)
```

**Archivos involucrados**: `package.json`

**Recomendación**: Verificar si algún componente de `react-day-picker` requiere `date-fns` como peer dependency. Si no, ejecutar `npm uninstall date-fns`.

---

## CM-12: `recharts` y `components/ui/chart.tsx` — instalados pero sin uso

**Severidad**: Baja

**Descripción**: `recharts` (2.15.0) está instalado y existe `components/ui/chart.tsx` (wrapper de shadcn/ui sobre recharts). Ningún archivo de la aplicación importa `recharts` directamente ni usa `components/ui/chart.tsx`.

**Evidencia**:
```bash
grep -r "recharts\|from.*chart\|<Chart" app/ components/activos/ components/app-shell.tsx components/app-sidebar.tsx components/dashboard-sheet.tsx
# (sin resultados)
```

**Archivos involucrados**: `package.json`, `components/ui/chart.tsx`

**Recomendación**: Si no hay planes de agregar gráficos en el corto plazo, ejecutar `npm uninstall recharts` y eliminar `components/ui/chart.tsx`.

---

## CM-13: `playwright` — instalado sin ningún test

**Severidad**: Media

**Descripción**: `playwright` (^1.60.0) está en `dependencies` (no en `devDependencies`, lo cual también es incorrecto). No existe ningún archivo de test, ninguna carpeta `tests/` o `e2e/`, ni ningún `playwright.config.*`.

**Evidencia**:
```bash
find . -name "*.spec.*" -o -name "*.test.*" -o -name "playwright.config*"
# (sin resultados)
```

**Archivos involucrados**: `package.json`

**Recomendación**: Mover `playwright` a `devDependencies` si hay intención de escribir tests, o eliminarlo si no es una prioridad. Tener Playwright en `dependencies` de producción agrega peso innecesario al bundle.

---

## CM-14: Múltiples componentes `shadcn/ui` instalados sin uso aparente

**Severidad**: Baja

**Descripción**: Al instalar `shadcn/ui`, se agregaron muchos componentes que el proyecto no usa activamente. Los siguientes probablemente nunca son importados por el código de la aplicación:

| Componente | Paquete relacionado |
|---|---|
| `components/ui/carousel.tsx` | `embla-carousel-react` |
| `components/ui/drawer.tsx` | `vaul` |
| `components/ui/resizable.tsx` | `react-resizable-panels` |
| `components/ui/input-otp.tsx` | `input-otp` |
| `components/ui/command.tsx` | `cmdk` |
| `components/ui/menubar.tsx` | `@radix-ui/react-menubar` |
| `components/ui/navigation-menu.tsx` | `@radix-ui/react-navigation-menu` |

Estos componentes arrastran paquetes npm que se incluyen en el bundle de producción sin aportar funcionalidad.

**Archivos involucrados**: `components/ui/*.tsx` mencionados, `package.json`

**Recomendación**: Auditar qué componentes de `components/ui/` son efectivamente importados en la aplicación y eliminar los no usados junto con sus dependencias de `package.json`.

---

## CM-15: `prop linkType` en `SectionTable` — infraestructura de vinculación sin conectar

**Severidad**: Media

**Descripción**: `SectionTable` tiene soporte completo para mostrar una columna de vinculación con otro tipo de registro (`linkType`, `linkLabel`, `linkOptions`). La lógica de filtrado, renderizado de select, y guardado existe. Sin embargo, ninguna de las cuatro secciones del `DashboardSheet` pasa estas props, por lo que `hasLink` siempre es `false` y la columna nunca se muestra.

**Evidencia**:
```typescript
// dashboard-sheet.tsx, SectionTable props
interface SectionTableProps {
  linkType?: RecordType   // ← nunca recibe valor
  linkLabel?: string      // ← nunca recibe valor
  ...
}

// DashboardSheet — ninguna llamada a SectionTable pasa linkType
<SectionTable title="Ingresos" type="ingreso" ... />  // sin linkType
<SectionTable title="Gastos"   type="gasto"   ... />  // sin linkType
<SectionTable title="Activos"  type="activo"  ... />  // sin linkType
```

**Archivos involucrados**: `components/dashboard-sheet.tsx` (props `linkType`, `linkLabel` en `SectionTableProps` y en la función `SectionTable`)

**Recomendación**: Decidir si la vinculación entre registros es una feature activa. Si no, eliminar las props `linkType`, `linkLabel`, y toda la lógica asociada (`linkOptions`, `getLinkedName`, la columna de vinculación en el header y en los rows) para simplificar el componente.
