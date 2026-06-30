"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  loadLinksForIngreso,
  loadGastoOptions,
  createGastoIngresoLink,
  deleteGastoIngresoLink,
} from "@/lib/link-actions"
import type { GastoIngresoLink } from "@/lib/link-types"
import { formatAmount, currencies, type Currency } from "@/lib/finance"

interface Props {
  ingresoId: string
  ingresoCurrency: Currency
}

export function IngresoGastoLinksPanel({ ingresoId, ingresoCurrency }: Props) {
  const [links, setLinks] = useState<GastoIngresoLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [gastoOptions, setGastoOptions] = useState<
    { id: string; name: string; amount: number; currency: string }[]
  >([])
  const [selectedGastoId, setSelectedGastoId] = useState("")
  const [attributedAmount, setAttributedAmount] = useState("")
  const [linkCurrency, setLinkCurrency] = useState<Currency>(ingresoCurrency)
  const [saving, setSaving] = useState(false)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadLinksForIngreso(ingresoId)
      setLinks(data)
    } finally {
      setLoading(false)
    }
  }, [ingresoId])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const openAdd = async () => {
    const opts = await loadGastoOptions()
    setGastoOptions(opts)
    setSelectedGastoId("")
    setAttributedAmount("")
    setLinkCurrency(ingresoCurrency)
    setShowAdd(true)
  }

  const handleAdd = async () => {
    if (!selectedGastoId || !attributedAmount) return
    setSaving(true)
    try {
      await createGastoIngresoLink({
        gastoId: selectedGastoId,
        ingresoId,
        attributedAmount: Number(attributedAmount),
        currency: linkCurrency,
      })
      setShowAdd(false)
      fetchLinks()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteGastoIngresoLink(id)
    fetchLinks()
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-gray-500">Gastos financiados por este ingreso</span>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-black"
        >
          <Plus className="h-3 w-3" />
          Agregar
        </button>
      </div>

      {loading ? (
        <div className="py-2 text-xs text-gray-400">Cargando...</div>
      ) : links.length === 0 ? (
        <div className="py-2 text-xs text-gray-400">Sin gastos vinculados.</div>
      ) : (
        <div className="flex flex-col gap-1">
          {links.map((link) => (
            <div key={link.id} className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-1.5 text-xs">
              <span className="font-medium">{link.gastoName ?? link.gastoId}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-bold">
                  {formatAmount(link.attributedAmount, link.currency)} {link.currency}
                </span>
                <button onClick={() => handleDelete(link.id)} className="text-gray-300 hover:text-rose-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Dialog open onOpenChange={(o) => !o && setShowAdd(false)}>
          <DialogContent className="max-w-sm rounded-none border-2 border-black p-0">
            <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
              <DialogTitle className="font-bold italic text-white">Vincular gasto</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-4 py-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Gasto *</Label>
                <Select value={selectedGastoId} onValueChange={setSelectedGastoId}>
                  <SelectTrigger className="border-2 border-black">
                    <SelectValue placeholder="Seleccionar gasto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {gastoOptions.length === 0 ? (
                      <SelectItem value="_none" disabled>Sin gastos disponibles</SelectItem>
                    ) : (
                      gastoOptions.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                          <span className="ml-2 text-xs text-gray-400">
                            ({formatAmount(g.amount, g.currency as Currency)} {g.currency})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Monto atribuido *</Label>
                  <NumericInput
                    value={attributedAmount}
                    onChange={setAttributedAmount}
                    placeholder="0.00"
                    className="border-2 border-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Moneda</Label>
                  <Select value={linkCurrency} onValueChange={(v) => setLinkCurrency(v as Currency)}>
                    <SelectTrigger className="w-24 border-2 border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t-2 border-black px-4 py-3">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="border-2 border-black">
                Cancelar
              </Button>
              <Button
                className="bg-black text-white hover:bg-gray-800"
                onClick={handleAdd}
                disabled={saving || !selectedGastoId || !attributedAmount}
              >
                {saving ? "Vinculando..." : "Vincular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
