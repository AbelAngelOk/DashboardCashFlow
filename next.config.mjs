/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // El frontend vanilla es una SPA servida como estáticos desde public/.
    // `fallback` (a diferencia de un rewrite plano) se evalúa DESPUÉS de
    // archivos estáticos Y de las rutas dinámicas de app/api/**, así que
    // nunca puede pisar /api/assets/[id] ni similares — solo entra en juego
    // cuando nada más matcheó. Es el equivalente a `try_files $uri /index.html`
    // de nginx: deja que router.js decida qué pantalla mostrar según la URL.
    return {
      fallback: [{ source: "/:path*", destination: "/index.html" }],
    }
  },
}

export default nextConfig
