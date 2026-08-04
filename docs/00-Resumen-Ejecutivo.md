---
Versión: 2.1.0
Última actualización: 2026-08-04
Autor: Abel Cejas
Estado: Activo
---

# 00 — Resumen Ejecutivo

> Este documento es la **entrada corta**. Para el detalle completo de funcionalidades, entidades de dominio y cómo se relacionan entre sí, ver [10-Producto.md](10-Producto.md).

## ¿Qué hace el sistema?

**Cash Flow** es un dashboard financiero personal que permite al usuario llevar un registro completo de su situación económica: ingresos, gastos, activos e inversiones, y obligaciones (pasivos). El sistema presenta esta información en formato de Estado de Resultados y Balance, permite tomar instantáneas (snapshots) periódicas del estado financiero, y mantiene un log de auditoría de todos los cambios realizados.

A diferencia de una hoja de cálculo, el sistema es multiusuario, persiste los datos en una base de datos en la nube, permite gestionar activos financieros complejos (acciones con dividendos, plazos fijos, bonos, bots de trading, futuros), y convierte automáticamente montos entre múltiples monedas usando tasas de cambio en tiempo real.


## ¿Para quién fue construido?

Fue construido para uso personal, con posibilidad de múltiples usuarios registrados. El perfil del usuario objetivo es alguien con inversiones diversificadas en múltiples instrumentos y monedas (principalmente en contexto latinoamericano: ARS, USD, USDT). No está orientado a empresas ni a contadores profesionales.

## Problema que resuelve

Consolidar en un solo lugar el panorama financiero personal cuando se tienen:

- Ingresos y gastos mensuales en múltiples monedas.
- Activos heterogéneos: acciones, crypto, plazos fijos, bonos, futuros, bots automáticos de trading.
- Necesidad de comparar el estado financiero entre distintos períodos (snapshots).
- Trazabilidad de todos los cambios con log de auditoría y comentarios.

## Funcionalidades principales

| Funcionalidad | Descripción |
|---|---|
| Estado de Resultados | Registro y totalización de ingresos y gastos, con cálculo de Flujo de Caja mensual |
| Balance | Registro de activos (inversiones) y pasivos (obligaciones) |
| Gestión de Activos | Módulo detallado para múltiples tipos de instrumentos financieros con historial de movimientos |
| Snapshots | Congelamiento del estado del dashboard en un punto del tiempo para comparación histórica |
| Log de Movimientos | Auditoría automática de cada creación, edición o eliminación de registros |
| Conversión de Monedas | Consolidación multi-moneda con tasas de cambio actualizables desde API externa |
| Personalización | Configuración de moneda base, tasas de cambio manuales o automáticas |
| Autenticación | Registro e inicio de sesión con email/contraseña; datos aislados por usuario |

## Instrumentos financieros soportados

- **STOCK** — Acciones con seguimiento de dividendos (estimado vs. real)
- **CRYPTO** — Criptomonedas
- **FUTURES** — Futuros (posición LONG/SHORT)
- **OPTIONS** — Opciones
- **REBALANCE_BOT** — Bot de rebalanceo: distribuye aportes/extracciones proporcionalmente entre sub-activos
- **TRADING_BOT** — Bot de trading: registra agregados de ganado/perdido/extraído con cálculo de ROI
- **TRADING** — Trading manual con monto invertido y obtenido
- **FIXED_TERM** — Plazo fijo: calcula retorno esperado con tasa anual y fecha de vencimiento
- **BOND** — Bonos: cronograma de desembolsos con seguimiento de cobros
