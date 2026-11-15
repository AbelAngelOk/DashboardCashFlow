# PRODUCT_REVIEW.md — Revisión de producto: propuesta de valor, errores y mejoras

---
Versión: 1.0.0
Última actualización: 2026-08-26
Autor: Abel Cejas (revisión asistida)
Estado: Activo
---

> Esto no es una auditoría de código — ya existe `ARCHITECTURE.md` para eso. Es una revisión de **producto**: qué promete la app, dónde no cumple esa promesa, y qué haría falta para que la cumpla mejor. Cada hallazgo está verificado contra el código real (`grep`/lectura directa), no es especulación — donde no pude verificar algo con certeza, lo digo explícitamente.

---

## 1. Qué es este producto, en una frase

Un dashboard financiero personal estructurado como **Estado de Resultados + Balance** (Ingresos/Gastos arriba, Activos/Obligaciones abajo, con un panel "Auditor" que calcula el Flujo de Caja), inspirado explícitamente en el formato del juego CASHFLOW de Robert Kiyosaki — el commit fundacional literalmente dice *"restructure dashboard to match Cashflow game format"*.

Esa herencia importa porque **no es un tracker de gastos genérico** (tipo Mint/YNAB, categorizar gastos contra un presupuesto). Es una herramienta con una filosofía específica: separar **activos que generan ingreso** de **pasivos que cuestan dinero**, y llevar el **flujo de caja** (no el saldo, no el gasto categorizado) como métrica central. Esa es la propuesta de valor real, aunque en ningún lugar de la app se lo diga al usuario explícitamente.

## 2. Fortalezas reales (verificadas)

Antes de los problemas, lo que sí funciona y diferencia esto de una planilla de cálculo:

- **Libro contable de doble entrada real** (`journal-actions.ts`, `/libro-contable`) — cada operación financiera postea un asiento débito/crédito con saldos de cuenta calculados. Esto es rigor contable de verdad, algo que ni Mint ni YNAB tienen.
- **Corte mensual con modelo de período explícito** (`lib/cutoff.ts`) — archiva ingresos/gastos, activa obligaciones pendientes, extiende dividendos recurrentes. Mucho más maduro que "reseteo manual a fin de mes".
- **Multi-moneda con monedas latinoamericanas reales** (USD/EUR/MXN/**ARS**/**USDT**) — esto NO es cosmético. Un usuario argentino lidiando con devaluación y usando stablecoins como cobertura es un caso de uso real que herramientas gringas (Mint, YNAB, incluso Fintonic) no contemplan bien. Es una ventaja competitiva genuina si el público objetivo es LatAm.
- **Reglas de ingreso con 4 ejes independientes** (`income-streams.ts`: monto fijo/porcentual, ajuste periódico, cuotas finitas/indefinidas, cobro en efectivo/especie) — modela alquileres con aumento anual, sueldos, préstamos con cuotas, todo con la misma primitiva. Más flexible que la mayoría de las herramientas de consumo.
- **Tableros de dividendos que cierran el círculo activo→ingreso** — cobrar un dividendo genera automáticamente un ingreso en el dashboard. Es exactamente el mecanismo central del juego CASHFLOW (un activo que "paga"), bien resuelto a nivel de datos.

## 3. Errores que rompen la propuesta de valor

Estos no son bugs cualquiera — son fallas específicamente en la parte de la app que sostiene la promesa central ("llevá tus finanzas como un inversor, con datos confiables").

### 3.1 La métrica que define el juego CASHFLOW nunca se muestra

El objetivo del juego de Kiyosaki es literal: que el **ingreso pasivo supere al gasto** ("salir de la carrera de la rata"). Esta app tiene TODOS los datos para calcular ese porcentaje ahora mismo — `income-streams.ts` ya distingue ingreso de activos vs. ingreso libre, `dashboard-sheet.tsx` ya calcula `totalIngresos`/`totalGastos`. Pero **en ningún lugar de la UI aparece "tu ingreso pasivo cubre el X% de tus gastos"**. El panel "Auditor" muestra Flujo de Caja (ingresos − gastos totales, mezclando sueldo con renta de un activo), no el indicador que la propia estructura de la app promete.

**Esto es el gap más grande entre lo que la app dice ser y lo que realmente muestra.**

### 3.2 El diálogo de Snapshot miente sobre lo que hace

`app/(dashboard)/page.tsx` — el diálogo "Tomar Snapshot" pide **fecha inicio y fecha fin**, con inputs de tipo `date` bien visibles. Un usuario razonablemente asume que eso filtra qué registros entran al snapshot. **No filtra nada** — `takeSnapshot()` en `finance-store.tsx` siempre congela el array completo de `records` actuales; las fechas solo arman el texto del label `period`. Ya lo documentamos como comportamiento "sorprendente pero fiel al original" durante una migración anterior — pero sorprendente-y-preservado no es lo mismo que correcto. Para un producto cuya promesa es "datos financieros confiables", un control que aparenta hacer algo que no hace es exactamente el tipo de error que rompe confianza.

### 3.3 Las categorías de activo personalizadas se rompen visualmente

Verificado en el código actual (`components/activos/asset-list.tsx:265,341`):

```tsx
? (ASSET_TYPE_LABELS[record.assetType as AssetType] ?? record.assetType)
```

Esto resuelve el nombre de la categoría contra un mapa **legado de 11 entradas fijas** (`lib/assets.ts`), no contra `useAssetCategories().nameOf()` — el resolver correcto que sí existe y que sí maneja categorías creadas por el usuario. Resultado real: si creás una categoría propia desde `/configuracion` (la app literalmente tiene esa feature), la columna "Tipo" en `/activos` te muestra el UUID crudo en vez del nombre. Ya lo habíamos detectado y corregido una vez durante otro trabajo — pero esa corrección vive en una rama distinta (`post-migracion`); en la versión activa hoy (React), el bug sigue ahí.

### 3.4 Sin forma de recuperar acceso a tu propia información financiera

No existe `/forgot-password` ni ningún flujo de recuperación (`grep` sobre toda la app: cero resultados). Para cualquier producto, esto es un problema; para uno cuya categoría entera es "tus finanzas personales" — donde perder acceso significa perder visibilidad de tu plata — es una falla de confianza más seria que en una app de notas. Hoy con 3 usuarios reales (vos, probablemente familia) el riesgo es bajo porque seguro podés resetear la contraseña a mano en la base. Deja de ser sostenible en el momento en que alguien más ajeno a vos use esto.

### 3.5 El corte mensual es una operación destructiva sin vuelta atrás visible

`lib/cutoff-actions.ts` no tiene ningún mecanismo de deshacer. La app sí ofrece, como opción, tomar un snapshot automático antes del corte — pero esa opción **no es la que está activada por defecto de forma forzada, ni se comunica al usuario que ESE snapshot es su red de seguridad**. Si alguien confirma un corte por error, no hay un botón "deshacer" — tiene que saber, por su cuenta, que puede ir a buscar el snapshot y reconstruir manualmente. Eso es pedirle al usuario que entienda la arquitectura interna para protegerse de un error de UI.

## 4. Huecos funcionales frente a la promesa "llevá tus finanzas como un inversor"

Ninguno de estos es un bug — son ausencias que le impiden a la app cumplir del todo lo que su propia estructura promete.

| Falta | Por qué importa para ESTA app específicamente |
|---|---|
| **Sin gráficos ni tendencia histórica** | `components/ui/chart.tsx` (recharts) existe en el código pero está confirmado como no usado por nadie. Los snapshots guardan fotos del pasado pero nada las compara automáticamente. Un juego sobre "hacer crecer tu ingreso pasivo" sin una curva que muestre si está creciendo es la mitad de la promesa sin cumplir. |
| **Tipos de cambio manuales, sin indicador de antigüedad** | El toggle "convertir monedas" usa tasas que el usuario carga a mano en `/configuracion`. No hay timestamp de "última actualización" visible ni alerta de que están desactualizadas. El patrimonio total (la cifra que más importa) puede estar silenciosamente mal si alguien no actualiza el dólar hace 3 meses. |
| **Sin exportación de datos (CSV/PDF)** | Verificado: cero resultados para exportación real en todo el código. Es información financiera del usuario — no poder sacarla (para el contador, para un backup, para declarar impuestos) es una limitación de confianza, no solo de conveniencia. |
| **Sin onboarding** | Un usuario nuevo entra a un dashboard con 4 tablas vacías (ahora con mejor estado visual, tras el trabajo de esta sesión) pero cero explicación de qué es un "activo" vs. "pasivo" en el sentido Kiyosaki, o por qué el Flujo de Caja es la métrica que importa. Si el público son personas sin trasfondo en finanzas (familia, amigos), esa explicación falta justo donde más se necesita. |
| **Sin presupuestos ni límites de gasto** | No hay concepto de "tope mensual por categoría" en ningún lado del código. Es coherente con la filosofía Kiyosaki (foco en activos, no en recortar gasto) pero vale la pena confirmar si es una omisión deliberada o un hueco. |
| **Notificaciones solo in-app, sin email/push** | `notifications-store.tsx` cubre 2 casos (dividendo pendiente, obligación por vencer/vencida) — pero solo se ven si abrís la app. Una obligación vencida que nadie ve hasta loguearse de nuevo pierde buena parte de su utilidad. |
| **Sin rate limiting en login** | `proxy.ts` y las rutas de auth no tienen ninguna protección contra fuerza bruta. Con datos financieros reales detrás, es una superficie de ataque que hoy es barata de cerrar y cara de ignorar. |

## 5. Propuestas de mejora, priorizadas

### Prioridad alta — corrigen la propuesta de valor central

1. **Agregar el indicador "% Libertad Financiera"** (ingreso pasivo de activos ÷ gasto total) como métrica destacada del panel Auditor, separado del Flujo de Caja genérico. Es el cálculo que la app ya tiene los datos para hacer y que define su categoría de producto.
2. **Convertir los snapshots en una serie histórica real** — aunque sea un gráfico simple de líneas (patrimonio neto y flujo de caja por snapshot), sin necesitar reinstalar recharts (se puede hacer con SVG a mano, en línea con la filosofía "sin dependencias pesadas" que ya guía este proyecto).
3. **Timestamp + alerta de antigüedad en los tipos de cambio**, para no arriesgar la cifra de patrimonio total sobre datos viejos sin que nadie lo note.

### Prioridad alta — corrigen errores de confianza

4. **Arreglar el diálogo de Snapshot**: o hacer que las fechas filtren de verdad, o sacarlas y aclarar "esto congela el dashboard completo tal como está ahora".
5. **Portar el fix de `categoryName()`** a `asset-list.tsx` (ya resuelto una vez en otra rama — es portar, no re-diseñar).
6. **Agregar recuperación de contraseña** antes de sumar cualquier usuario que no seas vos o tu círculo cercano de confianza directa.
7. **Hacer explícito y forzado el snapshot pre-corte**, con un mensaje claro de "esta es tu forma de deshacer si te equivocás" — cerrando el círculo que la app ya construyó a medias.

### Prioridad media — cierran huecos funcionales

8. Exportación CSV de records/movimientos — mínimo viable para no dejar al usuario con sus datos atrapados.
9. Onboarding de una pantalla (o tooltips contextuales) explicando activo vs. pasivo vs. flujo de caja para quien no conoce el marco de Kiyosaki.
10. Rate limiting básico en `/api/auth/*` (aunque sea en memoria, N intentos por IP por minuto).

### Prioridad baja / a validar con el dueño del producto

11. Notificaciones por email para obligaciones vencidas — solo si el plan es que alguien use esto sin abrir la app todos los días.
12. Presupuestos/límites por categoría — **solo si encaja con la filosofía del producto**; podría diluir el foco "activos, no recortar gasto" que hoy es una fortaleza, no una carencia.

## 6. Una pregunta abierta que condiciona todo lo demás

Todo este documento asume una tensión que no puedo resolver por vos: **la app está construida con arquitectura multi-tenant completa (registro, login, aislamiento de datos por usuario), pero tiene 3 usuarios reales** y ninguna señal de crecimiento (sin invitaciones, sin plan de pago, sin landing pública). Varias de las prioridades de arriba cambian mucho según la respuesta:

- Si esto se queda como **herramienta personal/familiar**: recuperación de contraseña y rate limiting bajan de prioridad (podés resolver ambos casos manualmente vos mismo), y lo que más importa es el punto 1-3 (que la herramienta te diga lo que necesitás saber para tomar mejores decisiones).
- Si hay intención de que esto **crezca a más usuarios**: los puntos 4-10 pasan a ser bloqueantes, no mejoras — son la diferencia entre un producto y un experimento personal expuesto a terceros.

Vale la pena decidir esto explícitamente antes de priorizar el resto.
