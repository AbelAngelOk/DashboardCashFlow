---
Versión: 2.4.0
Última actualización: 2026-08-17
Autor: Abel Cejas
Estado: Activo
---

# Validación — Casos de uso de activos con rendimiento periódico

## Alcance

Se validan ocho casos de uso contra el modelo implementado (v2.3.0), más dos preguntas de diseño abiertas: la naturaleza del **bono** y la posibilidad de convertir el **bot de rebalanceo** en un grupo de activos reales.

Documento complementario de [Clasificacion-Tipos-de-Activo.md](Clasificacion-Tipos-de-Activo.md), que analiza la taxonomía de cronogramas.

---

## 1. Los dos ejes de los casos

Todos los casos planteados se describen con dos variables independientes:

| | **Ingreso: ninguno** | **Ingreso: fijo nominal** | **Ingreso: porcentual** | **Ingreso: variable/ajustable** |
|---|---|---|---|---|
| **Precio variable** | Crypto, Futuros, Trading | Departamento (USD) · Bono | Acción con dividendo % · Crypto en staking | Departamento (ARS) |
| **Precio fijo** | — | — | — | — |
| **Sin precio** | — | Salario (USD) | — | Salario (ARS) |

Dos observaciones inmediatas:

- **La columna "precio fijo" está vacía.** Ningún caso real que plantees tiene precio fijo. Confirma la conclusión del análisis anterior: el valor de un activo es siempre *mark-to-market* o inexistente.
- **El modelo cubre bien la columna "fijo nominal" y mal las otras dos.** `IncomeRule.expectedAmount` es un monto nominal fijo. No existe ningún campo de porcentaje ni de ajuste — verificado por búsqueda en `lib/income-streams.ts` y `lib/income-actions.ts`.

---

## 2. Validación caso por caso

| # | Caso | Veredicto |
|---|---|---|
| 1 | Acción con precio variable y dividendo porcentual | ⚠️ **Parcial** |
| 2 | Departamento con precio variable e ingreso fijo en USD | ✅ **Soportado** |
| 3 | Departamento con precio variable e ingreso ajustado por inflación en ARS | ⚠️ **Parcial** |
| 4 | Salario cuyo valor representa los ingresos anuales esperados | 🔄 **Divergencia con lo implementado** |
| 5 | Bono con precio de mercado e ingresos contractuales | ⚠️ **Estructura correcta, cableado ausente** |
| 6 | Criptomoneda en staking | ⚠️ **Parcial** |
| 7 | Bot de trading como activo que cambia de valor | ✅ **Soportado** |
| 8 | Bot de rebalanceo | 🔍 **Ver §4** |

### Caso 1 — Acción con dividendo porcentual ⚠️

**Lo que funciona**: el precio es editable (inline en el detalle, o vía diálogo de ajuste en el dashboard). El tablero de Dividendos soporta series recurrentes y, desde v2.3.0, no se agotan.

**Lo que falta**: `DividendEntry` tiene un campo `percentage`, pero **es decorativo**. En `dividends-board.tsx` el usuario tipea el porcentaje y la ganancia estimada como dos campos independientes; el porcentaje solo se muestra en la tabla (`{d.percentage}%`) y nunca se usa para calcular nada.

Si la acción sube de precio, el dividendo estimado **no se recalcula**. Un dividendo del 5 % sobre una posición que pasó de 10.000 a 12.000 sigue estimando sobre los 10.000 originales, a menos que el usuario lo corrija a mano.

**Brecha**: no existe "ingreso porcentual" como concepto calculado, ni en dividendos ni en `IncomeRule`.

### Caso 2 — Departamento con ingreso fijo en USD ✅

Plenamente soportado hoy. Se crea el activo (con tipo `INCOME_STREAM` o un tipo personalizado desde `/configuracion`), se le agrega una regla de ingreso mensual de monto fijo con `reducesPrincipal = false`, y el precio del inmueble se ajusta a mano cuando cambia.

El alquiler entra en la proyección anual, se pre-genera a 12 meses, el Corte Mensual lo activa y se confirma con el monto real.

> **Nota al margen**: si se crea un tipo personalizado "Departamento", el listado `/activos` resuelve bien su nombre (`asset-list.tsx:175` fusiona `customAssetTypes` en el mapa de etiquetas), pero la **página de detalle no**: `activos/[id]/page.tsx:23` hace `ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType` y termina mostrando el UUID del tipo. Defecto menor, ajeno a este análisis, pero se cruza con este caso.

### Caso 3 — Departamento con ingreso ajustado por inflación ⚠️

**Lo que funciona**: `updateIncomeRule()` permite cambiar el monto esperado, y regenera las ocurrencias pendientes que todavía no llegaron al dashboard (RP-23). O sea, **el ajuste es posible**.

**Lo que falta**: es enteramente manual y sin memoria.

- No hay "ajustar un X % cada N períodos"
- No queda registro de los tramos: la regla solo conserva el monto vigente
- La proyección anual se recalcula con el monto nuevo, así que **una regla ajustada tres veces en el año proyecta como si siempre hubiera valido el último monto** — sobreestima el año en curso

Para un alquiler con ajuste trimestral en ARS, el usuario tiene que acordarse de editar la regla cada tres meses, y la proyección anual nunca es fiel.

### Caso 4 — Salario 🔄 Divergencia

Acá hay una diferencia real entre lo que describís y lo que implementé.

**Lo que decís**: *"no tiene precio pero por definición al usuario le damos un valor que representa los ingresos esperados anuales. Esto ya ocurre con un tipo de obligación."*

Tenés razón en la simetría. En `recalcularObligation()`, una obligación `RECURRING` calcula:

```
amount = Σ (regla.expectedAmount × ocurrenciasPorAño)
```

Es decir, **el `amount` de una obligación recurrente ES su costo anual proyectado**, y eso es lo que aparece en el Balance.

**Lo que implementé**: el preset Salario nace con `amount = 0`, con el argumento de que un sueldo no es patrimonio (regla RB-F11). La proyección anual existe pero vive solo en el panel del activo, no en el `amount`.

**Veredicto**: mi decisión rompe la simetría que vos pedías. El comportamiento simétrico sería:

| Activo | `amount` debería ser |
|---|---|
| Sin reglas que descuenten capital (salario, alquiler) | Ganancia anual proyectada |
| Con reglas que descuenten capital (préstamo, cuotas) | Capital pendiente |

Que es exactamente cómo se comportan las obligaciones (`RECURRING` → proyección anual; `INSTALLMENT` → pendiente).

**Consecuencia a decidir conscientemente**: con ese cambio, un salario de 800.000 ARS mensuales aparecería en el Balance como un activo de 9.600.000 ARS, y tu patrimonio neto subiría en esa cifra. Es coherente con cómo ya tratás las obligaciones —donde el costo anual proyectado infla el pasivo de la misma forma— pero conviene que sea una decisión explícita y no un efecto colateral.

### Caso 5 — Bono ⚠️ Ver análisis en §3

### Caso 6 — Criptomoneda en staking ⚠️

**Lo que funciona**: cualquier activo, incluido `CRYPTO`, puede llevar reglas de ingreso — `IncomeRulesSection` se monta para todos los tipos salvo `GROUP`. Una recompensa de staking de monto fijo mensual funciona hoy.

**Dos brechas**:

1. **El staking se expresa como APY**, o sea un porcentaje sobre la tenencia. Misma brecha que el caso 1: no hay ingreso porcentual calculado.

2. **El staking se cobra en especie, no en efectivo.** La recompensa son más monedas, no pesos. El modelo genera un `Record` de tipo ingreso con un monto en moneda, y el asiento es `efectivo / ingresos`. Pero no entró efectivo: aumentó `currentQty` del activo.

   Ese segundo punto es conceptualmente más profundo que el primero. Hoy el modelo **no distingue ingreso en efectivo de ingreso en especie**, y para staking, dividendos reinvertidos o cupones capitalizados la diferencia importa: el patrimonio sube, la caja no.

### Caso 7 — Bot de trading ✅

Tu preferencia —*"prefiero que se ignoren las operaciones de los bots"*— coincide exactamente con el diseño actual. `TRADING_BOT` guarda agregados (`totalInvested`, `totalGained`, `totalLost`, `totalExtracted`) y su valor se ajusta con movimientos `ADJUSTMENT`, sin registrar operación por operación.

No hace falta cambiar nada. El vehículo correcto para reflejar el cambio de valor es el diálogo de ajuste del dashboard, que ya crea el `ADJUSTMENT` con comentario.

---

## 3. Análisis: ¿qué es un bono?

**Tu hipótesis**: *"un activo con precio variable e ingresos fijos, y no un valor fijo que se va depreciando"*.

**Es correcta.** Y la intuición contraria confunde dos cosas que se mueven por razones distintas:

| Magnitud | Cómo se mueve | Determinismo |
|---|---|---|
| **Capital residual** (valor nominal pendiente) | Baja en cada amortización, según el cronograma contractual | Determinista — se sabe desde el día 1 |
| **Precio de mercado** | Se mueve por tasa de interés, riesgo crediticio y liquidez | Estocástico — no se sabe |

Un bono que amortiza no "se deprecia": su capital residual baja de forma contractual, mientras su precio de mercado se mueve por su cuenta. Los dos números pueden ir en direcciones opuestas — un bono puede haber amortizado la mitad del capital y cotizar por encima de la par si bajaron las tasas.

**Clasificación correcta**: precio variable + cronograma de flujos finito y contractual.

### La pieza que faltaba

Un pago de bono normalmente **mezcla interés y amortización de capital**. Esa es exactamente la distinción `reducesPrincipal` que ya existe en `IncomeRule`:

- Cupón de interés → `reducesPrincipal = false` → asiento `efectivo / ingresos`
- Amortización de capital → `reducesPrincipal = true` → asiento `efectivo / activos`

**Un bono es, estructuralmente, el preset "Préstamo otorgado" con cronograma finito en vez de recurrente.** Le prestaste plata a un emisor y te la devuelve con intereses.

### Estado del modelo

`BondMetadata.disbursements[]` tiene la forma correcta (fecha + monto + cobrado) pero está desconectado de todo:

| Aspecto | Estado |
|---|---|
| Cronograma finito con fechas y montos | ✅ Existe |
| Cobrar genera un ingreso | ❌ Solo cambia un booleano `collected` |
| Distingue interés de amortización | ❌ No |
| Baja el capital al amortizar | ❌ No |
| Entra en la proyección anual | ❌ No |
| Participa del Corte Mensual | ❌ No |
| Genera asiento contable | ❌ No |

O sea: **cobrar un cupón de bono hoy no mueve ni un peso en tu dashboard**. Marca un checkbox y nada más.

---

## 4. Análisis: ¿el bot de rebalanceo debería ser un grupo de activos reales?

### 4.1 La pregunta de fondo

Planteás el criterio con precisión: *"si el bot da un precio menor pero tiene más cantidad en los activos se considera positivo; si tiene menos cantidad se nota que en las operaciones se perdió cantidad."*

Ese criterio es correcto y es la clave de todo el análisis: **para un bot de rebalanceo la métrica de desempeño es la cantidad, no el valor.** El precio se mueve por el mercado —no es mérito ni culpa del bot—; la cantidad de unidades solo cambia por lo que el bot hizo.

### 4.2 Por qué hoy ese indicador no se puede calcular

`RebalanceBotMetadata.assets[]` **sí** guarda `initialQty` y `currentQty`, y el panel los muestra en columnas separadas (`rebalance-bot-panel.tsx:191,194`). Parecería suficiente. No lo es, porque **`currentQty` cambia por tres causas distintas que quedan confundidas**:

| Causa | Dónde ocurre | ¿Es señal del bot? |
|---|---|---|
| Operaciones del bot | Ajuste manual del usuario | ✅ Sí |
| Depósito del usuario | `rebalance-bot-panel.tsx:122` — suma cantidad prorrateada | ❌ No |
| Extracción del usuario | `rebalance-bot-panel.tsx:105` — resta proporcionalmente | ❌ No |

Con las tres causas mezcladas en un solo número, `currentQty < initialQty` **no significa que el bot perdió unidades**: puede significar simplemente que retiraste plata. El indicador que querés no es derivable del estado actual.

> **Detalle adicional**: en la línea 122 el depósito llama `calcWeightedAvgPrice(a.currentQty, a.currentPrice, newQty, a.currentPrice)`, pasando `currentPrice` como precio previo **y** como precio nuevo. El promedio ponderado devuelve siempre `currentPrice`, o sea que la llamada no hace nada. Es inocuo si `currentPrice` significa "precio de mercado" (un depósito no debería moverlo), pero delata que el campo mezcla dos conceptos: precio de mercado y precio promedio de compra.

### 4.3 Comparación de las dos arquitecturas

| Aspecto | Hoy: sub-activos en JSON | Propuesta: activos reales agrupados |
|---|---|---|
| Valor del grupo | Recalculado a mano en el panel | Derivado de los hijos por `computeGroupValue()` ✅ |
| Cantidad inicial | `initialQty` en JSON ✅ | **No existe**: `Record` tiene `currentQty` y `avgBuyPrice`, no `initialQty` ⚠️ |
| Trazabilidad de cambios de cantidad | Ninguna | `FinancialMovement` por sub-activo ✅ |
| Separar causa de los cambios | ❌ Imposible | ✅ Por `movementType` |
| Marcadores, tableros, reglas de ingreso por sub-activo | ❌ | ✅ |
| Auditoría | ❌ | ✅ |
| Multi-moneda por sub-activo | Campo `currency` sin conversión | `computeGroupValue()` con desglose o conversión ✅ |
| Rebalanceo proporcional | Implementado en el panel | Habría que reimplementarlo sobre los hijos |
| Costo de migración | — | Alto: migrar JSON a `Record`s, preservando cantidades |

### 4.4 Veredicto

**Sí, conviene migrarlos a activos reales agrupados — y no solo por prolijidad: es la única forma de obtener el indicador que querés.**

Con sub-activos como `Record`s con `FinancialMovement`, el indicador se deriva sin necesidad de guardar `initialQty`:

```
cantidadAportadaNeta = Σ qty(BUY, DEPOSIT) − Σ qty(SELL, EXTRACT)

Δbot = currentQty − cantidadAportadaNeta
```

| Resultado | Lectura |
|---|---|
| `Δbot > 0` | El bot **acumuló** unidades: operó a favor |
| `Δbot = 0` | El bot no movió la aguja en cantidad |
| `Δbot < 0` | El bot **perdió** unidades en las operaciones |

Y es independiente del precio, que es justamente lo que pedías: un `Δbot > 0` con precio a la baja se lee como desempeño positivo del bot en un mercado adverso.

Guardar `initialQty` como campo también funcionaría y es más barato, pero es frágil: hay que acordarse de no tocarlo en depósitos y extracciones, que es precisamente el error que tiene el modelo actual. Derivarlo de los movimientos no puede desincronizarse.

**Matiz sobre el rebalanceo**: la operación de rebalanceo proporcional del panel actual es genuinamente útil y no la da gratis la funcionalidad de grupos. Habría que reimplementarla como una acción sobre los hijos del grupo. Eso es trabajo real, no solo migración de datos.

---

## 5. Brechas consolidadas

| # | Brecha | Casos afectados | Severidad |
|---|---|---|---|
| **B1** | No existe ingreso **porcentual** calculado sobre el valor del activo | 1 (dividendo %), 6 (staking APY) | Alta |
| **B2** | No existe **ajuste periódico** de monto; el cambio es manual y sin historial, y la proyección anual queda sobreestimada | 3 (alquiler ARS), 4 (salario ARS) | Alta |
| **B3** | El `amount` de un `INCOME_STREAM` sin capital es `0`, no la proyección anual — rompe la simetría con obligaciones | 4 (salario) | Media |
| **B4** | `BOND` tiene cronograma pero no genera ingresos, ni asientos, ni distingue interés de amortización | 5 (bono) | Media |
| **B5** | No se distingue ingreso **en efectivo** de ingreso **en especie** | 6 (staking) | Media |
| **B6** | En `REBALANCE_BOT`, `currentQty` mezcla operaciones del bot con aportes y retiros del usuario | 8 (bot rebalanceo) | Media |
| **B7** | `Record` no tiene `initialQty` ni forma derivada de baseline de cantidad | 8 (bot rebalanceo) | Media |
| **B8** | La página de detalle no resuelve el nombre de los tipos de activo personalizados | 2 (departamento) | Baja |

---

## 6. Recomendaciones

Ninguna está implementada. Ordenadas por relación valor/costo.

| # | Recomendación | Resuelve | Esfuerzo |
|---|---|---|---|
| **R1** | `IncomeRule.amountMode: "FIXED" \| "PERCENTAGE"`. En modo porcentual, la ocurrencia calcula `asset.amount × pct / 100` al generarse | B1 | Bajo |
| **R2** | `IncomeRule.adjustment: { pct, everyNPeriods }` — ajuste automático al generar cada ocurrencia, más un historial de tramos para que la proyección anual sea fiel | B2 | Medio |
| **R3** | `amount` de `INCOME_STREAM` = proyección anual cuando ninguna regla descuenta capital; capital pendiente cuando alguna lo hace. Espejo de `recalcularObligation()` | B3 | Bajo |
| **R4** | Migrar `BondDisbursement` a reglas de ingreso `INSTALLMENT` con `reducesPrincipal` por tramo (interés vs. amortización) | B4 | Medio |
| **R5** | `IncomeRule.settlement: "CASH" \| "IN_KIND"`. En especie, el cobro suma a `currentQty` en vez de generar ingreso en efectivo | B5 | Medio |
| **R6** | Migrar los sub-activos de `REBALANCE_BOT` a `Record`s agrupados y derivar `Δbot` de los movimientos | B6, B7 | Alto |
| **R7** | Resolver los tipos personalizados en la página de detalle, como ya hace `asset-list.tsx` | B8 | Trivial |

### Orden sugerido

**R1 y R3 primero**: son baratos, independientes entre sí, y desbloquean tres de los ocho casos. R3 además es una corrección de simetría que vos ya identificaste.

**R2 después**: es el que más impacto tiene en un contexto argentino, pero requiere decidir si el ajuste es automático por porcentaje o manual con historial de tramos. Vale la pena decidirlo antes de escribir código.

**R4 y R5** son mejoras de fidelidad conceptual; pueden esperar.

**R6 al final**: es el de mayor esfuerzo y arrastra una migración de datos desde JSON. Conviene hacerlo cuando R1–R3 hayan validado que el modelo de reglas aguanta los casos reales.

> **Advertencia sobre R6**: la operación de rebalanceo proporcional del panel actual no la reemplaza la funcionalidad de grupos. Migrar sin reimplementarla sería una regresión funcional.

---

## Referencias

| Documento | Relación |
|---|---|
| [Clasificacion-Tipos-de-Activo.md](Clasificacion-Tipos-de-Activo.md) | Taxonomía de cronogramas y duplicación de mecanismos |
| [modules/flujos-de-ingresos.md](../modules/flujos-de-ingresos.md) | `IncomeRule`, `reducesPrincipal`, tratamiento contable |
| [modules/obligaciones.md](../modules/obligaciones.md) | `recalcularObligation()` y el `amount` como proyección anual |
| [10-Producto.md](../10-Producto.md) | Los tipos de activo en lenguaje de producto |
