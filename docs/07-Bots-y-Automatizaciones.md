# 07 — Bots y Automatizaciones

## Resumen

El sistema **no implementa bots, automatizaciones, procesos batch ni jobs programados** en el sentido tradicional (cron jobs, workers de background, daemons, etc.). No hay ningún proceso que se ejecute de forma autónoma o periódica sin intervención del usuario.

Lo que sí existen son **instrumentos financieros de tipo "bot"** que el usuario registra y gestiona manualmente a través de la interfaz. Estos son modelos de activos que ayudan a trackear el rendimiento de estrategias automáticas que corren en plataformas externas (no dentro de esta aplicación).

---

## Instrumento: TRADING_BOT (Bot de Trading)

**Archivo**: `components/activos/panels/trading-bot-panel.tsx`

**Descripción**: Representa un bot de trading automático que opera en una plataforma externa. El sistema solo lleva el registro agregado de sus resultados; no interactúa con el bot en absoluto.

**Campos que el usuario gestiona manualmente**:
- `totalInvested` — Capital total invertido en el bot
- `totalGained` — Suma de todas las ganancias históricas
- `totalLost` — Suma de todas las pérdidas históricas
- `totalExtracted` — Capital retirado del bot

**Cálculos automáticos del panel**:
- `Resultado neto = totalGained - totalLost - totalExtracted`
- `ROI = ((totalGained - totalLost) / totalInvested) × 100`
- `Monto actual del activo = max(0, totalInvested - totalLost + totalGained - totalExtracted)`

**Actualización**: Solo cuando el usuario edita manualmente los agregados haciendo clic en "Editar" y guardando.

---

## Instrumento: REBALANCE_BOT (Bot de Rebalanceo)

**Archivo**: `components/activos/panels/rebalance-bot-panel.tsx`

**Descripción**: Representa un bot que distribuye inversiones entre múltiples activos y los rebalancea periódicamente. El sistema ayuda a trackear la composición del portafolio y simular operaciones de aporte y extracción proporcional.

**Capacidades del panel** (todas manuales):

### Agregar activo al bot
El usuario registra cada componente con: nombre, ticker, precio inicial, cantidad, inversión.

### Nuevo aporte (Depósito proporcional)
Al registrar un aporte:
1. Se calcula la participación de cada activo: `share = invested_i / totalInvested`
2. Se distribuye el aporte: `depositForAsset = depositAmt × share`
3. Se calculan las nuevas cantidades: `newQty = depositForAsset / currentPrice`
4. Se actualiza el precio promedio con `calcWeightedAvgPrice()`

### Extracción parcial proporcional
Al registrar una extracción:
1. Se calcula el valor total del portafolio: `Σ(currentPrice × currentQty)`
2. Se calcula el ratio: `ratio = extractAmt / total`
3. Para cada activo: `newQty = max(0, currentQty × (1 - ratio))`

**Automatismo real**: Ninguno. El usuario debe ingresar manualmente los valores de precio actuales y las cantidades para mantener el tracking actualizado.

---

## Debounce de comentarios (única "automatización" técnica)

**Archivo**: `components/finance-store.tsx` (línea ~161)

**Descripción**: Al editar un comentario en el log de movimientos, la escritura a la base de datos se difiere 600 milisegundos después del último cambio (debounce). Esto reduce las escrituras a la DB mientras el usuario escribe.

```typescript
commentTimers.current[id] = setTimeout(() => {
  fire(dbUpdateComment(id, comment))
}, 600)
```

Esto es una optimización técnica, no una automatización de negocio.

---

## Jobs programados: No existen

| Tipo | Estado |
|---|---|
| Cron jobs | No implementados |
| Workers de background | No implementados |
| Queues de mensajería (Redis, SQS, etc.) | No implementados |
| Webhooks entrantes | No implementados |
| Polling periódico de APIs externas | No implementado (las tasas de cambio se actualizan solo cuando el usuario lo solicita) |
| Alertas automáticas (vencimientos de plazos fijos, cobros de bonos) | No implementadas |
| Emails automáticos | No implementados |

---

## Oportunidades de automatización identificadas

Las siguientes automatizaciones serían valiosas para el sistema pero actualmente requieren acción manual del usuario:

1. **Actualización periódica de tasas de cambio**: Podría configurarse un cron job en Vercel para llamar a la API de tasas y actualizar un campo en la DB.

2. **Alertas de vencimiento de plazos fijos**: El campo `endDate` en `FixedTermMetadata` contiene la fecha de vencimiento. Un job diario podría notificar al usuario cuando un plazo está próximo a vencer.

3. **Alertas de cobros de bonos**: El cronograma de `BondDisbursement` con `dueDate` podría usarse para notificar cobros pendientes.

4. **Precios de activos en tiempo real**: No hay integración con APIs de precios de acciones o cripto (Binance, Yahoo Finance, CoinGecko). El usuario actualiza los precios manualmente.
