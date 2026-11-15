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
- Las obligaciones activas aparecen como filas extra en la sección Obligaciones del Dashboard (ícono Eye → `/obligaciones/{id}`)
- Las cuotas del período entran a Gastos con el corte como **Por revisar**, con botón **Pagar** y monto editable (ver `docs/modules/dashboard.md` §4b). Rechazar una cuota cancela su gasto.

### 5. Marcadores visuales
- MarkerPicker por obligación en la lista
- `entityType = "OBLIGATION"`

### 6. Agrupar y desagrupar (v2.8.0)
- Modo **Agrupar** en `/obligaciones`, igual que en activos: seleccionar ≥ 2 → "Crear nuevo grupo", o ≥ 1 → "Agregar a: {grupo}".
- El grupo es **solo visual** (`Obligation.groupId` → `Group` con `groupType = "LIABILITY"`): no cambia montos, cuotas ni pagos. Fila colapsable con el valor sumado, en la lista y en el dashboard.
- "Quitar del grupo" por fila y "Desagrupar" por grupo; un grupo que queda vacío se borra.
- Actions: `createObligationGroup`, `assignObligationsToGroup`, `removeObligationFromGroup`, `ungroupObligations` en `lib/obligation-actions.ts`.

### 6b. Editar la fecha de inicio y reglas semanales (v2.9.0)
- Lápiz en cada regla recurrente y en "Primera cuota" (obligaciones por cuotas). Recalcula los pagos futuros: regenera los pagos cuyo gasto todavía es `PENDING`; los que un corte ya trajo al dashboard o ya se pagaron no se tocan. En cuotas, la cuota N pasa a primera + N-1 meses.
- Recurrencia **Semanal** (`ObligationRecurrence = RecurrenceType | "WEEKLY"`): pago cada 7 días, 52 por año en la proyección anual. Solo obligaciones; las reglas de ingreso no la tienen.
- Varios pagos de la misma obligación en un período entran al corte con la fecha en el nombre (`Clases (5/10)`).

### 7. Gráficos (v2.8.0)
- **Peso mensual**: lo que vence cada mes (pagos hechos hacia atrás, cuotas/pagos programados hacia adelante), con el promedio de los 6 meses anteriores vs los 6 próximos para ver si las obligaciones suben o bajan. Las obligaciones fijas sin cronograma no tienen fechas y no entran.
- **Las más pesadas**: barras con el valor de cada obligación activa (costo anual si es recurrente, saldo si es en cuotas o fija). Ver `docs/modules/graficos.md`.

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
