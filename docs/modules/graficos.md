# Módulo: Gráficos

## Objetivo

Ver en un solo lugar hacia dónde va la plata: qué meses vienen pesados en gastos ("meses de dolor"), cuáles traen más ingresos ("meses de bonanza"), si las obligaciones están subiendo o bajando, y qué obligaciones y activos pesan más.

**Ruta**: `/graficos` (sidebar → Inicio). Los mismos gráficos aparecen también en su módulo: proyección de ingresos en `/ingresos`, de gastos en `/gastos`, los de obligaciones en `/obligaciones` y los de activos en `/activos`.

## De dónde salen los datos

`loadFlowSchedule()` (`lib/chart-actions.ts`) junta todo lo que **tiene fecha** en activos y obligaciones, de 6 meses atrás a 11 adelante:

| Serie | Origen | Monto |
|---|---|---|
| Ingresos | `IncomeOccurrence` (PENDING / COLLECTED) | real si ya se cobró, esperado si no |
| Ingresos | Dividendos de los tableros (`metadata.boards[].dividends`, por `month`) | `actualGain` si se cobró, `estimatedGain` si no |
| Obligaciones | `ObligationPayment` (PAID / PENDING) con `expectedDate` | el pagado o el esperado |
| Obligaciones | `ObligationInstallment` (PENDING / OVERDUE) | esperado |

Los ingresos y gastos cargados a mano no tienen fecha de vencimiento y **no entran** a las proyecciones. Las obligaciones fijas sin cronograma tampoco. Todo se convierte a la moneda base de Personalización.

Helpers puros en `lib/charts.ts` (meses, totales por mes, pico).

## Gráficos

| Gráfico | Forma | Qué responde |
|---|---|---|
| Ingresos proyectados | Línea, 12 meses | El mes de mayor ingreso, marcado en verde como "Pico" |
| Gastos proyectados | Línea, 12 meses | El mes más pesado, marcado en rojo como "Pico" |
| Peso mensual de las obligaciones | Línea, 6 meses atrás + 12 adelante (punteado = proyectado, línea "hoy") | Promedio de los 6 meses anteriores vs los 6 próximos: ▲ subiendo / ▼ bajando |
| Las obligaciones más pesadas | Barras horizontales ordenadas | Valor de cada obligación activa (costo anual si es recurrente) |
| Evolución de los activos | Línea por snapshot + hoy | Cuánto creció o bajó el total desde el primer snapshot |
| Los activos más pesados | Barras horizontales | Valor de cada activo; un grupo cuenta como una unidad |
| Patrimonio neto / Flujo de caja | Línea por snapshot | Igual que en `/snapshots` |

## Decisiones de diseño

- Componentes propios en SVG (`components/charts/line-chart.tsx`, `bar-list.tsx`), sin librerías: mismo criterio que `trend-chart.tsx`.
- Monocromo como el resto de la app; el único color es el punto del pico (verde/rojo) y siempre va con la etiqueta "Pico", nunca solo.
- Cada gráfico tiene tooltip (mouse o flechas del teclado) y una tabla desplegable "Ver tabla" con todos los valores.
- Más de 8 barras se pliegan en "Otros".

## Snapshots y grupos de activos

Los snapshots guardaban el padre de un grupo **y** sus hijos, así que el total de activos de un snapshot contaba el grupo dos veces. Desde v2.8.0 los snapshots nuevos no guardan padres de grupo; para los viejos, `snapshotAssetsTotal()` descarta los registros cuyo nombre coincide con un grupo actual (heurística: `SnapshotRecord` no guarda `parentId`). El gráfico de patrimonio de `/snapshots` usa la misma corrección.
