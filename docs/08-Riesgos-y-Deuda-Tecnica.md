# 08 — Riesgos y Deuda Técnica

## Riesgos de Seguridad

### RS-01: Credenciales sensibles en archivos de entorno probablemente trackeados

**Severidad**: Alta

**Descripción**: Los archivos `.env` y `.env.local` contienen la cadena de conexión a la base de datos (con usuario y contraseña de Supabase) y el `NEXTAUTH_SECRET`. Ambos archivos existen en el directorio del proyecto.

**Riesgo**: Si el repositorio es o fue alguna vez público, o si los archivos se commitearon por error, las credenciales pueden estar expuestas. La rotación de credenciales es la única mitigación efectiva.

**Verificar**: Ejecutar `git log --all -- .env .env.local` para ver si estos archivos aparecen en el historial de git.

---

### RS-02: Ausencia de validación de contraseña en el servidor

**Severidad**: Media

**Descripción**: La validación de longitud mínima de contraseña (8 caracteres) solo existe en el frontend (`app/register/page.tsx`). La Server Action `registerUser()` acepta cualquier contraseña sin validación adicional.

**Riesgo**: Una llamada directa a la Server Action puede registrar una contraseña vacía o de un solo carácter.

---

### RS-03: Race condition en el registro de usuario

**Severidad**: Baja (impacto limitado)

**Descripción**: La verificación de email duplicado en `registerUser()` se hace con `findUnique` antes de `create`, sin transacción atómica. Dos registros concurrentes del mismo email pueden pasar la validación.

**Mitigación existente**: La constraint `@unique` en la DB actuará como barrera final y devolverá un error de Prisma, aunque el mensaje de error al usuario puede no ser el amigable "Ya existe una cuenta con ese email".

---

### RS-04: Datos de usuario compartidos entre dispositivos pero configuración no

**Severidad**: Baja (más UX que seguridad)

**Descripción**: Los datos financieros se sincronizan vía DB, pero la configuración de tasas de cambio está en `localStorage` y es por dispositivo.

---

## Riesgos de Datos

### RD-01: Mutaciones optimistas sin rollback visible

**Severidad**: Alta

**Descripción**: Todas las mutaciones del dashboard (`createRecord`, `editRecord`, `deleteRecord`, `takeSnapshot`) actualizan el estado React inmediatamente, sin esperar confirmación del servidor. La función `fire(promise)` ejecuta la operación de DB en background y los errores solo se loguean a `console.error`.

**Escenario de riesgo**: Si el servidor falla (timeout de red, sesión expirada, error de DB), el usuario verá sus cambios reflejados pero en la próxima recarga perderá esos cambios sin ninguna advertencia.

**Archivo**: `components/finance-store.tsx`, función `fire()` (línea ~45)

---

### RD-02: El `NEXTAUTH_SECRET` actual es inseguro para producción si se rota

**Severidad**: Alta

**Descripción**: El valor del `NEXTAUTH_SECRET` está hardcodeado en `.env`. Si se necesita rotar este secreto (por compromiso de seguridad), todos los usuarios existentes perderán su sesión activa y deberán volver a iniciar sesión.

---

### RD-03: Crecimiento sin límite de la tabla `records` por soft delete

**Severidad**: Media (largo plazo)

**Descripción**: Los registros nunca se eliminan físicamente. La tabla `records` crece indefinidamente. No hay mecanismo de purga ni archivado.

---

### RD-04: Strings de fecha en lugar de DateTime

**Severidad**: Media

**Descripción**: Los campos `date` en `AuditLog` y `created_at` en `Snapshot` son strings formateados en español (ej: "19/06/2026, 14:30"). Esto impide:
- Ordenar por fecha eficientemente en la DB.
- Filtrar por rangos de fecha.
- Comparar fechas correctamente.

Actualmente la ordenación de `AuditLog` se hace por el campo `date` como string, lo que podría dar resultados incorrectos si el formato cambia o si hay datos mixtos.

---

### RD-05: Tabla `Groups`/`RecordGroups` huérfana

**Severidad**: Baja

**Descripción**: El schema de Prisma tiene los modelos `Group` y `RecordGroup`, pero la funcionalidad de agrupación en la UI usa `parentId` en `records` directamente. Las tablas `groups` y `record_groups` posiblemente estén vacías o sin uso activo.

---

## Deuda Técnica

### DT-01: CLAUDE.md desactualizado — describe una arquitectura que ya no es actual

**Severidad**: Media

**Descripción**: El archivo `CLAUDE.md` describe el sistema como "sin base de datos, sin localStorage, sin API — datos resetean on page refresh". Esto era cierto en las primeras versiones pero ya no lo es: el sistema tiene PostgreSQL (Supabase), NextAuth, Prisma, y datos persistentes.

**Impacto**: Confusión para desarrolladores que lean el CLAUDE.md y asuman que no hay backend.

---

### DT-02: Tabla polimórfica `records` mezcla tipos con schemas distintos

**Severidad**: Media

**Descripción**: La tabla `records` alberga tanto registros simples (ingresos, gastos, pasivos) como activos financieros complejos con campos como `ticker`, `current_quantity`, `avg_buy_price`, `metadata`. Los registros simples tienen la mayoría de estos campos en `NULL`.

**Impacto**: Columnas nulas en masa, mayor complejidad en queries, riesgo de insertar datos en columnas equivocadas.

---

### DT-03: Duplicación de concepto "Movement"

**Severidad**: Media

**Descripción**: Existen dos entidades llamadas "Movement" en el sistema:
1. `Movement` / `AuditLog` (`lib/finance.ts`, tabla `movements`) — Log de auditoría de cambios en registros del dashboard.
2. `AssetFinancialMovement` / `FinancialMovement` (`lib/assets.ts`, tabla `financial_movements`) — Historial de operaciones financieras en activos.

El mismo término "movimiento" se usa para dos cosas distintas, lo que puede generar confusión. La página `/movimientos` muestra el log de auditoría, no los movimientos financieros de activos.

---

### DT-04: Reclamación de datos huérfanos es un vestigio de migración

**Severidad**: Baja

**Descripción**: La lógica en `registerUser()` que reclama records/snapshots/auditLogs sin `userId` fue necesaria durante la migración inicial del sistema (cuando se agregó autenticación a un sistema que no la tenía). Si ya no existen datos huérfanos en producción, este código es letra muerta con una potencial race condition.

---

### DT-05: Fuentes Geist posiblemente no aplicadas

**Severidad**: Baja

**Descripción**: En `app/layout.tsx`, las fuentes se importan pero se asignan a variables con prefijo `_` (`_geist`, `_geistMono`) que luego no se usan. Esto sugiere que las fuentes se cargan pero no se aplican al `body` o a ningún elemento.

---

### DT-06: Sin manejo de error de sesión expirada en mutaciones

**Severidad**: Media

**Descripción**: Cuando un JWT expira durante una sesión activa, las Server Actions lanzarán `Error("No autorizado")`. Esta excepción es capturada por la función `fire()` que solo hace `console.error`, sin notificar al usuario ni redirigirlo al login.

**Escenario**: El usuario lleva horas en el dashboard, su sesión expira, hace cambios → los cambios no se guardan sin ninguna indicación visual.

---

### DT-07: Sin tests

**Severidad**: Media

**Descripción**: El proyecto no tiene tests unitarios, de integración, ni end-to-end (a pesar de tener `playwright` como dependencia instalada). No hay cobertura de las reglas de negocio críticas como cálculos financieros, conversión de monedas, o flujos de cobro.

---

### DT-08: `package.json` sin nombre de proyecto real

**Severidad**: Baja (cosmético)

**Descripción**: El campo `"name"` en `package.json` es `"my-project"`, que es el nombre por defecto de Next.js. No refleja el nombre real del proyecto.

---

### DT-09: Validación de nombres de activos solo en el cliente

**Severidad**: Media

**Descripción**: La unicidad del nombre de activos se verifica contra el array en memoria. En escenarios de múltiples pestañas, dispositivos o llamadas directas a Server Actions, se pueden crear activos con nombres duplicados.

---

## Funcionalidades incompletas identificadas

| Funcionalidad | Evidencia | Estado estimado |
|---|---|---|
| `fields startDate, endDate, data` en `Snapshot` | Existen en el schema pero ningún código los usa | Planificadas para "Fase 4" (comentario en schema) |
| Tabla `Groups`/`RecordGroups` | Existe en schema, no hay UI para gestionarlas | Posiblemente abandonada a favor de `parentId` |
| Página `/configuracion` — tema visual | El componente `ThemeProvider` existe pero no hay UI de selección de tema | No expuesta al usuario |
| Proveedor social OAuth | Espacio en `lib/auth.ts` para agregar más providers | No implementado |
| Recuperación de contraseña | No hay endpoint ni UI de "olvidé mi contraseña" | No implementado |
| Tipos `OPTIONS` y `CRYPTO` | Están definidos en `ASSET_TYPE_LABELS` pero no tienen panel específico | Usan el panel genérico (`generic-asset-panel`) |
| Tipo `FUTURES` | Tiene un panel (`futures-panel.tsx`) y `FuturesMetadata` en tipos, pero el panel no fue revisado en detalle | Parcialmente implementado |
| Tabla de seguimiento (`TrackingConfig`) | Existe en tipos y hay `AssetTrackingSection`, pero el código de persistencia está en `updateTracking()` | Aparentemente implementado |

---

## Resumen de prioridades

| # | Riesgo/Deuda | Severidad | Acción recomendada |
|---|---|---|---|
| 1 | RS-01: Credenciales en .env | Alta | Verificar .gitignore y rotar credenciales si fue commiteado |
| 2 | RD-01: Mutaciones sin rollback | Alta | Agregar notificación de error al usuario cuando `fire()` falla |
| 3 | DT-01: CLAUDE.md desactualizado | Media | Actualizar la documentación interna |
| 4 | DT-06: Sesión expirada silenciosa | Media | Detectar error 401 en Server Actions y redirigir a login |
| 5 | DT-07: Sin tests | Media | Agregar tests de las funciones de cálculo financiero |
| 6 | RS-02: Validación de contraseña solo en cliente | Media | Agregar validación en `registerUser()` |
| 7 | RD-04: Strings de fecha | Media | Migrar a DateTime en futura iteración |
| 8 | DT-02: Tabla polimórfica | Media | Considerar separar activos en tabla propia a futuro |
