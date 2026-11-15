"use client"

import Link from "next/link"

const INK = "#1f1f1f"
const MAX_ROWS = 8

export interface BarItem {
  id: string
  label: string
  value: number
  href?: string
}

interface BarListProps {
  items: BarItem[]
  formatValue: (v: number) => string
  emptyText?: string
  testId?: string
}

/**
 * Barras horizontales ordenadas de mayor a menor, un solo tono: el largo es el
 * dato. Más de 8 filas se pliegan en "Otros" (pasado ~7 clases se pierde la lectura).
 */
export function BarList({ items, formatValue, emptyText = "Sin datos para graficar.", testId }: BarListProps) {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  if (positive.length === 0) {
    return <p data-testid={testId} className="py-6 text-center text-xs text-gray-400">{emptyText}</p>
  }

  const total = positive.reduce((s, i) => s + i.value, 0)
  const rows: BarItem[] =
    positive.length > MAX_ROWS
      ? [
          ...positive.slice(0, MAX_ROWS - 1),
          {
            id: "__others__",
            label: `Otros (${positive.length - (MAX_ROWS - 1)})`,
            value: positive.slice(MAX_ROWS - 1).reduce((s, i) => s + i.value, 0),
          },
        ]
      : positive
  const max = rows[0].value

  return (
    <ul data-testid={testId} className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const share = (row.value / total) * 100
        const name = row.href ? (
          <Link href={row.href} className="truncate hover:underline" title={row.label}>{row.label}</Link>
        ) : (
          <span className="truncate" title={row.label}>{row.label}</span>
        )
        return (
          <li
            key={row.id}
            className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs"
            title={`${row.label}: ${formatValue(row.value)} (${share.toFixed(1)}% del total)`}
          >
            <span className="flex min-w-0 text-gray-700">{name}</span>
            <span className="relative h-4">
              <span
                className="absolute inset-y-0 left-0 rounded-r transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(1, (row.value / max) * 100)}%`, backgroundColor: INK }}
              />
            </span>
            <span className="whitespace-nowrap text-right tabular-nums">
              {formatValue(row.value)}
              <span className="ml-1 text-gray-400">{share.toFixed(0)}%</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
