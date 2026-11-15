// El server siempre en UTC: Vercel ya corre así, y local y producción comparten la
// misma base. Con otra zona (ej. UTC-3) el cálculo de fechas de obligaciones y
// períodos corre un día (un lunes semanal caía en domingo).
process.env.TZ = "UTC"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
