---
Versión: 2.0.0
Última actualización: 2026-06-30
Autor: Abel Cejas
Estado: Activo
---

# Módulo: Libro Contable

## Objetivo

Mantener un registro de partida doble de todos los eventos financieros del sistema. Cada operación genera un asiento con débito y crédito. La vista muestra el libro mayor con saldo por cuenta y el detalle de asientos.

**Ruta**: `/libro-contable`
**Página**: `app/(dashboard)/libro-contable/page.tsx`

---

## Entidades involucradas

| Entidad | Tabla DB | Rol |
|---------|----------|-----|
| `JournalEntry` | `journal_entries` | Asiento contable: operación → debit/credit pair |

---

## Regla arquitectónica crítica

> **Toda nueva función financiera DEBE llamar `createJournalEntry()` desde `lib/journal-actions.ts`.**

Esta regla se aplica sin excepción a: ingresos, gastos, activos, movimientos de activos, dividendos, pagos de cuotas, extracciones, depósitos.

---

## Features

### 1. Vista de asientos
- Listado cronológico de todos los asientos del usuario
- Cada asiento: fecha, descripción, cuenta débito, monto débito, cuenta crédito, monto crédito

### 2. Vista de saldos por cuenta
- Agrupación de asientos por cuenta contable
- Saldo neto por cuenta (suma de débitos − suma de créditos o viceversa según naturaleza)

### 3. Vista en snapshots (read-only)
- `/snapshots/[id]` incluye los saldos del libro contable al momento del snapshot

---

## Cuentas contables

Las cuentas están definidas en `docs/financial-domain-architecture.md`. Mapa de operaciones → cuentas:

| Operación | Débito | Crédito |
|-----------|--------|---------|
| Crear ingreso | Efectivo/Banco | Ingreso |
| Crear gasto | Gasto | Efectivo/Banco |
| Depósito en activo | Activo | Efectivo/Banco |
| Extracción de activo | Efectivo/Banco | Activo |
| Crear obligación | — | Pasivo |
| Pagar cuota | Pasivo | Efectivo/Banco |
| Cobrar dividendo | Efectivo/Banco | Ingreso por dividendo |

---

## Reglas de negocio

- **RB-LC01**: Los registros HISTORICAL y ARCHIVED de ingresos/gastos NO generan nuevos asientos (el asiento se genera solo en la creación original o en "nuevo período").
- **RB-LC02**: `createJournalEntry()` es el único punto de entrada para crear asientos. No insertar en `journal_entries` directamente.
- **RB-LC03**: Los asientos son inmutables. Si una operación se revierte, se genera un contra-asiento.

---

## Server Actions

| Función | Archivo | Descripción |
|---------|---------|-------------|
| `createJournalEntry(data)` | `lib/journal-actions.ts` | Crear asiento de doble entrada |
| `loadJournalEntries()` | `lib/journal-actions.ts` | Cargar asientos para la vista |
| `loadAccountBalances()` | `lib/journal-actions.ts` | Saldos agregados por cuenta |
