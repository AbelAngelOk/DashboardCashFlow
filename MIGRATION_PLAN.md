# MIGRATION_PLAN.md — De Next.js/React a HTML + CSS + JS vanilla

---
Versión: 2.0.0
Última actualización: 2026-08-25
Autor: Abel Cejas
Estado: Completo — Fases 1 a 6 del plan original cerradas
---

> Requisito previo: leer [`ARCHITECTURE.md`](ARCHITECTURE.md).
> **Corrección de premisa**: el proyecto es Next.js + React, no Expo / React Native.

---

## 0. La restricción que define todo el plan

**El proyecto no tiene API HTTP.** 110 Server Actions hablan directo con Postgres vía Prisma y derivan la sesión con `getServerSession()`. Nada de eso puede ejecutarse en el navegador:

| Secreto | Consecuencia de exponerlo |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Acceso total de lectura y escritura a la base |
| `NEXTAUTH_SECRET` | Falsificación de sesiones de cualquier usuario |
| bcrypt / hashing | Sin sentido fuera del servidor |

**Por lo tanto el backend se conserva.** La migración saca React del navegador y construye la capa HTTP que faltaba. No es una traducción de componentes: es una separación cliente/servidor que hoy no existe.

---

## 1. Tabla por área

| Área | Next.js / React actual | HTML / CSS / JS propuesto | Complejidad |
|---|---|---|---|
| **Navigation** | App Router de Next.js. 19 rutas de archivo. Navegar re-monta el árbol de React bajo el layout | `router.js` de ~40 líneas sobre History API. Un solo `index.html`; el shell se monta una vez y solo se reemplaza `<main>`. Cada pantalla se carga con `import()` dinámico | 🟢 Baja |
| **State** | 5 React Contexts anidados + estado local de componente. Mutaciones optimistas con `fire()` | Sin réplica de React. Estado de UI → **el propio DOM** (`data-*`, `classList`). Datos de pantalla → variable de módulo. Datos compartidos → cache de `api.js`. Preferencias → `settings.js` sobre `localStorage` | 🟠 Media |
| **API** | 110 Server Actions (POST RPC no cacheables, sin paralelizar) | ~12 routers REST en `app/api/**/route.ts` envolviendo las mismas funciones de `lib/`. Más 3 endpoints compuestos que matan los waterfalls de arranque. `GET` cacheables | 🔴 Alta |
| **Auth** | NextAuth v4 JWT + bcrypt + `proxy.ts`. Cada acción deriva `userId` de la sesión | **Sin cambios en el servidor.** Las route handlers siguen usando `getServerSession()`. El cliente solo envía la cookie (`credentials: "same-origin"`) y maneja el 401 | 🟡 Baja-media |
| **Storage** | 4 claves de `localStorage` leídas desde React | Las mismas 4 claves, desde `settings.js` y los módulos de pantalla. Sin cambios de formato | 🟢 Baja |
| **Animations** | Utilidades de Tailwind (`transition-*`, `animate-spin`). Sin librería | CSS propio con `transition` y `@keyframes`, restringido a `transform` y `opacity` para no disparar layout | 🟢 Trivial |
| **Rendering** | React reconcilia el árbol; editar un monto re-renderiza `dashboard-sheet.tsx` (1250 líneas) | `<template>` + `cloneNode` para filas; `textContent` / `classList` para actualizar. **Nunca `innerHTML` con datos** | 🟠 Media |
| **Styling** | Tailwind v4 + shadcn/ui (59 componentes, 13 en uso) | CSS propio en 3 archivos. Diseño monocromo, sin responsive, sin breakpoints | 🟠 Media |
| **Assets** | Sin `public/`. Iconos vía `lucide-react` (JS), fuentes vía `next/font` | Sprite SVG único con los ~25 iconos usados. Fuentes con `font-display: swap` | 🟢 Baja |
| **Forms** | Diálogos de Radix con validación cruzada | `<dialog>` nativo + validación en JS. Portar las reglas, no solo los campos | 🟠 Media |
| **Rich text** | TipTap (13 paquetes) para un campo | A decidir: `contenteditable` con sanitización, o textarea + Markdown | 🟠 Media |

---

## 2. Diseño de la API

### Criterio

Base **1:1 con las acciones existentes** — predecible y de bajo riesgo — más **3 endpoints compuestos** que resuelven en el servidor lo que hoy son cargas en cascada en el cliente.

### Routers

| Router | Base | Envuelve |
|---|---|---|
| `bootstrap` | `GET /api/bootstrap` | Los 5 provider loads, en paralelo |
| `dashboard` | `GET /api/dashboard` | `loadData` + grupos de flujo |
| `records` | `/api/records` | `dbCreateRecord`, `dbEditRecord`, `dbDeleteRecord`, `editOrVersionRecord` |
| `assets` | `/api/assets` | 23 acciones de `assets-actions` |
| `assets/:id/full` | `GET` | `loadAsset` + `loadIncomeRules` en una request |
| `income` | `/api/income` | 10 acciones de `income-actions` |
| `obligations` | `/api/obligations` | 16 acciones de `obligation-actions` |
| `gastos` / `ingresos` | `/api/gastos`, `/api/ingresos` | 16 acciones |
| `flow-groups` | `/api/flow-groups` | 7 acciones |
| `links` | `/api/links` | 6 acciones |
| `markers` | `/api/markers` | 8 acciones |
| `categories` | `/api/categories` | 6 acciones |
| `cutoff` | `/api/cutoff` | 5 acciones |
| `journal` | `/api/journal` | `loadJournalEntries`, `getAccountBalances`, `initializeAccountBalances` |
| `historial` | `GET /api/historial` | `loadHistorial`, `dbUpdateComment` |
| `snapshots` | `/api/snapshots` | `dbTakeSnapshot` |

### Excluida a propósito

**`createJournalEntry` NO recibe endpoint.** Es un helper interno y hoy constituye una vulnerabilidad (ver `ARCHITECTURE.md` §9): acepta `userId` del llamador y está exportada desde `"use server"`, lo que la vuelve invocable desde el navegador con cualquier `userId`. **Se corrige en la Fase 3** convirtiéndola en función no exportada.

### Correcciones de rendimiento incluidas

| Corrección | Efecto |
|---|---|
| `bootstrap` devuelve `auditCount` (un `COUNT`), no las 130 filas del audit log | El badge del sidebar deja de costar una tabla entera |
| Las lecturas del bootstrap se paralelizan con `Promise.all` en el servidor | 5 round-trips → 1 |
| La siembra de categorías deja de correr en cada montaje | Se ejecuta bajo demanda, no en el arranque |
| Los `GET` llevan `Cache-Control` conservador | El navegador puede reutilizar respuestas |

### Contrato de errores

Uniforme en todos los endpoints, para que el cliente distinga los casos que hoy distingue React:

```
200  OK
400  Validation error   { error, field? }
401  Authentication     → redirigir a /login
403  Authorization
404  Not found
409  Conflict           (ej. corte de período ya ejecutado)
500  Server error       { error }
```

Fallo de red = excepción de `fetch` → estado "network error", distinto de un error de API.

---

## 3. Cache en memoria

Solo donde hay evidencia de reuso. **No indiscriminado.**

| Dato | Estrategia | Se invalida con |
|---|---|---|
| Categorías de activo | Cache de sesión | CRUD de categorías |
| Marcadores | Cache de sesión | CRUD de marcadores |
| Settings | `localStorage` | Edición del usuario |
| Records, gastos, ingresos, obligaciones | **Sin cache** | Es lo que cambia |
| Deduplicación de requests en vuelo | Mapa `url → Promise` | Al resolver |

La deduplicación cubre el caso que planteó el usuario: dos módulos pidiendo `/api/bootstrap` a la vez disparan **una** request.

---

## 4. Estructura del cliente

```
web/
  index.html          shell: header, sidebar, <main>, <template>s
  login.html          fuera del shell
  css/
    base.css          reset, tipografía, tokens
    layout.css        grilla del shell
    components.css    tablas, diálogos, badges, botones
  js/
    api.js            fetch, sesión, errores, cache, dedup
    router.js         History API (~40 líneas)
    dom.js            helpers de actualización incremental
    settings.js       localStorage
    format.js         moneda, fechas (reusa lib/finance.ts portado)
    icons.svg         sprite único
    pages/
      dashboard.js  activos.js  activo-detalle.js
      gastos.js  ingresos.js  obligaciones.js
      obligacion-detalle.js  libro.js  historial.js
      snapshots.js  configuracion.js
```

### Principios de renderizado

- **Prohibido `innerHTML` con datos del usuario.** Solo `textContent`. Sin JSX, el escapado deja de ser automático.
- Filas desde `<template>` + `cloneNode(true)`.
- Cada fila con `data-id`; actualizar = localizar el nodo y tocar solo las celdas cambiadas.
- `DocumentFragment` solo al insertar ≥ 10 nodos.
- **Delegación de eventos**: un listener por contenedor, no uno por fila. Elimina el problema de limpieza.
- Sin `setTimeout` para simular carga. Los estados de carga aparecen solo mientras hay una request en vuelo.

---

## 5. Orden de migración

Por dependencia y riesgo creciente. El frontend vanilla se sirve en `/app`; la app React sigue viva para comparar.

| # | Pantalla | Por qué en este orden |
|---|---|---|
| 0 | **Capa API** | Prerrequisito de todo. Incluye el fix de `createJournalEntry` |
| 1 | **Login / Register** | Valida el flujo de sesión end-to-end antes que nada |
| 2 | **Shell + router** | Header, sidebar, notificaciones. Base de las demás |
| 3 | **Configuración** | Pantalla chica; ejercita CRUD, cache e invalidación |
| 4 | **Historial** | Solo lectura con filtros y paginación; valida el patrón de listas |
| 5 | **Libro Contable** · **Snapshots** | Solo lectura, sin mutaciones |
| 6 | **Gastos** · **Ingresos** | CRUD, agrupación, versionado, vínculos N:M |
| 7 | **Obligaciones** | Reglas, cuotas, pagos, aceptar/rechazar |
| 8 | **Activos** (lista + detalle) | La más compleja: 8 paneles, reglas de ingreso, tableros, editor rico |
| 9 | **Dashboard** | Última: depende de todo lo anterior |

### Verificación después de cada pantalla

1. **Funcional** — cada acción tiene equivalente y produce el mismo efecto en la base
2. **Requests** — sin duplicadas; las independientes en paralelo; sin polling
3. **Errores** — network / API / auth / validación / vacío / carga se distinguen igual que hoy
4. **Navegación** — sin recargas completas; back/forward correctos
5. **Rendimiento** — al mutar un dato, verificar en DevTools que **solo cambia el nodo afectado**
6. **Visual** — comparación lado a lado contra la ruta React equivalente

---

## 6. Fases finales

### Fase 5 — Limpieza (solo cuando todo funcione)

Eliminar `app/(dashboard)/**`, `components/**`, React, React DOM, los 27 `@radix-ui/*`, TipTap (13), Tailwind, y las 5 dependencias huérfanas (`zod`, `@hookform/resolvers`, `date-fns`, `playwright`, `postgres`). Mover `/app` a la raíz.

### Fase 6 — Auditoría de rendimiento

Medición antes/después: FCP, LCP, TBT, tiempo de ejecución de JS, nodos del DOM, tamaño de bundle. Más una tabla por pantalla:

| Request | Método | Endpoint | Cuándo ocurre | Duración | ¿Necesaria? | ¿Paralelizable? | ¿Cacheable? |
|---|---|---|---|---|---|---|---|

---

## 7. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | Exponer credenciales al mover lógica de servidor al cliente | 🔴 Crítica | El backend se conserva íntegro. Auditar cada endpoint antes de darlo por hecho |
| R2 | Pérdida de paridad funcional en 110 acciones | 🔴 Alta | Migración pantalla por pantalla con React vivo al lado. Nada se elimina hasta que su reemplazo funcione |
| R3 | Datos reales en producción (153 records, 15 tablas) | 🔴 Alta | La Fase 3 solo agrega endpoints equivalentes; no altera esquema ni datos |
| R4 | Sin JSX, el escapado deja de ser automático | 🟠 Media | Prohibido `innerHTML` con datos. Solo `textContent` |
| R5 | XSS en el editor rico | 🟠 Media | Sanitizar en servidor **y** cliente si se reemplaza TipTap |
| R6 | Regresión de UX en formularios con validación cruzada | 🟠 Media | Portar las reglas (cantidad × precio, montos > 0), no solo los campos |
| R7 | Alcance mayor al percibido: 21.867 líneas de TSX | 🟠 Media | Proyecto de varias sesiones. Orden incremental con la app vieja funcionando |
| R8 | Pérdida de accesibilidad de Radix (foco, teclado, ARIA) | 🟡 Baja-media | Los 13 componentes vivos son simples. Usar `<dialog>` nativo; portar foco y `Escape` |
| R9 | Operaciones destructivas (corte mensual, liquidación) | 🟡 Baja | Ya revalidan en servidor. Los endpoints deben preservar esa revalidación |

---

## 8. Criterio de éxito

No alcanza con que funcione. Hay que demostrar:

| # | Criterio | Cómo se mide |
|---|---|---|
| 1 | Funcionalidad preservada | Los 16 comportamientos de `ARCHITECTURE.md` §10, verificados uno a uno |
| 2 | Complejidad reducida | Dependencias runtime: 70 → objetivo < 10. Líneas de frontend medidas antes/después |
| 3 | Sin re-renders innecesarios | No hay reconciliación: cada mutación toca un nodo, verificable en DevTools |
| 4 | Menos JavaScript ejecutado | Tiempo de scripting en el panel Performance, antes/después |
| 5 | Menos operaciones de DOM | Contar mutaciones con `MutationObserver` en el flujo de editar un monto |
| 6 | Sin requests duplicadas | Panel Network por pantalla |
| 7 | Requests independientes en paralelo | `bootstrap` reemplaza 5 cargas en cascada |
| 8 | Cache donde corresponde | Categorías y marcadores no se repiden al navegar |
| 9 | Sin delays artificiales | Cero `setTimeout` con fines cosméticos |
| 10 | UI inmediata ante interacción local | Abrir un diálogo o colapsar un grupo no dispara red |
| 11 | Las esperas visibles son solo de API/DB | Cada estado de carga corresponde a una request en vuelo |

---

## 9. Registro de avance

### Fase 3 — Capa API · **en curso**

| Endpoint | Métodos | Envuelve | Estado |
|---|---|---|---|
| `/api/auth/register` | POST | `registerUser` | ✅ público a propósito |
| `/api/bootstrap` | GET | Los 5 provider loads | ✅ paridad verificada |
| `/api/categories` | GET · POST | `loadAssetCategories`, `createAssetCategory`, `ensureAssetCategories`, `assetCountByCategory` | ✅ |
| `/api/categories/:id` | PATCH · DELETE | `renameAssetCategory`, `deleteAssetCategory` | ✅ |
| `/api/markers` | GET · POST | `loadMarkers`, `createMarker` | ✅ |
| `/api/markers/:id` | PATCH · DELETE | `updateMarker`, `deleteMarker` | ✅ |
| `/api/markers/entity` | GET · PUT · DELETE | `setEntityMarker`, `removeEntityMarker`, `loadEntityMarkersForIds` | ✅ |
| `/api/cutoff` | GET · POST · PATCH | Las 5 acciones de corte | ✅ |
| `/api/historial` | GET | `loadHistorial` | ✅ |
| `/api/historial/:id` | PATCH | `dbUpdateComment` | ✅ |
| `/api/journal` | GET · POST | `loadJournalEntries`, `getAccountBalances`, `initializeAccountBalances` | ✅ |
| `/api/snapshots` | GET · POST | `dbTakeSnapshot` + listado | ✅ |

**Cubren las pantallas 1 a 5** del orden de migración (Login/Register, Shell, Configuración, Historial, Libro/Snapshots).

**Pendientes**: `assets` (23), `obligations` (16), `income` (10), `gastos` (9), `ingresos` (7), `flow-groups` (7), `links` (6), `records`/`versioning` (5), `dashboard` compuesto.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `tsc --noEmit` · `next build` | ✅ 30 rutas |
| Paridad `bootstrap` vs `loadData()` | ✅ Sin diferencias en los 3 usuarios |
| Contrato de errores sin sesión | ✅ Los 7 GET devuelven **401 + JSON** |
| Endpoints con sesión | ✅ Los 7 devuelven **200** con la forma esperada |
| Validación de entrada | ✅ Password corta → **400** con `field` |
| Aislamiento por usuario | ✅ Usuario nuevo ve 0 registros, no los 153 ajenos |
| Usuario de prueba | ✅ Creado, verificado y **eliminado**; 0 filas reclamadas |

### Correcciones aplicadas durante la fase

#### 1. Vulnerabilidad: `createJournalEntry` era invocable desde el navegador

Estaba exportada desde un archivo `"use server"` y recibía `userId` como parámetro. En Next.js todo export de esos archivos es un endpoint RPC, así que cualquier usuario autenticado podía escribir asientos en el libro contable de otro.

**Corregido**: movida a `lib/journal-internal.ts`, módulo **sin** `"use server"`. Verificado que ninguna de las 110 acciones acepta ya un `userId` del cliente.

#### 2. El middleware redirigía las llamadas de API al login

`proxy.ts` solo excluía `api/auth`, así que el resto de `/api/*` recibía un **307 hacia `/login`**. Para un cliente `fetch` eso devuelve HTML donde espera JSON, y hace indistinguible "sesión vencida" de cualquier otro fallo.

**Corregido**: `api` queda fuera del matcher. Cada route handler valida la sesión por su cuenta y responde **401 con cuerpo JSON**. Verificado ruta por ruta antes del cambio.

#### 3. Efecto secundario de `registerUser` a tener presente

`registerUser` reclama los registros huérfanos (`userId: null`) para el usuario nuevo. Hoy no hay huérfanos, así que es inocuo — pero **cualquier alta de usuario futura se apropiaría de los que aparecieran**. Conviene revisarlo antes de abrir el registro a terceros.

---

### Fase 3 — Capa API · **completa** (69 rutas)

Las 12 acordadas más 4 adicionales que aparecieron al desglosar dominios grandes (`assets`, `obligations`, `income`) en sub-recursos.

| Router | Rutas | Cubre |
|---|---|---|
| `assets` | 24 | Las 23 acciones de `assets-actions` (`groupAssets` queda sin exponer — alias legacy de `assignToGroup`, sin uso en la UI) |
| `obligations` | 15 | Las 16 acciones (base + status + finalize + rules + payments + installments) |
| `income` | 7 | Las 10 acciones (`refreshIncomeWindows` es interna, ya cubierta por `/api/cutoff`) |
| `gastos` / `ingresos` | 6 + 5 | Las 16 acciones, con detalle + vínculos en una sola request |
| `flow-groups` / `links` | 4 + 3 | Las 13 acciones |
| `records` / `versioning` | 2 | Las 5 acciones — mismo payload `{ record, movement }` que usa hoy `FinanceProvider` |
| `dashboard` | 1 | Compuesto: records + ambos grupos de flujo, en paralelo |
| *(Fase 3 previa)* | 12 | bootstrap, categories, markers, cutoff, historial, journal, snapshots, auth/register |

**Verificación de cobertura**: script que cruza las 110 acciones contra los imports de `app/api/**`. **106 cubiertas, 4 justificadamente sin endpoint**: `createJournalEntry` (fix de seguridad), `groupAssets` (alias muerto), `refreshIncomeWindows` (interna) y `loadEntityMarkerEntries` (sin ningún caller en toda la UI).

### Verificación end-to-end ejecutada

| Check | Resultado |
|---|---|
| `tsc --noEmit` · `next build` | ✅ **86 rutas totales, 69 de API** |
| Smoke test sin sesión (14 endpoints nuevos) | ✅ 401 + JSON — encontró y corrigió 1 caso real |
| Escritura real: crear activo → agregar regla de ingreso → leer `/full` | ✅ Proyección anual correcta (1500×12=18000) |
| Ventana de 12 meses (`ensureIncomeWindow`) | ✅ Generó 12 ingresos `[Programado]` automáticamente |
| Crear obligación FIXED → leer detalle | ✅ |
| `/api/dashboard` refleja el activo recién creado | ✅ |
| Usuario de prueba y **todos** sus datos (13 records, 1 obligación, 1 regla, journal, movimientos) | ✅ Eliminados; 3 usuarios reales intactos |

### Hallazgo — orden validación/auth (menor, documentado y no corregido en masa)

En varios POST/PATCH, el body se valida (`badRequest`) **antes** de que la acción interna revalide la sesión. Detectado en `GET /api/links` (corregido: ahora llama `requireUserId()` primero) y presente por patrón en otros endpoints de escritura.

**No es una vulnerabilidad**: ningún dato se expone y la sesión siempre se revalida antes de tocar la base — en el peor caso, un cliente sin sesión que manda un body inválido recibe 400 en vez de 401. No se corrigió sistemáticamente en los 69 endpoints porque el caso no ocurre en el flujo real (sin sesión, la UI no llega a mostrar el formulario). Queda como pulido pendiente si se detecta que importa en la Fase 4.

**Fase 3 cerrada.** Sigue la Fase 4: migración pantalla por pantalla, empezando por Login/Register y el Shell.

---

### Fase 4 — Login/Register + Shell · **completa**

Primer bloque de frontend vanilla real: `public/app/`, servido por Next.js como estáticos, sin código de servidor propio.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/api.js` | 96 | Cliente HTTP: dedup de requests en vuelo, cache TTL solo para categorías/marcadores, distingue NetworkError de ApiError |
| `js/dom.js` | 47 | `qs`, `on` (delegación), `fromTemplate`, `el` — nunca `innerHTML` con datos |
| `js/router.js` | ~80 | History API, normaliza `/app`, `/app/`, `/app/index.html` a la misma ruta lógica |
| `js/auth.js` | 56 | Login/logout contra NextAuth directo (csrf + credentials), sin `next-auth/react` |
| `js/shell.js` | 190 | Orquestador: header, sidebar con badges, toggle colapsable, notificaciones |
| `js/notifications.js` | 210 | Puerto de `notifications-store.tsx` + `notifications-popover.tsx` — misma clave de `localStorage` |
| `js/lib/finance.js`, `js/lib/obligations.js` | 90 + 35 | Puerto **1:1** de la lógica pura de `lib/finance.ts` y `lib/obligations.ts` |
| `login.html` / `register.html` + sus páginas | ~180 | Standalone, fuera del shell |
| `index.html` | ~180 | Shell + sprite de iconos SVG inline (sin `lucide-react`) |
| CSS (`base` + `layout` + `components` + `auth`) | ~360 | Monocromo, sin responsive, sin librería de animación |

**Total: ~1525 líneas** reemplazando lo que en React eran `app-shell.tsx` + `app-header.tsx` + `app-sidebar.tsx` (726 líneas solo el `ui/sidebar.tsx` sin usar) + `notifications-store/popover.tsx` + `login/page.tsx` + `register/page.tsx` + toda la cadena de Radix/Tailwind detrás.

### Decisión de diseño: convivencia por URL, no por ruta lógica

El sidebar distingue rutas **migradas** (SPA, `data-link`) de las que **todavía viven en la app clásica** (navegación completa, sin interceptar). Hoy solo `/app` (Dashboard/home placeholder) está migrado; el resto de los links del sidebar navegan de verdad a la app React hasta que le llegue su turno en el orden de migración.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 11 módulos | ✅ Sin errores de sintaxis |
| **Paridad de lógica pura** vs. TS original (`finance.js`, `obligations.js`) | ✅ 16/16 aserciones — mismo `formatAmount`, `computeGroupValue`, `isDueWithin`, etc. |
| `tsc --noEmit` · `next build` | ✅ Sin errores |
| Los 18 archivos estáticos, servidos con content-type correcto | ✅ |
| El resto del sitio (`/`, `/activos`, etc.) sigue redirigiendo a `/login` igual que antes | ✅ Sin regresión |
| `/api/*` conserva su contrato 401+JSON | ✅ Sin regresión |
| Flujo real: registro → login → `getSession()` → `apiGet('/api/bootstrap')` en paralelo | ✅ |
| Las 5 formas de llegar al shell (`/app`, `/app/`, `/app/index.html`, `/app/activos`, `/app/obligaciones/:id`) | ✅ Las 5 sirven 200 |
| Normalización de ruta del router, aislada | ✅ 5/5 casos |
| Limpieza de los 2 usuarios de prueba | ✅ 3 usuarios reales intactos |

### Bugs encontrados y corregidos durante esta fase

1. **El middleware bloqueaba `/app/*`** — mismo problema que `/api/*` en la Fase 3, esta vez sobre los estáticos: sin excluirlo, ni siquiera `/app/login.html` cargaba (307 antes de que el JS pudiera ejecutarse). `app` se agregó al matcher de exclusión de `proxy.ts`.
2. **`dialog.show()` no modal no dispara `cancel` en Escape** — ese comportamiento es exclusivo de `showModal()`. Se agregó un listener de `keydown` manual para el popover de notificaciones.
3. **Sin rewrite, la SPA no soportaba refresh/deep-link** — `/app/activos` daba 404 (Next no resuelve `index.html` de directorio como un servidor estático clásico). Se agregó una regla en `next.config.mjs` que cae a `index.html` solo cuando no hay un archivo real — Next resuelve `public/` *antes* que los rewrites, así que los estáticos existentes no se ven afectados. Verificado explícitamente que no rompe `login.html`, `register.html` ni ningún asset.
4. **El router no normalizaba `/app/index.html`** a la misma ruta lógica que `/app` — corregido; validado con 5 casos.

**Fase 4 en curso.** Sigue: Configuración (pantalla 3 del orden), primera pantalla con CRUD real contra los endpoints de la Fase 3.

---

### Fase 4 — Configuración · **completa**

Primera pantalla con CRUD real contra los endpoints de la Fase 3. Sin trabajo de API nuevo — los 10 endpoints que usa (`categories`, `markers`, `cutoff`) ya existían.

| Archivo nuevo | Líneas | Rol |
|---|---|---|
| `js/settings.js` | 115 | Puerto de `settings-store.tsx` sobre `localStorage`, con `fetchExchangeRates()` contra la API pública de cotizaciones (sin secretos: se llama igual desde el navegador) |
| `js/toast.js` | 44 | Sistema de notificaciones mínimo — reemplaza sonner + next-themes, que solo existían por este único componente |
| `js/lib/colors.js` | 24 | Paleta de 22 colores portada de `tailwind-color-picker.tsx` |
| `js/pages/configuracion.js` | 400 | Las 4 secciones: Dashboard (monedas), Categorías, Marcadores, Corte Mensual |

**Total: 746 líneas** reemplazando `configuracion/page.tsx` + `asset-categories-settings.tsx` + `marker-manager-dialog.tsx` + `cutoff-settings.tsx` + `settings-store.tsx` + `tailwind-color-picker.tsx` — 6 archivos React, varios de ellos con Radix (`Select`, `Dialog`) detrás.

**Nota de alcance**: `settings-store.tsx` traía además `hiddenAssetTypes`/`customAssetTypes` y sus 4 acciones — campos legados de antes de que existieran las categorías en DB (v2.5.0), que la página React actual **ya no usa** (se removieron de la UI en una sesión previa). No se portaron: no tiene sentido migrar código que ni la propia app React invoca.

### Cada sección administra su propio re-render

Verificado que ninguna acción reconstruye más de lo necesario:
- Tipear una tasa de cambio → un solo `updateRate()`, cero repintado de DOM (el input ya refleja lo tecleado)
- Alternar "Convertir divisas" → repinta solo el bloque condicional de monedas, no la sección completa
- Crear/renombrar/eliminar una categoría → repinta solo la lista de categorías
- Reordenar un marcador → repinta solo el cuerpo del diálogo, nunca el header/footer

### Dos bugs encontrados revisando el propio código (no en runtime)

1. **Footer del diálogo de marcadores duplicándose.** `renderMarkerDialogBody()` hacía `body.after(footer)` en cada repintado — funciona la primera vez, pero cada `reload()` posterior (crear, reordenar, eliminar) agregaba un footer nuevo sin quitar el anterior. Corregido separando la estructura fija (header + footer, creados una vez) del contenido que sí se repinta.
2. **Listener de settings sin desuscribir.** `renderDashboardSection()` se suscribía a `onSettingsChange()` pero la página nunca liberaba esa suscripción al navegar afuera — cada visita apilaba un listener más, todos apuntando a nodos DOM ya desmontados. Corregido: `onSettingsChange()` devuelve la función de desuscripción, que ahora viaja hasta el `return` de limpieza de `render()` (el mismo mecanismo que usa `router.js` para limpiar cada página al navegar).

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 15 módulos | ✅ Sin errores de sintaxis |
| Cruce de los 10 endpoints usados contra las rutas reales de `app/api/` | ✅ Los 10 existen |
| `tsc --noEmit` · `next build` | ✅ Sin errores |
| Estáticos nuevos servidos | ✅ |
| `/app/configuracion` vía rewrite, sin sesión | ✅ 200 (el JS decide el redirect) |
| **Flujo real de escritura**: crear categoría → renombrar → crear 2 marcadores → reordenarlos (swap de `order`) → cambiar día de corte | ✅ Los 10 pasos, verificados con las respuestas reales de la API |
| Limpieza del usuario de prueba (con categorías/marcadores, sin cascade en el schema) | ✅ Eliminado en orden correcto; 3 usuarios reales intactos |

### Fase 4 — Historial · **completa**

Primera pantalla de solo-lectura paginada. Valida el patrón que van a reutilizar Gastos/Ingresos/Obligaciones: filtros sincronizados con la URL, búsqueda debounced, cancelación de respuestas obsoletas y edición inline con guardado debounced. Sin trabajo de API nuevo — `GET /api/historial` y `PATCH /api/historial/:id` ya existían de la Fase 3.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/pages/historial.js` | 278 | Filtros + lista paginada + edición de comentario |

**Decisión de diseño — por qué esta pantalla NO usa `router.navigate()` para sus propios cambios de filtro/página**: el hook original (`useHistorialFilters`) usa `router.replace()` de Next, que en React re-ejecuta hooks pero **no desmonta el árbol** — el input de búsqueda nunca pierde el foco mientras el usuario tipea. El router vanilla (`router.js`) no tiene ese lujo: `navigate()` llama a `mod.render()` de nuevo, reconstruyendo la página entera. Si `historial.js` llamara a `navigate()` en cada tecla (aunque sea debounced a 350ms), el `<input>` se destruiría y recrearía cada vez, perdiendo el foco a mitad de palabra — exactamente la clase de fricción artificial que el proyecto busca eliminar. La página sincroniza la URL con `history.replaceState()` directo, sin pasar por el router: actualiza la barra de direcciones (deep-linking sigue funcionando) sin disparar un remount. Solo los controles (selects, fechas, paginación) tocan el DOM que cambia — los filtros ya construidos nunca se recrean.

**Patrones portados de `use-historial-query.ts`**:
- **Cancelación de respuestas obsoletas**: un contador `reqId` que se incrementa en cada fetch; si la respuesta llega y `reqId` ya avanzó (otro filtro se aplicó mientras tanto), se descarta. Sin este guard, escribir rápido en el buscador podía hacer que una respuesta vieja pisara una más nueva.
- **Comentario debounced a 600ms por fila**: un `Map<movementId, timerId>` — cada input de comentario tiene su propio timer, no se pisan entre filas.
- **Búsqueda debounced a 350ms**: mismo criterio que el original, antes de tocar la URL.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` | ✅ Sin errores de sintaxis |
| `GET /api/historial` — sin filtros, `action=editado`, `recordType=gasto`, `search=` | ✅ Las 4 variantes devuelven el subconjunto correcto |
| `GET /api/historial` — paginación (`page`/`pageSize`) | ✅ `skip`/`take` correctos; `pageSize` fuera de `[10,25,50,100]` cae a 25 (comportamiento del servidor, no un bug) |
| `PATCH /api/historial/:id` — persistencia de comentario | ✅ Confirmado releyendo la lista después del PATCH |
| Ambos endpoints sin cookie de sesión | ✅ 401 |
| Estático `/app/js/pages/historial.js` servido | ✅ 200 |
| **Flujo real de escritura**: crear ingreso "Salario" + gasto "Alquiler" → editar el ingreso (genera entrada `editado`) → filtrar por acción/categoría/búsqueda → comentar una fila | ✅ Los 6 pasos, verificados contra las respuestas reales de la API |
| `tsc --noEmit` | ✅ Sin errores |
| Limpieza del usuario de prueba (2 records + 3 audit log) | ✅ Eliminado en orden correcto (`auditLog` → `record` → `user`, sin cascade en el schema); 3 usuarios reales intactos |

### Fase 4 — Libro Contable / Snapshots · **Libro Contable completa · Snapshots parcial (lista)**

Dos pantallas de solo lectura. Sin trabajo de API nuevo — ambas ya tenían endpoint propio desde la Fase 3.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/pages/libro-contable.js` | 213 | Asientos + saldos por cuenta, vía el endpoint compuesto `GET /api/journal` |
| `js/pages/snapshots.js` | 78 | Listado de snapshots, vía `GET /api/snapshots` |

**Libro Contable** reutiliza `GET /api/journal`, que ya trae `entries` + `balances` en una sola request (Promise.all en el servidor) — el original hacía lo mismo con dos Server Actions en paralelo desde el cliente; ahora es una sola llamada HTTP. Filtros (fecha desde/hasta, cuenta, moneda) sin URL-sync, igual que el componente React original (nunca tuvo `useSearchParams`). Mismo patrón `reqId` que Historial para descartar respuestas fuera de orden.

**Snapshots — alcance de esta sub-fase**: solo se migró el **listado**. El original tenía además una variante de tarjetas para mobile con media query; se omitió a propósito — esta es una app exclusivamente desktop (ver §0), esa segunda variante del componente React no tenía razón de portarse.

**El detalle (`/snapshots/:id`) queda deliberadamente sin migrar todavía.** Motivo: `SnapshotDetailPage` renderiza con `<DashboardSheet records={snapshot.records} readOnly />` — el mismo componente de 1250 líneas que el dashboard en vivo usa en modo editable (ver ARCHITECTURE.md §P4). Portarlo ahora implicaría una de dos cosas, ambas descartadas: (a) construir una versión simplificada solo para el snapshot y volver a construirla "en serio" cuando le toque el turno al Dashboard (trabajo duplicado), o (b) adelantar la construcción completa del renderer de dashboard-sheet fuera de orden, rompiendo la secuencia del plan que puso al Dashboard al final exactamente por esta dependencia. La fila de cada snapshot en la lista sigue apuntando a la ruta clásica de React (`/snapshots/:id`, navegación completa, sin `data-link`) hasta que el renderer compartido exista — coherente con la estrategia de convivencia aprobada. Cuando se construya el dashboard-sheet vanilla en la Fase Dashboard, `/app/snapshots/:id` se agrega reusando ese mismo módulo en modo `readOnly`, sin volver a escribirlo.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en ambos módulos + `shell.js` | ✅ Sin errores de sintaxis |
| `GET /api/journal` — vacío, con datos, filtro `account`, filtro `currency` | ✅ Las 4 variantes devuelven `{entries, balances}` con la forma esperada |
| `GET /api/snapshots` — vacío y con un snapshot creado | ✅ `{snapshots: [...]}` con `id/name/period/createdAt` |
| Ambos endpoints sin cookie de sesión | ✅ 401 |
| Estáticos nuevos (`libro-contable.js`, `snapshots.js`, ícono `icon-arrow-right` agregado al sprite) servidos | ✅ 200 |
| `/app/libro-contable` y `/app/snapshots` vía rewrite, deep-link directo | ✅ 200 |
| **Flujo real**: crear 2 ingresos libres en monedas distintas (USD/EUR) → verificar asientos + saldos por cuenta y moneda → crear un snapshot → verificar que aparece en el listado | ✅ Los 4 pasos, verificados contra las respuestas reales de la API |
| `tsc --noEmit` | ✅ Sin errores |
| Limpieza del usuario de prueba (2 records + 2 audit log + 2 journal entries + 1 snapshot) | ✅ Eliminado en orden correcto (`journalEntry`/`auditLog` → `snapshotRecord` → `snapshot` → `record` → `user`); 3 usuarios reales intactos |

### Fase 4 — Gastos / Ingresos · **completa**

La pantalla más grande hasta ahora — comparable en superficie a lo que le espera a Activos. Sin trabajo de API nuevo: los ~15 endpoints que usa (`gastos`, `ingresos`, `flow-groups`, `links`, `markers`, `markers/entity`, `dashboard`, `categories`, `records/version`) ya existían.

**Decisión de diseño — un solo renderer compartido, no dos páginas duplicadas.** En React, `gastos/page.tsx` e `ingresos/page.tsx` eran ~550 líneas cada una, prácticamente un espejo exacto (mismo agrupamiento, mismo modo selección, mismo panel de vínculos, mismo marker picker) con los nombres de campo invertidos — confirmado línea por línea con un diff normalizado antes de escribir una sola línea de JS. Portarlas como dos archivos vanilla separados habría significado 500+ líneas duplicadas y, más grave, un bug corregido en una lista sin corregir en la otra. En cambio:

| Archivo | Líneas | Rol |
|---|---|---|
| `js/pages/flow-list.js` | 330 | Renderer compartido: header, filtro de estado, resumen, grupos de usuario (crear/renombrar/eliminar/quitar miembro), modo selección + barra de acción, tablas agrupadas, fila con marker picker y panel de vínculos |
| `js/pages/gastos.js` | 51 | Config: 3 fuentes (obligación/activo/libre), 3 secciones, diálogo propio |
| `js/pages/ingresos.js` | 45 | Config: 2 fuentes (activo/libre) con sub-tipo (dividendo/plazo fijo/liquidación/extracción/manual), 2 secciones, diálogo propio |
| `js/components/gasto-form-dialog.js` | 190 | 3 modos: libre / depósito en activo existente / gasto + activo nuevo |
| `js/components/ingreso-form-dialog.js` | 175 | 3 orígenes: libre / extracción de activo (con tope al balance) / automático (panel informativo, sin acción) |
| `js/components/edit-or-version-dialog.js` | 145 | Compartido entre ambas listas — ya era genérico sobre `recordType` en el original |
| `js/components/links-panel.js` | 175 | Compartido — los dos paneles React (`GastoIngresoLinksPanel`/`IngresoGastoLinksPanel`) eran el mismo componente con los campos invertidos |
| `js/components/marker-picker.js` | 150 | Popover único por página (no uno por fila), mismo patrón `<dialog>` no-modal + Escape manual que ya usa el popover de notificaciones |
| `js/lib/markers.js` | 38 | Wrappers finos sobre `/api/markers` y `/api/markers/entity` |

**Total: ~1300 líneas** reemplazando `gastos/page.tsx` + `ingresos/page.tsx` + `gasto-form-dialog.tsx` + `ingreso-form-dialog.tsx` + `edit-or-version-dialog.tsx` + `gasto-ingreso-links-panel.tsx` + `ingreso-gasto-links-panel.tsx` + `marker-picker.tsx` — 8 archivos React, ~2400 líneas, varios con Radix (`Dialog`, `Select`, `Popover`) detrás. La reducción no es solo por eliminar el framework: es la deduplicación real entre las dos pantallas que el original nunca tuvo.

**Piezas nuevas reutilizables agregadas a `dom.js` y `api.js`** (con efecto retroactivo — `historial.js`, `libro-contable.js` y `snapshots.js` ya usaban una versión copiada a mano de estas dos funciones, ahora deduplicadas):
- `svgIcon(symbolId, size)` — antes vivía repetida en 3 páginas
- `createDialog(className)` — `<dialog>` montado en `<body>`, listo para que el caller pinte su contenido
- `apiPut(path, body)` — faltaba en el cliente HTTP; lo necesitan `setEntityMarker` y `assignToFlowGroup`

**Iconos agregados al sprite**: `icon-chevron-down`/`icon-chevron-right` (expandir grupo/vínculos — el original usaba `ChevronDown`/`ChevronRight` de lucide-react), `icon-pencil` (editar/renombrar), `icon-trash` (eliminar grupo), `icon-plus` (botones "Nuevo Gasto"/"Nuevo Ingreso").

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 12 módulos nuevos/tocados | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos + `/app/gastos` y `/app/ingresos` vía rewrite | ✅ 200 |
| **Flujo real de escritura, contra la API real con un usuario de prueba**: crear activo → gasto libre / gasto en activo existente / gasto + activo nuevo (los 3 modos) → ingreso libre / ingreso por extracción de activo → archivar y restaurar → crear grupo, asignar miembro, renombrar, quitar miembro, eliminar grupo → opciones de vínculo, crear vínculo, listar, eliminar → crear marcador, asignarlo, buscarlo por id, quitarlo → editar in-situ y crear nuevo período (`HISTORICAL`/`nextVersionId` verificados) | ✅ Los 19 pasos, verificados contra las respuestas reales de la API |
| Los 3 endpoints de creación de gasto y los 2 de ingreso devuelven exactamente el shape que `flow-list.js` espera (`source.type`, `source.sourceType` en ingresos) | ✅ Confirmado con la lista releída después de cada creación |
| Endpoints sin cookie de sesión | ✅ 401 en `gastos`, `ingresos`, `flow-groups`, `links`, `markers` |
| Limpieza del usuario de prueba (8 records + 7 audit log + 9 journal entries + 1 marker + 4 financial movements) | ✅ Eliminado en orden correcto (`financialMovement`/`gastoIngresoLink`/`entityMarker`/`marker`/`group`/`journalEntry`/`auditLog` → `record` → `user`); 3 usuarios reales intactos |

**Hallazgo — mismo patrón de validación/auth ya documentado.** `GET /api/markers/entity` con `ids` vacío devuelve 200 en vez de 401 sin sesión: `loadEntityMarkersForIds()` retorna `{}` antes de llamar `getUserId()` cuando el array de ids está vacío. Mismo caso que `/api/links` (ver más arriba): no filtra ningún dato (devuelve objeto vacío), y con `ids` real vuelve a 401 correctamente — verificado. Se deja documentado junto al hallazgo anterior, no se corrige de forma aislada.

### Fase 4 — Obligaciones · **completa**

Primera pantalla con ruta dinámica (`/app/obligaciones/:id`) — valida `route()` con `:param` en un caso real, más allá de Configuración/Historial que no lo necesitaban. Sin trabajo de API nuevo: los 13 endpoints (`obligations`, `.../status`, `.../finalize`, `.../manual-payment`, `.../rules`, `.../rules/:ruleId`, `.../rules/:ruleId/pause|resume`, `installments/:id/accept|reject`, `payments/:id/accept|reject`) ya existían.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/pages/obligaciones.js` | 165 | Listado — solo la variante de tabla del original (sin las tarjetas mobile: la app es desktop-only) |
| `js/pages/obligacion-detail.js` | 490 | Panel de info con edición inline, pausar/reanudar, tablero de reglas (RECURRING), tablero de cuotas o historial de pagos (INSTALLMENT vs RECURRING/FIXED), diálogo de pago manual (FIXED), diálogo de finalización con generación opcional de gastos por cuotas pendientes |
| `js/components/obligation-form-dialog.js` | 250 | Diálogo de 2 pasos: elegir tipo → formulario específico (RECURRING arma N reglas antes de guardar, INSTALLMENT pide cuotas+monto+primer vencimiento, FIXED pide el saldo inicial) |
| `js/lib/obligations.js` | +45 | Se completó con lo que faltaba del original: `OBLIGATION_STATUS_LABELS`, `PAYMENT_TYPE_LABELS`, `INSTALLMENT_STATUS_LABELS`, `computeRecurringBreakdown`, `pendingInstallmentsTotal` |

**Decisión de diseño — re-fetch tras cada mutación, no estado local sembrado.** El original guarda `obligation` en `useState(initialObligation)` y confía en que `router.refresh()` (Server Component) lo mantenga sincronizado — un patrón fràgil, porque React no vuelve a sincronizar un `useState` solo porque cambió la prop de origen salvo que el componente se remonte. En la versión vanilla cada mutación (pausar, editar, pagar cuota, agregar regla, etc.) vuelve a pedir `GET /api/obligations/:id` y repinta desde la respuesta fresca — más simple y sin el riesgo de quedar mostrando datos viejos tras una acción.

**Enlace cruzado actualizado**: `gastos.js` ya enlazaba "Desde Obligaciones" a `/obligaciones/:id` (navegación completa, la ruta aún no existía en vanilla). Ahora que el detalle está migrado, ese link pasa a `/app/obligaciones/:id` con `data-link` — navegación SPA sin recarga.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 4 módulos + `shell.js` | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos + `/app/obligaciones` + deep-link `/app/obligaciones/:id` vía rewrite | ✅ 200 |
| **Flujo real de escritura, contra la API real con un usuario de prueba**: crear los 3 tipos (RECURRING/FIXED/INSTALLMENT) → agregar regla → pausar/reanudar regla → pausar/reactivar obligación → editar nombre y descripción → registrar pago manual en FIXED (verificado el descuento del saldo: 5000→4500) → pagar cuota 1 de 3 (verificado `PENDING→PAID`) → rechazar cuota 2 → finalizar INSTALLMENT generando gastos por las pendientes (verificado `status→COMPLETED`) → eliminar regla | ✅ Los 11 pasos, verificados contra las respuestas reales de la API |
| Los 12 pagos pre-generados de una regla RECURRING nueva (ventana de 1 año) traen exactamente los campos que `obligacion-detail.js` espera (`expectedDate`, `expectedAmount`, `actualAmount`, `gastoRecordId`, `status`) | ✅ Confirmado con la respuesta real |
| Endpoints sin cookie de sesión | ✅ 401 en listado y detalle |
| Limpieza del usuario de prueba (16 records + 2 journal entries + 3 obligaciones con sus reglas/cuotas/pagos en cascada) | ✅ Eliminado en orden correcto (`financialMovement` → `obligation` (cascada a rules/installments/payments por schema) → `journalEntry` → `auditLog` → `record` → `user`); 3 usuarios reales intactos |

### Fase 4 — Activos (lista) · **completa** — el detalle queda para la próxima sub-entrega

Activos es, con diferencia, la pantalla más grande del proyecto: ~5900 líneas entre `page.tsx`, `[id]/page.tsx` y los 24 componentes de `components/activos/` — más que Gastos + Ingresos + Obligaciones juntos. Se divide en sub-entregas verificables, igual que las pantallas anteriores. Esta primera cubre **la lista** (`/app/activos`): filtro por categoría, agrupamiento, marcadores, liquidar/eliminar, y el diálogo de alta. **El detalle (`/app/activos/:id`) — info, movimientos, 8 paneles por tipo de dato, reglas de ingreso, tableros, editor rico — queda pendiente** para una o más sub-entregas siguientes; hasta entonces, cada fila de la lista sigue apuntando a la ruta clásica de React (`/activos/:id`, navegación completa), igual que hizo Gastos con Obligaciones antes de que esa ruta existiera.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/pages/activos.js` | ~290 | Lista + `AssetList` combinados en un solo módulo — el original nunca reusaba `AssetList` en otro lado, separarlo habría sido una capa sin necesidad real |
| `js/components/asset-form-dialog.js` | ~330 | Diálogo de 2 pasos: preset (capacidades: `quantity`/`income`/`boards`) → detalle. Reemplaza el enum de tipos por categorías libres (v2.5.0) |
| `js/lib/asset-categories.js` | 60 | `ASSET_PRESETS`, `CAPABILITY_LABELS/DESCRIPTIONS`, `categoryName()` |

**Corrección de comportamiento — resolución de categoría en la columna "Tipo".** El `AssetList.tsx` original resuelve la columna con `ASSET_TYPE_LABELS[record.assetType] ?? record.assetType` — un mapa de solo 11 entradas *legadas*. Desde v2.5.0 `assetType` guarda el id de una `AssetCategory` (ver CLAUDE.md); para una categoría legada el id sigue siendo la clave vieja (`"STOCK"`, sembrado así por `ensureAssetCategories()`) y el lookup funciona por coincidencia, pero para **cualquier categoría que el usuario cree desde cero** el id es un UUID nuevo, `ASSET_TYPE_LABELS[uuid]` es `undefined`, y el fallback muestra el UUID crudo en la tabla — un defecto real y verificable en el código actual. `lib/asset-categories.ts` ya expone `categoryName(id, categories)`, el resolver correcto (categoría real → nombre legado → id crudo como último recurso), pero `AssetList.tsx` nunca lo llama pese a tener `categories` disponible. La versión vanilla sí lo usa. Es una corrección de una línea con datos que la propia pantalla ya tenía cargados — no un cambio de comportamiento intencional que amerite discutirse aparte.

**Ícono agregado**: `icon-network` (agrupar / indicador de grupo) — el original usaba `Network` de lucide-react, sin equivalente en el sprite hasta ahora.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 3 módulos + `shell.js` | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos + `/app/activos` vía rewrite | ✅ 200 |
| **Flujo real de escritura, contra la API real con un usuario de prueba**: sembrar categorías → crear categoría "Inmuebles" → crear activo simple con esa categoría → crear activo con capacidad `quantity` (ticker+cantidad+precio) → crear activo con capacidad `income` (valor = proyección) → agregar regla de ingreso → fijar `valueMode=PROJECTION` (verificado el recálculo: 2000/mes → 24000 anual) → gasto vinculado (`linked`) → crear grupo con 2 activos → asignar un tercero → remover uno → liquidar un activo (verificado balance→0 + ingreso creado) → eliminarlo físicamente → eliminar el grupo | ✅ Los 13 pasos, verificados contra las respuestas reales de la API |
| `isGroupParent`/`parentId` en la respuesta de `/api/dashboard` tras crear/asignar/remover de un grupo | ✅ Confirmado en cada paso |
| Endpoints sin cookie de sesión | ✅ 401 (mismo patrón ya documentado de validación-antes-que-auth en `POST /api/assets` con body vacío — no es un hallazgo nuevo) |
| Limpieza del usuario de prueba (17 records + 2 audit log + 3 journal entries + 1 categoría + 1 regla de ingreso + 2 financial movements) | ✅ Eliminado en orden correcto (`incomeOccurrence` → `incomeRule` → `financialMovement` → `group` → `journalEntry` → `auditLog` → `record` → `assetCategory` → `user`); 3 usuarios reales intactos |

### Fase 4 — Activos (detalle) · **en construcción, todavía NO enrutado**

Primer avance sobre `/app/activos/:id`. **Deliberadamente no se registró la ruta en `shell.js` ni se cambiaron los links de la lista** — la página compone secciones que aún faltan (reglas de ingreso, tableros, 6 de los 8 paneles especializados) y exponerla a mitad de camino violaría el criterio de corte del plan ("ninguna pantalla se considera migrada si pierde funcionalidad"). Se sigue sirviendo desde la ruta clásica de React hasta que esté completa.

| Archivo | Líneas | Rol | Estado |
|---|---|---|---|
| `js/pages/activo-detail.js` | ~150 | Página: header, resumen de hijos (grupo), desagrupar, compone las secciones | Estructura completa; el dispatcher de paneles tiene 6 casos con `TODO` explícito |
| `js/components/asset-info-section.js` | ~215 | Edición inline (nombre, ticker, categoría, descripción, capacidad `tracksQuantity`) | Completo |
| `js/components/asset-movements-section.js` | ~110 | Tabla de movimientos con edición/eliminación inline | Completo |
| `js/components/asset-panels/generic-panel.js` | 45 | Panel "Detalles técnicos" (ticker/cantidad/precio promedio) | Completo — cubre 2 de los 8 casos del dispatcher (ver nota) |

**Uso del endpoint compuesto.** `GET /api/assets/:id/full` (creado en la Fase 3, no usado hasta ahora) trae `{asset, income}` en una sola request — el original hacía `loadAsset()` server-side directo en el Server Component, sin round-trip visible, pero acá reemplaza lo que habrían sido 2 llamadas separadas (activo + reglas de ingreso).

**Simplificación deliberada — sin editor de texto enriquecido.** El campo `description` usa TipTap en el original (`RichEditor`), guardando JSON. Ese mismo componente **ya tolera strings planos como fallback** — los envuelve en un párrafo si `JSON.parse` falla (confirmado leyendo `rich-editor.tsx`). Portar TipTap a vanilla (toolbar, esquema de nodos, sanitización) para un solo campo de texto es exactamente la complejidad que el brief pide cuestionar; la versión vanilla guarda y edita texto plano. Se pierde negrita/listas/tablas en la descripción — nada más — y el texto sigue siendo legible y editable desde ambas apps mientras convivan.

**`StockPanel` y `GenericAssetPanel` son el mismo panel.** Leyendo `stock-panel.tsx` se confirmó que su única lógica propia (`handleBuyFromHistory`) nunca se conecta a ningún botón — está silenciada con `void handleBuyFromHistory` para que el linter no se queje de código muerto. El componente solo renderiza `<GenericAssetPanel/>`. `generic-panel.js` cubre ambos casos del dispatcher (activos con `tracksQuantity` y activos genéricos con datos técnicos) sin duplicar nada.

**Pendiente explícito para completar esta pantalla** (bloquea el enrutado):
1. `IncomeRulesSection` + `IncomeRuleDialog` + `CollectIncomeDialog` (~890 líneas originales) — el motor de ingresos recurrentes, disponible para cualquier activo.
2. `BoardManager` + `DividendsBoard` + `CustomBoard` (~860 líneas originales) — tableros opcionales.
3. Los 6 paneles especializados restantes: `FixedTermPanel`, `FuturesPanel`, `BondPanel`, `TradingPanel`, `TradingBotPanel`, `RebalanceBotPanel` (~1260 líneas originales) — se activan por la forma de `metadata`, nunca por tipo.
4. Una vez completo: registrar `/app/activos/:id` en `shell.js`, cambiar los links de `activos.js` y del `sourceBadge` de activo en `gastos.js`/`ingresos.js` a navegación SPA, y correr la verificación end-to-end completa (hoy solo se verificaron por API `GET .../full`, `PATCH` de info, `PATCH`/`POST`/`DELETE` de movimientos, y 401 sin sesión — sin probar en navegador porque la página todavía no es alcanzable).

### Verificación ejecutada (parcial — alcance de esta sub-entrega)

| Check | Resultado |
|---|---|
| `node --check` en los 4 módulos | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos servidos (`activo-detail.js` y sus 3 componentes) | ✅ 200 |
| `GET /api/assets/:id/full` — shape exacto de `{asset, income}` contra un activo real con ticker/cantidad/precio/descripción | ✅ Coincide con lo que esperan `asset-info-section.js` y `generic-panel.js` |
| `PATCH /api/assets/:id` (nombre + descripción) | ✅ Confirmado releyendo `/full` después |
| `POST`/`PATCH`/`DELETE` de movimientos | ✅ Los 3 verificados contra las respuestas reales |
| Sin cookie de sesión | ✅ 401 en `/full` |
| Limpieza del usuario de prueba (1 record + 1 financial movement + 2 journal entries) | ✅ Eliminado en orden correcto; 3 usuarios reales intactos |

### Fase 4 — Activos (detalle) — reglas de ingreso · **avance, sigue sin enrutar**

Segundo avance sobre `/app/activos/:id`. Se agregó el motor de ingresos recurrentes completo: crear/editar regla (4 ejes: monto fijo o porcentual, ajuste periódico, cronograma finito, efectivo o en especie), pausar/reanudar/eliminar regla, listar ocurrencias con proyección anual, y confirmar/rechazar cada cobro. La ruta **sigue sin registrarse** — todavía faltan tableros y 6 paneles especializados.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/components/income-rules-section.js` | ~200 | Orquesta: proyección anual, modo de valuación (checkbox proyección/manual), lista de reglas, lista de ocurrencias con paginación "ver todos" |
| `js/components/income-rule-dialog.js` | ~215 | Crear/editar regla — un solo diálogo para ambos casos, como el original |
| `js/components/collect-income-dialog.js` | ~120 | Confirmar cobro, con vista previa en vivo del efecto sobre el activo (capital que baja, o que sube si es en especie) |
| `js/lib/income-streams.js` | 18 | Etiquetas (`INCOME_STATUS_LABELS`, `AMOUNT_MODE_LABELS`, `SETTLEMENT_LABELS`) — `RECURRENCE_TYPE_LABELS` se reusa de `lib/obligations.js`, igual que en el original (`income-streams.ts` lo reexporta del mismo lugar) |

**Corrección de patrón — vista previa sin reconstruir el input.** El primer borrador de `collect-income-dialog.js` repintaba el diálogo completo en cada tecla del monto (para recalcular la diferencia vs. lo esperado y el efecto sobre el capital), igual que había hecho en otros diálogos donde no importaba. Acá sí importa: el usuario tipea un monto que puede tener varios dígitos, y reconstruir el `<input>` en cada tecla le hace perder el cursor a mitad de escritura — el mismo problema que motivó el diseño de `historial.js`. Se corrigió antes de darlo por terminado: el monto vive en un `<input>` que nunca se destruye; solo el texto derivado (diferencia, vistas previas) se actualiza por `textContent`.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 4 módulos | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos servidos | ✅ 200 |
| **Flujo real, contra la API real con un usuario de prueba**: crear activo tipo préstamo → crear regla de ingreso (monto fijo, `reducesPrincipal`, 12 cuotas) → verificar las 12 ocurrencias pre-generadas (`ingresoRecordId`, `installmentNumber`, etc.) → pausar/reanudar regla → cobrar una ocurrencia (verificado el descuento de capital: 6000→5500) → rechazar otra → editar la regla → eliminarla | ✅ Los 8 pasos, verificados contra las respuestas reales de la API |
| Sin cookie de sesión | ✅ 401 en `GET .../income` y `POST .../collect` |
| Limpieza del usuario de prueba (12 records + 2 financial movements + 2 journal entries + 2 audit log) | ✅ Eliminado en orden correcto (`incomeOccurrence` → `incomeRule` → `financialMovement` → `journalEntry` → `auditLog` → `record` → `user`); 3 usuarios reales intactos |

### Fase 4 — Activos (detalle) — tableros · **avance, sigue sin enrutar**

Tercer avance sobre `/app/activos/:id`: tableros de dividendos y personalizado. La ruta **sigue sin registrarse** — quedan los 6 paneles especializados.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/components/boards/board-manager.js` | ~75 | Lista los tableros del activo, agregar/eliminar |
| `js/components/boards/dividends-board.js` | ~205 | Tabla de dividendos + alta (con serie recurrente) + cobro |
| `js/components/boards/custom-board.js` | ~250 | Tabla libre con columnas/filas tipadas — el único componente de todo Activos con **edición en borrador local** (ver nota) |
| `js/lib/dividends.js` | 35 | `generateRecurringDividends`/`nextRecurringMonth`, portadas 1:1 |

**Simplificación deliberada — sin menú desplegable para "Agregar tablero".** El original usa un `DropdownMenu` de Radix con exactamente 2 opciones fijas que nunca cambian (Dividendos / Tablero personalizado). Montar un componente de dropdown genérico para 2 botones que no varían es más aparato del que el caso pide — la versión vanilla muestra los dos botones lado a lado. Mismo resultado, un clic menos, sin dependencia nueva.

**`CustomBoard` es el único componente de Activos con edición en borrador.** Agregar/quitar columnas y filas **no llama a la API de inmediato** — se acumula en estado local (bandera `dirty`) hasta que el usuario aprieta "Guardar" o "Descartar". Confirmado leyendo el original: no es una simplificación mía, es el comportamiento real que evita un `PATCH` por cada columna tocada durante la edición. Se portó tal cual, incluyendo que "Descartar" solo restaura hasta el último guardado real.

**Hallazgo — falso positivo, no un bug real.** Al verificar `POST /api/assets/:id/dividends/:dividendId/collect` contra el servidor apareció un 404 servido por el propio Next.js (HTML de "This page could not be found", no el JSON de error que produce `handle()`), pese a que el archivo de la ruta existe y sigue el mismo patrón que otras rutas anidadas con dos parámetros dinámicos que sí funcionan (p. ej. `obligations/[id]/rules/[ruleId]/pause`, verificada en la sub-fase de Obligaciones). Un restart del dev server con `.next` borrado lo resolvió — Turbopack no había compilado esa ruta específica en ningún momento anterior de la sesión de desarrollo. No hay nada que corregir en el código: ni la ruta, ni el cliente. Documentado para que una futura sesión no pierda tiempo si vuelve a aparecer un 404 en una ruta que "debería" existir — antes de sospechar del código, reiniciar con caché limpia.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 4 módulos | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos servidos | ✅ 200 |
| **Flujo real, contra la API real con un usuario de prueba**: crear activo → agregar tablero de dividendos → agregar dividendo recurrente (serie con `seriesId`) → cobrarlo (verificado `actualGain` + `ingresoRecordId` persistidos) → agregar tablero personalizado con columna + fila → eliminar el tablero personalizado (verificado que solo queda 1 tablero) | ✅ Los 6 pasos, verificados contra las respuestas reales de la API |
| Sin cookie de sesión | ✅ 401 en `PATCH .../boards` |
| Limpieza del usuario de prueba (2 records + 1 financial movement + 2 journal entries) | ✅ Eliminado en orden correcto; 3 usuarios reales intactos |

### Fase 4 — Activos (detalle) · **completa y enrutada**

Últimos 6 paneles especializados (fixed-term, bono, trading, trading-bot, futuros, bot de rebalanceo) — el dispatcher `pickPanel()` ya elige entre los 8 por la forma de `metadata`, igual que `asset-detail.tsx`. Con esto `/app/activos/:id` queda **registrada en `shell.js` y enlazada desde todos lados**: la lista de Activos, el header de Gastos/Ingresos ("Desde Activos"), los hijos de un grupo, el botón "Desagrupar", y el propio botón "Nueva operación" de Futuros post-liquidación (que reabre el mismo `asset-form-dialog.js` que ya existía para la lista — sin duplicarlo).

| Archivo | Líneas | Se activa cuando |
|---|---|---|
| `js/components/asset-panels/fixed-term-panel.js` | ~110 | `metadata.rate != null && metadata.endDate != null` |
| `js/components/asset-panels/bond-panel.js` | ~135 | `Array.isArray(metadata.disbursements)` |
| `js/components/asset-panels/trading-panel.js` | ~90 | `metadata.totalObtained != null` |
| `js/components/asset-panels/trading-bot-panel.js` | ~95 | `metadata.totalGained != null \|\| metadata.totalLost != null` |
| `js/components/asset-panels/futures-panel.js` | ~215 | `metadata.positionTracking === true \|\| metadata.liquidated != null` |
| `js/components/asset-panels/rebalance-bot-panel.js` | ~245 | `Array.isArray(metadata.assets)` |
| `js/lib/assets-calc.js` | 12 | `calcFixedTermReturn`/`calcWeightedAvgPrice`, portadas 1:1 |

**Con esto termina Activos** — la pantalla más grande del proyecto (~5900 líneas originales entre 2 páginas y 24 componentes), migrada en 6 sub-entregas a lo largo de varias sesiones: lista, info+movimientos+panel genérico, reglas de ingreso, tableros, y estos 6 paneles. Todas verificadas end-to-end contra la API real antes de darlas por cerradas.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 7 módulos nuevos + `shell.js`/`activos.js`/`gastos.js`/`ingresos.js` (links actualizados) | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos + deep-link `/app/activos/:id` vía rewrite | ✅ 200 |
| **Flujo real, contra la API real con un usuario de prueba, los 6 tipos de metadata**: fixed-term (crear con tasa/fechas → verificar cálculo de retorno → cobrar) · bono (agregar desembolso → marcar cobrado) · trading (editar invertido/obtenido) · trading-bot (editar los 4 agregados) · futuros (agregar posición LONG → liquidar) · bot de rebalanceo (agregar 2 sub-activos → aporte proporcional 60/40 verificado a mano → eliminar uno) | ✅ Los 6 flujos, verificados contra las respuestas reales de la API |
| Sin cookie de sesión | ✅ 401 en `GET .../full` |
| Limpieza del usuario de prueba (7 records + 7 financial movements + 6 journal entries) | ✅ Eliminado en orden correcto; 3 usuarios reales intactos |

### Fase 4 — Dashboard · **completa — última pantalla de la Fase 4**

La pantalla más grande de todas después de Activos: `dashboard-sheet.tsx` (1250 líneas) es el motor de tabla compartido entre el Dashboard en vivo (editable) y la vista de solo lectura de un snapshot. Con esta entrega **se cierra `/app/snapshots/:id`**, pendiente desde la sub-fase de Snapshots — exactamente como se anticipó entonces: el mismo renderer se escribió una sola vez y ambas pantallas lo reusan.

| Archivo | Líneas | Rol |
|---|---|---|
| `js/components/section-table.js` | ~430 | El núcleo de la tabla: alta/edición/baja inline, grupos de flujo (gasto/ingreso), grupos de activos expandibles, filas extra (obligaciones), y los 2 diálogos especiales de activos (poner en cero, cambiar valor con Ajuste/Depósito/Egreso) |
| `js/components/dashboard-sheet.js` | ~140 | Compone Estado de Resultados (Ingresos/Gastos + Auditor) y BALANCE (Activos/Obligaciones) a partir de `section-table.js` |
| `js/components/cutoff-banner.js` + `cutoff-dialog.js` | ~50 + ~150 | Botón condicional + diálogo de corte mensual, con auto-apertura una vez por período (`localStorage: cashflow:cutoff-dismissed`) |
| `js/pages/home.js` | ~135 | Reemplaza la página de estado provisional. Header (corte + snapshot) + `dashboard-sheet.js` + diálogo de snapshot |
| `js/pages/snapshot-detail.js` | ~90 | Cierra el pendiente: balances contables + `dashboard-sheet.js` en modo `readOnly` |
| `js/pages/gasto-detail.js`, `js/pages/ingreso-detail.js` | ~85 c/u | Ver nota — hallazgo nuevo, no estaban en el alcance original de la sub-fase Gastos/Ingresos |

**Decisión de diseño — `SectionTable` deja de recibir 7 callbacks.** El original recibe `onCreate/onEdit/onDelete/onGroupAdjust/onBreakdown/onDeleteWithComment/onEditAmountWithComment` desde su padre — un diseño correcto en React porque mantiene `DashboardSheet` como componente puro, reusable y testeable por separado de sus efectos. Acá esa ventaja no existe: el módulo se usa desde exactamente dos lugares (dashboard en vivo, snapshot de solo lectura), y el segundo nunca dispara ninguno de esos callbacks. `section-table.js` llama a la API directamente (mismo patrón que el resto de la migración) y expone un único `onChanged()`.

**Hallazgo — dos pantallas que no estaban en el alcance original.** Migrando `dashboard-sheet.tsx` aparecieron los links `href="/gastos/${id}"` y `href="/ingresos/${id}"` en cada fila — rutas reales (`app/(dashboard)/gastos/[id]/page.tsx`, `.../ingresos/[id]/page.tsx`, ~150 líneas cada una) que la sub-fase de Gastos/Ingresos no cubrió porque esa sub-fase migró solo las pantallas de **lista** y esos detalles nunca aparecen enlazados desde ahí — únicamente desde el Dashboard. Se migraron acá, reusando el `links-panel.js` ya construido; sin esto, esos dos links del Dashboard habrían quedado rotos.

**Hallazgo — `onBreakdown` es código muerto en el original, no se portó.** `DashboardSheet` recibe la prop `onBreakdown` y la reenvía hasta `SectionTable`, pero **ningún botón la invoca** — confirmado grepeando las 4 apariciones del nombre en `dashboard-sheet.tsx`: ninguna está dentro de un `onClick`. `GroupBreakdownDialog` (88 líneas) es por lo tanto inalcanzable desde la UI actual del Dashboard. Portarlo habría sido reproducir un diálogo sin ningún botón que lo abra. No se portó — no es una pérdida de funcionalidad porque la funcionalidad ya no existía.

**Comportamiento preservado tal cual, aunque sorprende.** El diálogo "Tomar Snapshot" pide fecha inicio/fin, pero esos campos **solo arman el texto del período** — nunca filtran qué registros entran al snapshot (siempre son todos los `records` actuales). Confirmado leyendo `finance-store.tsx`: `takeSnapshot()` ignora las fechas para el filtrado. Se portó exactamente así, con un comentario en el código explicando por qué no filtra.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `node --check` en los 8 módulos nuevos + `shell.js`/`snapshots.js` (links actualizados) | ✅ Sin errores de sintaxis |
| `tsc --noEmit` | ✅ Sin errores |
| Estáticos nuevos + `/app`, `/app/snapshots/:id` vía rewrite | ✅ 200 |
| **`POST`/`PATCH`/`DELETE /api/records`** — el endpoint genérico que arma el Dashboard (nunca antes probado; las pantallas de Gastos/Ingresos/Activos usan sus propios endpoints con Server Actions dedicadas, no este) | ✅ Los 3 verbos, con el `movement` de auditoría armado en el cliente igual que `finance-store.tsx` |
| **Flujo real, contra la API real con un usuario de prueba**: crear ingreso inline → editarlo → eliminarlo → crear activo → Depósito con gasto asociado (verificado el gasto creado) → Egreso con ingreso asociado (verificado 1200→1000) → poner en cero con ingreso asociado (verificado →0) → crear obligación RECURRING con regla (verificado el shape para la fila extra) → estado y vista previa del corte → **ejecutar el corte real** (verificado `ingresosArchived`/`gastosArchived`/`gastosGenerated` + snapshot automático creado) → snapshot manual (verificado `data.accountBalances`) → `GET /api/gastos/:id` con el gasto que generó el corte | ✅ Los 13 pasos, verificados contra las respuestas reales de la API |
| Sin cookie de sesión | ✅ 401 en `/api/records` y `/api/cutoff` |
| Limpieza del usuario de prueba (17 records + 6 audit log + 5 journal entries + 4 financial movements + 1 obligación + 2 snapshots + 1 corte mensual) | ✅ Eliminado en orden correcto (`snapshotRecord` → `snapshot` → `monthlyCutoff` → `financialMovement` → `obligation` (cascada a rules/installments/payments) → `journalEntry` → `auditLog` → `record` → `user`); 3 usuarios reales intactos |

## Fase 4 — completa

Con el Dashboard se cierra la migración pantalla por pantalla: Login/Register, Shell, Configuración, Historial, Libro Contable, Snapshots (lista + detalle), Gastos/Ingresos (lista + detalle), Obligaciones, Activos (lista + detalle), y Dashboard. Toda pantalla alcanzable desde la navegación principal vive en `/app/*` con paridad funcional verificada contra la API real en cada sub-fase — ninguna se dio por migrada sin ese paso.

### Fase 5 — Limpieza (primer lote) · **completa**

Primer lote de limpieza: borrado de todo lo que quedó huérfano al terminar la Fase 4, y ajuste de `package.json` a lo que el servidor realmente necesita.

**Corrección de premisa — el plan original decía "eliminar React, React DOM".** Es incorrecto y no se ejecutó así: `next@16.2.6` declara `react` y `react-dom` como **peerDependencies obligatorias** (`node -e "require('./node_modules/next/package.json').peerDependencies"`), o sea que Next.js no arranca sin ellas aunque no quede un solo `.tsx` de UI. Next.js se queda como servidor de API + estáticos, y esas dos dependencias se quedan con él — no es una regresión ni un olvido, es una restricción real del framework que el plan original no había verificado.

**Borrado (`git rm`), confirmado sin consumidores server-side antes de cada borrado (`Grep` sobre `lib/*.ts` y `app/api/**`):**

| Qué | Detalle |
|---|---|
| `app/(dashboard)/**` | 19 archivos — todas las pantallas React, ya con equivalente vanilla verificado en Fase 4 |
| `app/login/`, `app/register/` | Páginas React de auth — reemplazadas por `public/app/login.html` / `register.html` |
| `components/**` | Directorio completo — cero imports desde `lib/*.ts` o `app/api/**` |
| `hooks/**` | Directorio completo — mismo chequeo |
| `lib/utils.ts` | El `cn()` de shadcn — solo lo usaba `components/**` |
| `postcss.config.mjs`, `components.json` | Config de Tailwind/shadcn CLI, sin Tailwind ya no aplica |
| `app/globals.css` | Directivas Tailwind — no relacionado con el CSS propio de `public/app/**` |
| `proxy.ts` (middleware) | Con cero `page.tsx` restantes y `/api/**`+`/app/**` ya excluidos de su matcher, no protegía nada |

**`app/layout.tsx` reescrito** — Next exige un layout raíz aunque no quede ningún `page.tsx`. Se dejó al mínimo: sin `AuthProvider` (borrado con `components/**`), sin fuentes Geist (no tenían ningún `className` que las usara), sin `globals.css`, sin las entradas de favicon/icon rotas que ya apuntaban a archivos inexistentes (`icon-light-32x32.png` etc. — deuda preexistente, no introducida acá).

**`package.json` recortado.** De 70 dependencias runtime a 10 (`@prisma/adapter-pg`, `@prisma/client`, `@vercel/analytics`, `bcryptjs`, `next`, `next-auth`, `pg`, `prisma`, `react`, `react-dom`) + 6 dev (`@types/bcryptjs`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`, `typescript`). Se fueron 27 `@radix-ui/*`, 13 `@tiptap/*`, todo el stack de Tailwind (`tailwindcss`, `@tailwindcss/postcss`, `postcss`, `tailwind-merge`, `tw-animate-css`, `autoprefixer`), y los huérfanos ya identificados en `ARCHITECTURE.md` P1 (`recharts`, `embla-carousel-react`, `react-day-picker`, `vaul`, `cmdk`, `react-resizable-panels`, `input-otp`, `next-themes`, `sonner`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `zod`, `playwright`, `postgres`, `class-variance-authority`, `clsx`, `lucide-react`).

**Nota operativa (Windows).** `npm install` falló primero con `EPERM` al no poder borrar binarios nativos de Tailwind — un dev server de un turno anterior seguía corriendo y tenía esos archivos abiertos vía el watcher de Turbopack. Se mató ese proceso y se borraron a mano los directorios huérfanos (`@radix-ui`, `@tiptap`, `@tailwindcss`, `tailwindcss`, `tailwind-merge`, `tw-animate-css`) antes de reintentar. No es un problema del código, solo de tener un proceso viejo reteniendo handles.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `tsc --noEmit` tras todos los borrados | ✅ Sin errores |
| `npm run build` (¿arranca Next con cero `page.tsx` bajo `app/`?) | ✅ Build limpio — todas las rutas listadas son `ƒ /api/**` (dinámicas) + `○ /_not-found`, sin ninguna página |
| Servidor real + usuario descartable (`fase5-smoketest-*@example.com`) | ✅ registro → login (`/api/auth/callback/credentials`) → `/api/auth/session` con cookie |
| `GET /api/bootstrap` | ✅ `auditCount` en vez del audit log completo, tal cual P2 del diagnóstico original |
| `GET /api/dashboard` | ✅ 200 |
| Estáticos: `/app/index.html`, `/app/js/shell.js`, `/app/js/pages/home.js`, `/app/login.html` | ✅ 200, `content-type` correcto |
| Rewrite SPA: `/app/activos`, `/app/activos/some-id` (deep link con id inventado) | ✅ 200, sirve `index.html` — el router de `router.js` decide client-side |
| `/` (raíz, ya sin `page.tsx`) | ⚠️ 404 — **esperado, no es regresión**: se confirmó por `Grep` que ningún flujo (`login.js`, `register.js`, `shell.js`, `api.js`) redirige nunca a `/`, todos van a `/app` o `/app/login.html` |
| Escritura real: `POST /api/categories`, `POST /api/records` (con `record`+`movement` completos) | ✅ Category y gasto creados, reaparecen en el siguiente `GET /api/bootstrap` |
| Sin sesión | (no re-verificado en este lote — ya cubierto en la verificación de Fase 4 Dashboard) |
| Limpieza del usuario de prueba (categoría + record + audit log + user) | ✅ Eliminado vía script puntual con el mismo adapter (`@prisma/adapter-pg`) que usa `lib/db.ts`; 3 usuarios reales confirmados intactos después |

### Fase 5 — mover `/app` a la raíz · **completa**

Segundo lote, tratado aparte por ser el de mayor riesgo: `public/app/**` deja de vivir bajo un prefijo y pasa a ser la raíz del sitio. `/activos`, `/gastos/:id`, `/` en vez de `/app/activos`, etc.

**Movimientos (`git mv`, preserva historia):** `public/app/{css,js}` → `public/{css,js}`, `public/app/{index,login,register}.html` → `public/{index,login,register}.html`. El directorio `public/app/` queda vacío y se borra.

**Reescritura de rutas hardcodeadas** en los 22 archivos que las tenían (`api.js`, `router.js`, `shell.js`, y ~19 `pages/*.js`/`components/*.js` con links `data-link`): `/app/` → `/`, y el caso especial de `/app` "pelado" (sin barra final: el href del Dashboard, `MIGRATED_PATHS`, los `window.location.href` de login/register) → `/`.

**Incidente durante el reemplazo masivo, corregido antes de seguir.** El primer intento uso `Get-Content -Raw` / `Set-Content -Encoding utf8` de PowerShell para el reemplazo — PowerShell 5.1 decodificó mal el UTF-8 de entrada y produjo mojibake (`está` → `estÃ¡`) en 19 de los 22 archivos. Detectado por revisión de diff antes de cualquier commit, revertido con `git checkout -- public/` (que también deshizo, de paso, la simplificación ya aplicada a `router.js`, reaplicada después) y rehecho con un script Node.js (`fs.readFileSync/writeFileSync` con `"utf8"` explícito), que no tiene ese problema. Verificado con `grep -rl 'Ã'` que no quedó mojibake y con `xxd` que ningún archivo quedó con BOM.

**`router.js` simplificado.** `normalizedPath()` ya no necesita despojar un prefijo `/app` (tres formas de llegar a la raíz reducidas a una: `location.pathname`, más el caso de `/index.html` explícito). El resaltado de link activo en `render()` perdió su rama especial para hrefs que empezaban con `/app`.

**`next.config.mjs` — no un rewrite plano, sino `fallback`.** El rewrite anterior (`/app/:path*` → `/app/index.html`) podía vivir como array plano porque estaba scopeado a un prefijo que nunca colisionaba con `/api/**`. Un rewrite plano equivalente en la raíz (`/:path*` → `/index.html`) sí colisionaría: según el orden de resolución de Next, un rewrite "afterFiles" (que es lo que es un array plano) se evalúa **antes** que las rutas dinámicas de `app/api/**`, así que `/api/assets/[id]` quedaría tapado. La categoría `fallback` (forma de objeto: `{ fallback: [...] }`) es justamente el patrón que la documentación de Next.js recomienda para este caso — se evalúa **después** de archivos estáticos y de rutas dinámicas, solo entra en juego si nada más matcheó. Verificado explícitamente contra una ruta con 2 parámetros dinámicos anidados (`/api/obligations/:id/rules/:ruleId/pause`) sin sesión: devolvió `401 application/json`, no el HTML del fallback.

### Verificación ejecutada

| Check | Resultado |
|---|---|
| `grep -rl 'Ã'` (mojibake) y `xxd` (BOM) sobre los 22 archivos tocados | ✅ Ninguno |
| `tsc --noEmit` | ✅ Sin errores |
| `npm run build` limpio tras el rm -rf .next | ✅ |
| `/`, `/login.html`, `/register.html`, `/js/shell.js`, `/css/base.css` | ✅ 200, tipos correctos |
| Deep links sin recarga real: `/activos`, `/activos/some-id`, `/obligaciones/uuid-fake`, incluso `/app` (ya no es un prefijo especial, cae al mismo fallback) | ✅ 200, sirve `index.html` |
| **Crítico** — `/api/bootstrap` sin sesión | ✅ `401 {"error":"No autorizado"}`, no HTML |
| **Crítico** — `/api/assets/fake-id` (1 param dinámico) sin sesión | ✅ `401 application/json` |
| **Crítico** — `/api/obligations/fake-id/rules/fake-rule/pause` (2 params dinámicos anidados) sin sesión | ✅ `401 application/json` — confirma que `fallback` no tapa ni las rutas dinámicas más profundas |
| Flujo real con usuario descartable (`fase5move-smoketest-*`): registro → login → `/api/auth/session` → `/api/bootstrap` con cookie | ✅ Los 4 pasos, todos contra rutas de la raíz nueva |
| `/js/auth.js`, `/js/pages/login.js`, `/js/pages/register.js`, `/js/api.js` (imports de módulos ES desde los HTML de auth) | ✅ 200 |
| Limpieza del usuario de prueba | ✅ Eliminado; 3 usuarios reales confirmados intactos |

## Fase 5 — completa

Con el movimiento de `/app` a la raíz se cierra la Fase 5. Queda solo la Fase 6 del plan original.

## Fase 6 — Auditoría de rendimiento · **completa**

Medición antes/después real, no estimada. Metodología: la versión "antes" no convive con la nueva en el mismo checkout (Fase 5 ya borró `app/(dashboard)/**` y `components/**`), así que se resucitó temporalmente en un **git worktree** apuntando al último commit puramente React (`6bdeeda`, padre directo del squash `705490c` que introdujo la capa API + frontend vanilla). Ambas versiones corrieron en paralelo, en modo producción (`next build && next start`), contra la **misma base de datos**, con un usuario descartable sembrado con 16 records (7 gastos, 4 ingresos, 5 activos) para que ninguna pantalla se midiera vacía.

**Herramienta**: `puppeteer-core` (solo el driver, sin Chromium propio — apunta al Chrome ya instalado en la máquina) pilotando el mismo navegador contra los dos puertos (`:3002` viejo, `:3000` nuevo). La cookie de sesión de NextAuth no está scopeada por puerto (los cookies no distinguen puerto per RFC 6265), así que un solo login sirvió para autenticar contra ambas versiones. Métricas leídas de la Performance API real del navegador (`paint`, `navigation`, `PerformanceObserver` para LCP vía `largest-contentful-paint` y TBT vía `longtask`) más bytes reales de red por `Network.loadingFinished` (CDP) — nada estimado ni extrapolado.

**Aclaración honesta sobre el alcance.** Todo corrió en localhost, en la misma máquina, sin throttling de red ni CPU — así que los milisegundos absolutos de FCP/LCP no representan la experiencia de un usuario real en producción (ahí las diferencias serían mayores, no menores: más aún con latencia de red real, la ventaja de menos requests y menos bytes se amplifica). Los deltas *relativos* y los bytes/requests contados sí son datos duros, no estimaciones.

### Resultados

| Pantalla | Métrica | Antes (React) | Después (vanilla) | Δ |
|---|---|---|---|---|
| `/login` | Bytes transferidos | 261 300 | 8 427 | **−97 %** |
| | Requests | 25 | 7 | −72 % |
| | LCP | 160 ms | 36 ms | −78 % |
| | Nodos DOM | 51 | 23 | −55 % |
| `/` (Dashboard) | Bytes transferidos | 393 190 | 72 087 | **−82 %** |
| | Requests | 79 | 36 | −54 % |
| | LCP | 2680 ms | 1044 ms | −61 % |
| | Nodos DOM | 814 | 636 | −22 % |
| `/activos` | Bytes transferidos | 390 401 | 55 812 | **−86 %** |
| | Requests | 58 | 26 | −55 % |
| | LCP | 864 ms | 488 ms | −44 % |
| | Nodos DOM | 349 | 287 | −18 % |
| `/historial` | Bytes transferidos | 389 564 | 40 373 | **−90 %** |
| | Requests | 49 | 18 | −63 % |
| | LCP | 872 ms | 636 ms | −27 % |
| | Nodos DOM | 344 | 337 | −2 % |
| TBT (las 4 pantallas) | — | 0 ms | 0 ms | sin diferencia medible en esta máquina sin throttling — ver aclaración arriba |

**Lectura del patrón.** Los bytes transferidos de la versión React son casi idénticos entre `/` (393 KB), `/activos` (390 KB) y `/historial` (390 KB) — la firma exacta de un bundle de framework compartido (React + Radix + TipTap + el resto del árbol de `components/ui`) que se re-descarga en cada navegación completa, dominando por sobre el código propio de cada pantalla. La versión vanilla no tiene ese piso: cada ruta pesa lo que sus módulos JS específicos pesan (72 KB → 55 KB → 40 KB, decreciente con la complejidad real de cada pantalla), sin una "cuota de entrada" fija. Esto es exactamente el problema que motivó la migración (P4/P7 de `ARCHITECTURE.md`) confirmado con datos, no solo con la cuenta de dependencias.

**Dependencias**: 70 → 10 en runtime (Fase 5). `node_modules` instalado: 370 paquetes en la versión vieja vs. 156 en la nueva (de la instalación registrada en el lote de limpieza).

**Build**: la versión vieja compila con Turbopack pero no imprime la tabla clásica de "First Load JS" por ruta (formato de salida cambiado en esta versión de Next); se midieron bytes reales de red en vez de inferir del build manifest, que resulta un dato más fiel de todos modos (captura compresión de transporte real, no el tamaño del archivo en disco).

### Verificación ejecutada / higiene del entorno de prueba

| Check | Resultado |
|---|---|
| Worktree en `6bdeeda`, `npm install` + `npm run build` + `npm start` en puerto 3002 | ✅ Levantó sin tocar el checkout principal |
| Usuario descartable + 16 records sembrados vía API, cookie de sesión válida contra ambos puertos | ✅ Confirmado con `/api/bootstrap` (nuevo) y `200` en `/` (viejo) |
| Limpieza del usuario de prueba (categoría + records + audit log + user) | ✅ Eliminado; 3 usuarios reales confirmados intactos |
| `git worktree remove --force ../DashboardCashFlow-before` | ✅ Worktree eliminado, `git worktree list` solo muestra el checkout principal |
| `git status` en el checkout principal tras toda la prueba | ✅ Limpio — la auditoría no dejó cambios de código, solo el informe en este archivo |

## Fase 6 — completa. Plan original (§4, Fases 1–6) cerrado en su totalidad.
