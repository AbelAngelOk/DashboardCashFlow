---
Versión: 2.0.0
Última actualización: 2026-06-30
Autor: Abel Cejas
Estado: Activo
---

# 02 — Reglas de Negocio

## RN-01: Unicidad de email en el registro

**Descripción**: No pueden existir dos usuarios con el mismo email. El registro falla con el mensaje "Ya existe una cuenta con ese email".

**Archivos**: `lib/actions.ts` → `registerUser()` (línea ~35)

**Riesgo**: La validación se hace con una consulta `findUnique` antes de crear el usuario, lo que podría producir una condición de carrera (race condition) en escenarios de alto concurrencia donde dos registros simultáneos del mismo email pasen la validación antes de que cualquiera complete la inserción. En la práctica, la constraint `@unique` de la base de datos actuará como segunda barrera.

---

## RN-02: Hash de contraseñas con bcrypt factor 12

**Descripción**: Las contraseñas se hashean con bcryptjs usando un factor de trabajo de 12. Nunca se almacenan en texto plano.

**Archivos**: `lib/actions.ts` → `registerUser()`, `lib/auth.ts` → `authorize()`

**Riesgo**: Factor 12 es seguro para hashing de contraseñas pero puede ser lento en entornos con CPUs lentas o muchos logins simultáneos.

---

## RN-03: Contraseña mínima de 8 caracteres

**Descripción**: En el formulario de registro, la contraseña debe tener al menos 8 caracteres. Esta validación solo se aplica en el cliente (frontend).

**Archivos**: `app/register/page.tsx` (línea ~19 y atributo `minLength={8}`)

**Riesgo**: La validación es solo frontend; no existe validación equivalente en el servidor. Si se llama directamente a `registerUser()`, se puede registrar una contraseña de cualquier longitud.

---

## RN-04: Soft delete de registros y activos

**Descripción**: Los registros financieros nunca se eliminan físicamente de la base de datos. En su lugar, se marca el campo `deletedAt` con la fecha actual. Las queries excluyendo registros borrados siempre filtran con `deletedAt: null`.

**Archivos**: `lib/actions.ts` → `dbDeleteRecord()`, `lib/assets-actions.ts` → `deleteAsset()`; `prisma/schema.prisma` (campo `deletedAt`)

**Riesgo**: Los registros borrados quedan en la DB indefinidamente. No existe mecanismo de limpieza (purga) ni interfaz para ver o restaurar registros eliminados. A largo plazo, la tabla puede crecer significativamente.

---

## RN-05: Toda mutación genera un log de auditoría (AuditLog)

**Descripción**: Cada vez que se crea, edita o elimina un registro financiero del dashboard (`FinancialRecord`), se crea simultáneamente (en la misma transacción de DB) una entrada en la tabla `movements` (`AuditLog`) que registra: fecha, acción (`creado`/`editado`/`eliminado`), tipo de registro, nombre, y un detalle del cambio.

**Archivos**: `lib/actions.ts` → `dbCreateRecord()`, `dbEditRecord()`, `dbDeleteRecord()`; `components/finance-store.tsx` → `logMovement()`

**Riesgo**: El log es inmutable desde la UI (no hay botón de borrar). El campo `comment` sí es editable y se persiste con debounce. Si el servidor falla después de que el estado React se actualizó optimisticamente pero antes de que la transacción complete, el estado local y la DB pueden divergir.

---

## RN-06: Actualizaciones optimistas sin rollback

**Descripción**: Todas las mutaciones del dashboard (crear, editar, eliminar registro, tomar snapshot) actualizan el estado React inmediatamente sin esperar la confirmación del servidor. La función `fire(promise)` ejecuta la operación de DB en segundo plano y los errores solo se loguean a la consola.

**Archivos**: `components/finance-store.tsx` → función `fire()` (línea ~45), y su uso en `createRecord`, `editRecord`, `deleteRecord`, `takeSnapshot`

**Riesgo**: Si la escritura en DB falla (timeout, error de red, token expirado), el usuario verá datos en pantalla que no se persistieron. En la próxima recarga de la página, los datos volverán al estado real de la DB. No hay notificación de error al usuario.

---

## RN-07: El "eliminar activo" desde el dashboard no elimina el registro, lo pone en cero

**Descripción**: Cuando el usuario hace clic en "eliminar" un registro de tipo `activo` en el dashboard, el comportamiento no es eliminar el registro sino editar su monto a 0 y crear un movimiento de ajuste con el delta negativo. El diálogo muestra "Poner activo en cero" y permite agregar un comentario.

**Archivos**: `app/(dashboard)/page.tsx` → `handleActivoDelete()` (línea ~35); `components/dashboard-sheet.tsx` → `handleDeleteClick()` (línea ~292)

**Riesgo**: El comportamiento es contraintuitivo: el registro sigue existiendo en la DB con `amount = 0` y es visible en la página de `/activos`. El activo desaparece del Balance del dashboard porque se filtra por `amount !== 0`, pero existe en la lista de activos.

---

## RN-08: Edición de monto de activos requiere confirmación y comentario

**Descripción**: Cuando el monto de un `activo` cambia en el dashboard, se muestra un diálogo de confirmación que solicita un comentario opcional. El comentario se propaga a un movimiento de tipo `ADJUSTMENT` en `FinancialMovement`.

**Archivos**: `components/dashboard-sheet.tsx` → `saveEdit()` (línea ~245), `setPendingEdit()`; `app/(dashboard)/page.tsx` → `handleActivoEditAmount()`

**Riesgo**: Si el usuario cierra el diálogo sin confirmar, la edición se descarta correctamente. No hay riesgo de datos inconsistentes.

---

## RN-09: Unicidad de nombre en activos

**Descripción**: Al editar el nombre de un activo, se valida que no exista otro activo con el mismo nombre. La validación se hace en el cliente contra el array en memoria.

**Archivos**: `components/dashboard-sheet.tsx` → `saveEdit()` (línea ~249)

**Riesgo**: La validación es solo client-side. Si se crean dos activos en sesiones paralelas con el mismo nombre antes de que ninguno recargue, la DB aceptará ambos (no existe constraint de unicidad en la DB sobre el nombre de activos).

---

## RN-10: Creación de activo siempre genera un movimiento DEPOSIT inicial

**Descripción**: Al crear un activo desde el módulo de activos (`createAsset()`), se genera automáticamente un movimiento financiero de tipo `DEPOSIT` con la descripción "Inversión inicial" y el monto inicial del activo.

**Archivos**: `lib/assets-actions.ts` → `createAsset()` (línea ~82)

**Riesgo**: El movimiento DEPOSIT se crea siempre, incluso si el activo es creado desde el formulario rápido del dashboard (donde no se llama a `createAsset()`). Hay dos caminos de creación que generan datos parcialmente distintos.

---

## RN-11: Cobro de plazo fijo elimina el activo y crea un ingreso

**Descripción**: Al cobrar un plazo fijo (`collectFixedTerm()`), se realiza una transacción atómica que: (1) crea un registro de tipo `ingreso` con el nombre "Cobro plazo fijo: {nombre}" y el monto cobrado, (2) hace soft-delete del activo de plazo fijo.

**Archivos**: `lib/assets-actions.ts` → `collectFixedTerm()` (línea ~237)

**Riesgo**: El ingreso creado NO tiene `linkedTo` apuntando al activo eliminado. Si el usuario quiere ver la trazabilidad entre el ingreso y el activo que lo generó, no hay forma directa de hacerlo desde la UI.

---

## RN-12: Cobro de dividendo crea un ingreso y no modifica el activo principal

**Descripción**: Al cobrar un dividendo (`collectDividend()`), se crea un ingreso con nombre "Ganancia dividendos {nombre activo}" y se actualiza el metadata del activo (el campo `actualGain` del dividendo cobrado). El monto del activo en el Balance no cambia.

**Archivos**: `lib/assets-actions.ts` → `collectDividend()` (línea ~202); `components/activos/panels/stock-panel.tsx`

**Riesgo**: El ingreso creado tampoco tiene `linkedTo`. Misma observación que RN-11.

---

## RN-13: Reclamación de datos huérfanos al registrarse

**Descripción**: Al crear un nuevo usuario, el sistema recorre los registros, snapshots y logs de auditoría que tengan `userId: null` y los asigna al nuevo usuario. Esto permite importar datos previos creados antes de que existiera el sistema de autenticación.

**Archivos**: `lib/actions.ts` → `registerUser()` (líneas ~42-47)

**Riesgo**: Si varios usuarios se registran concurrentemente, todos reclamarán los mismos datos huérfanos. No existe una transacción que atómicamente asigne y proteja esos registros. Este mecanismo es un vestigio de una migración inicial y debería inhabilitarse cuando ya no existan datos huérfanos.

---

## RN-14: Snapshots almacenan una copia plana de los registros

**Descripción**: Al tomar un snapshot, se copia el array actual de `FinancialRecord` del estado React. Cada registro se copia en la tabla `snapshot_records` con sus campos básicos (tipo, nombre, monto, moneda, `linkedTo`). Los campos extendidos (`assetType`, `parentId`, metadatos) no se incluyen en la copia de snapshot.

**Archivos**: `lib/actions.ts` → `dbTakeSnapshot()` (línea ~213); `prisma/schema.prisma` → modelo `SnapshotRecord`

**Riesgo**: El snapshot no refleja los detalles de activos (historial de movimientos, metadata tipo-específica). Es solo un Balance/Estado de Resultados congelado.

---

## RN-15: Conversión de monedas es solo visual

**Descripción**: La conversión de monedas (modo "convertir divisas") transforma los montos en pantalla a una moneda base usando las tasas configuradas. Los montos en la base de datos **nunca se modifican**. El código lo indica explícitamente: "solo visual, no modifica los datos".

**Archivos**: `components/settings-store.tsx` (comentario en `showConvertedAmounts`); `components/dashboard-sheet.tsx` → `RecordAmount`, `TotalsBlock`

**Riesgo**: Si las tasas son incorrectas o están desactualizadas, los totales mostrados pueden ser engañosos. No hay advertencia visible en la UI de que las tasas son aproximadas.

---

## RN-16: Las tasas de cambio tienen fallback estático

**Descripción**: Si la API de tasas de cambio (`open.er-api.com`) no está disponible, el sistema continúa usando las tasas almacenadas en `localStorage` (o las tasas por defecto codificadas en el código si no hay ninguna guardada). Los errores de API se silencian sin notificar al usuario.

**Archivos**: `components/settings-store.tsx` → `fetchExchangeRates()` (bloque `catch`, línea ~148)

**Riesgo**: El usuario puede operar con tasas completamente desactualizadas sin saberlo.

---

## RN-17: Agrupación de activos (parentId)

**Descripción**: Los activos pueden organizarse jerárquicamente: un activo puede ser "padre de grupo" (`isGroupParent: true`) y tener hijos (`parentId` apuntando al padre). El dashboard solo muestra activos sin `parentId` y con `amount !== 0`. El detalle de un activo padre muestra la lista de hijos.

**Archivos**: `lib/assets-actions.ts` → `groupAssets()`; `app/(dashboard)/activos/[id]/page.tsx`; `components/dashboard-sheet.tsx` (filtro en línea ~589)

**Riesgo**: El monto del activo padre es independiente de la suma de sus hijos. No existe validación que mantenga consistencia entre el monto del grupo y la suma de los montos de los activos hijos.

---

## RN-19: Eliminación lógica de ingresos y gastos mediante status

**Descripción**: Eliminar un ingreso o gasto desde el Dashboard NO usa `deletedAt`. En su lugar, se cambia `status = "HISTORICAL"`. El registro sigue existiendo y es visible en `/ingresos` y `/gastos` con filtro de estado "Históricos".

**Comportamiento de dbDeleteRecord()**: Si `record.type === "ingreso" || record.type === "gasto"` → actualiza `status = "HISTORICAL"`. Para activos y pasivos → mantiene el comportamiento original de `deletedAt`.

**Archivos**: `lib/actions.ts` → `dbDeleteRecord()` (bifurcación por tipo)

**Riesgo**: Registros con `deletedAt` de versiones anteriores (antes del deploy) coexisten con los nuevos registros HISTORICAL. Son datos legados y se ignoran; no tienen impacto en la funcionalidad nueva.

---

## RN-20: Versionado de ingresos y gastos

**Descripción**: Al editar un ingreso o gasto, el usuario puede elegir entre (a) editar el registro existente o (b) crear un "nuevo período". Si elige nuevo período, se realiza en una sola transacción: (1) `status = "HISTORICAL"` en el registro antiguo, (2) creación del nuevo registro con `status = "ACTIVE"` y `previousVersionId = oldId`. Se crea un nuevo `JournalEntry` para el nuevo registro; los asientos del registro anterior se conservan intactos.

**Archivos**: `lib/versioning-actions.ts` → `editOrVersionRecord()`

**Riesgo**: Si la transacción falla a mitad (después del HISTORICAL pero antes del CREATE), el registro anterior quedará HISTORICAL sin sucesor. Al restaurar desde /ingresos o /gastos, el usuario puede reactivarlo con `restoreIngreso()`/`restoreGasto()`.

---

## RN-21: Links N:M entre gastos e ingresos

**Descripción**: Un gasto puede estar financiado por cero, uno o múltiples ingresos. Cada link registra el `attributedAmount` de ese ingreso hacia ese gasto. La suma de `attributedAmount` puede ser menor al monto total del gasto (el resto viene de fuentes no registradas) pero no puede ser negativa.

**Validación**: `attributedAmount > 0`. La sobre-atribución (suma > gasto.amount) genera una advertencia visual pero no bloquea el guardado.

**Gestión**: Los links se gestionan desde ambos lados — desde el formulario del gasto (panel "Financiado por") y desde el formulario del ingreso (panel "Gastos financiados"). El mismo link creado desde un lado es visible en el otro.

**Archivos**: `lib/link-actions.ts` → `createGastoIngresoLink()`, `deleteGastoIngresoLink()`

**Riesgo**: Un link entre un gasto HISTORICAL y un ingreso ACTIVE queda "huérfano" visualmente (el gasto no aparece en el dashboard). Los links se conservan intencionalmente para trazabilidad histórica.

---

## RN-22: Marcadores visuales — un marcador por entidad

**Descripción**: El usuario puede asignar un marcador a cualquier fila de activo, ingreso, gasto u obligación. Solo puede haber un marcador activo por entidad a la vez. Asignar un marcador nuevo reemplaza automáticamente al anterior (upsert). El marcador se almacena en `entity_markers` y su estilo visual (borde + fondo semi-transparente) se aplica dinámicamente con el color del marcador.

**Archivos**: `lib/marker-actions.ts` → `setEntityMarker()`, `removeEntityMarker()`, `loadEntityMarkersForIds()`

**Riesgo**: Al eliminar un marcador globalmente, todos sus `EntityMarker` se eliminan por CASCADE. Las filas que usaban ese marcador vuelven al estilo default sin ninguna acción adicional requerida.

---

## RN-23: loadData() excluye ingresos y gastos HISTORICAL/ARCHIVED del Dashboard

**Descripción**: `loadData()` en `lib/actions.ts` filtra los records devueltos al Dashboard usando `status = "ACTIVE"` tanto para gastos como para ingresos. Solo registros ACTIVE aparecen en el Estado de Resultados y el Balance del Dashboard.

**Archivos**: `lib/actions.ts` → `loadData()` (cláusula WHERE con OR multi-tipo)

**Riesgo**: Si el `FinanceProvider` tiene datos en caché que aún contienen registros HISTORICAL (por una mutación optimista), el Dashboard puede mostrar momentáneamente registros incorrectos hasta el próximo `reload()`.

---

## RN-18: El modo de conversión persiste en localStorage

**Descripción**: La configuración del modo de conversión de monedas (moneda base, tasas, switches) se almacena en `localStorage` bajo la clave `cashflow:settings`. Persiste entre sesiones del mismo navegador y es independiente por dispositivo.

**Archivos**: `components/settings-store.tsx` → `loadFromStorage()`, `saveToStorage()`

**Riesgo**: Si el usuario usa el sistema desde distintos navegadores/dispositivos, tendrá configuraciones de conversión distintas. No hay sincronización de configuración entre dispositivos.
