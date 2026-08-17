# Documentación — DashboardCashFlow

> **Versión actual del proyecto: 2.5.0** — Ver [CHANGELOG.md](CHANGELOG.md) para historial completo.

## Empezar por acá

| Archivo | Contenido |
|---|---|
| [10-Producto.md](10-Producto.md) | **Vista de producto**: funcionalidades, entidades, cómo se relacionan, ciclos de vida y recorridos de usuario |
| [00-Resumen-Ejecutivo.md](00-Resumen-Ejecutivo.md) | Síntesis breve del sistema |

## Documentación por módulo

| Archivo | Módulo |
|---|---|
| [modules/dashboard.md](modules/dashboard.md) | Dashboard — Estado de Resultados + Balance |
| [modules/activos.md](modules/activos.md) | Activos — Portafolio de inversiones |
| [modules/gastos.md](modules/gastos.md) | Gastos — Registros de gastos con agrupación y versionado |
| [modules/ingresos.md](modules/ingresos.md) | Ingresos — Registros de ingresos con agrupación y versionado |
| [modules/obligaciones.md](modules/obligaciones.md) | Obligaciones — Deudas y compromisos periódicos |
| [modules/flujos-de-ingresos.md](modules/flujos-de-ingresos.md) | Flujos de Ingresos — Sueldos, préstamos y rentas periódicas |
| [modules/libro-contable.md](modules/libro-contable.md) | Libro Contable — Doble entrada |
| [modules/corte-mensual.md](modules/corte-mensual.md) | Corte Mensual — Cierre de período y armado del mes entrante |
| [modules/snapshots.md](modules/snapshots.md) | Snapshots — Capturas periódicas del estado |
| [modules/historial.md](modules/historial.md) | Historial — Log de auditoría paginado |
| [modules/configuracion.md](modules/configuracion.md) | Configuración — Monedas, tipos, marcadores |

## Releases

| Versión | Archivo |
|---------|---------|
| v2.5.0 | [releases/v2.5.0.md](releases/v2.5.0.md) |
| v2.4.0 | [releases/v2.4.0.md](releases/v2.4.0.md) |
| v2.3.0 | [releases/v2.3.0.md](releases/v2.3.0.md) |
| v2.2.0 | [releases/v2.2.0.md](releases/v2.2.0.md) |
| v2.1.0 | [releases/v2.1.0.md](releases/v2.1.0.md) |
| v2.0.0 | [releases/v2.0.0.md](releases/v2.0.0.md) |

## Referencia técnica

| Archivo | Contenido |
|---|---|
| [10-Producto.md](10-Producto.md) | Funcionalidades, entidades de dominio, relaciones, ciclos de vida, recorridos y límites |
| [01-Arquitectura.md](01-Arquitectura.md) | Stack, layout de componentes, providers, rutas, Server Actions, flujo de datos |
| [02-Reglas-de-Negocio.md](02-Reglas-de-Negocio.md) | Reglas de negocio de activos, snapshots, obligaciones |
| [03-Modelo-de-Datos.md](03-Modelo-de-Datos.md) | Todas las tablas de la DB con campos, índices, relaciones |
| [04-Flujos-Principales.md](04-Flujos-Principales.md) | 13 flujos end-to-end (login, crear activo, snapshot, cobrar dividendo, etc.) |
| [05-Integraciones.md](05-Integraciones.md) | Integraciones externas (Supabase, er-api.com, Vercel Analytics) |
| [06-API.md](06-API.md) | Referencia de Server Actions (endpoints internos) |
| [07-Bots-y-Automatizaciones.md](07-Bots-y-Automatizaciones.md) | Lógica de TradingBot y RebalanceBot |
| [08-Riesgos-y-Deuda-Tecnica.md](08-Riesgos-y-Deuda-Tecnica.md) | Riesgos de seguridad, datos y deuda técnica con severidades |
| [09-Glosario.md](09-Glosario.md) | Términos del dominio financiero usados en el proyecto |

## Arquitectura especializada

| Archivo | Contenido |
|---|---|
| [financial-domain-architecture.md](financial-domain-architecture.md) | Tres capas de registro financiero: JournalEntry, AuditLog, FinancialMovement |
| [historial-paginacion.md](historial-paginacion.md) | Arquitectura de `/historial`: Server Component + Suspense, hooks, paginación server-side |
| [decision-editor-rico.md](decision-editor-rico.md) | Decisión de usar TipTap v3 para el campo description de activos |

## Estado del proyecto

| Archivo | Contenido |
|---|---|
| [estado-tecnico.md](estado-tecnico.md) | Resumen consolidado de issues: inconsistencias, refactorizaciones, código muerto |
| [ComponentIds.md](ComponentIds.md) | Atributos `data-testid` de todos los contenedores visuales principales |
| [TestScenarios.md](TestScenarios.md) | Escenarios de prueba documentados |

## Módulos y propuestas

| Archivo | Contenido |
|---|---|
| [modulo-obligaciones.md](modulo-obligaciones.md) | Módulo de obligaciones: tipos, reglas, cuotas, pagos |
| [obligaciones-ajustes-v2.md](obligaciones-ajustes-v2.md) | Propuestas de ajuste v2 para el módulo de obligaciones |
| [cambios-grupos-liquidacion-activos.md](cambios-grupos-liquidacion-activos.md) | Cambios en grupos y liquidación de activos |
| [bugfix-conversion-divisas-grupos.md](bugfix-conversion-divisas-grupos.md) | Fix de conversión de divisas en grupos de activos |

## Archivo

Documentos de propuesta ya implementados, conservados como referencia histórica:

| Archivo | Contenido original |
|---|---|
| [archive/modulo-gastos-relaciones.md](archive/modulo-gastos-relaciones.md) | Propuesta de `/gastos` — implementado |
| [archive/modulo-ingresos-relaciones.md](archive/modulo-ingresos-relaciones.md) | Propuesta de `/ingresos` — implementado |
| [archive/refactor-modulo-gastos.md](archive/refactor-modulo-gastos.md) | Propuesta de refactor de gastos — implementado |

## Análisis

Análisis detallados generados durante la auditoría de código:

- [analisis/Clasificacion-Tipos-de-Activo.md](analisis/Clasificacion-Tipos-de-Activo.md) — ¿los tipos de activo entran en la taxonomía Recurrente/Cuotas/Fijo de las obligaciones?
- [analisis/Validacion-Casos-de-Uso-Activos.md](analisis/Validacion-Casos-de-Uso-Activos.md) — validación de 8 casos con rendimiento periódico; análisis del bono y del bot de rebalanceo
- [analisis/Inconsistencias.md](analisis/Inconsistencias.md)
- [analisis/Refactorizaciones-Recomendadas.md](analisis/Refactorizaciones-Recomendadas.md)
- [analisis/Codigo-Muerto.md](analisis/Codigo-Muerto.md)
