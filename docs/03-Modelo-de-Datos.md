# 03 — Modelo de Datos

## Fuente

Archivo: `prisma/schema.prisma`

Base de datos: PostgreSQL (Supabase)

---

## Diagrama de relaciones (texto)

```
users
  ├──< records (userId)
  ├──< snapshots (userId)
  ├──< financial_movements (userId)
  ├──< audit_logs / movements (userId)
  ├──< groups (userId)
  ├──< obligations (userId)
  ├──< obligation_payments (userId)
  ├──< journal_entries (userId)
  ├──< gasto_ingreso_links (userId)     ← NUEVO
  ├──< markers (userId)                  ← NUEVO
  └──< entity_markers (userId)           ← NUEVO

records
  ├──< records (parentId → self-referencia para grupos)
  ├──< records (previousVersionId → self-referencia para versionado)  ← NUEVO
  ├──< financial_movements (recordId)
  ├──< audit_logs (recordId)
  ├──< record_groups (recordId)
  ├──< gasto_ingreso_links (gastoId)     ← NUEVO
  └──< gasto_ingreso_links (ingresoId)   ← NUEVO

snapshots
  └──< snapshot_records (snapshotId)

groups
  └──< record_groups (groupId)

record_groups [tabla pivote]
  ├── recordId → records
  └── groupId  → groups

obligations
  ├──< obligation_rules (obligationId)
  ├──< obligation_installments (obligationId)
  └──< obligation_payments (obligationId)

markers
  └──< entity_markers (markerId)         ← NUEVO

gasto_ingreso_links [tabla pivote N:M]   ← NUEVO
  ├── gastoId   → records
  └── ingresoId → records

entity_markers [tabla de asignación]     ← NUEVO
  └── markerId → markers
```

---

## Tabla: `users`

Modelo Prisma: `User`

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | ID generado automáticamente |
| `name` | String | No | Nombre del usuario |
| `email` | String (UNIQUE) | No | Email, usado como identificador de login |
| `password_hash` | String | No | Hash bcrypt de la contraseña |
| `created_at` | DateTime | No | Fecha de creación (default: now()) |
| `updated_at` | DateTime | No | Fecha de última modificación (auto-update) |

**Índices**: `email` (unique)

---

## Tabla: `records`

Modelo Prisma: `Record`

Tabla polimórfica: alberga tanto registros financieros simples (ingresos, gastos, pasivos) como activos financieros complejos.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | String (PK) | No | UUID generado por el cliente |
| `type` | String | No | `"activo"` \| `"pasivo"` \| `"ingreso"` \| `"gasto"` |
| `name` | String | No | Nombre/descripción del registro |
| `amount` | Decimal | No | Monto en la moneda del registro |
| `currency` | String | No | Código de moneda: `USD`, `EUR`, `MXN`, `ARS`, `USDT` |
| `linked_to` | String? | Sí | ID de otro record al que está vinculado (ej: ingreso → activo) |
| `user_id` | String? | Sí | FK a `users.id`. Nullable para datos legados |
| `description` | String? | Sí | Descripción larga (usado principalmente en activos) |
| `operation_date` | DateTime? | Sí | Fecha de la operación (usado principalmente en activos) |
| `deleted_at` | DateTime? | Sí | Timestamp de soft delete (null = activo) |
| `asset_type` | String? | Sí | Tipo de activo: `STOCK`, `CRYPTO`, `FUTURES`, `OPTIONS`, `REBALANCE_BOT`, `TRADING_BOT`, `TRADING`, `FIXED_TERM`, `BOND` |
| `ticker` | String? | Sí | Código de cotización (ej: AAPL, BTCUSDT) |
| `current_quantity` | Decimal(18,8)? | Sí | Cantidad actual de unidades (acciones, crypto, etc.) |
| `avg_buy_price` | Decimal(18,4)? | Sí | Precio promedio de compra ponderado |
| `parent_id` | String? | Sí | FK auto-referencia a `records.id` para agrupación |
| `metadata` | Json? | Sí | Objeto JSON con datos tipo-específicos del activo (ver más abajo) |
| `created_at` | DateTime | No | Fecha de creación del registro en el sistema (default: now()) ← NUEVO |
| `effective_date` | DateTime? | Sí | Fecha efectiva del período (ej: inicio de "Salario Julio 2026") ← NUEVO |
| `previous_version_id` | String? | Sí | FK auto-referencia a `records.id` de la versión anterior ← NUEVO |

**Status values por tipo**:
- `activo` / `pasivo`: `ACTIVE` → soft-delete via `deletedAt`
- `ingreso` / `gasto`: `ACTIVE` | `PENDING` | `CANCELLED` | `HISTORICAL` | `ARCHIVED`
  - `HISTORICAL`: eliminado desde Dashboard o reemplazado por nueva versión
  - `ARCHIVED`: archivado manualmente desde /ingresos o /gastos

**Índices**:
- `(user_id)` — para filtrar por usuario
- `(user_id, type)` — para filtrar activos/pasivos/ingresos/gastos por usuario

**Relaciones**:
- `user` → `users` (N:1)
- `parent` → `records` (self, N:1) — padre del grupo
- `children` → `records[]` (self, 1:N) — hijos del grupo
- `financialMovements` → `financial_movements[]`
- `auditLogs` → `audit_logs[]`
- `groups` → `record_groups[]`

### Campo `metadata` por tipo de activo

El campo `metadata` es un JSON libre. Su estructura varía según `asset_type`:

**STOCK**:
```json
{
  "dividends": [
    {
      "id": "uuid",
      "month": "YYYY-MM",
      "percentage": 5.2,
      "estimatedGain": 100.0,
      "actualGain": 98.5,
      "ingresoRecordId": "uuid"
    }
  ]
}
```

**FIXED_TERM**:
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-07-01",
  "rate": 45.5,
  "collected": false,
  "ingresoRecordId": null
}
```

**BOND**:
```json
{
  "disbursements": [
    {
      "id": "uuid",
      "dueDate": "2024-06-01",
      "amount": 500.0,
      "currency": "USD",
      "collected": false
    }
  ]
}
```

**TRADING_BOT**:
```json
{
  "totalInvested": 10000.0,
  "totalGained": 3500.0,
  "totalLost": 800.0,
  "totalExtracted": 1200.0,
  "currency": "USDT"
}
```

**REBALANCE_BOT**:
```json
{
  "assets": [
    {
      "id": "uuid",
      "name": "Bitcoin",
      "ticker": "BTC",
      "invested": 5000.0,
      "currentPrice": 62000.0,
      "initialQty": 0.08,
      "currentQty": 0.075,
      "currency": "USD"
    }
  ]
}
```

**TRADING**:
```json
{
  "totalInvested": 5000.0,
  "totalObtained": 5800.0,
  "currency": "USD"
}
```

**FUTURES** (metadata a nivel de movimiento individual):
```json
{
  "positionType": "LONG"
}
```

**Nota**: El campo `metadata` también puede contener una clave `tracking` (tabla de seguimiento configurable):
```json
{
  "tracking": {
    "columns": [
      { "id": "uuid", "name": "Observación", "type": "text" }
    ],
    "rows": [
      { "id": "uuid", "cells": { "uuid": "valor" } }
    ]
  }
}
```

---

## Tabla: `snapshots`

Modelo Prisma: `Snapshot`

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | String (PK) | No | UUID generado por el cliente |
| `name` | String | No | Nombre del snapshot (ej: "Cierre Enero 2025") |
| `period` | String | No | Período en texto libre (ej: "01/01/2025 - 31/01/2025") |
| `created_at` | String | No | Fecha/hora de creación formateada en español (legado, no DateTime) |
| `user_id` | String? | Sí | FK a `users.id`. Nullable para datos legados |
| `start_date` | DateTime? | Sí | Fecha inicio del período (actualmente no utilizado en la UI) |
| `end_date` | DateTime? | Sí | Fecha fin del período (actualmente no utilizado en la UI) |
| `data` | Json? | Sí | Estado consolidado (campo para Fase 4, actualmente no utilizado) |

**Índices**: `(user_id)`

**Notas**:
- `created_at` es un `String` y no un `DateTime`, lo que es un dato legado. No puede ordenarse con funciones de fecha de PostgreSQL de forma nativa.
- Los campos `start_date`, `end_date`, y `data` existen en el schema pero no se usan en el código actual.

---

## Tabla: `snapshot_records`

Modelo Prisma: `SnapshotRecord`

Copia plana de los records en el momento del snapshot.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | String (PK) | No | UUID generado al crear el snapshot |
| `snapshot_id` | String | No | FK a `snapshots.id` (cascade delete) |
| `type` | String | No | Tipo de registro |
| `name` | String | No | Nombre del registro |
| `amount` | Decimal | No | Monto en la moneda |
| `currency` | String | No | Moneda |
| `linked_to` | String? | Sí | ID del registro vinculado |

**Índices**: `(snapshot_id)`

**Restricciones**: `ON DELETE CASCADE` desde `snapshots`

**Notas**: No incluye `assetType`, `parentId`, ni `metadata`. Es una vista congelada básica del Balance/Estado de Resultados.

---

## Tabla: `movements` (AuditLog)

Modelo Prisma: `AuditLog`

Log de auditoría de operaciones sobre records del dashboard.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | String (PK) | No | UUID generado por el cliente |
| `date` | String | No | Fecha/hora en español (ej: "19/06/2026, 14:30") |
| `action` | String | No | `"creado"` \| `"editado"` \| `"eliminado"` |
| `record_type` | String | No | Tipo del record afectado |
| `record_name` | String | No | Nombre del record afectado |
| `detail` | String | No | Descripción textual del cambio |
| `comment` | String | No | Comentario del usuario (default: `""`) |
| `user_id` | String? | Sí | FK a `users.id` |
| `record_id` | String? | Sí | FK a `records.id` |
| `created_at` | DateTime | No | Timestamp de inserción real (default: now()) |

**Índices**:
- `(user_id)` — por usuario
- `(user_id, created_at)` — para paginación y filtrado por fecha en `/historial`

**Notas**:
- `date` es String, no DateTime — es el campo legado formateado en español. Para ordenación y filtros de fecha se usa `created_at` (DateTime real).
- La tabla se llama `movements` en la DB pero `AuditLog` en Prisma, y `Movement` en el código TypeScript. Existe una ambigüedad de nomenclatura entre este log de auditoría y los `FinancialMovement` de activos.
- La página `/historial` usa `created_at` para ordenación y filtros de rango de fecha a través de `loadHistorial()` (Server Action con paginación server-side).

---

## Tabla: `financial_movements`

Modelo Prisma: `FinancialMovement`

Historial de operaciones financieras sobre activos (compras, ventas, dividendos, etc.).

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `user_id` | String | No | FK a `users.id` |
| `record_id` | String | No | FK a `records.id` |
| `movement_type` | String | No | `BUY` \| `SELL` \| `DIVIDEND` \| `FEE` \| `COLLECT` \| `ADJUSTMENT` \| `EXTRACT` \| `DEPOSIT` |
| `amount` | Decimal(18,4) | No | Monto de la operación |
| `quantity` | Decimal(18,8)? | Sí | Cantidad de unidades |
| `unit_price` | Decimal(18,4)? | Sí | Precio unitario |
| `currency` | String | No | Moneda de la operación |
| `exchange_rate` | Decimal(18,6)? | Sí | Tipo de cambio aplicado |
| `description` | String? | Sí | Descripción libre de la operación |
| `operation_date` | DateTime | No | Fecha de la operación (default: now()) |
| `created_at` | DateTime | No | Timestamp de inserción |
| `metadata` | Json? | Sí | Datos adicionales (ej: `positionType` para FUTURES) |

**Índices**:
- `(user_id, operation_date)` — para queries temporales por usuario
- `(record_id)` — para queries por activo

---

## Tabla: `groups`

Modelo Prisma: `Group`

Agrupación lógica de records (actualmente parece poco usada en la UI).

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | |
| `user_id` | String | No | FK a `users.id` |
| `name` | String | No | Nombre del grupo |
| `group_type` | String | No | `ASSET` \| `INCOME` \| `EXPENSE` \| `LIABILITY` |
| `created_at` | DateTime | No | |

---

## Tabla: `record_groups`

Modelo Prisma: `RecordGroup`

Tabla pivote entre `records` y `groups`.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `record_id` | String | No | FK a `records.id` (cascade delete) |
| `group_id` | String | No | FK a `groups.id` (cascade delete) |

**PK compuesta**: `(record_id, group_id)`

---

## Módulo: Obligaciones

Las obligaciones representan compromisos financieros periódicos (préstamos, cuotas, suscripciones, alquileres). El módulo está compuesto por cuatro tablas relacionadas.

### Tabla: `obligations`

Modelo Prisma: `Obligation`

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `user_id` | String | No | FK a `users.id` |
| `obligation_type` | String | No | `"RECURRING"` \| `"INSTALLMENT"` \| `"FIXED"` |
| `name` | String | No | Nombre de la obligación (ej: "Préstamo banco") |
| `description` | String? | Sí | Descripción opcional |
| `currency` | String | No | Moneda de la obligación |
| `amount` | Decimal(18,4) | No | Monto base |
| `status` | String | No | `"ACTIVE"` \| `"PAUSED"` \| `"COMPLETED"` \| `"CANCELLED"` (default: ACTIVE) |
| `next_due_date` | DateTime? | Sí | Próxima fecha de vencimiento |
| `created_at` | DateTime | No | Timestamp de creación (default: now()) |
| `metadata` | Json? | Sí | Datos adicionales tipo-específicos |

**Índices**:
- `(user_id, status)` — para filtrar obligaciones activas por usuario
- `(user_id, next_due_date)` — para ordenar por próximo vencimiento

---

### Tabla: `obligation_rules`

Modelo Prisma: `ObligationRule`

Reglas de recurrencia de una obligación periódica.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `obligation_id` | String | No | FK a `obligations.id` (cascade delete) |
| `name` | String | No | Nombre de la regla |
| `recurrence_type` | String | No | `"MONTHLY"` \| `"QUARTERLY"` \| `"SEMI_ANNUAL"` \| `"ANNUAL"` |
| `start_date` | DateTime | No | Fecha de inicio de la recurrencia |
| `expected_amount` | Decimal(18,4) | No | Monto esperado por cuota |
| `currency` | String | No | Moneda |
| `status` | String | No | `"ACTIVE"` \| `"PAUSED"` (default: ACTIVE) |
| `metadata` | Json? | Sí | Datos adicionales |

**Índices**: `(obligation_id)`

---

### Tabla: `obligation_installments`

Modelo Prisma: `ObligationInstallment`

Cuotas individuales generadas para una obligación de tipo INSTALLMENT.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `obligation_id` | String | No | FK a `obligations.id` (cascade delete) |
| `installment_number` | Int | No | Número de cuota (1, 2, 3...) |
| `due_date` | DateTime | No | Fecha de vencimiento de la cuota |
| `expected_amount` | Decimal(18,4) | No | Monto esperado |
| `status` | String | No | `"PENDING"` \| `"OVERDUE"` \| `"PAID"` \| `"REJECTED"` (default: PENDING) |
| `gasto_record_id` | String? | Sí | FK a `records.id` del gasto asociado al pago |

**Índices**:
- `(obligation_id)` — para cargar cuotas de una obligación
- `(due_date, status)` — para encontrar cuotas vencidas o próximas a vencer

---

### Tabla: `obligation_payments`

Modelo Prisma: `ObligationPayment`

Registro de pagos realizados contra una obligación.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `obligation_id` | String | No | FK a `obligations.id` (cascade delete) |
| `user_id` | String | No | FK a `users.id` |
| `rule_id` | String? | Sí | FK a `obligation_rules.id` (si aplica) |
| `payment_type` | String | No | `"PAYMENT"` \| `"INTEREST"` \| `"FEE"` |
| `expected_date` | DateTime? | Sí | Fecha esperada del pago |
| `expected_amount` | Decimal(18,4)? | Sí | Monto esperado |
| `currency` | String | No | Moneda del pago |
| `gasto_record_id` | String? | Sí | FK a `records.id` del gasto vinculado al pago |
| `status` | String | No | `"PENDING"` \| `"PAID"` \| `"REJECTED"` |
| `comment` | String? | Sí | Comentario opcional |
| `created_at` | DateTime | No | Timestamp de creación (default: now()) |

**Índices**:
- `(obligation_id)` — por obligación
- `(user_id, expected_date)` — para agenda de pagos por usuario
- `(rule_id)` — para ligar pagos a reglas de recurrencia

---

## Tabla: `journal_entries` (JournalEntry / Asiento Contable)

Modelo Prisma: `JournalEntry`

Libro contable de doble entrada. Cada evento financiero genera al menos un asiento que registra la cuenta debitada y la cuenta acreditada. Ver `docs/financial-domain-architecture.md` para la arquitectura completa.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por el servidor |
| `date` | DateTime | No | Fecha del asiento (default: now()) |
| `description` | String | No | Descripción del evento financiero |
| `currency` | String | No | Moneda del asiento |
| `amount` | Decimal(18,4) | No | Monto del asiento |
| `debit_account` | String | No | Cuenta debitada: `"activos"` \| `"pasivos"` \| `"ingresos"` \| `"gastos"` \| `"efectivo"` \| `"obligaciones"` |
| `credit_account` | String | No | Cuenta acreditada: mismo set |
| `source_entity_id` | String? | Sí | FK a `records.id` — entidad origen del asiento |
| `target_entity_id` | String? | Sí | FK a `records.id` — entidad destino del asiento |
| `reference` | String? | Sí | ID externo de referencia (obligationPaymentId, dividendId, etc.) |
| `notes` | String? | Sí | Observaciones opcionales del usuario |
| `user_id` | String | No | FK a `users.id` |

**Índices**:
- `(user_id)`
- `(user_id, date)` — para queries temporales por usuario

**Relaciones**:
- `user` → `users` (N:1)

**Notas**:
- La tabla coexiste con `AuditLog` y `FinancialMovement` — no las reemplaza.
- `AuditLog` es para auditoría de CRUD. `FinancialMovement` es para tracking operacional de activos. `JournalEntry` es el libro contable financiero.
- La cuenta `"efectivo"` es virtual — representa caja/banco del usuario sin un record real asociado.
- Solo registra operaciones desde la fecha de deploy. Ver estrategia de migración en `docs/financial-domain-architecture.md`.

---

---

## Tabla: `gasto_ingreso_links` ← NUEVA

Modelo Prisma: `GastoIngresoLink`

Relación N:M entre gastos e ingresos, con monto atribuido. Permite registrar que un gasto fue financiado parcialmente por uno o más ingresos.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `user_id` | String | No | FK a `users.id` |
| `gasto_id` | String | No | FK a `records.id` del gasto financiado |
| `ingreso_id` | String | No | FK a `records.id` del ingreso financiador |
| `attributed_amount` | Decimal(18,4) | No | Monto del ingreso atribuido a este gasto |
| `currency` | String | No | Moneda del monto atribuido |
| `created_at` | DateTime | No | Timestamp de creación (default: now()) |

**Restricciones**:
- `UNIQUE(gasto_id, ingreso_id)` — un par gasto/ingreso solo puede tener un link. Ajustar el monto implica actualizar `attributed_amount`.

**Índices**: `(user_id)`, `(gasto_id)`, `(ingreso_id)`

**Notas**: La suma de `attributed_amount` de todos los links de un gasto no necesita igualar `gasto.amount` (el resto puede venir de fuentes no registradas). La validación es blanda (alerta, no bloqueo).

---

## Tabla: `markers` ← NUEVA

Modelo Prisma: `Marker`

Marcadores visuales definidos por el usuario. Se usan para resaltar filas en el Dashboard, /activos, /gastos, /ingresos, /obligaciones.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `user_id` | String | No | FK a `users.id` |
| `name` | String | No | Nombre del marcador (ej: "Urgente", "Revisado") |
| `color` | String | No | Código de color hexadecimal (ej: "#EF4444") |
| `order` | Int | No | Orden en el selector (default: 0) |
| `created_at` | DateTime | No | Timestamp de creación (default: now()) |

**Índices**: `(user_id)`

---

## Tabla: `entity_markers` ← NUEVA

Modelo Prisma: `EntityMarker`

Asignación de un marcador a una entidad. Constraint `UNIQUE(entity_id, entity_type)` garantiza un marcador por entidad a la vez.

| Campo | Tipo DB | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID (PK) | No | Generado por la DB |
| `marker_id` | String | No | FK a `markers.id` (cascade delete) |
| `entity_id` | String | No | ID de la entidad marcada (record.id o obligation.id) |
| `entity_type` | String | No | `"RECORD"` \| `"OBLIGATION"` |
| `user_id` | String | No | FK a `users.id` |
| `created_at` | DateTime | No | Timestamp de creación (default: now()) |

**Restricciones**: `UNIQUE(entity_id, entity_type)` — un marcador a la vez por entidad.

**Índices**: `(user_id)`, `(entity_id, entity_type)`

**Notas**:
- `entity_id` es String (no FK tipada). Permite apuntar a `records` u `obligations` con el mismo modelo.
- Al eliminar un marcador, `ON DELETE CASCADE` elimina todos sus `EntityMarker`.
- Al hacer soft-delete de un record, el `EntityMarker` NO se elimina automáticamente (no hay FK). El marcador permanece en DB aunque el record esté HISTORICAL o con `deletedAt`.

---

## Consideraciones del modelo

1. **Tabla polimórfica `records`**: Una sola tabla alberga todos los tipos de registros (simples y complejos). Simplifica el esquema pero mezcla columnas que solo tienen sentido para activos (`ticker`, `current_quantity`, `avg_buy_price`, `metadata`) con registros simples (ingresos, gastos).

2. **Campos `String` donde debería ser `DateTime`**: Los campos `date` en `AuditLog` y `created_at` en `Snapshot` son strings formateados en español. Esto impide ordenar y filtrar por fecha eficientemente en la DB.

3. **FK `userId` nullable en `records`, `snapshots`, `AuditLog`**: Es un remanente de la migración inicial (antes de que existiera autenticación). Todos los nuevos registros tendrán `userId`.

4. **Sin constraints de unicidad sobre nombre de activos**: La validación de nombre único de activos es solo client-side.

5. **Tabla `Groups` y `RecordGroups`**: Presente en el schema pero la funcionalidad de agrupación en la UI usa directamente `parentId` en `records`, no estas tablas. `Groups`/`RecordGroups` parece ser una implementación alternativa o un vestigio no activo.
