# Bug Fix: Conversión de divisas en grupos

**Versión:** 1.0 | **Fecha:** 2026-06-20 | **Estado:** Pre-implementación

---

## 1. Causa raíz

Hay **dos bugs relacionados** con la misma causa raíz subyacente:

### Causa raíz primaria

El campo `records.amount` del grupo padre en PostgreSQL almacena un **valor caché calculado una sola vez** al momento de creación. Este valor:

1. Solo suma hijos que tienen la **misma divisa** que el grupo padre (`totalSameCurrency` en `recalcularGrupo()`)
2. Es **ignorado en la visualización correcta** — los componentes deberían calcular live desde los hijos
3. No refleja la configuración `convertCurrencies` / `baseCurrency` / `exchangeRates`, que viven en `localStorage` (cliente)

### Causa raíz secundaria

Ningún componente de display de grupos llama a `useSettings()` para consultar si debe convertir divisas al mostrar el valor del grupo. Cada componente implementa (o no implementa) su propia lógica ad-hoc, sin consistencia.

### Consecuencias concretas

| Síntoma | Origen |
|---------|--------|
| `AssetInfoSection` muestra valor incorrecto para grupos multi-divisa | Usa `asset.amount` (caché) en lugar de sumar hijos |
| `AssetList` siempre muestra breakdown multi-divisa, ignora `convertCurrencies=true` | No llama `useSettings()` para el cálculo de valor |
| `DashboardSheet` muestra el valor caché del grupo padre | `RecordAmount` usa `record.amount` directamente |
| Cambiar la configuración de divisas en tiempo real no actualiza los valores de grupo | Sin reactividad al cambio de settings |

---

## 2. Componentes afectados

| Componente | Archivo | Bug | Descripción |
|-----------|---------|-----|-------------|
| `AssetInfoSection` | `components/activos/asset-info-section.tsx` | BUG 1 | Muestra `asset.amount` (caché, monodivisa) sin considerar hijos ni settings |
| `AssetList` | `components/activos/asset-list.tsx` | BUG 2 | Siempre muestra breakdown; ignora `convertCurrencies`; usa `record.amount` para monodivisa |
| `RecordAmount` | `components/dashboard-sheet.tsx` (función local) | BUG relacionado | Para grupos, muestra `record.amount` sin considerar hijos ni settings |
| `SectionTable` | `components/dashboard-sheet.tsx` (función local) | BUG relacionado | Tiene acceso a `allRecords` (con hijos) pero no lo usa para calcular el valor del grupo padre |

---

## 3. Servicios afectados

| Servicio / Función | Archivo | Rol en el bug |
|--------------------|---------|---------------|
| `recalcularGrupo()` | `lib/assets-actions.ts` | Calcula `totalSameCurrency` (ignora hijos en otras divisas); almacena `currencyBreakdown` en metadata pero nadie lo usa |
| `createGroup()` | `lib/assets-actions.ts` | Crea el grupo con `amount = SUM(all children)` sin conversión — incorrecto para multi-divisa |
| `loadData()` | `lib/actions.ts` | Devuelve `FinancialRecord[]` con `amount` caché del grupo — correcto para el contexto React |
| `loadAsset()` / `mapToAsset()` | `lib/assets-actions.ts` | Devuelve `Asset` con `children?: Asset[]` — los datos correctos están disponibles |
| `calculateTotalsConverted()` | `lib/finance.ts` | Función existente correcta para convertir; no usada para grupos |
| `convertAmount()` | `lib/finance.ts` | Función existente correcta para convertir un monto; no usada para grupos |

---

## 4. Modelo actual de cálculo

### 4.1 Al crear un grupo (`createGroup()`)

```
totalAmount = SUM(children.amount)   // suma directa, SIN conversión, SIN considerar divisas
GROUP.amount = totalAmount
GROUP.currency = currency (param, típicamente la del primer hijo)
```

**Incorrecto:** si TSLA es USD $100 y AL30 es ARS $120.000, `totalAmount = $120.100` en la divisa que sea.

### 4.2 Al recalcular el grupo (`recalcularGrupo()`)

```
children = fetch(parentId, deletedAt=null)
totalSameCurrency = SUM(children WHERE currency == GROUP.currency)
breakdown = { USD: X, ARS: Y, ... }     // correcto, almacenado en metadata
GROUP.amount = totalSameCurrency          // INCOMPLETO: ignora hijos en otras divisas
GROUP.metadata.currencyBreakdown = breakdown  // correcto pero nadie lo lee
```

**Problema:** `GROUP.amount` solo incluye hijos en la misma divisa que el grupo. Los demás se pierden en el display del caché.

### 4.3 Display en `AssetInfoSection` (Bug 1)

```tsx
// Valor actual — always read-only
<div className="font-bold">
  {formatAmount(asset.amount, asset.currency)}
  {asset.currency}
</div>
```

`asset.amount` = caché en DB = incorrecto para multi-divisa.
No consulta `useSettings()` para el cálculo.
No usa `asset.children` (disponibles en el tipo `Asset`).

### 4.4 Display en `AssetList` (Bug 2)

```tsx
// Mi implementación anterior:
const groupCurrencyBreakdown = isGroup
  ? children.reduce((acc, child) => {
      acc[child.currency] = (acc[child.currency] ?? 0) + child.amount
      return acc
    }, {})
  : null
const groupHasMultipleCurrencies =
  Object.keys(groupCurrencyBreakdown).filter(c => c > 0).length > 1

// Si multi-divisa: muestra breakdown (correcto SI convertCurrencies=false)
// Si mono-divisa: muestra record.amount (stale, no es live desde hijos)
// NUNCA convierte aunque convertCurrencies=true
```

### 4.5 Display en `DashboardSheet` (RecordAmount)

```tsx
function RecordAmount({ record }) {
  const { convertCurrencies, showConvertedAmounts, baseCurrency, exchangeRates } = settings
  
  if (convertCurrencies && showConvertedAmounts && record.currency !== baseCurrency) {
    const converted = convertAmount(record.amount, record.currency, baseCurrency, exchangeRates)
    // muestra converted — pero record.amount para grupos ES EL CACHÉ INCORRECTO
  }
  
  return <span>{formatAmount(record.amount, record.currency)}</span>
  // Para grupos: amount = caché incorrecto
}
```

---

## 5. Modelo corregido

### 5.1 Principio fundamental

> El valor de un grupo **nunca debe leerse desde `record.amount`/`asset.amount` para display**.
> Debe calcularse **live desde los hijos** usando la configuración activa de divisas.

El campo `amount` en DB sigue siendo útil para: (a) cálculos de totales en el Balance del dashboard, (b) ordenamiento. Pero el display debe calcular desde hijos.

### 5.2 Función compartida: `computeGroupValue()`

Una única función pura en `lib/finance.ts`:

```ts
export type GroupValueResult =
  | { type: "single"; value: number; currency: Currency }
  | { type: "breakdown"; entries: Array<{ currency: Currency; value: number }> }

export function computeGroupValue(
  children: Array<{ amount: number; currency: Currency }>,
  convertCurrencies: boolean,
  baseCurrency: Currency,
  exchangeRates: Record<Currency, number>,
): GroupValueResult {
  if (children.length === 0) {
    return { type: "single", value: 0, currency: baseCurrency }
  }
  
  if (convertCurrencies) {
    const total = children.reduce(
      (sum, c) => sum + convertAmount(c.amount, c.currency, baseCurrency, exchangeRates),
      0,
    )
    return { type: "single", value: total, currency: baseCurrency }
  }
  
  // Sin conversión: agrupar por divisa
  const breakdown: Record<string, number> = {}
  for (const c of children) {
    breakdown[c.currency] = (breakdown[c.currency] ?? 0) + c.amount
  }
  
  const entries = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([cur, val]) => ({ currency: cur as Currency, value: val }))
  
  if (entries.length <= 1) {
    const e = entries[0]
    return { type: "single", value: e?.value ?? 0, currency: e?.currency ?? baseCurrency }
  }
  
  return { type: "breakdown", entries }
}
```

**Características:**
- Función pura (no hooks, no effectos)
- Acepta cualquier array con `{ amount, currency }` — funciona para `Asset[]` y `FinancialRecord[]`
- Respeta `convertCurrencies`: cuando activo → single total; cuando desactivado → breakdown
- Cuando hay una sola divisa activa → siempre `type: "single"` (sin breakdown innecesario)

### 5.3 Componente compartido: `GroupValueDisplay`

Un React client component en `components/group-value-display.tsx`:

```tsx
"use client"

import { computeGroupValue } from "@/lib/finance"
import { formatAmount, type Currency } from "@/lib/finance"
import { useSettings } from "@/components/settings-store"

interface GroupChild { amount: number; currency: Currency }

export function GroupValueDisplay({
  children,
  className,
}: {
  children: GroupChild[]
  className?: string
}) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings
  const result = computeGroupValue(children, convertCurrencies, baseCurrency, exchangeRates)

  if (result.type === "single") {
    return (
      <span className={className}>
        {formatAmount(result.value, result.currency)}{" "}
        <span className="text-xs text-gray-400">{result.currency}</span>
      </span>
    )
  }

  return (
    <div className={`flex flex-col items-end gap-0.5 ${className ?? ""}`}>
      {result.entries.map(({ currency, value }) => (
        <span key={currency} className="text-xs">
          {formatAmount(value, currency)}{" "}
          <span className="text-gray-400">{currency}</span>
        </span>
      ))}
    </div>
  )
}
```

**Reactividad:** Como llama `useSettings()`, se re-renderiza automáticamente cuando el usuario cambia `convertCurrencies` o `baseCurrency` en `/configuracion`. Esto resuelve el Caso 6 (cambio en tiempo real) automáticamente.

### 5.4 Corrección de `recalcularGrupo()` en DB

El `amount` del grupo en DB debería representar el total cuando todos los hijos tienen la misma divisa, y 0 (o sumar en la divisa del grupo) cuando hay múltiples. Esto es secundario al display; el display ya no depende de este valor.

Sin embargo, para no romper los cálculos del Balance en `DashboardSheet` (que usa `record.amount` para los totales), hay dos estrategias:

**Estrategia elegida:** Corregir `recalcularGrupo()` para que sume TODOS los hijos (si son misma divisa) o el total convertido si hay configuración de base. Pero como la configuración es client-side, la mejor opción es que el Balance del dashboard también use la lógica de hijos.

**Alternativa pragmática (menor impacto):** Para el Balance del dashboard, los activos que se muestran son los que tienen `!r.parentId` + `r.amount !== 0`. Los hijos tienen `parentId` y están excluidos. El grupo padre tiene `amount = totalSameCurrency`. Para el Balance, esto puede ser incorrecto si hay hijos en otras divisas.

Ver sección de riesgos para la decisión final.

### 5.5 Flujo de display corregido

```
Usuario navega a /activos/[id] (grupo con TSLA USD + AL30 ARS):

convertCurrencies = DESACTIVADO:
  AssetInfoSection →
    asset.children = [{ amount: 100, currency: "USD" }, { amount: 120000, currency: "ARS" }]
    computeGroupValue(children, false, ...) → { type: "breakdown", entries: [USD:100, ARS:120000] }
    Renderiza: "USD: $100.00 | ARS: $120.000,00"

convertCurrencies = ACTIVADO (baseCurrency = USD):
  AssetInfoSection →
    asset.children = [{ amount: 100, currency: "USD" }, { amount: 120000, currency: "ARS" }]
    computeGroupValue(children, true, "USD", rates) → { type: "single", value: 100 + 120000*rateARS, currency: "USD" }
    Renderiza: "$XXX.XX USD"
```

---

## 6. Riesgos detectados

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|-----------|
| R1 | `DashboardSheet` Balance: `TotalsBlock` suma `record.amount` de grupos (caché incorrecto para multi-divisa). El grupo padre aparece en `activos` del dashboard como una línea con su `amount` caché | ALTO | El Balance usa `calculateTotals()` / `calculateTotalsConverted()`. Para grupos multi-divisa, el `amount` caché es incorrecto. **Solución:** excluir el grupo padre del cálculo del Balance y sumar directamente los hijos. Requiere cambio en `DashboardSheet`. |
| R2 | `recalcularGrupo()` sigue almacenando solo `totalSameCurrency` en DB | MEDIO | El campo DB es un caché secundario; los componentes ya no dependen de él para display. Aceptable a corto plazo. Documentar en comentario de código. |
| R3 | `asset.children` en `AssetInfoSection` puede ser undefined (activos no-group o si la query no incluye children) | MEDIO | Guard: `if (asset.isGroupParent && asset.children?.length > 0)` antes de computar desde hijos |
| R4 | Hijos con `amount = 0` (activos liquidados) contribuyen 0 al total — correcto | INFO | No es un riesgo; simplemente $0 no aparece en el breakdown |
| R5 | Configuración de tasas manuales incorrectas → conversión incorrecta | INFO | El usuario es responsable de sus tasas; mismo comportamiento que en el rest del dashboard |
| R6 | `FinancialRecord` en contexto no tiene `metadata.currencyBreakdown` | BAJO | Con `computeGroupValue()` desde hijos (que sí están en `records`), no se necesita leer metadata |
| R7 | `GroupValueDisplay` en `AssetList` itera sobre `children` derivados de `all` (filtro local). Si `all` no incluye un hijo porque fue liquidado (amount=0), el total será correcto (0 contribución). | INFO | Correcto: activos con amount=0 no deben contribuir al total visible del grupo |

### Decisión sobre el Balance del dashboard (R1)

El `DashboardSheet` muestra el grupo padre como una fila en la tabla de Activos. El total del Balance usa `calculateTotals(activos)` donde `activos` incluye el grupo padre (con `amount` caché) y excluye a los hijos (filtro `!r.parentId`).

**Problema:** si el grupo tiene TSLA $100 USD + AL30 $120.000 ARS, y el grupo padre tiene `amount = 100` (solo USD), el Balance muestra $100 USD para ese grupo. Los ARS quedan sin representar.

**Solución en este fix:** En `DashboardSheet`, para la tabla de activos, reemplazar el `amount` del grupo padre en el cálculo de totales por la suma real de sus hijos. Esto requiere que `allRecords` (que ya incluye los hijos) sea usado para recalcular el valor del grupo.

---

## 7. Archivos a crear/modificar

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `components/group-value-display.tsx` | Componente React reutilizable para display de valor de grupo |
| `lib/finance.ts` | Agregar `computeGroupValue()` (función pura) + tipo `GroupValueResult` |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `components/activos/asset-info-section.tsx` | "Valor actual" para grupos: usar `GroupValueDisplay` con `asset.children` |
| `components/activos/asset-list.tsx` | Reemplazar lógica inline por `GroupValueDisplay` con children de `all` |
| `components/dashboard-sheet.tsx` | `RecordAmount` para grupos: usar `GroupValueDisplay` con hijos de `allRecords`; `TotalsBlock` para activos: usar hijos directamente |

---

## 8. Estrategia de pruebas

### Casos requeridos

| Caso | Escenario | Comportamiento esperado |
|------|-----------|------------------------|
| 1 | Grupo: todos los activos en USD | Muestra suma total en USD |
| 2 | Grupo: USD + ARS, conversión OFF | Muestra "USD: $X / ARS: $Y" por separado |
| 3 | Grupo: USD + EUR + ARS, conversión OFF | Muestra 3 filas por divisa |
| 4 | Grupo: USD + ARS, conversión ON (base=USD) | Muestra total consolidado en USD |
| 5 | Grupo: USD + ARS, conversión OFF | Sin suma entre divisas incompatibles |
| 6 | Cambiar `convertCurrencies` en /configuracion | Valor del grupo en /activos, /activos/[id] y dashboard se actualiza en tiempo real sin recarga |
| 7 | Editar activo TSLA ($100 → $150), pertenece a grupo | Grupo actualiza de $100 a $150 (mismo en los 3 lugares) |
| 8 | Alta de activo dentro de grupo | Grupo suma el nuevo activo; display correcto |
| 9 | Remoción de activo del grupo | Grupo se actualiza sin el activo removido |
| 10 | Liquidar activo dentro de grupo (amount → 0) | Grupo se actualiza; el activo liquidado no contribuye al total |

### Verificaciones de consistencia

Para cada caso, verificar que el valor mostrado en:
- `/activos` (AssetList, fila del grupo)
- `/activos/[id]` (AssetInfoSection, campo "Valor actual")
- `/` dashboard (tabla Activos, fila del grupo)

... es **idéntico** (o al menos consistente con la misma lógica).

---

*Documento finalizado. Proceder a implementación.*
