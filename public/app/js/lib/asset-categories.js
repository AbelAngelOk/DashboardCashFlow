// Portado desde lib/asset-categories.ts. Las categorías son etiquetas libres
// desde v2.5.0 (ver CLAUDE.md) — no determinan comportamiento, solo qué
// nombre se muestra. Las capacidades (quantity/income/boards/group) sí.

export const CAPABILITY_LABELS = {
  quantity: "Se opera en unidades",
  income: "Genera ingresos recurrentes",
  boards: "Tableros de seguimiento",
  group: "Agrupa otros activos",
}

export const CAPABILITY_DESCRIPTIONS = {
  quantity: "Cantidad y precio promedio ponderado, con registro de compras. Para acciones, crypto, futuros u opciones.",
  income: "Reglas periódicas que generan ingresos: sueldo, alquiler, cupón, cuota de un préstamo o staking.",
  boards: "Tableros opcionales dentro del activo: dividendos con series recurrentes, o una tabla propia.",
  group: "El valor se calcula sumando los activos que contiene. Se arma desde el modo «Agrupar» de la lista.",
}

export const ASSET_PRESETS = {
  UNITS: {
    label: "Inversión en unidades",
    description: "Acciones, crypto, futuros, opciones. Lleva cantidad y precio promedio; podés sumarle dividendos o staking.",
    capabilities: ["quantity", "boards"],
    valueIsProjection: false,
    reducesPrincipal: false,
  },
  INCOME: {
    label: "Renta o sueldo",
    description: "Genera ingresos periódicos sin capital que se consuma: sueldo, alquiler, honorarios. Su valor puede ser la proyección anual.",
    capabilities: ["income"],
    valueIsProjection: true,
    reducesPrincipal: false,
  },
  LOAN: {
    label: "Préstamo o cobro en cuotas",
    description: "Un capital que se recupera de a cuotas. Cada cobro baja el valor del activo; el interés se cobra aparte.",
    capabilities: ["income"],
    valueIsProjection: false,
    reducesPrincipal: true,
  },
  SIMPLE: {
    label: "Activo simple",
    description: "Solo un valor que ajustás a mano. Para inmuebles, bots o cualquier cosa cuyo precio seguís por tu cuenta.",
    capabilities: [],
    valueIsProjection: false,
    reducesPrincipal: false,
  },
}

export const LEGACY_TYPE_NAMES = {
  STOCK: "Acciones", CRYPTO: "Crypto", FUTURES: "Futuros", OPTIONS: "Opciones",
  REBALANCE_BOT: "Bot Rebalanceo", TRADING_BOT: "Bot Trading", TRADING: "Trading",
  FIXED_TERM: "Plazo Fijo", BOND: "Bonos", INCOME_STREAM: "Flujo de Ingresos", GROUP: "Grupo",
}

/** Resuelve el nombre visible de una categoría a partir de su id. */
export function categoryName(categoryId, categories) {
  if (!categoryId) return "—"
  return categories.find((c) => c.id === categoryId)?.name ?? LEGACY_TYPE_NAMES[categoryId] ?? categoryId
}
