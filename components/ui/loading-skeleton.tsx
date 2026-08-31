// Skeletons compartidos para listas/tablas que cargan desde la DB.
// Se usan mientras el fetch está en vuelo, en lugar de un "Cargando..." de
// texto plano o (peor) dejar la lista vacía y que se confunda con "no hay
// datos". Ver components/dashboard-sheet.tsx para el mismo patrón aplicado
// a las tablas del dashboard.

/** Filas de tabla con barras pulsantes — para listas tipo Gastos/Ingresos/Activos/Obligaciones (desktop). */
export function TableRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center border-b border-black/10 px-3 py-2.5">
          <div
            className="h-3 rounded bg-gray-200"
            style={{ width: `${58 - i * 9}%` }}
          />
          <div className="ml-auto h-3 w-16 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

/** Tarjetas pulsantes — para la vista mobile de Obligaciones. */
export function CardsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse border-2 border-black p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="h-3.5 w-1/2 rounded bg-gray-200" />
            <div className="h-3.5 w-14 rounded bg-gray-200" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="h-3 w-1/3 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}
