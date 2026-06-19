# 05 — Integraciones

## Supabase (PostgreSQL)

### Descripción

Supabase actúa únicamente como proveedor de PostgreSQL. No se usa ninguna otra característica de Supabase (Auth de Supabase, Storage, Realtime, Edge Functions). La conexión se realiza a través del cliente oficial de `pg` con el adaptador de Prisma para pg.

### Configuración

Dos strings de conexión configurados en `.env`:

| Variable | Puerto | Modo | Uso |
|---|---|---|---|
| `DATABASE_URL` | 6543 | PgBouncer (modo transacción) | Queries normales (no-transaccionales) |
| `DIRECT_URL` | 5432 | Directo al servidor | Transacciones interactivas (`$transaction` async) |

> El modo transacción de PgBouncer no soporta comandos de sesión ni transacciones interactivas multi-statement, por eso se usa `DIRECT_URL` para las operaciones que requieren `$transaction`.

### Región

`aws-1-sa-east-1` — São Paulo, Brasil. Elección apropiada para un usuario en Argentina/Latinoamérica.

### Archivos relevantes

- `lib/db.ts` — Instanciación del cliente Prisma con adaptador `pg`
- `prisma/schema.prisma` — Definición del esquema
- `.env` / `.env.local` — Variables de conexión

### Riesgo de seguridad

Las credenciales de la base de datos (`DATABASE_URL` y `DIRECT_URL`) están en el archivo `.env` y también en `.env.local`, ambos probablemente rastreados por git (no se encontró `.gitignore` en la revisión, pero debería verificarse). Las credenciales incluyen usuario, contraseña y host de Supabase. **Si el repositorio es público o se expone accidentalmente, la base de datos queda comprometida.**

---

## NextAuth (Autenticación)

### Descripción

Sistema de autenticación basado en [NextAuth v4](https://next-auth.js.org/) con estrategia de sesiones JWT. No hay OAuth ni proveedores sociales; solo autenticación por credenciales (email + contraseña hasheada en la DB).

### Configuración

Archivo `lib/auth.ts`:

```typescript
{
  session: { strategy: "jwt" },
  providers: [CredentialsProvider(...)],
  callbacks: { jwt, session },
  pages: { signIn: "/login" }
}
```

### Flujo JWT

1. Login exitoso → NextAuth genera un JWT con `id`, `email`, `name` del usuario.
2. El callback `jwt` agrega `token.id = user.id`.
3. El callback `session` expone `session.user.id = token.id`.
4. Las Server Actions usan `getServerSession(authOptions)` para extraer el `userId`.

### Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `NEXTAUTH_SECRET` | Clave para firmar/verificar los JWT (actualmente hardcodeada en `.env`) |
| `NEXTAUTH_URL` | URL base de la aplicación para los redirects de auth |

### Handler API

`app/api/auth/[...nextauth]/route.ts` — Maneja todas las rutas de NextAuth (`/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, etc.).

### Middleware

`proxy.ts` usa `withAuth` de NextAuth para proteger todas las rutas excepto:
- `/login`
- `/register`
- `/api/auth/*`
- Archivos estáticos de Next.js

### Riesgo de seguridad

El valor de `NEXTAUTH_SECRET` está hardcodeado en los archivos `.env` y `.env.local`. Si este valor se expone, un atacante podría forjar tokens JWT válidos para cualquier usuario.

---

## open.er-api.com (Tasas de Cambio)

### Descripción

API REST gratuita y pública para obtener tasas de cambio en tiempo real. Se usa para la funcionalidad de conversión de monedas del dashboard.

### Endpoint utilizado

```
GET https://open.er-api.com/v6/latest/{baseCurrency}
```

### Ejemplo de respuesta esperada

```json
{
  "result": "success",
  "rates": {
    "USD": 1,
    "EUR": 0.92,
    "ARS": 1050,
    "MXN": 17.2,
    "USDT": 1.0
  }
}
```

### Conversión de formato

La API devuelve `1 base = X foreign`. El sistema necesita `1 foreign = ? base`:

```typescript
rates[c] = 1 / apiRate  // conversión de formato
```

### Características

- **Sin autenticación**: No requiere API key (tier gratuito).
- **Bajo demanda**: Solo se llama cuando el usuario hace clic en "Actualizar" en `/configuracion`.
- **Fallback**: Si falla, mantiene las tasas anteriores guardadas en `localStorage`.
- **Monedas soportadas**: USD, EUR, MXN, ARS, USDT (USDT no es una divisa real, la API puede no devolverla, en cuyo caso se usa la tasa por defecto 1:1 con USD).

### Limitaciones conocidas

- El tier gratuito puede tener límites de rate y las tasas pueden no ser en tiempo real.
- USDT (stablecoin) no es una divisa ISO estándar; no aparece en APIs de cambio de divisas tradicionales.
- Si la API cambia su estructura de respuesta, el sistema fallará silenciosamente.

### Archivos relevantes

- `components/settings-store.tsx` → función `fetchExchangeRates()` (línea ~120)

---

## Vercel Analytics

### Descripción

Servicio de analíticas web de Vercel, integrado como componente React.

### Uso

Solo se activa en producción (`process.env.NODE_ENV === "production"`):

```tsx
// app/layout.tsx
{process.env.NODE_ENV === "production" && <Analytics />}
```

### Datos recopilados

Métricas de uso: visitas de página, rutas, tiempo en pantalla, etc. Sin datos de usuario identificables (PII-free).

### Archivos relevantes

- `app/layout.tsx`
- Paquete: `@vercel/analytics` v1.6.1

---

## Google Fonts (Geist)

### Descripción

Las tipografías Geist Sans y Geist Mono se cargan desde Google Fonts a través del sistema integrado de Next.js (`next/font/google`).

### Configuración

```tsx
// app/layout.tsx
const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
```

> **Nota**: Las variables de fuente se asignan a `_geist` y `_geistMono` (con prefijo `_`) pero no se aplican a ningún elemento HTML. Es posible que la fuente Geist se cargue por el CDN de Google pero no se use efectivamente, y la tipografía visible sea la fuente `font-sans` por defecto de Tailwind. Esto requiere verificación.

---

## Variables de entorno — Resumen

| Variable | Archivo | Descripción | Sensible |
|---|---|---|---|
| `DATABASE_URL` | `.env`, `.env.local` | Conexión PostgreSQL vía PgBouncer | ✅ Sí |
| `DIRECT_URL` | `.env`, `.env.local` | Conexión directa PostgreSQL | ✅ Sí |
| `NEXTAUTH_SECRET` | `.env`, `.env.local` | Clave de firma JWT | ✅ Sí |
| `NEXTAUTH_URL` | `.env`, `.env.local` | URL base del sitio | No |
| `NODE_ENV` | Runtime | Entorno de ejecución | No |

### Variables de entorno necesarias en producción (Vercel)

Para desplegar correctamente se requiere configurar en el panel de Vercel:
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (con la URL de producción, no `localhost:3000`)

---

## Integraciones ausentes

Las siguientes integraciones fueron buscadas y **no encontradas** en el código:

| Integración | Estado |
|---|---|
| **Binance API** | No integrada. No existe ninguna referencia a Binance en el código fuente. |
| **Webhooks** | No existen endpoints de webhook. |
| **Envío de emails** | No hay integración de email (confirmación, recuperación de contraseña). |
| **Notificaciones push** | No implementadas. |
| **SMS** | No implementado. |
| **Stripe / pagos** | No implementado. |
