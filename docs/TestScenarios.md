# Escenarios de prueba — Phase B

Cada sección corresponde a un cambio implementado. Los escenarios están ordenados por prioridad de riesgo (los más críticos primero).

---

## 1. Tipos de movimiento en el popup de edición del dashboard (Punto 1)

**Archivo**: `components/dashboard-sheet.tsx` + `app/(dashboard)/page.tsx`

### Escenario 1.1 — Editar valor con tipo Ajuste
1. Ir a `/`.
2. Hover sobre un activo → clic en lápiz (editar) → cambiar el valor → Enter.
3. El popup muestra "Tipo de movimiento" con radios **Ajuste** y **Depósito**. Ajuste viene seleccionado por defecto.
4. No aparece ningún switch de "Crear gasto".
5. Confirmar → el activo actualiza su valor en el dashboard; en `/activos/[id]` aparece un movimiento `ADJUSTMENT`.

### Escenario 1.2 — Editar valor con tipo Depósito + gasto asociado
1. Editar valor de un activo → seleccionar **Depósito** en el popup.
2. Aparece el switch "Crear gasto asociado".
3. Activar el switch → confirmar.
4. El activo actualiza su valor; en `/activos/[id]` aparece un movimiento `DEPOSIT`; en el dashboard, en la sección Gastos, aparece un nuevo registro "Depósito en {nombre activo}".

### Escenario 1.3 — Editar valor con tipo Depósito sin gasto
1. Mismo flujo pero con el switch desactivado.
2. El activo actualiza su valor; el movimiento es `DEPOSIT`; NO se crea ningún gasto en el dashboard.

---

## 2. Poner activo en cero con ingreso opcional (Punto 4)

**Archivo**: `components/dashboard-sheet.tsx` + `lib/assets-actions.ts` (zeroOutAsset)

### Escenario 2.1 — Borrar activo sin ingreso asociado
1. En el dashboard, hover sobre un activo → clic en la papelera.
2. El popup dice "Poner activo en cero" + muestra el switch "Crear ingreso asociado" (desactivado).
3. Confirmar sin activar el switch.
4. El activo desaparece del dashboard (valor = 0); en `/activos/[id]` aparece un movimiento `EXTRACT`; NO se crea ningún ingreso.

### Escenario 2.2 — Borrar activo con ingreso asociado
1. Mismo flujo pero activar el switch "Crear ingreso asociado".
2. Confirmar.
3. El activo desaparece del dashboard; en la sección Ingresos aparece un registro "Liquidación {nombre}"; en `/activos/[id]` el movimiento `EXTRACT` existe.

### Escenario 2.3 — El activo sigue existiendo (valor = 0)
1. Después de cualquier escenario anterior, ir a `/activos` → activar "Balance cero" (toggle).
2. El activo debe aparecer con valor 0. No fue eliminado de la base de datos.

---

## 3. Borrar activo hijo de grupo desde el dashboard (Punto 10)

**Archivo**: `components/dashboard-sheet.tsx`

### Escenario 3.1 — Poner en cero un hijo desde la vista expandida
1. En el dashboard, expandir un grupo (clic en chevron).
2. Hover sobre una fila hija → aparece ícono de papelera.
3. Clic → popup de confirmación con switch "Crear ingreso asociado".
4. Confirmar → el hijo desaparece de la vista expandida (valor = 0); el grupo padre mantiene su valor (NO se recalcula automáticamente aquí — diseño deliberado).
5. En `/activos/[id]` del hijo: aparece el movimiento `EXTRACT`.

---

## 4. Edición de movimientos en detalle de activo (Punto 2)

**Archivo**: `components/activos/asset-movements-section.tsx`

### Escenario 4.1 — Editar tipo y comentario de un movimiento
1. Ir a `/activos/[id]` de cualquier activo.
2. Hover sobre una fila de movimiento → aparece ícono de lápiz.
3. Clic → la fila se convierte en modo edición: dropdown de tipo + campo de texto para comentario.
4. Cambiar tipo a `Depósito` y escribir un comentario → Enter o ✓.
5. La fila vuelve a modo lectura con los valores actualizados. Refrescar la página confirma que persiste.

### Escenario 4.2 — Cancelar edición con Escape
1. Mismo flujo hasta el paso 3.
2. Presionar Escape → la fila vuelve sin cambios.

### Escenario 4.3 — Eliminar un movimiento
1. Hover sobre movimiento → ícono papelera → clic.
2. El movimiento desaparece sin confirmación (flujo ya existía, sin cambios).

---

## 5. Validación reactiva en formulario de activo (Punto 3)

**Archivo**: `components/activos/asset-form-dialog.tsx`

### Escenario 5.1 — Auto-cálculo de valor al completar cantidad y precio
1. En `/activos` → "Nuevo activo" → tipo STOCK (o CRYPTO, FUTURES, OPTIONS).
2. Completar **Cantidad**: 10 → **Precio promedio**: 50.
3. El campo **Valor inicial** se completa automáticamente con 500.

### Escenario 5.2 — Auto-cálculo de valor al completar precio con cantidad ya ingresada
1. Primero completar Cantidad: 5, luego Precio: 20.
2. Valor se actualiza a 100 automáticamente.

### Escenario 5.3 — Inconsistencia bloquea el guardado
1. Completar Cantidad: 10, Precio: 50 → Valor se calcula en 500.
2. Sobreescribir manualmente el campo Valor con 999.
3. Aparece advertencia en amber: "El valor (999) no coincide con cantidad × precio (500.00)".
4. El botón Guardar queda deshabilitado.

### Escenario 5.4 — Tipos sin cantidad/precio no tienen validación
1. Tipo BOND, FIXED_TERM, TRADING, etc. → no aparecen campos Cantidad ni Precio → no hay validación reactiva.

---

## 6. GROUP excluido de selectores (Punto 5)

**Archivos**: `components/activos/asset-form-dialog.tsx`, `components/activos/asset-info-section.tsx`

### Escenario 6.1 — Formulario de nuevo activo
1. Abrir "Nuevo activo" → en el selector de tipo, verificar que "Grupo" no aparece en la lista.

### Escenario 6.2 — Edición inline en detalle de activo
1. Ir a `/activos/[id]` de un activo no-grupo → editar tipo inline → verificar que "Grupo" no aparece.

---

## 7. Gestión de grupos (Punto 6)

**Archivos**: `app/(dashboard)/activos/page.tsx`, `components/activos/asset-list.tsx`, `lib/assets-actions.ts`

### Escenario 7.1 — Crear nuevo grupo
1. En `/activos`, clic en "Agrupar" → seleccionar ≥ 2 activos.
2. El dropdown "Crear nuevo grupo" ya está seleccionado.
3. Escribir nombre → "Crear grupo" → los activos se agrupan bajo el nuevo padre.

### Escenario 7.2 — Asignar a grupo existente
1. Tener al menos un grupo creado.
2. Clic en "Agrupar" → seleccionar 1+ activos → en el dropdown elegir "Agregar a: {nombre grupo}".
3. Clic en "Asignar al grupo" → los activos seleccionados aparecen como hijos del grupo.

### Escenario 7.3 — Remover un activo de su grupo
1. En la lista de activos, expandir un grupo → hover sobre un hijo.
2. Clic en el ícono Unlink (cadena rota) → el hijo deja de pertenecer al grupo y aparece como activo de nivel superior.

### Escenario 7.4 — Eliminar un grupo (hijos quedan libres)
1. Hover sobre la fila de grupo → clic en papelera → confirmación.
2. El grupo desaparece; sus ex-hijos aparecen como activos de nivel superior. Los hijos no se eliminan.

### Escenario 7.5 — Desagrupar desde el detalle del grupo
1. Ir a `/activos/[id]` de un grupo → clic en "Desagrupar" → confirmar.
2. Se navega a `/activos`; el grupo desaparece; los hijos son independientes.

---

## 8. Tipos de activo configurables (Punto 8)

**Archivos**: `components/settings-store.tsx`, `app/(dashboard)/configuracion/page.tsx`

### Escenario 8.1 — Ocultar un tipo de sistema
1. Ir a `/configuracion` → sección "Tipos de Activo".
2. Clic en el ícono ojo de "Crypto" → aparece tachado.
3. Ir a "Nuevo activo" → CRYPTO no aparece en el selector.
4. En el filtro de `/activos` → tampoco aparece el botón "Crypto".

### Escenario 8.2 — Mostrar un tipo oculto nuevamente
1. Volver a `/configuracion` → clic en ojo de "Crypto" → vuelve a estar disponible.

### Escenario 8.3 — Crear tipo personalizado
1. En `/configuracion` → campo de texto → escribir "Real Estate" → "Agregar".
2. Aparece en la lista de tipos personalizados.
3. En "Nuevo activo" → aparece "Real Estate" en el selector de tipo.

### Escenario 8.4 — Renombrar tipo personalizado
1. Clic en lápiz junto a un tipo personalizado → editar nombre → Enter.
2. El nombre se actualiza en la lista y en el selector de tipo.

### Escenario 8.5 — Eliminar tipo personalizado
1. Clic en papelera junto a un tipo personalizado → se elimina de la lista y del selector.

### Escenario 8.6 — Persistencia entre sesiones
1. Configurar tipos ocultos y personalizados.
2. Cerrar el navegador → volver a abrir → la configuración se mantiene (localStorage).

---

## 9. Filtro multi-selección en /activos (Punto 9)

**Archivo**: `components/activos/asset-list.tsx`

### Escenario 9.1 — Seleccionar un tipo
1. En `/activos`, clic en "Acciones" → solo se muestran activos de tipo STOCK.
2. "Todos" (blanco, sin relleno) deselecciona.

### Escenario 9.2 — Seleccionar múltiples tipos
1. Clic en "Crypto" → también clic en "Bonos" → se muestran activos de ambos tipos simultáneamente.
2. Ambos botones están en negro (activos).

### Escenario 9.3 — Limpiar filtro
1. Con filtros activos, clic en "Todos" → todos los activos visibles. Botones de tipo vuelven al estado sin relleno.

---

## 10. Orden fijo en detalle de grupo (Punto 11)

**Archivo**: `app/(dashboard)/activos/[id]/page.tsx`

### Escenario 10.1 — Secciones del detalle de un grupo
1. Ir a `/activos/[id]` de un activo de tipo GROUP.
2. Verificar orden de secciones:
   1. **Información General** (AssetInfoSection)
   2. **Activos del grupo** (tabla de hijos con links)
   3. **Movimientos** (AssetMovementsSection)
3. No debe aparecer ningún tablero (BoardManager ausente).

### Escenario 10.2 — Comparar con detalle de activo no-grupo
1. Ir a `/activos/[id]` de un STOCK.
2. Orden correcto: Información General → Panel STOCK → Movimientos → Tableros (si existen).

---

## Regresiones a verificar

Después de los cambios anteriores, confirmar que estos flujos existentes siguen funcionando:

| Flujo | Verificación |
|---|---|
| Tomar snapshot | Botón en `/` → diálogo → guardar → aparece en `/snapshots` |
| Ver snapshot | `/snapshots/[id]` → tabla read-only, sin botones de editar/borrar |
| Auditoría de movimientos | `/movimientos` → lista completa de cambios |
| Cobrar dividendo | En tablero de dividendos → "Cobrar" → ingreso en dashboard |
| Tablero personalizado | Agregar tablero desde detalle de activo no-grupo → aparece y persiste |
| Edición inline de activo | En `/activos/[id]` → clic en nombre/ticker/descripción → editar → blur guarda |
| Convertir monedas | `/configuracion` → activar conversión → dashboard consolida totales |
