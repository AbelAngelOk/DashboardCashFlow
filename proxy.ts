import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function proxy(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  },
)

export const config = {
  matcher: [
    // `api` queda FUERA del middleware a propósito.
    //
    // withAuth responde con un 307 hacia /login, que sirve para navegación pero
    // rompe a un cliente fetch: recibe HTML donde espera JSON y no puede
    // distinguir "sesión vencida" de cualquier otro error.
    //
    // Cada route handler de /api valida la sesión por su cuenta (requireUserId o
    // getUserId de las acciones) y devuelve 401 con cuerpo JSON. La única ruta
    // pública es /api/auth/* (login y alta de usuario).
    //
    // `app` también queda fuera: es el frontend HTML/CSS/JS vanilla servido
    // como estáticos desde public/app/. Necesita ser alcanzable SIN sesión
    // (empezando por /app/login.html), y valida la sesión por su cuenta en
    // JS (auth.js + el manejo de 401 de api.js). El mismo 307 que rompe a
    // fetch acá rompería directamente la carga del HTML: el navegador nunca
    // llegaría a ejecutar el JS que decide si redirigir o no.
    "/((?!login|register|api|app|_next/static|_next/image|favicon.ico|icon.*|apple-icon).*)",
  ],
}
