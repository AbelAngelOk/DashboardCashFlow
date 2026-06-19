# 04 — Flujos Principales

## Flujo 1: Registro e inicio de sesión

### Registro de nuevo usuario

1. El usuario navega a `/register`.
2. Ingresa nombre, email y contraseña (mínimo 8 caracteres, validación client-side).
3. Se llama a la Server Action `registerUser()` (`lib/actions.ts`):
   a. Se verifica que el email no exista ya en la DB.
   b. Se hashea la contraseña con bcrypt (factor 12).
   c. Se crea el usuario en la tabla `users`.
   d. Se reclaman datos huérfanos (registros sin `userId`) asignándolos al nuevo usuario.
4. Inmediatamente después del registro, se llama a `signIn("credentials", ...)` para iniciar sesión automáticamente.
5. Al login exitoso, NextAuth crea un JWT con el `user.id`.
6. Se redirige a `/`.

### Inicio de sesión

1. El usuario navega a `/login`.
2. Ingresa email y contraseña.
3. `signIn("credentials", { email, password })` invoca el callback `authorize` de NextAuth (`lib/auth.ts`):
   a. Busca al usuario por email en la DB.
   b. Compara la contraseña con `bcrypt.compare()`.
   c. Si es válido, retorna `{ id, email, name }`.
4. NextAuth crea un JWT almacenado en cookies.
5. Se redirige a `/`.

---

## Flujo 2: Carga inicial del dashboard

1. El usuario autenticado accede a cualquier ruta del grupo `/(dashboard)`.
2. El middleware (`proxy.ts`) verifica el JWT; si es válido, permite el acceso.
3. El layout `/(dashboard)/layout.tsx` monta `SettingsProvider` → `FinanceProvider` → `AppShell`.
4. `FinanceProvider` ejecuta `useEffect` al montar, llamando a `loadData()` (Server Action):
   - Consulta en paralelo: `records` (sin `deletedAt`), `snapshots` (ordenados por fecha desc), `auditLogs` (ordenados por fecha desc).
   - Mapea los resultados de la DB a los tipos TypeScript del frontend.
5. El estado local se actualiza con los datos recibidos: `setRecords()`, `setSnapshots()`, `setMovements()`.
6. El flag `loading` pasa a `false` y los componentes se renderizan con datos.
7. `SettingsProvider` carga la configuración guardada desde `localStorage`.

---

## Flujo 3: Crear un registro financiero (ingreso/gasto/pasivo)

1. El usuario hace clic en "+" en la sección correspondiente del dashboard.
2. Aparece una fila editable en línea con campos: descripción, monto, moneda, y (si aplica) vinculación.
3. El usuario completa los campos y presiona Enter o el botón ✓.
4. `saveNewRow()` en `SectionTable` construye el objeto `FinancialRecord`.
5. Se llama a `createRecord(record)` del `FinanceProvider`:
   a. Se actualiza el estado React inmediatamente (optimista): `setRecords(prev => [...prev, record])`.
   b. Se genera un `Movement` de auditoría local con `logMovement("creado", ...)`.
   c. Se dispara `dbCreateRecord(record, movement)` en background.
6. `dbCreateRecord()` (Server Action):
   a. Obtiene el `userId` de la sesión.
   b. Ejecuta transacción atómica: `INSERT` en `records` + `INSERT` en `movements` (AuditLog).

---

## Flujo 4: Crear un activo financiero (módulo Activos)

1. El usuario navega a `/activos` y hace clic en "Nuevo activo".
2. Se abre `AssetFormDialog` donde selecciona tipo, nombre, ticker (opcional), monto, moneda.
3. Al confirmar, se llama a `createRecord(record)` del `FinanceProvider` (para el registro simple en el dashboard):
   - Crea la entrada en `records` con `type: "activo"` y el `assetType` seleccionado.
4. **Adicionalmente**, se llama a `createAsset(data)` de `assets-actions.ts`:
   - Inserta el registro completo en `records` con campos extendidos (`ticker`, `assetType`, etc.).
   - Crea automáticamente un `FinancialMovement` de tipo `DEPOSIT` con la descripción "Inversión inicial".

> **Incertidumbre**: Al revisar el código, el botón "Nuevo activo" llama a `onCreate` del `AssetFormDialog`, que mapea a `createRecord` del contexto. No queda claro si `createAsset` se llama también o si el `AssetFormDialog` llama directamente a la Server Action. Se requiere revisión adicional del archivo `components/activos/asset-form-dialog.tsx` para confirmar el flujo exacto.

---

## Flujo 5: Editar un activo (cambio de monto desde el dashboard)

1. El usuario hace clic en el ícono de editar en la fila de un activo.
2. La fila pasa a modo edición inline con los campos actuales.
3. El usuario modifica el monto y confirma (✓).
4. Dado que el campo `amount` cambió y el tipo es `activo`:
   a. Se guarda el estado `pendingEdit` (en lugar de llamar directamente a `onEdit`).
   b. El diálogo `ConfirmWithCommentDialog` se abre solicitando un comentario opcional.
5. Al confirmar el diálogo:
   a. Se llama a `handleActivoEditAmount()` en `page.tsx`:
      - Si el activo es `isGroupParent`, llama a `handleGroupAdjust()`.
      - Si no, llama a `editRecord(record, previous)` y `createAdjustmentMovement()`.
   b. `editRecord()` actualiza el estado React y dispara `dbEditRecord()`.
   c. `createAdjustmentMovement()` crea un `FinancialMovement` de tipo `ADJUSTMENT` en la DB.

---

## Flujo 6: Tomar un Snapshot

1. El usuario hace clic en "Tomar Snapshot" en el dashboard.
2. Se abre un diálogo con: nombre (pre-llenado con "Snapshot N"), fecha inicio y fecha fin (pre-llenadas con el primer y último día del mes actual).
3. El usuario ajusta los valores y confirma.
4. Se llama a `takeSnapshot(name, period)` del `FinanceProvider`:
   a. Se construye el objeto `Snapshot` con: ID aleatorio, nombre, período formateado ("DD/MM/YYYY - DD/MM/YYYY"), timestamp actual en español, y copia del array `records` actual.
   b. El snapshot se agrega al estado React inmediatamente.
   c. Se dispara `dbTakeSnapshot(snapshot)` en background.
5. `dbTakeSnapshot()` (Server Action):
   a. Ejecuta una transacción: `INSERT` en `snapshots` + `createMany` en `snapshot_records` (una fila por cada record actual).

---

## Flujo 7: Ver un Snapshot

1. El usuario navega a `/snapshots`.
2. La lista de snapshots se obtiene del `FinanceContext` (cargado en la carga inicial).
3. El usuario hace clic en la flecha de un snapshot.
4. Navega a `/snapshots/[id]`.
5. `SnapshotDetailPage` llama a `getSnapshot(id)` del contexto, que hace una búsqueda en el array en memoria.
6. Se renderiza `DashboardSheet` con `readOnly={true}`, usando los records del snapshot (no los actuales).

---

## Flujo 8: Cobrar un Plazo Fijo

1. El usuario navega a `/activos/[id]` de un activo tipo `FIXED_TERM`.
2. `FixedTermPanel` muestra los datos del plazo fijo (capital, fechas, tasa, retorno estimado).
3. El usuario hace clic en "Cobrar plazo fijo".
4. Se abre un diálogo con el monto cobrado pre-cargado (capital + retorno esperado), editable.
5. Al confirmar, se llama a `collectFixedTerm()` (Server Action):
   a. Transacción atómica:
      - `INSERT` en `records` con `type: "ingreso"` y nombre "Cobro plazo fijo: {nombre}".
      - `UPDATE` del activo con `deletedAt: now()` (soft delete).
6. `router.push("/activos")` redirige al listado de activos.
7. El nuevo ingreso aparece en el dashboard principal (visible en la próxima carga o recarga).

---

## Flujo 9: Cobrar un Dividendo (Acciones)

1. El usuario navega a `/activos/[id]` de un activo tipo `STOCK`.
2. `StockPanel` muestra la tabla de dividendos con filas de mes, porcentaje, ganancia estimada, ganancia real.
3. El usuario hace clic en "Cobrar" en la fila de un dividendo sin ganancia real registrada.
4. Se abre `CollectDividendDialog` donde ingresa la ganancia obtenida real.
5. Al confirmar, se llama a `collectDividend()` (Server Action):
   a. Transacción atómica:
      - `INSERT` en `records` con `type: "ingreso"` y nombre "Ganancia dividendos {nombre activo}".
      - `UPDATE` del activo: metadata con `actualGain` y `ingresoRecordId` actualizados.
6. `router.refresh()` actualiza la página.

---

## Flujo 10: Actualizar tasas de cambio

1. El usuario navega a `/configuracion`.
2. Activa el switch "Convertir divisas al calcular".
3. Aparecen las opciones de moneda base y tasas de cambio.
4. El usuario hace clic en "Actualizar" (ícono de refresh).
5. `fetchExchangeRates()` del `SettingsProvider` llama a `https://open.er-api.com/v6/latest/{baseCurrency}`.
6. La API retorna tasas relativas a la moneda base seleccionada.
7. Se convierte el formato de la API (1 base = X foreign) al formato interno (1 foreign = ? base).
8. El estado `exchangeRates` se actualiza y se guarda en `localStorage`.
9. Todos los componentes que consumen `useSettings()` re-renderizan con las nuevas tasas.

---

## Flujo 11: Log de movimientos y comentarios

1. El usuario navega a `/movimientos`.
2. La lista de `movements` se obtiene del `FinanceContext`.
3. Cada entrada muestra: badge de acción (creado/editado/eliminado con colores), tipo, detalle, fecha, y un input de comentario editable.
4. El usuario escribe en el campo de comentario.
5. `updateComment(id, comment)` del `FinanceProvider`:
   a. Actualiza el estado React inmediatamente.
   b. Limpia el timer de debounce anterior para ese `id`.
   c. Inicia un nuevo timer de 600ms.
   d. Al vencer el timer, llama a `dbUpdateComment(id, comment)` (Server Action).

---

## Flujo 12: Extracción parcial del Bot de Rebalanceo

1. El usuario está en el detalle de un activo tipo `REBALANCE_BOT`.
2. Hace clic en "Extracción parcial".
3. Ingresa el monto total a extraer.
4. Al confirmar:
   a. Se calcula el valor total del portafolio: `Σ(currentPrice × currentQty)`.
   b. Se calcula el ratio de extracción: `extractAmt / total`.
   c. Para cada sub-activo: `newQty = max(0, currentQty × (1 - ratio))`.
   d. Se llama a `updateAsset()` con el metadata actualizado.
5. El monto del activo padre se recalcula como `max(totalInvested, totalValue)`.

---

## Flujo 13: Agrupación de activos

1. La funcionalidad de agrupación existe en la Server Action `groupAssets()` (`lib/assets-actions.ts`).
2. Recibe un `parentId` y una lista de `childIds`.
3. Actualiza en masa el campo `parentId` de los hijos al ID del padre.
4. El padre pasa a tener `isGroupParent: true` (determinado por `_count.children > 0`).
5. En el dashboard, el padre aparece con un ícono de red (Network) y al hacer clic abre `GroupBreakdownDialog`.

> **Nota**: La UI para iniciar una agrupación (cómo seleccionar el padre y los hijos desde la interfaz) no fue identificada claramente en los archivos revisados. `groupAssets()` existe como Server Action pero el flujo completo de la UI para crear grupos no fue encontrado.
