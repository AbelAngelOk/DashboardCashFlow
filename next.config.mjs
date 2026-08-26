/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // El frontend vanilla es una SPA servida como estáticos desde public/app/.
      // Next.js resuelve public/ ANTES que los rewrites, así que esta regla solo
      // se dispara para rutas que no son un archivo real (/app, /app/activos,
      // /app/gastos...) — nunca pisa css/js/html existentes. Es el equivalente
      // a un `try_files $uri /index.html` de nginx: deja que el router de
      // router.js decida qué pantalla mostrar a partir de la URL.
      { source: "/app", destination: "/app/index.html" },
      { source: "/app/:path*", destination: "/app/index.html" },
    ]
  },
}

export default nextConfig
