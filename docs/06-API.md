# 06 — API

## Descripción general

El sistema no expone una API REST tradicional con múltiples endpoints. La comunicación entre cliente y servidor ocurre de dos formas:

1. **Server Actions de Next.js**: Funciones TypeScript marcadas con `"use server"` que se ejecutan en el servidor. Son invocadas directamente desde componentes React como si fueran funciones locales, pero se transmiten como POST requests internos de Next.js.

2. **Endpoint de NextAuth**: Una ruta de API convencional para el sistema de autenticación.

---

## Endpoint de NextAuth

### `GET|POST /api/auth/[...nextauth]`

Archivo: `app/api/auth/[...nextauth]/route.ts`

Maneja todas las operaciones del sistema de autenticación NextAuth. Las sub-rutas relevantes son:

| Sub-ruta | Método | Descripción |
|---|---|---|
| `/api/auth/signin` | GET / POST | Página y procesamiento de inicio de sesión |
| `/api/auth/signout` | GET / POST | Cierre de sesión |
| `/api/auth/session` | GET | Obtener sesión actual (JWT) |
| `/api/auth/csrf` | GET | Token CSRF para formularios |
| `/api/auth/providers` | GET | Lista de proveedores disponibles |
| `/api/auth/callback/credentials` | POST | Callback del proveedor de credenciales |

**Acceso**: Público (excluido del middleware de protección)

**Autenticación**: JWT almacenado en cookie `next-auth.session-token`

---

## Server Actions

Las Server Actions no son endpoints HTTP convencionales, pero se documentan aquí por su rol equivalente al de una API.

### `loadData()` — lib/actions.ts

**Descripción**: Carga el estado completo del usuario autenticado (registros, snapshots, movimientos de auditoría).

**Autenticación**: Requiere sesión válida (lanza `Error("No autorizado")` si no hay sesión).

**Retorna**:
```typescript
{
  records: FinancialRecord[]    // Registros financieros activos (sin deletedAt)
  snapshots: Snapshot[]         // Snapshots ordenados por fecha desc
  movements: Movement[]         // Logs de auditoría ordenados por fecha desc
}
```

---

### `registerUser()` — lib/actions.ts

**Descripción**: Registra un nuevo usuario.

**Parámetros**:
```typescript
{ name: string; email: string; password: string }
```

**Retorna**: `{ id: string }` — ID del usuario creado.

**Errores**: Lanza `"Ya existe una cuenta con ese email"` si el email ya existe.

**Efectos secundarios**: Reclama registros huérfanos (sin `userId`) asignándolos al nuevo usuario.

---

### `dbCreateRecord()` — lib/actions.ts

**Descripción**: Crea un registro financiero y su log de auditoría en una transacción atómica.

**Parámetros**:
```typescript
record: FinancialRecord
movement: Movement
```

---

### `dbEditRecord()` — lib/actions.ts

**Descripción**: Actualiza un registro financiero y crea su log de auditoría en una transacción atómica.

**Parámetros**:
```typescript
record: FinancialRecord  // estado nuevo
movement: Movement       // log del cambio
```

**Restricción**: Solo modifica registros que pertenecen al usuario autenticado (`WHERE id = ? AND userId = ?`).

---

### `dbDeleteRecord()` — lib/actions.ts

**Descripción**: Soft-delete de un registro financiero (establece `deletedAt`) y crea el log de auditoría.

**Parámetros**:
```typescript
record: FinancialRecord
movement: Movement
```

**Nota**: No elimina físicamente el registro.

---

### `dbTakeSnapshot()` — lib/actions.ts

**Descripción**: Crea un snapshot del estado actual.

**Parámetros**:
```typescript
snapshot: Snapshot   // incluye el array de records copiados
```

---

### `dbUpdateComment()` — lib/actions.ts

**Descripción**: Actualiza el comentario de un log de auditoría.

**Parámetros**:
```typescript
id: string       // ID del AuditLog
comment: string
```

**Restricción**: Solo actualiza logs del usuario autenticado.

---

### `loadAssets()` — lib/assets-actions.ts

**Descripción**: Carga todos los activos del usuario con sus movimientos financieros e hijos.

**Retorna**: `Asset[]` — Solo activos de nivel raíz (`parentId: null`), con hijos anidados.

---

### `loadAsset(id)` — lib/assets-actions.ts

**Descripción**: Carga un activo individual con todos sus detalles.

**Parámetros**: `id: string`

**Retorna**: `Asset | null`

---

### `createAsset()` — lib/assets-actions.ts

**Descripción**: Crea un nuevo activo y su movimiento DEPOSIT inicial.

**Parámetros**:
```typescript
{
  name: string
  assetType: AssetType
  ticker?: string
  amount: number
  currency: Currency
  currentQty?: number
  avgBuyPrice?: number
  description?: string
  parentId?: string
  metadata?: unknown
}
```

**Retorna**: `string` — ID del activo creado.

---

### `updateAsset()` — lib/assets-actions.ts

**Descripción**: Actualiza campos del activo (actualización parcial).

**Parámetros**:
```typescript
id: string
data: {
  name?: string
  amount?: number
  currency?: Currency
  ticker?: string
  currentQty?: number
  avgBuyPrice?: number
  description?: string
  metadata?: unknown
}
```

---

### `deleteAsset()` — lib/assets-actions.ts

**Descripción**: Soft-delete de un activo.

**Parámetros**: `id: string`

---

### `addMovement()` — lib/assets-actions.ts

**Descripción**: Registra un movimiento financiero sobre un activo.

**Parámetros**:
```typescript
{
  recordId: string
  movementType: MovementType   // BUY | SELL | DIVIDEND | FEE | COLLECT | ADJUSTMENT | EXTRACT | DEPOSIT
  amount: number
  quantity?: number
  unitPrice?: number
  currency: Currency
  exchangeRate?: number
  description?: string
  operationDate?: Date
  metadata?: unknown
}
```

**Retorna**: `string` — ID del movimiento creado.

---

### `updateMovement()` — lib/assets-actions.ts

**Descripción**: Actualiza un movimiento financiero.

**Parámetros**: `id: string` + campos opcionales (amount, quantity, unitPrice, description, operationDate, metadata).

---

### `deleteMovement()` — lib/assets-actions.ts

**Descripción**: Elimina un movimiento financiero (hard delete).

**Parámetros**: `id: string`

---

### `collectDividend()` — lib/assets-actions.ts

**Descripción**: Registra el cobro de un dividendo: crea ingreso en el dashboard y actualiza metadata del activo.

**Parámetros**:
```typescript
assetId: string
dividendId: string
actualGain: number
currency: Currency
assetName: string
currentMetadata: unknown
```

**Retorna**: `string` — ID del ingreso creado.

---

### `collectFixedTerm()` — lib/assets-actions.ts

**Descripción**: Cobra un plazo fijo: crea ingreso y elimina el activo (soft delete).

**Parámetros**:
```typescript
assetId: string
collectedAmount: number
currency: Currency
assetName: string
```

**Retorna**: `string` — ID del ingreso creado.

---

### `createAdjustmentMovement()` — lib/assets-actions.ts

**Descripción**: Registra un ajuste manual de valor como movimiento ADJUSTMENT.

**Parámetros**:
```typescript
recordId: string
difference: number
currency: Currency
description?: string
```

---

### `updateTracking()` — lib/assets-actions.ts

**Descripción**: Actualiza la tabla de seguimiento configurable de un activo (guardada dentro de `metadata.tracking`).

**Parámetros**:
```typescript
assetId: string
tracking: TrackingConfig
```

---

### `groupAssets()` — lib/assets-actions.ts

**Descripción**: Asigna un `parentId` a múltiples activos, agrupándolos bajo un padre.

**Parámetros**:
```typescript
parentId: string
childIds: string[]
```

---

## API externa consumida

### `GET https://open.er-api.com/v6/latest/{base}`

Consumida desde: `components/settings-store.tsx` → `fetchExchangeRates()`

**Descripción**: Obtiene tasas de cambio relativas a una moneda base.

**Autenticación**: Sin autenticación (API pública gratuita).

**Respuesta**:
```json
{
  "result": "success",
  "rates": { "USD": 1, "EUR": 0.92, ... }
}
```

**Manejo de errores**: Los errores se capturan silenciosamente; el sistema mantiene las tasas anteriores.
