# Cambios: Grupos, Liquidación y Egreso de Activos

**Versión:** 1.0 | **Fecha:** 2026-06-20 | **Estado:** Pre-implementación

---

## 1. Análisis de la implementación actual

### 1.1 Eliminación desde /activos

El flujo actual en `/activos` no distingue si el activo tiene balance > 0 o = 0:

```
handleDelete(record, comment) → deleteRecord(record)  [en FinanceProvider]
                                      ↓
                            dbDeleteRecord(id, userId)  [en lib/actions.ts]
                                      ↓
                    prisma.record.update({ deletedAt: new Date() })  // soft-delete
```

**Problema:** Un activo con $1.000 USD puede eliminarse de la vista sin dejar rastro de a dónde fue el dinero. No se crea movimiento, ni ingreso, ni audit trail financiero.

**Popup actual:** `ConfirmWithCommentDialog` con título "Eliminar activo" — un solo flujo para todos los casos.

### 1.2 Valor de grupos

```
createGroup(name, childIds, currency)
  → totalAmount = SUM(children.amount)  [calculado UNA VEZ]
  → prisma.record.create({ amount: totalAmount, assetType: "GROUP" })
```

El `amount` del grupo padre se calcula una sola vez al momento de creación. No existe ninguna función `recalcularGrupo()`. Ninguna de las operaciones que modifica hijos (`removeFromGroup`, `assignToGroup`, `updateAsset`, `zeroOutAsset`) toca el `amount` del grupo padre.

**Consecuencia:** El valor mostrado en el grupo es siempre el valor de creación, congelado en el tiempo.

### 1.3 Grupos con múltiples divisas

`createGroup()` recibe un solo parámetro `currency` (la divisa del primer hijo seleccionado). Los hijos pueden tener divisas distintas. El grupo padre almacena un único `amount` en una única `currency`. No hay sumatorias por divisa, ni conversión, ni display de breakdown.

**Consecuencia:** Un grupo con TSLA (USD) + BONO AL30 (ARS) muestra un monto incorrecto en la divisa del primero seleccionado.

### 1.4 Dashboard — tipos de movimiento

```ts
export type DashboardMovementType = "ADJUSTMENT" | "DEPOSIT"
// Falta: "EXTRACT"
```

El popup "Cambiar valor de activo" ofrece: Ajuste | Depósito. No existe la opción Egreso/EXTRACT. El server action `zeroOutAsset()` crea movimientos EXTRACT pero no hay forma de crear un EXTRACT parcial desde el dashboard.

### 1.5 Trazabilidad movimiento↔ingreso/gasto

Patrón ya establecido para dividendos:
```ts
interface DividendEntry {
  ingresoRecordId?: string  // FK al ingreso creado en DB
}
```

Para movimientos de activos (`FinancialMovement`), existe el campo `metadata Json?`. La estructura de cross-reference no está formalizada pero el campo existe.

---

## 2. Entidades afectadas

| Entidad | Tipo | Campo afectado | Cambio requerido |
|---------|------|----------------|-----------------|
| `Record` (activo) | DB | `deletedAt`, `amount` | Nuevo flujo de eliminación física |
| `Record` (ingreso) | DB | `name`, `amount`, `currency` | Creación desde liquidación/egreso |
| `FinancialMovement` | DB | `movementType`, `metadata` | Nuevo tipo EXTRACT desde dashboard; cross-ref metadata |
| `AuditLog` | DB | `action`, `detail` | Nuevo registro "liquidado" |
| `FinancialRecord` | Tipo TS | — | Sin cambio |
| `DashboardMovementType` | Tipo TS | — | Agregar `"EXTRACT"` |

---

## 3. Tablas afectadas (Prisma/PostgreSQL)

| Tabla | Operaciones nuevas |
|-------|-------------------|
| `records` | DELETE físico (hijos de `financial_movements` primero), UPDATE `amount` para recálculo de grupos |
| `financial_movements` | CREATE EXTRACT parcial desde dashboard con `metadata.relatedIngresoId`; DELETE en cascada antes de eliminar record |
| `movements` (audit log) | CREATE entrada "liquidado" |

**Sin migraciones de schema necesarias.** Todos los cambios caben en los campos existentes:
- `metadata Json?` en `FinancialMovement` para cross-references
- `deletedAt` ya existe en `Record`
- No se agrega ninguna columna nueva

---

## 4. Componentes afectados

| Componente | Cambio |
|------------|--------|
| `lib/assets-actions.ts` | Nuevas funciones: `physicalDeleteAsset()`, `recalcularGrupo()`, `liquidarActivo()`, `createExtractFromDashboard()` |
| `lib/actions.ts` | Sin cambio |
| `components/activos/asset-list.tsx` | Dos popups distintos según balance: LiquidarDialog vs EliminarDialog |
| `app/(dashboard)/activos/page.tsx` | `handleDelete` → bifurcación por `record.amount > 0` |
| `components/dashboard-sheet.tsx` | `DashboardMovementType` + EXTRACT en selector + switch "Crear ingreso" |
| `components/activos/confirm-with-comment-dialog.tsx` | Sin cambio (reutilizable) |

---

## 5. Servicios afectados

- **`lib/assets-actions.ts`** (server actions): toda la lógica nueva vive aquí
- **`lib/actions.ts`** (audit log): `dbLogAction()` llamado con acción "liquidado"
- **`components/finance-store.tsx`**: `reload()` llamado después de cualquier operación que afecte grupos

---

## 6. Riesgos detectados

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|-----------|
| R1 | Eliminar físicamente un record con FK en `financial_movements` | CRÍTICO | Eliminar primero todos los `FinancialMovement` del record en la misma transacción; luego eliminar el record |
| R2 | Eliminar físicamente un record con FK en `audit_log` (`movements`) | CRÍTICO | Eliminar o desvincular (`recordId → null`) los AuditLog antes del delete físico |
| R3 | Recalcular grupo con hijos en divisas distintas y conversión desactivada | ALTO | Si `convertCurrencies=false`, usar la divisa mayoritaria o la divisa del grupo; documentar limitación |
| R4 | Race condition: dos usuarios editando hijos del mismo grupo simultáneamente | MEDIO | Aceptable para una app personal single-user; no requiere mitigación |
| R5 | Ingreso creado en liquidación no aparece en dashboard hasta `reload()` | BAJO | Llamar `reload()` en el contexto después de la operación |
| R6 | Group recalculation: `recalcularGrupo()` suma hijos sin el hijo que se acaba de eliminar | BAJO | Refetch de hijos directamente en la función; no confiar en estado React |
| R7 | Dashboard EXTRACT crea ingreso pero el activo no llega a 0 (egreso parcial) | INFO | El ingreso es por el monto del egreso, no por el total del activo — esto es correcto |
| R8 | `audit_log.recordId` tiene FK a `records` — si se elimina físicamente el record, la FK se rompe | ALTO | Antes del delete: `UPDATE movements SET record_id = NULL WHERE record_id = ?` |

---

## 7. Propuesta de implementación

### Cambio 1 — Eliminación desde /activos: dos casos

#### Caso A: balance > 0 → "Liquidar activo"

**Flujo:**
1. Usuario hace click en ícono de papelera de un activo con `amount > 0`
2. Aparece popup "Liquidar activo" con:
   - Descripción: `"${nombre}" tiene un balance de ${formatAmount(amount, currency)}. Al liquidar, el balance pasará a $0.`
   - Checkbox "Crear ingreso asociado" — **activado por defecto**
   - Campo de comentario opcional
3. Al confirmar → `liquidarActivo(recordId, amount, currency, assetName, comment, createIngreso)`

**`liquidarActivo()` (nueva función en `lib/assets-actions.ts`):**
```
TRANSACTION {
  1. UPDATE records SET amount = 0 WHERE id = recordId
  2. CREATE financial_movements { movementType: "EXTRACT", amount: previousAmount, metadata: { relatedIngresoId? } }
  3. IF createIngreso:
       CREATE records { type: "ingreso", name: "Liquidación de ${assetName}", amount: previousAmount }
       UPDATE financial_movements.metadata.relatedIngresoId = ingresoId
  4. IF parentId: recalcularGrupo(parentId)
  5. LOG audit: action="liquidado", detail="Activo liquidado, balance puesto en 0"
}
```

**Trazabilidad:** `FinancialMovement.metadata = { relatedIngresoId: string }` (mismo patrón que `DividendEntry.ingresoRecordId`)

**Diferencia con `zeroOutAsset()` existente:** `liquidarActivo()` es idéntico en esencia pero agrega: (a) recálculo del grupo padre, (b) metadata con `relatedIngresoId` en el movimiento. Se puede refactorizar `zeroOutAsset()` para que llame a la lógica común, o directamente reemplazarlo.

#### Caso B: balance = 0 → "Eliminar activo"

**Flujo:**
1. Usuario hace click en papelera de un activo con `amount === 0`
2. Aparece popup "Eliminar activo" con:
   - Descripción: `"${nombre}" tiene balance $0. ¿Eliminar definitivamente?`
   - Sin opciones adicionales — eliminación directa
3. Al confirmar → `physicalDeleteAsset(recordId)`

**`physicalDeleteAsset()` (nueva función en `lib/assets-actions.ts`):**
```
TRANSACTION {
  1. UPDATE movements SET record_id = NULL WHERE record_id = recordId  // desvincula audit log
  2. DELETE financial_movements WHERE record_id = recordId
  3. DELETE records WHERE id = recordId AND amount = 0  // guard: solo si sigue en 0
  4. IF parentId: recalcularGrupo(parentId)
}
```

**Guard de seguridad:** El DELETE incluye `AND amount = 0` para evitar que una race condition elimine un activo que volvió a tener balance.

---

### Cambio 2 — Cálculo correcto de grupos con múltiples divisas

#### Con conversión activa (`convertCurrencies = true`)

**Flujo actual de `recalcularGrupo()`:**
```
1. Obtener todos los hijos con deletedAt = null
2. Para cada hijo: convertAmount(child.amount, child.currency, group.currency, exchangeRates)
3. total = SUM(montos convertidos)
4. UPDATE records SET amount = total WHERE id = groupId
```

**Display:** El grupo muestra el monto total en la divisa del grupo (como hoy, pero actualizado).

#### Sin conversión (`convertCurrencies = false`)

**Problema:** Sumar USD + ARS sin tasa de cambio no tiene sentido financiero.

**Propuesta de display en la lista de activos (`AssetList`):**

En lugar de mostrar el monto del grupo padre (que puede estar desactualizado o ser incorrecto), mostrar un resumen por divisa:

```
Portafolio USA + AR     GRUPO
  ↳ USD: $1.230,00                    [hijos USD]
  ↳ ARS: $450.000,00                  [hijos ARS]
```

**Implementación:**
- `recalcularGrupo()` con conversión desactivada: almacena en `metadata.currencyBreakdown: Record<Currency, number>` el total por divisa
- `AssetList` cuando el registro es GROUP y `!convertCurrencies`: renderiza `metadata.currencyBreakdown` en lugar de `amount`
- El `amount` del grupo se establece en 0 (o en la divisa del grupo si todos los hijos tienen la misma divisa)

---

### Cambio 3 — Recalcular grupo al quitar activos

**Trigger:** `removeFromGroup(assetId)` en `lib/assets-actions.ts`

**Cambio:** Después de `UPDATE records SET parentId = null`, obtener el `parentId` del hijo antes de quitarlo y llamar a `recalcularGrupo(parentId)`.

```ts
export async function removeFromGroup(assetId: string): Promise<void> {
  const userId = await getUserId()
  const child = await prisma.record.findFirst({ where: { id: assetId, userId }, select: { parentId: true } })
  await prisma.record.update({ where: { id: assetId, userId }, data: { parentId: null } })
  if (child?.parentId) await recalcularGrupo(child.parentId, userId)
}
```

---

### Cambio 4 — Recalcular grupo al editar activos

**Trigger:** `updateAsset(id, { amount })` cuando el activo tiene un `parentId`

**Cambio:** En `updateAsset()`, si se actualiza `amount`:
1. Obtener `parentId` del activo antes del update
2. Después del update, si hay `parentId` → `recalcularGrupo(parentId, userId)`

```ts
export async function updateAsset(id: string, data: { amount?: number, ... }): Promise<void> {
  const userId = await getUserId()
  let parentId: string | null = null
  if (data.amount !== undefined) {
    const current = await prisma.record.findFirst({ where: { id, userId }, select: { parentId: true } })
    parentId = current?.parentId ?? null
  }
  await prisma.record.update({ where: { id, userId }, data: { ... } })
  if (parentId && data.amount !== undefined) await recalcularGrupo(parentId, userId)
}
```

---

### Cambio 5 — Recalcular grupo al liquidar/eliminar activos

Cubierto dentro de `liquidarActivo()` y `physicalDeleteAsset()` (ver Cambio 1).

La función `recalcularGrupo()` siempre refetch los hijos desde DB (no usa estado React), por lo que el hijo que se acaba de poner en 0 ya estará excluido o en 0 antes del recálculo.

---

### Cambio 6 — Nuevo tipo "Egreso" en dashboard

**Cambio en `DashboardMovementType`:**
```ts
// Antes:
export type DashboardMovementType = "ADJUSTMENT" | "DEPOSIT"

// Después:
export type DashboardMovementType = "ADJUSTMENT" | "DEPOSIT" | "EXTRACT"
```

**UI en popup "Cambiar valor de activo":**
```
Tipo de movimiento: [Depósito ▾ | Egreso | Ajuste]

Si Egreso seleccionado:
  [ ] Crear ingreso asociado          ← nuevo switch
      Si activado: ingreso "Venta de [Nombre del Activo]" por monto del egreso

Comentario: [____________________]
```

**`createExtractFromDashboard()` (nueva función en `lib/assets-actions.ts`):**
```
PARAMS: recordId, previousAmount, newAmount, currency, assetName, comment, createIngreso

egressAmount = previousAmount - newAmount

TRANSACTION {
  1. UPDATE records SET amount = newAmount WHERE id = recordId
  2. CREATE financial_movements {
       movementType: "EXTRACT",
       amount: egressAmount,
       description: comment,
       metadata: { relatedIngresoId? }
     }
  3. IF createIngreso:
       CREATE records { type: "ingreso", name: "Venta de ${assetName}", amount: egressAmount }
       UPDATE movement.metadata.relatedIngresoId = ingresoId
  4. IF parentId: recalcularGrupo(parentId)
}
```

**Manejo en `dashboard-sheet.tsx`:**
- `onEditAmountWithComment` recibe `movementType: DashboardMovementType` + `createIngreso: boolean`
- La firma actual ya tiene `createGasto: boolean`; agregar `createIngreso: boolean` al tipo
- Cuando `movementType === "EXTRACT"`: mostrar switch "Crear ingreso asociado"; ocultar switch "Crear gasto asociado"
- Cuando `movementType === "DEPOSIT"`: mostrar switch "Crear gasto asociado" (comportamiento actual)

---

### `recalcularGrupo()` — función núcleo compartida

```ts
async function recalcularGrupo(groupId: string, userId: string): Promise<void> {
  const children = await prisma.record.findMany({
    where: { parentId: groupId, userId, deletedAt: null },
    select: { amount: true, currency: true },
  })
  
  // Breakdown por divisa
  const breakdown: Record<string, number> = {}
  for (const child of children) {
    const cur = child.currency
    const amt = typeof child.amount === "number" ? child.amount : child.amount.toNumber()
    breakdown[cur] = (breakdown[cur] ?? 0) + amt
  }
  
  // Total: suma todos los montos (en la divisa del grupo padre se necesita saber)
  // Para simplificar, se almacena el breakdown y el amount = total en la divisa del grupo
  const group = await prisma.record.findFirst({ where: { id: groupId, userId }, select: { currency: true } })
  const groupCurrency = group?.currency ?? "USD"
  const total = children.reduce((s, c) => {
    const amt = typeof c.amount === "number" ? c.amount : c.amount.toNumber()
    // Si mismo currency que el grupo: suma directa
    if (c.currency === groupCurrency) return s + amt
    // Si distinta: conservar el breakdown pero no convertir (conversión real solo en client-side)
    return s
  }, 0)
  
  await prisma.record.update({
    where: { id: groupId, userId },
    data: {
      amount: total,
      // metadata update: guardar breakdown para display multi-divisa
    },
  })
}
```

**Nota:** La conversión de divisas real usa las tasas de `localStorage` que solo están disponibles en el cliente. `recalcularGrupo()` en servidor solo puede hacer sumas directas por divisa igual. El display convertido sigue siendo responsabilidad del cliente (como hoy).

---

## 8. Flujo funcional de cada cambio

### Flujo A — Liquidar activo desde /activos

```
Usuario: click papelera en activo con amount > 0
   ↓
AssetList.tsx: setPendingLiquidate(record)
   ↓
LiquidarActivoDialog: muestra balance, checkbox "Crear ingreso" (checked), comentario
   ↓
Usuario confirma
   ↓
page.tsx: handleLiquidate(record, comment, createIngreso)
   ↓
liquidarActivo(recordId, amount, currency, name, comment, createIngreso)  [Server Action]
   ├─ amount = 0 en DB
   ├─ FinancialMovement EXTRACT creado
   ├─ Si createIngreso: ingreso "Liquidación de ${name}" creado, FK en metadata del movimiento
   ├─ Si parentId: recalcularGrupo(parentId)
   └─ AuditLog "liquidado"
   ↓
reload() + router.refresh()
```

### Flujo B — Eliminar activo desde /activos (balance 0)

```
Usuario: click papelera en activo con amount === 0
   ↓
AssetList.tsx: setPendingDelete(record)
   ↓
EliminarActivoDialog: "¿Eliminar definitivamente?" sin opciones extra
   ↓
Usuario confirma
   ↓
page.tsx: handlePhysicalDelete(record)
   ↓
physicalDeleteAsset(recordId)  [Server Action]
   ├─ UPDATE movements SET record_id = NULL (desvincula audit)
   ├─ DELETE financial_movements WHERE record_id = recordId
   ├─ DELETE records WHERE id = recordId AND amount = 0
   └─ Si parentId: recalcularGrupo(parentId)
   ↓
reload() + router.refresh()
```

### Flujo C — Recálculo automático de grupo

```
Cualquier operación que modifica amount de un hijo:
  updateAsset(id, { amount }) → SI parentId → recalcularGrupo(parentId)
  removeFromGroup(assetId)    → obtiene parentId → recalcularGrupo(parentId)
  liquidarActivo(recordId)    → SI parentId → recalcularGrupo(parentId)
  physicalDeleteAsset(id)     → SI parentId → recalcularGrupo(parentId)
   ↓
recalcularGrupo(groupId):
  SUM(children.amount por divisa)
  UPDATE records.amount = total (misma divisa que grupo)
  UPDATE records.metadata.currencyBreakdown = { USD: X, ARS: Y, ... }
```

### Flujo D — Egreso desde dashboard

```
Usuario: edita valor de activo en dashboard, baja el monto
   ↓
SectionTable.tsx: amountChanged=true → setPendingEdit({ record, previous })
   ↓
EditDialog: selector "Depósito | Egreso | Ajuste"
  Si Egreso: muestra switch "Crear ingreso asociado"
   ↓
Usuario confirma con movementType="EXTRACT", createIngreso=true/false
   ↓
page.tsx: onEditAmountWithComment(record, previous, comment, "EXTRACT", createGasto=false, createIngreso=true)
   ↓
createExtractFromDashboard(recordId, previous.amount, record.amount, currency, name, comment, createIngreso)
   ├─ UPDATE records.amount = newAmount
   ├─ CREATE FinancialMovement { movementType: "EXTRACT", amount: diff }
   ├─ Si createIngreso: CREATE ingreso "Venta de ${name}", metadata FK en movimiento
   └─ Si parentId: recalcularGrupo(parentId)
   ↓
reload()
```

---

## 9. Impacto en capas del sistema

### Dashboard (`/`)
- Nuevo tipo EXTRACT en `DashboardMovementType`
- `onEditAmountWithComment` firma: agregar `createIngreso: boolean`
- Nuevo switch condicional según movementType
- Grupos recalculados automáticamente → valores siempre correctos

### /activos
- Dos popups distintos en `AssetList` según balance
- `handleDelete` en `page.tsx` bifurca: `amount > 0` → liquidar, `amount === 0` → eliminar físico
- Grupos se recalculan al quitar hijos o editar valores

### Grupos
- `amount` siempre actualizado tras cualquier cambio en hijos
- `metadata.currencyBreakdown` para display multi-divisa correcto
- `AssetList` usa breakdown para renderizar totales por divisa cuando `convertCurrencies=false`

### /movimientos (Audit Log)
- Nueva acción `"liquidado"` para activos liquidados desde /activos
- Los registros existentes no se modifican

### Ingresos
- Se crean con nombre descriptivo: `"Liquidación de ${name}"` o `"Venta de ${name}"`
- Trazabilidad: el `FinancialMovement.metadata.relatedIngresoId` apunta al ingreso creado
- El ingreso aparece en el dashboard bajo "Ingresos" tras `reload()`

---

## 10. Migraciones necesarias

**No se requieren migraciones de schema Prisma.**

Todos los cambios usan campos existentes:
- `deletedAt DateTime?` — ya existe en `records`
- `metadata Json?` — ya existe en `records` y `financial_movements`
- No se agrega ninguna columna nueva

**Datos existentes:** No requieren transformación. Los grupos existentes tienen `amount` desactualizado; se actualizará la próxima vez que se modifique cualquier hijo.

---

## 11. Estrategia de pruebas

### Escenario 1: Liquidar activo con balance > 0

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a /activos, activo TSLA con $1.000 USD | Ícono papelera visible |
| 2 | Click papelera | Popup "Liquidar activo" con checkbox "Crear ingreso" marcado |
| 3 | Confirmar con checkbox marcado | amount=0, movimiento EXTRACT creado, ingreso "Liquidación de TSLA" $1.000 USD |
| 4 | Ir a dashboard | Ingreso visible en tabla Ingresos |
| 5 | Ir a /activos/[id] → Movimientos | Movimiento EXTRACT visible |
| 6 | Confirmar sin checkbox | amount=0, EXTRACT creado, NO ingreso |

### Escenario 2: Eliminar activo con balance = 0

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a /activos, activo con $0 | Ícono papelera visible |
| 2 | Click papelera | Popup "Eliminar activo" (sin opciones) |
| 3 | Confirmar | Record eliminado físicamente de DB; ya no aparece en /activos ni /movimientos |
| 4 | Verificar DB | `SELECT * FROM records WHERE id = ?` → 0 rows |
| 5 | Verificar FK | `SELECT * FROM financial_movements WHERE record_id = ?` → 0 rows |

### Escenario 3: Protección — activo con balance > 0 no puede eliminarse físicamente

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Balance > 0 | Solo aparece popup "Liquidar" (no "Eliminar") |
| 2 | `physicalDeleteAsset(id)` directo con amount > 0 | Guard `AND amount = 0` falla silenciosamente; record no eliminado |

### Escenario 4: Recálculo de grupo al editar hijo

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Grupo PORTAFOLIO ($1.500): TSLA ($1.000) + NVDA ($500) | Grupo muestra $1.500 |
| 2 | Editar TSLA a $1.200 desde dashboard | Grupo actualiza a $1.700 sin reload manual |
| 3 | /activos → ver grupo | $1.700 |

### Escenario 5: Recálculo de grupo al quitar hijo

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Grupo con TSLA ($1.000) + NVDA ($500) = $1.500 | Grupo $1.500 |
| 2 | Quitar TSLA del grupo (Unlink icon) | Grupo recalcula a $500 |
| 3 | TSLA pasa a standalone | TSLA visible en lista sin grupo |

### Escenario 6: Recálculo al liquidar hijo de grupo

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Grupo con TSLA ($1.000) + NVDA ($500) = $1.500 | Grupo $1.500 |
| 2 | Liquidar TSLA desde /activos | TSLA amount=0; grupo recalcula a $500 |

### Escenario 7: Grupo con múltiples divisas (conversión desactivada)

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Grupo con TSLA $1.000 USD + BONO $500.000 ARS, `convertCurrencies=false` | No muestra suma incorrecta |
| 2 | Lista de activos | Grupo muestra: "USD: $1.000,00 / ARS: $500.000,00" |
| 3 | Activar conversión | Grupo muestra total convertido a `baseCurrency` |

### Escenario 8: Egreso desde dashboard

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Editar TSLA desde $1.000 a $800 | Popup aparece con selector de tipo |
| 2 | Seleccionar "Egreso" | Switch "Crear ingreso asociado" aparece |
| 3 | Activar switch, confirmar | amount=$800; FinancialMovement EXTRACT $200; ingreso "Venta de TSLA" $200 |
| 4 | Verificar trazabilidad | `FinancialMovement.metadata.relatedIngresoId` = id del ingreso |

### Escenario 9: Integridad de FK al eliminar físicamente

| Paso | Verificación | Resultado esperado |
|------|-------------|-------------------|
| 1 | Activo tiene 5 movimientos y 3 audit logs | — |
| 2 | Liquidar activo (amount=0) | Movimientos intactos, audit logs intactos |
| 3 | Eliminar físicamente | `financial_movements` borrados; `movements.record_id` = NULL |
| 4 | Página /movimientos | Sin errores de FK; audit logs muestran nombre del activo |

### Tabla de regresión

| Feature preexistente | Verificar que sigue funcionando |
|---------------------|--------------------------------|
| Creación de activos | `AssetFormDialog` → nuevo activo aparece |
| Editar activo en dashboard (ADJUSTMENT/DEPOSIT) | Sigue funcionando; EXTRACT es adición, no reemplazo |
| `zeroOutAsset()` desde dashboard (delete con comentario) | Sin cambio |
| Grupos: crear, asignar, desagrupar | Sin regresión |
| Dividendos: cobrar genera ingreso | Sin cambio |
| Notificaciones: dividendo pendiente | Sin cambio |

---

## 12. Orden de implementación recomendado

1. **`recalcularGrupo()` interna** — función más pequeña, requerida por todo lo demás
2. **`liquidarActivo()`** — refactor de `zeroOutAsset()` + recálculo grupo
3. **`physicalDeleteAsset()`** — con cascada FK + guard
4. **UI en `AssetList`** — bifurcación de popup según balance
5. **`page.tsx` handlers** — conectar con nuevas server actions
6. **`recalcularGrupo()` en `updateAsset()`** — recálculo automático al editar
7. **`recalcularGrupo()` en `removeFromGroup()`** — recálculo al quitar hijo
8. **Display multi-divisa en `AssetList`** — breakdown por divisa en grupo
9. **`createExtractFromDashboard()`** — nuevo server action para EXTRACT parcial
10. **`DashboardMovementType` + UI** — agregar EXTRACT al selector + switch ingreso
11. **Conectar `onEditAmountWithComment`** en `page.tsx` con `createIngreso`
12. **`tsc --noEmit`** — verificación de tipos
13. **Build** — `npm run build`

---

## 13. Archivos a crear/modificar

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `lib/assets-actions.ts` | +`recalcularGrupo()`, +`liquidarActivo()`, +`physicalDeleteAsset()`, +`createExtractFromDashboard()`; modificar `updateAsset()`, `removeFromGroup()` |
| `components/activos/asset-list.tsx` | Bifurcación de popup: LiquidarDialog vs EliminarDialog; nuevas props |
| `app/(dashboard)/activos/page.tsx` | `handleDelete` → `handleLiquidate` + `handlePhysicalDelete` |
| `components/dashboard-sheet.tsx` | `DashboardMovementType` agrega `"EXTRACT"`; UI del popup de edición; firma de `onEditAmountWithComment` agrega `createIngreso` |
| `app/(dashboard)/page.tsx` | Actualizar `onEditAmountWithComment` para pasar `createIngreso` a `createExtractFromDashboard()` |

### Archivos nuevos

Ninguno — toda la lógica se integra en los archivos existentes.

---

*Documento finalizado. Proceder a implementación.*
