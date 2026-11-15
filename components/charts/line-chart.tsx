"use client"

import { useEffect, useRef, useState } from "react"

// Tintas del sistema monocromo; el acento solo marca el pico (bonanza / dolor)
// y siempre va con la etiqueta "Pico" — nunca color solo.
const INK = "#1f1f1f"
const GRID = "#e7e5e4"
const AXIS = "#a8a29e"
const ACCENT = { good: "#0ca30c", bad: "#d03b3b" } as const

export interface LinePoint {
  label: string
  value: number
}

interface LineChartProps {
  points: LinePoint[]
  formatValue: (v: number) => string
  /** Marca el máximo con el acento correspondiente */
  peak?: { index: number; tone: keyof typeof ACCENT }
  /** Índice del mes actual: lo posterior se dibuja punteado (proyección) */
  todayIndex?: number
  height?: number
  emptyText?: string
  testId?: string
}

const PAD = { top: 16, right: 16, bottom: 24, left: 56 }

function niceMax(v: number): number {
  if (v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

function compact(v: number): string {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(v)
}

export function LineChart({
  points,
  formatValue,
  peak,
  todayIndex,
  height = 200,
  emptyText = "Sin datos para graficar.",
  testId,
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  const hasData = points.length > 1 && points.some((p) => p.value !== 0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasData])

  if (!hasData) {
    return (
      <div ref={wrapRef} data-testid={testId} className="flex items-center justify-center text-xs text-gray-400" style={{ height }}>
        {emptyText}
      </div>
    )
  }

  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const max = niceMax(Math.max(...points.map((p) => p.value)))
  const x = (i: number) => PAD.left + (i * plotW) / (points.length - 1)
  const y = (v: number) => PAD.top + plotH - (Math.max(0, v) / max) * plotH
  const baseline = y(0)

  const split = todayIndex !== undefined && todayIndex >= 0 && todayIndex < points.length - 1 ? todayIndex : points.length - 1
  const pathOf = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((p, k) => `${k === 0 ? "M" : "L"} ${x(from + k)} ${y(p.value)}`)
      .join(" ")
  const solidPath = pathOf(0, split)
  const futurePath = split < points.length - 1 ? pathOf(split, points.length - 1) : ""
  const areaPath = `${pathOf(0, points.length - 1)} L ${x(points.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`

  const ticks = [0, max / 2, max]
  const labelEvery = points.length > 12 ? 2 : 1

  const indexAt = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const rel = clientX - rect.left - PAD.left
    return Math.min(points.length - 1, Math.max(0, Math.round((rel / plotW) * (points.length - 1))))
  }

  const peakPoint = peak && peak.index >= 0 ? points[peak.index] : null
  const tip = hover !== null ? points[hover] : null

  return (
    <div data-testid={testId} className="w-full">
      <div
        ref={wrapRef}
        className="relative w-full outline-none focus-visible:ring-2 focus-visible:ring-black"
        tabIndex={0}
        role="img"
        aria-label={`Gráfico de línea, ${points.length} meses. Usá las flechas para recorrer los valores.`}
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1))
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1))
        }}
      >
        <svg width={width} height={height} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500 text-[10px] tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}

          {todayIndex !== undefined && todayIndex >= 0 && todayIndex < points.length && (
            <g>
              <line x1={x(todayIndex)} x2={x(todayIndex)} y1={PAD.top} y2={baseline} stroke={AXIS} strokeWidth={1} />
              <text x={x(todayIndex) + 4} y={PAD.top + 8} className="fill-gray-500 text-[10px]">hoy</text>
            </g>
          )}

          <path d={areaPath} fill={INK} fillOpacity={0.08} />
          <path d={solidPath} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {futurePath && (
            <path d={futurePath} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {points.map((p, i) =>
            // Anclado al último punto para que la última etiqueta nunca pise a la anterior
            (points.length - 1 - i) % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-gray-500 text-[10px]">
                {p.label}
              </text>
            ) : null,
          )}

          {peak && peakPoint && (
            <circle cx={x(peak.index)} cy={y(peakPoint.value)} r={5} fill={ACCENT[peak.tone]} stroke="#ffffff" strokeWidth={2} />
          )}

          {tip && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={baseline} stroke={INK} strokeWidth={1} strokeOpacity={0.35} />
              <circle cx={x(hover)} cy={y(tip.value)} r={4} fill={INK} stroke="#ffffff" strokeWidth={2} />
            </g>
          )}
        </svg>

        {tip && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 border border-black bg-white px-2 py-1 text-xs shadow-none"
            style={{ left: Math.min(Math.max(x(hover) - 60, 0), width - 130) }}
          >
            <div className="font-bold tabular-nums">{formatValue(tip.value)}</div>
            <div className="text-gray-500">
              {tip.label}
              {todayIndex !== undefined && hover > todayIndex ? " · proyectado" : ""}
            </div>
          </div>
        )}
      </div>

      {peak && peakPoint && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-700">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT[peak.tone] }} />
          <span className="font-bold">Pico:</span> {peakPoint.label} — {formatValue(peakPoint.value)}
        </p>
      )}

      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-gray-500 hover:text-black">Ver tabla</summary>
        <table className="mt-1 w-full border-collapse">
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-0.5 pr-2 text-gray-600">
                  {p.label}
                  {todayIndex !== undefined && i > todayIndex ? " (proyectado)" : ""}
                </td>
                <td className="py-0.5 text-right tabular-nums">{formatValue(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
