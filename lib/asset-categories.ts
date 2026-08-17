// Categorías de activo — tipos y helpers puros.
//
// Desde v2.5.0 el "tipo de activo" dejó de ser un enum con comportamiento y pasó
// a ser una etiqueta libre. Lo que antes distinguía a un STOCK de un BOND ahora
// son capacidades configurables por activo (ver ASSET_CAPABILITIES).

export interface AssetCategory {
  id: string
  name: string
  order: number
}

/**
 * Nombres de los tipos legados. Se usan solo para SEMBRAR categorías con el mismo
 * id que el valor legado, de modo que los activos existentes conserven su etiqueta
 * sin tener que migrar un solo registro.
 */
export const LEGACY_TYPE_NAMES: Record<string, string> = {
  STOCK: "Acciones",
  CRYPTO: "Crypto",
  FUTURES: "Futuros",
  OPTIONS: "Opciones",
  REBALANCE_BOT: "Bot Rebalanceo",
  TRADING_BOT: "Bot Trading",
  TRADING: "Trading",
  FIXED_TERM: "Plazo Fijo",
  BOND: "Bonos",
  INCOME_STREAM: "Flujo de Ingresos",
  GROUP: "Grupo",
}

/** Categorías sugeridas a un usuario que todavía no tiene ninguna. */
export const STARTER_CATEGORIES = [
  "Acciones",
  "Crypto",
  "Inmuebles",
  "Renta fija",
  "Trabajo",
]

// ── Capacidades ───────────────────────────────────────────────────────────────

/**
 * Lo que antes venía atado al tipo, ahora se activa por activo.
 *
 * `quantity` es la única que necesita un campo propio (`Record.tracksQuantity`).
 * Las otras tres se derivan de los datos que el activo ya tiene, así que no
 * hace falta persistir un flag: existen si hay hijos, reglas o tableros.
 */
export type AssetCapability = "quantity" | "income" | "boards" | "group"

export const CAPABILITY_LABELS: Record<AssetCapability, string> = {
  quantity: "Se opera en unidades",
  income: "Genera ingresos recurrentes",
  boards: "Tableros de seguimiento",
  group: "Agrupa otros activos",
}

export const CAPABILITY_DESCRIPTIONS: Record<AssetCapability, string> = {
  quantity:
    "Cantidad y precio promedio ponderado, con registro de compras. Para acciones, crypto, futuros u opciones.",
  income:
    "Reglas periódicas que generan ingresos: sueldo, alquiler, cupón, cuota de un préstamo o staking.",
  boards:
    "Tableros opcionales dentro del activo: dividendos con series recurrentes, o una tabla propia.",
  group:
    "El valor se calcula sumando los activos que contiene. Se arma desde el modo «Agrupar» de la lista.",
}

// ── Presets del formulario de alta ────────────────────────────────────────────

export type AssetPreset = "UNITS" | "INCOME" | "LOAN" | "SIMPLE"

export interface AssetPresetDef {
  label: string
  description: string
  /** Capacidades que el preset deja activadas */
  capabilities: AssetCapability[]
  /** El valor del activo es la proyección anual de sus ingresos */
  valueIsProjection: boolean
  /** Las reglas de ingreso descuentan capital */
  reducesPrincipal: boolean
  categoryHint: string
}

export const ASSET_PRESETS: Record<AssetPreset, AssetPresetDef> = {
  UNITS: {
    label: "Inversión en unidades",
    description:
      "Acciones, crypto, futuros, opciones. Lleva cantidad y precio promedio; podés sumarle dividendos o staking.",
    capabilities: ["quantity", "boards"],
    valueIsProjection: false,
    reducesPrincipal: false,
    categoryHint: "Acciones",
  },
  INCOME: {
    label: "Renta o sueldo",
    description:
      "Genera ingresos periódicos sin capital que se consuma: sueldo, alquiler, honorarios. Su valor puede ser la proyección anual.",
    capabilities: ["income"],
    valueIsProjection: true,
    reducesPrincipal: false,
    categoryHint: "Trabajo",
  },
  LOAN: {
    label: "Préstamo o cobro en cuotas",
    description:
      "Un capital que se recupera de a cuotas. Cada cobro baja el valor del activo; el interés se cobra aparte.",
    capabilities: ["income"],
    valueIsProjection: false,
    reducesPrincipal: true,
    categoryHint: "Renta fija",
  },
  SIMPLE: {
    label: "Activo simple",
    description:
      "Solo un valor que ajustás a mano. Para inmuebles, bots o cualquier cosa cuyo precio seguís por tu cuenta.",
    capabilities: [],
    valueIsProjection: false,
    reducesPrincipal: false,
    categoryHint: "",
  },
}

/** Resuelve el nombre visible de una categoría a partir de su id. */
export function categoryName(
  categoryId: string | null | undefined,
  categories: AssetCategory[],
): string {
  if (!categoryId) return "—"
  return (
    categories.find((c) => c.id === categoryId)?.name ??
    LEGACY_TYPE_NAMES[categoryId] ??
    categoryId
  )
}
