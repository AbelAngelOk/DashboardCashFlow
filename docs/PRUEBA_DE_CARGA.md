---
Versión: 1.0.0
Última actualización: 2026-08-26
Autor: Abel Cejas
Estado: Activo
---

# Prueba de carga — resultados

Resultados de la prueba de carga corrida contra `localhost` en modo producción (`npm run build && npm start`), con la herramienta dedicada en `../DashboardCashFlow-loadtest` (carpeta hermana, fuera de este repo — no toca el `package.json` ni las dependencias del proyecto principal).

## Por qué localhost primero

Esta app no tiene API REST estable: el Dashboard carga datos llamando Server Actions (`"use server"`) directamente desde componentes cliente. Next.js las expone como `POST` a la URL de la página con un header `Next-Action: <id>`, pero ese id no es estable entre builds — no es una API pública versionada. Por eso el approach de la herramienta es *grabar y reproducir*, no adivinar endpoints:

1. `npm run record` abre un Chrome real (headless) una vez, hace login, navega Dashboard → Activos → Gastos → Ingresos → Obligaciones, y graba cada request `POST` con header `Next-Action` que el navegador mandó de verdad (id, path y body exactos). La grabación usada para esta corrida tiene **30 pasos**: 6 en `/` (Dashboard), 5 en `/activos`, 7 en `/gastos`, 7 en `/ingresos`, 5 en `/obligaciones`.
2. `npm run load` reproduce esa secuencia con `fetch` puro (sin navegador, para poder escalar concurrencia barato) para N usuarios virtuales en paralelo, cada uno logueado con su propia cookie de sesión, subiendo la concurrencia en escalones y parando si el error rate supera 20%.

Localhost ya revela el cuello de botella más probable: `lib/db.ts` usa `DIRECT_URL` (pooler en modo sesión, necesario para que las transacciones interactivas de Prisma funcionen) con un `Pool` de `pg` sin `max` explícito — tope de 10 conexiones por instancia. En local hay una sola instancia de Next.js corriendo, así que localhost muestra exactamente el techo de **una** instancia. En Vercel (serverless), cada instancia fría que el auto-scaling levanta abre su propio pool de hasta 10 conexiones — con tráfico repartido en varias instancias, el total de conexiones a Postgres puede superar el límite del plan de Supabase antes de que la app sufra por CPU o memoria. Ese escenario no se probó todavía (ver "Qué falta" más abajo).

**Importante**: la app target corrió con `npm run build && npm start`, no `npm run dev` — en dev, Next.js compila cada ruta la primera vez que se pide, y esa demora de compilación arruinaría los primeros escalones sin decir nada real sobre capacidad.

---

## Resultado

Escalones de concurrencia `5, 10, 20, 40, 80` usuarios virtuales, 20 segundos cada uno, deteniendo la corrida si el error rate supera 20%.

| Concurrencia (VUs) | Requests | req/s aprox. | Error rate | p50 | p95 | p99 |
|---|---|---|---|---|---|---|
| 5  | 755  | ~37.8 | 0.0%  | 108 ms | 271 ms  | 828 ms |
| 10 | 910  | ~45.5 | 0.5%  | 107 ms | 267 ms  | 307 ms |
| 20 | 1220 | ~61.0 | 0.8%  | 125 ms | 325 ms  | 391 ms |
| 40 | 940  | ~47.0 | 1.1%  | 370 ms | 1096 ms | **8834 ms** |
| 80 | 1640 | ~82.0 | **8.5%** | 772 ms | **10009 ms** | **20454 ms** |

(Reporte completo: `report-1787762477888.json` en la carpeta de la herramienta.)

### Lectura

- **De 5 a 20 VUs la app responde bien**: error rate por debajo del 1%, p95 se mantiene bajo los 330ms. Este es el rango de tráfico que la app absorbe sin degradarse.
- **En 40 VUs aparece la primera señal real, antes de que el error rate lo muestre**: el error rate sigue bajo (1.1%), pero `p99` salta a **8.8 segundos**. La latencia se dispara mucho antes de que las requests empiecen a fallar — es la firma típica de un pool de conexiones haciendo cola (Prisma esperando una conexión libre) en vez de rechazar de una. El throughput (req/s) también cae en este escalón respecto a 20 VUs, otra señal de que el sistema ya está saturado y no procesando más rápido por tener más usuarios simultáneos.
- **En 80 VUs se rompe de verdad**: error rate 8.5%, p95 supera los 10 segundos, p99 supera los 20 segundos. Tráfico sostenido de 80 usuarios concurrentes (sin pausas entre acciones — ver "Qué mide" más abajo) ya no es sostenible con una sola instancia y el pool de 10 conexiones por default.
- **El techo real está entre 20 y 40 VUs concurrentes por instancia**, no en 80: para cuando el error rate se dispara (80), la experiencia ya viene degradándose fuerte desde 40.

---

## Qué mide (y qué no)

- Cada VU repite la secuencia grabada lo más rápido posible, sin pausas entre pasos ("think time") — esto mide el **peor caso** (tráfico sostenido sin pausas), no un patrón de uso típico. Con pausas realistas entre clicks, el número de usuarios reales que la app soporta antes de este mismo techo sería mayor a 20-40.
- Solo prueba **lecturas** (navegar y cargar datos) — no crea, edita ni borra registros. Escribir a escala con datos de load-test requeriría su propia limpieza cuidadosa.
- No mide tiempo de descarga de JS/CSS del lado del cliente.
- No se corrió todavía contra un deployment de Vercel — el escenario de múltiples instancias serverless con pools de conexión independientes (el que de verdad importa para "cuánto tráfico soporta en producción") queda pendiente. La herramienta ya soporta apuntar a cualquier `TARGET_URL`; falta ejecutarlo.

## Qué falta / próximos pasos

1. Correr la misma herramienta contra un **preview deployment** de Vercel (nunca contra producción con los 3 usuarios reales activos) para ver el efecto de múltiples instancias serverless sobre el límite de conexiones de Supabase.
2. Si el pool de conexiones se confirma como el techo real (lo que sugiere fuertemente el salto de `p99` en 40 VUs), la mitigación más directa es subir `max` en el `Pool` de `pg` en `lib/db.ts` y/o revisar el límite de conexiones del plan de Supabase — no es un problema de código de la app, es configuración de infraestructura.
3. Repetir con `think time` entre pasos para tener una cifra de "usuarios reales concurrentes" en vez del peor caso de tráfico sostenido.

## Cómo reproducir

```bash
cd ../DashboardCashFlow-loadtest
npm install
npm run setup                                    # crea usuarios descartables (una vez)
TARGET_URL=http://localhost:3000 npm run record   # graba la sesión (si el árbol de providers cambió)
TARGET_URL=http://localhost:3000 npm run load     # corre la prueba
npm run cleanup                                   # borra los usuarios descartables al terminar
```

Detalle completo de la herramienta (variables de entorno, diseño, limitaciones) en `../DashboardCashFlow-loadtest/README.md`.
