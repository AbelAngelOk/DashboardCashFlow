import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"

// Next.js exige un layout raíz aunque no quede ningún page.tsx bajo app/ —
// toda la UI real vive en public/app/** (HTML/CSS/JS vanilla). Este layout
// solo importa lo mínimo que Next necesita para compilar; ya no depende de
// componentes de React (todos removidos en la Fase 5 de MIGRATION_PLAN.md).
export const metadata: Metadata = {
  title: "Cash Flow",
  description: "Personal financial dashboard",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
