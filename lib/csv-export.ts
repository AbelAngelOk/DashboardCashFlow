// Exportación de datos a CSV, 100% client-side — los datos ya están en el
// navegador (via FinanceProvider), no hace falta ningún endpoint nuevo.
// Ver PRODUCT_REVIEW.md §4: "no poder sacar tus propios datos financieros es
// una limitación de confianza, no solo de conveniencia."

function escapeCsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.map((c) => escapeCsvCell(String(c))).join(",")
  const body = rows.map((r) => columns.map((c) => escapeCsvCell(r[c])).join(",")).join("\n")
  return `${header}\n${body}`
}

/** Dispara la descarga de un archivo de texto en el navegador. */
export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["﻿" + content], { type: mime }) // BOM para que Excel detecte UTF-8
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
