# Documentación — DashboardCashFlow

Historial de versiones: [CHANGELOG.md](CHANGELOG.md). Notas por versión en [releases/](releases/).

## Fuente de verdad por tema

| Tema | Archivo |
|---|---|
| Reglas que evitan bugs (para Claude Code) | [`../CLAUDE.md`](../CLAUDE.md) |
| Referencia de código: páginas, providers, hooks, diálogos, API de grupos | [REFERENCIA.md](REFERENCIA.md) |
| Vista de producto: funcionalidades, entidades, recorridos | [10-Producto.md](10-Producto.md) |
| Modelo de datos (tablas, campos, relaciones) | [03-Modelo-de-Datos.md](03-Modelo-de-Datos.md) |
| Capas de registro financiero (asientos, auditoría, movimientos) | [financial-domain-architecture.md](financial-domain-architecture.md) |

## Módulos

| Archivo | Módulo |
|---|---|
| [modules/dashboard.md](modules/dashboard.md) | Dashboard — Estado de Resultados + Balance |
| [modules/graficos.md](modules/graficos.md) | Gráficos — proyección de flujo, peso de obligaciones y activos |
| [modules/activos.md](modules/activos.md) | Activos |
| [modules/flujos-de-ingresos.md](modules/flujos-de-ingresos.md) | Flujos de ingresos (reglas y ocurrencias) |
| [modules/obligaciones.md](modules/obligaciones.md) | Obligaciones |
| [modules/ingresos.md](modules/ingresos.md) / [modules/gastos.md](modules/gastos.md) | Ingresos / Gastos |
| [modules/corte-mensual.md](modules/corte-mensual.md) | Corte mensual |
| [modules/libro-contable.md](modules/libro-contable.md) | Libro contable |
| [modules/snapshots.md](modules/snapshots.md) | Snapshots |
| [modules/historial.md](modules/historial.md) | Historial |
| [modules/configuracion.md](modules/configuracion.md) | Configuración |

## Otros

| Archivo | Contenido |
|---|---|
| [00-Resumen-Ejecutivo.md](00-Resumen-Ejecutivo.md) | Síntesis breve |
| [01-Arquitectura.md](01-Arquitectura.md) · [02-Reglas-de-Negocio.md](02-Reglas-de-Negocio.md) · [04-Flujos-Principales.md](04-Flujos-Principales.md) | Arquitectura, reglas y flujos (visión general; ante contradicción ganan `modules/` y `CLAUDE.md`) |
| [05-Integraciones.md](05-Integraciones.md) · [06-API.md](06-API.md) · [07-Bots-y-Automatizaciones.md](07-Bots-y-Automatizaciones.md) | Integraciones, Server Actions, bots |
| [08-Riesgos-y-Deuda-Tecnica.md](08-Riesgos-y-Deuda-Tecnica.md) · [estado-tecnico.md](estado-tecnico.md) | Riesgos y deuda técnica |
| [09-Glosario.md](09-Glosario.md) | Glosario |
| [ComponentIds.md](ComponentIds.md) · [TestScenarios.md](TestScenarios.md) | `data-testid` y escenarios de prueba |
| [historial-paginacion.md](historial-paginacion.md) · [decision-editor-rico.md](decision-editor-rico.md) | Decisiones técnicas puntuales |
| [PRUEBA_DE_CARGA.md](PRUEBA_DE_CARGA.md) | Resultados de la prueba de carga |

## Archivo histórico

[archive/](archive/) guarda propuestas ya implementadas y análisis puntuales (revisión de producto, explicación del corte, análisis de tipos de activo, refactors y bugfixes documentados en su momento). Son referencia histórica: **no describen necesariamente el estado actual**.
