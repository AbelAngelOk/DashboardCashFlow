"use client"

// Gráfico de línea mínimo, sin dependencias (nada de recharts — ver
// PRODUCT_REVIEW.md §5.2: no hace falta reinstalar una librería pesada para
// una sola curva). Pensado para pocos puntos (snapshots), no para series
// largas.

interface TrendChartProps {
  points: { label: string; value: number }[]
  /** Cómo formatear el valor en el tooltip/eje (ej: agregar moneda). */
  formatValue: (v: number) => string
  height?: number
  positiveColor?: string
  negativeColor?: string
}

export function TrendChart({
  points,
  formatValue,
  height = 140,
  positiveColor = "#059669",
  negativeColor = "#e11d48",
}: TrendChartProps) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400" style={{ height }}>
        Hacen falta al menos 2 snapshots para ver una tendencia.
      </div>
    )
  }

  const width = 600
  const padding = 24
  const values = points.map((p) => p.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1

  const x = (i: number) => padding + (i * (width - padding * 2)) / (points.length - 1)
  const y = (v: number) => height - padding - ((v - min) / range) * (height - padding * 2)
  const zeroY = y(0)

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ")
  const last = points[points.length - 1]
  const lastColor = last.value >= 0 ? positiveColor : negativeColor

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {/* Línea de cero, si el rango cruza el eje */}
        {min < 0 && max > 0 && (
          <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#d1d5db" strokeDasharray="4 3" />
        )}
        <path d={path} fill="none" stroke="#000" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? lastColor : "#000"}>
            <title>{`${p.label}: ${formatValue(p.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{points[0].label}</span>
        <span className="font-semibold" style={{ color: lastColor }}>
          {formatValue(last.value)}
        </span>
        <span>{last.label}</span>
      </div>
    </div>
  )
}
