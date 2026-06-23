"use client"

import { useState, useEffect, useCallback } from "react"
import { BookOpen, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  loadJournalEntries,
  getAccountBalances,
  type JournalEntryRecord,
  type AccountBalances,
  type AccountType,
} from "@/lib/journal-actions"
import { formatAmount, type Currency } from "@/lib/finance"

const ACCOUNT_LABELS: Record<AccountType, string> = {
  activos: "Activos",
  pasivos: "Pasivos",
  ingresos: "Ingresos",
  gastos: "Gastos",
  efectivo: "Efectivo",
  obligaciones: "Obligaciones",
}

const ACCOUNT_COLORS: Record<AccountType, string> = {
  activos: "bg-emerald-50 text-emerald-800",
  pasivos: "bg-rose-50 text-rose-800",
  ingresos: "bg-blue-50 text-blue-800",
  gastos: "bg-amber-50 text-amber-800",
  efectivo: "bg-slate-100 text-slate-700",
  obligaciones: "bg-purple-50 text-purple-800",
}

function AccountBadge({ account }: { account: AccountType }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ACCOUNT_COLORS[account]}`}>
      {ACCOUNT_LABELS[account]}
    </span>
  )
}

function BalancesPanel({ balances }: { balances: AccountBalances }) {
  const accounts = Object.keys(balances) as AccountType[]
  const hasSomeBalance = accounts.some((a) =>
    Object.values(balances[a]).some((v) => v !== 0),
  )
  if (!hasSomeBalance) return null

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {accounts.map((account) => {
        const currencies = balances[account]
        const entries = Object.entries(currencies).filter(([, v]) => v !== 0)
        if (entries.length === 0) return null
        return (
          <div key={account} className="border-2 border-black p-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              {ACCOUNT_LABELS[account]}
            </div>
            {entries.map(([cur, val]) => (
              <div key={cur} className={`text-sm font-semibold ${val >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {val >= 0 ? "+" : ""}
                {formatAmount(Math.abs(val), cur as Currency)} {cur}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function LibroContablePage() {
  const [entries, setEntries] = useState<JournalEntryRecord[]>([])
  const [balances, setBalances] = useState<AccountBalances | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [account, setAccount] = useState<string>("all")
  const [currency, setCurrency] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    const [entries, bal] = await Promise.all([
      loadJournalEntries({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        account: account !== "all" ? account : undefined,
        currency: currency !== "all" ? currency : undefined,
      }),
      getAccountBalances(),
    ])
    setEntries(entries)
    setBalances(bal)
    setLoading(false)
  }, [fromDate, toDate, account, currency])

  useEffect(() => { load() }, [load])

  const allCurrencies = [...new Set(entries.map((e) => e.currency))]

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center border-2 border-black">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Libro Contable</h1>
          <p className="text-sm text-gray-500">Asientos de doble entrada</p>
        </div>
      </div>

      {/* Account balances summary */}
      {balances && <BalancesPanel balances={balances} />}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-40 border-2 border-black text-sm"
          placeholder="Desde"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-40 border-2 border-black text-sm"
          placeholder="Hasta"
        />
        <Select value={account} onValueChange={setAccount}>
          <SelectTrigger className="w-40 border-2 border-black text-sm">
            <SelectValue placeholder="Cuenta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {(Object.keys(ACCOUNT_LABELS) as AccountType[]).map((a) => (
              <SelectItem key={a} value={a}>{ACCOUNT_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-32 border-2 border-black text-sm">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {allCurrencies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(fromDate || toDate || account !== "all" || currency !== "all") && (
          <Button
            variant="outline"
            size="sm"
            className="border-2 border-black"
            onClick={() => { setFromDate(""); setToDate(""); setAccount("all"); setCurrency("all") }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ArrowRightLeft className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">No hay asientos contables registrados</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 pr-4 text-left font-bold">Fecha</th>
                <th className="py-2 pr-4 text-left font-bold">Descripción</th>
                <th className="py-2 pr-4 text-left font-bold">Debe</th>
                <th className="py-2 pr-4 text-left font-bold">Haber</th>
                <th className="py-2 text-right font-bold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(entry.date).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="line-clamp-1">{entry.description}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <AccountBadge account={entry.debitAccount} />
                  </td>
                  <td className="py-2 pr-4">
                    <AccountBadge account={entry.creditAccount} />
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                    {formatAmount(entry.amount, entry.currency)} {entry.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-xs text-gray-400">
            {entries.length} asiento{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  )
}
