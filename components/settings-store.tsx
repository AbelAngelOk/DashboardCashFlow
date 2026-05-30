"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { type Currency, currencies } from "@/lib/finance"

// Default rates relative to USD (fallback when API is unreachable)
const DEFAULT_RATES_USD: Record<Currency, number> = {
  USD: 1,
  EUR: 1.08,
  MXN: 0.052,
  ARS: 0.00095,
  USDT: 1,
}

export interface DashboardSettings {
  convertCurrencies: boolean
  baseCurrency: Currency
  showConvertedAmounts: boolean
  // rates[X] = how many baseCurrency units 1 X is worth
  exchangeRates: Record<Currency, number>
  ratesLastUpdated: string | null
}

const DEFAULT_SETTINGS: DashboardSettings = {
  convertCurrencies: false,
  baseCurrency: "USD",
  showConvertedAmounts: false,
  exchangeRates: { ...DEFAULT_RATES_USD },
  ratesLastUpdated: null,
}

interface SettingsContextValue {
  settings: DashboardSettings
  updateSettings: (patch: Partial<DashboardSettings>) => void
  updateRate: (currency: Currency, rate: number) => void
  fetchExchangeRates: () => Promise<void>
  fetchingRates: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const STORAGE_KEY = "cashflow:settings"

function loadFromStorage(): DashboardSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveToStorage(s: DashboardSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

// Rebase rates: given rates relative to USD, convert to rates relative to newBase
function rebaseRates(
  usdRates: Record<Currency, number>,
  newBase: Currency,
): Record<Currency, number> {
  const baseInUsd = usdRates[newBase] ?? 1
  const result = {} as Record<Currency, number>
  for (const c of currencies) {
    result[c] = (usdRates[c] ?? 1) / baseInUsd
  }
  return result
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)
  const [fetchingRates, setFetchingRates] = useState(false)

  useEffect(() => {
    setSettings(loadFromStorage())
  }, [])

  const updateSettings = useCallback((patch: Partial<DashboardSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }

      // When baseCurrency changes, rebase existing rates
      if (patch.baseCurrency && patch.baseCurrency !== prev.baseCurrency) {
        // Convert current rates (relative to prev base) back to USD, then to new base
        const ratesInUsd: Record<Currency, number> = {} as Record<Currency, number>
        const prevBaseInUsd = DEFAULT_RATES_USD[prev.baseCurrency] ?? 1
        for (const c of currencies) {
          ratesInUsd[c] = (prev.exchangeRates[c] ?? 1) * prevBaseInUsd
        }
        next.exchangeRates = rebaseRates(ratesInUsd, patch.baseCurrency)
      }

      saveToStorage(next)
      return next
    })
  }, [])

  const updateRate = useCallback((currency: Currency, rate: number) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        exchangeRates: { ...prev.exchangeRates, [currency]: rate },
      }
      saveToStorage(next)
      return next
    })
  }, [])

  const fetchExchangeRates = useCallback(async () => {
    setFetchingRates(true)
    try {
      const base = settings.baseCurrency
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      if (data.result !== "success") throw new Error("API result failure")

      const rates: Record<Currency, number> = { ...DEFAULT_RATES_USD }
      for (const c of currencies) {
        if (c === base) { rates[c] = 1; continue }
        const apiRate = data.rates?.[c]
        if (typeof apiRate === "number" && apiRate > 0) {
          rates[c] = 1 / apiRate  // API gives: 1 base = X foreign → we want: 1 foreign = ? base
        }
      }
      rates[base] = 1

      const now = new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })

      setSettings((prev) => {
        const next = { ...prev, exchangeRates: rates, ratesLastUpdated: now }
        saveToStorage(next)
        return next
      })
    } catch {
      // Silently fail — keep existing rates
    } finally {
      setFetchingRates(false)
    }
  }, [settings.baseCurrency])

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, updateRate, fetchExchangeRates, fetchingRates }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider")
  return ctx
}
