"use client"

import { computeGroupValue, formatAmount, type Currency } from "@/lib/finance"
import { useSettings } from "@/components/settings-store"

interface GroupChild {
  amount: number
  currency: Currency
}

/**
 * Renders the value of a group asset from its children.
 * Single source of truth for group display across all views.
 *
 * - convertCurrencies ON  → single total in baseCurrency
 * - convertCurrencies OFF → per-currency breakdown (single line if all same currency)
 */
export function GroupValueDisplay({
  children,
  className,
}: {
  children: GroupChild[]
  className?: string
}) {
  const { settings } = useSettings()
  const { convertCurrencies, baseCurrency, exchangeRates } = settings
  const result = computeGroupValue(children, convertCurrencies, baseCurrency, exchangeRates)

  if (result.type === "single") {
    return (
      <span className={className}>
        {formatAmount(result.value, result.currency)}{" "}
        <span className="text-xs text-gray-400">{result.currency}</span>
      </span>
    )
  }

  return (
    <div className={`flex flex-col items-end gap-0.5 ${className ?? ""}`}>
      {result.entries.map(({ currency, value }) => (
        <span key={currency} className="text-xs">
          {formatAmount(value, currency)}{" "}
          <span className="text-gray-400">{currency}</span>
        </span>
      ))}
    </div>
  )
}
