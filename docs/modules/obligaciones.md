---
Versión: 2.0.0
Última actualización: 2026-06-30
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Obligaciones

## Objetivo

Gestionar las deudas y compromisos financieros periódicos del usuario: crear obligaciones con reglas de pago (cuotas fijas, variables, o monto esperado), registrar pagos realizados, y visualizar el estado de cada cuota.

**Ruta**: `/obligaciones` (lista), `/obligaciones/[id]` (detalle)
**Páginas**: `app/(dashboard)/obligaciones/page.tsx` y `app/(dashboard)/obligaciones/[id]/page.tsx`

---

## Entidades involucradas

| Entidad | Tabla DB | Rol |
|---------|----------|-----|
| `Obligation` | `obligations` | Obligación principal (deuda, préstamo, cuota) |
| `ObligationRule` | `obligation_rules` | Regla de pago: tipo y monto por cuota |
| `ObligationInstallment` | `obligation_installments` | Cuota individual generada por la regla |
| `ObligationPayment` | `obligation_payments` | Pago realizado contra una cuota |
| `Record` (type="gasto") | `records` | Gasto creado automáticamente al marcar pago |
| `EntityMarker` | `entity_markers` | Marcador visual por obligación |

---

## Features

### 1. Lista de obligaciones
- Vista de todas las obligaciones activas del usuario
- Por cada obligación: nombre, total adeudado, cuotas pagadas/total, próxima cuota
- Marcador visual por fila (MarkerPicker)
- Click en fila → `/obligaciones/{id}`

### 2. Crear obligación
- `ObligationFormDialog` desde el dashboard o la lista
- Campos: nombre, descripción, regla de pago
- Regla: `FIXED` (monto fijo) | `VARIABLE` (monto por cuota) | `EXPECTED` (monto estimado)
- Todos los inputs numéricos usan `NumericInput` (soporte `=expr`)

### 3. Detalle `/obligaciones/[id]`
- Nombre y descripción de la obligación
- Lista de cuotas generadas (`ObligationInstallment`) con estado: pendiente/pagada/vencida
- Por cuota pendiente: botón "Registrar pago" → crea `ObligationPayment` + gasto tipo `"gasto"` con `status = "PENDING"` en el dashboard

### 4. Cuotas en el Dashboard
- Las cuotas pendientes aparecen como filas extra en la sección de Pasivos del Dashboard
- Tienen ícono Eye → `/obligaciones/{id}`
- Los gastos asociados (`status = "PENDING"`) aparecen en la sección de Gastos cuando se convierten en activos (al confirmar el pago)

### 5. Marcadores visuales
- MarkerPicker por obligación en la lista
- `entityType = "OBLIGATION"`

---

## Reglas de negocio

- **RB-OB01**: Los gastos creados para cuotas de obligaciones tienen `status = "PENDING"`. No se editan ni archivan manualmente desde `/gastos`.
- **RB-OB02**: Los gastos de cuotas tienen `status = "CANCELLED"` si la cuota es cancelada.
- **RB-OB03**: Los marcadores de obligaciones usan `entityType = "OBLIGATION"`, a diferencia de los registros que usan `entityType = "RECORD"`.
- **RB-OB04**: `ObligationsProvider` es independiente de `FinanceProvider` para mantener el dominio de obligaciones separado.

---

## Flujo funcional

```mermaid
flowchart TD
    A[/obligaciones] --> B[Lista de obligaciones + marcadores]
    B --> C[Click fila]
    C --> D[/obligaciones/id]
    D --> E[Lista de cuotas]
    E --> F{Cuota pendiente}
    F --> G[Click Registrar pago]
    G --> H[createObligationPayment]
    H --> I[Crea Record type=gasto status=ACTIVE]
    I --> J[Aparece en dashboard como gasto ACTIVE]
```
