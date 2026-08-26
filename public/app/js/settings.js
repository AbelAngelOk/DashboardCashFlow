// Portado desde components/settings-store.tsx. Vive enteramente en
// localStorage, sin red salvo fetchExchangeRates() (API publica de
// cotizaciones, no un secreto). Sin Context: es un modulo con estado propio
// que cualquier pagina importa y usa directo.

import { currencies } from "./lib/finance.js"

const STORAGE_KEY = "cashflow:settings"

// Tasas de referencia relativas a USD (fallback si la API no responde)
const DEFAULT_RATES_USD = { USD: 1, EUR: 1.08, MXN: 0.052, ARS: 0.00095, USDT: 1 }

const DEFAULT_SETTINGS = {
  convertCurrencies: false,
  baseCurrency: "USD",
  showConvertedAmounts: false,
  exchangeRates: { ...DEFAULT_RATES_USD },
  ratesLastUpdated: null,
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveToStorage(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* localStorage lleno o bloqueado: no critico, son preferencias visuales */
  }
}

/** rates relativas a USD -> rates relativas a newBase */
function rebaseRates(usdRates, newBase) {
  const baseInUsd = usdRates[newBase] ?? 1
  const result = {}
  for (const c of currencies) result[c] = (usdRates[c] ?? 1) / baseInUsd
  return result
}

let settings = loadFromStorage()
let fetchingRates = false
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn(settings)
}

/** Suscribe a cambios de settings. Devuelve la funcion de desuscripcion. */
export function onSettingsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSettings() {
  return settings
}

export function isFetchingRates() {
  return fetchingRates
}

export function updateSettings(patch) {
  const next = { ...settings, ...patch }

  // Al cambiar la moneda base, las tasas existentes se re-basan (mismo
  // criterio que settings-store.tsx: nunca se pierden, se re-expresan).
  if (patch.baseCurrency && patch.baseCurrency !== settings.baseCurrency) {
    const ratesInUsd = {}
    const prevBaseInUsd = DEFAULT_RATES_USD[settings.baseCurrency] ?? 1
    for (const c of currencies) ratesInUsd[c] = (settings.exchangeRates[c] ?? 1) * prevBaseInUsd
    next.exchangeRates = rebaseRates(ratesInUsd, patch.baseCurrency)
  }

  settings = next
  saveToStorage(settings)
  notify()
}

export function updateRate(currency, rate) {
  settings = { ...settings, exchangeRates: { ...settings.exchangeRates, [currency]: rate } }
  saveToStorage(settings)
  notify()
}

/**
 * API publica de cotizaciones (open.er-api.com) — sin autenticacion, sin
 * secretos. Llamarla directo desde el navegador es exactamente lo mismo que
 * hacia el cliente React: no hay nada que "mover al servidor" aca.
 */
export async function fetchExchangeRates() {
  fetchingRates = true
  notify()
  try {
    const base = settings.baseCurrency
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    if (!res.ok) throw new Error("API error")
    const data = await res.json()
    if (data.result !== "success") throw new Error("API result failure")

    const rates = { ...DEFAULT_RATES_USD }
    for (const c of currencies) {
      if (c === base) { rates[c] = 1; continue }
      const apiRate = data.rates?.[c]
      if (typeof apiRate === "number" && apiRate > 0) rates[c] = 1 / apiRate
    }
    rates[base] = 1

    const now = new Date().toLocaleDateString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    })

    settings = { ...settings, exchangeRates: rates, ratesLastUpdated: now }
    saveToStorage(settings)
  } catch {
    // Silencioso: se mantienen las tasas existentes, igual que el original
  } finally {
    fetchingRates = false
    notify()
  }
}
