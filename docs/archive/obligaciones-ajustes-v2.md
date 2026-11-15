# Obligaciones — Ajustes v2

## 1. Análisis actual

### Arquitectura del módulo

El módulo de Obligaciones tiene una arquitectura limpia y sin duplicación:

```
lib/obligations.ts          → tipos TypeScript + helpers puros
lib/obligation-actions.ts   → Server Actions (CRUD, pagos, estado)
components/obligations-store.tsx → Context + hook useObligations()
components/obligations/
  obligation-form-dialog.tsx    → diálogo multi-paso de creación
  obligation-detail.tsx         → vista de detalle (client component)
  obligations-dashboard-section.tsx → [obsoleto: reemplazado por extraRows]
app/(dashboard)/obligaciones/page.tsx   → lista con filtros
app/(dashboard)/obligaciones/[id]/page.tsx → página de detalle (server)
```

### Entidades involucradas

| Entidad DB | Tabla Prisma | Relación |
|---|---|---|
| `Obligation` | `obligations` | raíz |
| `ObligationRule` | `obligation_rules` | 1:N desde Obligation (solo RECURRING) |
| `ObligationInstallment` | `obligation_installments` | 1:N desde Obligation (solo INSTALLMENT) |
| `ObligationPayment` | `obligation_payments` | 1:N desde Obligation (historial de pagos) |

### Estados válidos

```
ACTIVE    → Activa, genera notificaciones, permite pagos automáticos/manuales
PAUSED    → Pausada, conserva datos, SIN notificaciones ni gastos automáticos
COMPLETED → Finalizada positivamente (todas las cuotas pagadas)
CANCELLED → Cancelada, cuotas pendientes rechazadas
```

### Integración con otros módulos

- **Dashboard (`/`)**: Las obligaciones ACTIVE/PAUSED aparecen como `extraRows` en la tabla "Obligaciones" (columnas: Descripción + Valor + link). El botón `+` de esa tabla actualmente crea un `pasivo` FinancialRecord (incorrecto).
- **Notificaciones**: Solo genera notificaciones para `status === "ACTIVE"`. Las PAUSED son ignoradas.
- **Gastos**: Al aceptar un pago/cuota, se crea un `Record{type:"gasto"}` vinculado vía `gastoRecordId`.

---

## 2. Inconsistencias detectadas

### A. Botón `+` en Dashboard crea entidad incorrecta
El `+` en la tabla Obligaciones del dashboard llama a `createRecord({type:"pasivo"})`, creando un `FinancialRecord`, no una `Obligation`. Son entidades distintas.

**Impacto**: Inconsistencia de datos. Los "pasivos" simples no tienen cuotas, reglas ni trazabilidad.

### B. `deleteObligation` hace borrado físico en cascada
```typescript
await prisma.obligation.delete({ where: { id: obligationId, userId } })
```
Elimina físicamente la obligación y todos sus registros relacionados (reglas, cuotas, pagos) via `onDelete: Cascade` en el schema.

**Impacto**: Pérdida total de trazabilidad histórica.

### C. Botones Completar/Cancelar directos sin confirmación
`statusActions` incluye "Completar" y "Cancelar" como botones directos que cambian el estado sin mostrar diálogo ni crear gastos.

**Impacto**: Pérdida de cuotas pendientes sin registrar gastos correspondientes.

### D. Las cuotas de tipo INSTALLMENT no tienen botón de pago inline
El tablero de cuotas (`PaymentsBoard`) muestra el estado pero no tiene botón para pagar. El único mecanismo es vía notificaciones. No es posible pagar cuotas futuras desde la vista de detalle.

**Impacto**: No se puede pagar la cuota 4 sin que la cuota 2 y 3 hayan vencido y aparecido en notificaciones.

---

## 3. Riesgos detectados

| Riesgo | Severidad | Acción |
|---|---|---|
| Borrado físico sin confirmación | Alta | Reemplazar con `finalizeObligation` |
| Pasivos huérfanos creados desde dashboard | Media | Cambiar `+` para abrir `ObligationFormDialog` |
| Estado PAUSED no tiene documentación de impacto en cuotas | Baja | Documentar (fechas se conservan, sin desplazamiento) |
| `resumeObligationRule` hace múltiples queries separadas | Baja | No crítico, no se modifica en esta versión |

---

## 4. Propuesta de solución

### 4.1 Entidad única — sin cambios necesarios

La entidad `Obligation` ya es la única fuente de verdad. Dashboard y `/obligaciones` consumen el mismo `ObligationsContext`. No existe duplicación. El único problema es el botón `+` del dashboard que crea un tipo incorrecto — se corrige en 4.2.

### 4.2 Botón `+` en Dashboard

**Cambio**: El `+` de la tabla Obligaciones abre `ObligationFormDialog` en lugar de insertar un draft row de pasivo.

Implementación:
- `SectionTable` acepta nuevo prop `onAddClick?: () => void`
- Si está presente, el `+` llama `onAddClick` en lugar de `addNewRow`
- `DashboardSheet` acepta `onAddObligation?: () => void` y lo pasa al SectionTable de pasivos
- `page.tsx` (dashboard) monta `ObligationFormDialog` y pasa el handler

### 4.3 Pago adelantado de cuotas

**Cambio**: Cada cuota PENDING/OVERDUE en `PaymentsBoard` (tipo INSTALLMENT) tendrá un botón "Pagar" inline.

Implementación:
- `PaymentsBoard` recibe `onReload?: () => void`
- Se agrega columna "Acción" al tablero de cuotas (visible solo para obligaciones ACTIVE/PAUSED)
- Al pagar: llama `acceptInstallmentPayment(installmentId, gastoName)` y luego `onReload()`
- No hay restricción de orden: cualquier cuota PENDING/OVERDUE puede pagarse independientemente

**Decisión de diseño**: Las fechas de cuotas NO se desplazan cuando se paga adelantado. Las cuotas conservan sus fechas originales. El orden de pago es libre.

### 4.4 Eliminar botones obsoletos (Completar, Cancelar)

**Cambio**: Se eliminan "Completar" y "Cancelar" de `statusActions`.

Permanece: solo "Pausar"/"Reanudar" como acción de estado directo.

El estado COMPLETED y CANCELLED se gestiona únicamente a través del flujo de eliminación (4.5).

### 4.5 Nuevo flujo de eliminación

**Nueva Server Action `finalizeObligation`**:

```
Para tipo INSTALLMENT:
  Si generateExpenses = true:
    → Para cada cuota PENDING/OVERDUE:
        crear Record{type:"gasto"}
        marcar installment como PAID (con gastoRecordId)
        crear ObligationPayment de historial
    → Obligation.status = COMPLETED
  Si generateExpenses = false:
    → Marcar cuotas PENDING/OVERDUE como REJECTED
    → Obligation.status = CANCELLED

Para tipo RECURRING / FIXED:
  → Rechazar todos los ObligationPayment PENDING
  → Obligation.status = CANCELLED
```

**UI del diálogo de eliminación**:

```
┌─ Finalizar obligación ──────────────────────────┐
│                                                  │
│ "[Nombre de la obligación]"                      │
│                                                  │
│ [Solo si INSTALLMENT con cuotas pendientes:]     │
│   Saldo pendiente:  X ARS                        │
│   Cuotas pendientes: N                           │
│                                                  │
│   [✓] Generar gastos por cuotas pendientes       │
│                                                  │
│ El historial de pagos se conservará.             │
│                                                  │
├──────────────────────────────────────────────────┤
│  [Cancelar]              [Confirmar]             │
└──────────────────────────────────────────────────┘
```

Texto del botón confirm:
- Checkbox ON → "Finalizar y registrar gastos" → COMPLETED
- Checkbox OFF / no hay cuotas → "Cancelar obligación" → CANCELLED

**Invariante**: Nunca se elimina físicamente ningún registro de la base de datos.

### 4.6 Estado Pausada — formalización

El estado PAUSED ya funciona correctamente:
- Notificaciones: `if (obligation.status !== "ACTIVE") continue` → pausadas no generan notificaciones ✓
- Gastos automáticos: no se generan porque vienen de aceptar pagos manualmente o desde notificaciones ✓
- Historial: se conserva porque no se elimina nada ✓
- Cuotas: fechas no se desplazan (decisión: mantener fechas originales para preservar la lógica de negocio original)

**Decisión sobre desplazamiento de fechas**: Las fechas de cuotas permanecen iguales al pausar. Justificación: (1) la deuda sigue existiendo con su fecha contractual, (2) desplazar fechas requeriría recalcular fechas futuras y podría introducir errores, (3) al reanudar las cuotas vencidas durante la pausa simplemente aparecerán como OVERDUE, lo que es correcto.

**Lo único que cambia**: se elimina el botón directo "Pausar"/"Reanudar" de `statusActions` Y se re-añade como un botón explícito. Actualmente ya existe en `statusActions`, no es necesario moverlo.

---

## 5. Impacto funcional

| Área | Impacto |
|---|---|
| Dashboard `/` | Botón `+` abre ObligationFormDialog; no crea pasivos simples |
| `/obligaciones` | Sin cambios en la lista |
| `/obligaciones/[id]` | Diálogo de eliminación reemplaza `confirm()` nativo; se agregan botones Pagar en cuotas |
| Gastos | `finalizeObligation` con generateExpenses=true crea gastos automáticamente |
| Notificaciones | Sin cambios; PAUSED ya es ignorado correctamente |
| Snapshots | Sin cambios |
| Métricas / Balance | Sin cambios directos |

---

## 6. Impacto técnico

| Archivo | Tipo de cambio |
|---|---|
| `lib/obligation-actions.ts` | Agregar `finalizeObligation`; exportar `acceptInstallmentPayment` |
| `components/obligations/obligation-detail.tsx` | Agregar `DeleteObligationDialog`; remover botones Completar/Cancelar; agregar pay buttons en PaymentsBoard |
| `components/dashboard-sheet.tsx` | Agregar props `onAddObligation` / `onAddClick` |
| `app/(dashboard)/page.tsx` | Montar `ObligationFormDialog`; pasar `onAddObligation` |

**Migraciones de base de datos**: Ninguna. Los cambios usan campos y estados ya existentes en el schema.

**Riesgo de regresión**: Bajo. Los cambios son aditivos (nuevas props, nueva acción) y el flujo existente se mantiene para otros tipos de tabla.
