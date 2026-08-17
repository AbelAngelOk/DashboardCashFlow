"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { currencies, defaultCurrency, type Currency } from "@/lib/finance"
import {
  ASSET_PRESETS,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_LABELS,
  type AssetCapability,
  type AssetCategory,
  type AssetPreset,
} from "@/lib/asset-categories"
import { RECURRENCE_TYPE_LABELS, type RecurrenceType } from "@/lib/income-streams"
import { createAsset } from "@/lib/assets-actions"
import { createLinkedGasto } from "@/lib/gasto-actions"
import { createIncomeRule, setIncomeStreamValueMode } from "@/lib/income-actions"
import { createAssetCategory, ensureAssetCategories } from "@/lib/asset-category-actions"
import { useFinance } from "@/components/finance-store"
import { useSettings } from "@/components/settings-store"

interface RuleDraft {
  id: string
  name: string
  recurrenceType: RecurrenceType
  startDate: string
  expectedAmount: string
  currency: Currency
  reducesPrincipal: boolean
}

interface AssetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate?: () => void
  parentId?: string
  defaultName?: string
}

const NEW_CATEGORY = "__new__"
const NO_CATEGORY = "__none__"

function newRule(currency: Currency, reducesPrincipal: boolean): RuleDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    recurrenceType: "MONTHLY",
    startDate: new Date().toISOString().slice(0, 10),
    expectedAmount: "",
    currency,
    reducesPrincipal,
  }
}

export function AssetFormDialog({
  open,
  onOpenChange,
  onCreate,
  parentId,
  defaultName = "",
}: AssetFormDialogProps) {
  const { reload } = useFinance()
  const { settings } = useSettings()

  const [step, setStep] = useState<"preset" | "details">("preset")
  const [preset, setPreset] = useState<AssetPreset>("UNITS")

  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)
  const [newCategoryName, setNewCategoryName] = useState("")

  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState("")
  const [ticker, setTicker] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)

  // Capacidades
  const [caps, setCaps] = useState<AssetCapability[]>([])
  const [valueIsProjection, setValueIsProjection] = useState(false)
  const [positionTracking, setPositionTracking] = useState(false)

  // Unidades
  const [qty, setQty] = useState("")
  const [avgPrice, setAvgPrice] = useState("")

  // Reglas de ingreso
  const [rules, setRules] = useState<RuleDraft[]>([])

  const [createGasto, setCreateGasto] = useState(false)
  const [saving, setSaving] = useState(false)

  // Las categorías viven en la DB desde v2.5.0; se siembran desde los tipos
  // legados y desde los tipos propios que quedaron en localStorage.
  useEffect(() => {
    if (!open) return
    ensureAssetCategories(settings.customAssetTypes ?? [])
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [open, settings.customAssetTypes])

  const applyPreset = (p: AssetPreset) => {
    const def = ASSET_PRESETS[p]
    setPreset(p)
    setCaps(def.capabilities)
    setValueIsProjection(def.valueIsProjection)
    setRules(
      def.capabilities.includes("income")
        ? [newRule(currency, def.reducesPrincipal)]
        : [],
    )
  }

  const reset = () => {
    setStep("preset")
    setPreset("UNITS")
    setCategoryId(NO_CATEGORY)
    setNewCategoryName("")
    setName(defaultName)
    setDescription("")
    setTicker("")
    setAmount("")
    setCurrency(defaultCurrency)
    setCaps([])
    setValueIsProjection(false)
    setPositionTracking(false)
    setQty("")
    setAvgPrice("")
    setRules([])
    setCreateGasto(false)
    setSaving(false)
  }

  const handleClose = (v: boolean) => {
    if (saving) return
    if (!v) reset()
    onOpenChange(v)
  }

  const hasCap = (c: AssetCapability) => caps.includes(c)
  const toggleCap = (c: AssetCapability) =>
    setCaps((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
      if (c === "income") {
        setRules(
          next.includes("income")
            ? [newRule(currency, ASSET_PRESETS[preset].reducesPrincipal)]
            : [],
        )
      }
      return next
    })

  const qtyNum = Number(qty)
  const priceNum = Number(avgPrice)
  const amountNum = Number(amount)
  const calcMismatch =
    hasCap("quantity") &&
    qty !== "" &&
    avgPrice !== "" &&
    amount !== "" &&
    Math.abs(qtyNum * priceNum - amountNum) > 0.01

  const handleQtyChange = (v: string) => {
    setQty(v)
    if (v !== "" && avgPrice !== "") setAmount(String(Number(v) * Number(avgPrice)))
  }
  const handlePriceChange = (v: string) => {
    setAvgPrice(v)
    if (v !== "" && qty !== "") setAmount(String(Number(qty) * Number(v)))
  }

  const updateRule = (id: string, field: keyof RuleDraft, value: string | boolean) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  const addRule = () =>
    setRules((prev) => [...prev, newRule(currency, ASSET_PRESETS[preset].reducesPrincipal)])
  const removeRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id))

  const needsAmount = !valueIsProjection
  const rulesOk =
    !hasCap("income") || rules.some((r) => r.name.trim() && Number(r.expectedAmount) > 0)
  const categoryOk = categoryId !== NEW_CATEGORY || newCategoryName.trim() !== ""
  const canSave =
    name.trim() !== "" &&
    (!needsAmount || amount !== "") &&
    !calcMismatch &&
    rulesOk &&
    categoryOk

  const buildMetadata = (): Record<string, unknown> | undefined => {
    const meta: Record<string, unknown> = {}
    if (valueIsProjection) meta.valueMode = "PROJECTION"
    if (positionTracking) meta.positionTracking = true
    return Object.keys(meta).length > 0 ? meta : undefined
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      // Categoría: puede ser una existente, una nueva, o ninguna
      let finalCategoryId: string | null = null
      if (categoryId === NEW_CATEGORY) {
        finalCategoryId = (await createAssetCategory(newCategoryName.trim())).id
      } else if (categoryId !== NO_CATEGORY) {
        finalCategoryId = categoryId
      }

      const initialAmount = valueIsProjection ? 0 : Number(amount)

      const id = await createAsset({
        name: name.trim(),
        assetType: finalCategoryId,
        ticker: ticker.trim() || undefined,
        amount: initialAmount,
        currency,
        tracksQuantity: hasCap("quantity"),
        currentQty: hasCap("quantity") && qty ? Number(qty) : undefined,
        avgBuyPrice: hasCap("quantity") && avgPrice ? Number(avgPrice) : undefined,
        description: description.trim() || undefined,
        parentId,
        metadata: buildMetadata(),
      })

      if (createGasto && initialAmount > 0) {
        await createLinkedGasto({
          name: `Inversión en ${name.trim()}`,
          amount: initialAmount,
          currency,
          linkedTo: id,
        }).catch(console.error)
      }

      if (hasCap("income")) {
        for (const r of rules) {
          if (!r.name.trim() || !(Number(r.expectedAmount) > 0)) continue
          await createIncomeRule(id, {
            name: r.name.trim(),
            recurrenceType: r.recurrenceType,
            startDate: r.startDate,
            expectedAmount: Number(r.expectedAmount),
            currency: r.currency,
            reducesPrincipal: r.reducesPrincipal,
          })
        }
        // Recalcula el valor si el activo vale su proyección anual
        if (valueIsProjection) await setIncomeStreamValueMode(id, "PROJECTION")
      }

      reload()
      onCreate?.()
      handleClose(false)
    } catch (e) {
      toast({
        variant: "destructive",
        title: "No se pudo crear el activo",
        description: e instanceof Error ? e.message : "Error desconocido",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="asset-form-dialog"
        className="max-w-lg rounded-none border-2 border-black p-0"
      >
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">Nuevo activo</DialogTitle>
        </DialogHeader>

        <div
          className="flex flex-col gap-4 overflow-y-auto px-4 py-4"
          style={{ maxHeight: "70vh" }}
        >
          {step === "preset" && (
            <div className="flex flex-col gap-3">
              <Label className="text-xs font-bold uppercase">¿Qué clase de activo es?</Label>
              <p className="-mt-2 text-xs text-gray-500">
                Solo define con qué capacidades arranca. Podés cambiarlas después: un activo no
                tiene tipo fijo.
              </p>
              <div className="flex flex-col gap-2">
                {(Object.keys(ASSET_PRESETS) as AssetPreset[]).map((p) => (
                  <label
                    key={p}
                    className={`flex cursor-pointer items-start gap-3 border-2 p-3 transition-colors ${
                      preset === p ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="asset-preset"
                      value={p}
                      checked={preset === p}
                      onChange={() => applyPreset(p)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">{ASSET_PRESETS[p].label}</p>
                      <p className="text-xs text-gray-500">{ASSET_PRESETS[p].description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-black text-white hover:bg-gray-800"
                  onClick={() => {
                    applyPreset(preset)
                    setStep("details")
                  }}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">Nombre *</Label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Departamento Palermo"
                  className="border-2 border-black focus-visible:ring-0"
                />
              </div>

              {/* Categoría: etiqueta libre, sin comportamiento asociado */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">
                  Categoría <span className="font-normal text-gray-400">(etiqueta)</span>
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="border-2 border-black focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value={NEW_CATEGORY}>+ Crear categoría nueva</SelectItem>
                  </SelectContent>
                </Select>
                {categoryId === NEW_CATEGORY && (
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ej: Inmuebles"
                    className="mt-1 border-2 border-black focus-visible:ring-0"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs font-bold uppercase">
                  Descripción <span className="font-normal text-gray-400">(opcional)</span>
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="resize-none border-2 border-black focus-visible:ring-0"
                />
              </div>

              {/* Valor + moneda */}
              <div className="flex gap-3">
                {needsAmount ? (
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs font-bold uppercase">
                      {ASSET_PRESETS[preset].reducesPrincipal ? "Capital inicial *" : "Valor inicial *"}
                    </Label>
                    <NumericInput
                      value={amount}
                      onChange={setAmount}
                      placeholder="0.00"
                      className={`border-2 focus-visible:ring-0 ${calcMismatch ? "border-amber-500" : "border-black"}`}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 items-end">
                    <p className="text-xs text-gray-500">
                      El valor se calcula solo: es la proyección anual de los ingresos de abajo.
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase">Moneda</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                    <SelectTrigger className="w-24 border-2 border-black focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Capacidades */}
              <div className="flex flex-col gap-2 border-2 border-black p-3">
                <Label className="text-xs font-bold uppercase">Capacidades</Label>
                {(["quantity", "income", "boards"] as AssetCapability[]).map((c) => (
                  <label key={c} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hasCap(c)}
                      onChange={() => toggleCap(c)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">{CAPABILITY_LABELS[c]}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {CAPABILITY_DESCRIPTIONS[c]}
                      </div>
                    </div>
                  </label>
                ))}
                {hasCap("quantity") && (
                  <label className="flex cursor-pointer items-start gap-2 pl-6 text-sm">
                    <input
                      type="checkbox"
                      checked={positionTracking}
                      onChange={(e) => setPositionTracking(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">Posiciones LONG / SHORT</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        Para futuros: cada movimiento registra el sentido de la posición.
                      </div>
                    </div>
                  </label>
                )}
                {hasCap("income") && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={valueIsProjection}
                      onChange={(e) => setValueIsProjection(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">El valor es la proyección anual</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        Para sueldos y rentas sin patrimonio propio. Apagado, el valor lo fijás vos.
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {/* Unidades */}
              {hasCap("quantity") && (
                <>
                  <div className="flex gap-3">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs font-bold uppercase">Ticker</Label>
                      <Input
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        placeholder="AAPL, BTCUSDT"
                        className="border-2 border-black focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs font-bold uppercase">Cantidad</Label>
                      <NumericInput
                        value={qty}
                        onChange={handleQtyChange}
                        placeholder="0"
                        className={`border-2 focus-visible:ring-0 ${calcMismatch ? "border-amber-500" : "border-black"}`}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs font-bold uppercase">Precio prom.</Label>
                      <NumericInput
                        value={avgPrice}
                        onChange={handlePriceChange}
                        placeholder="0.00"
                        className={`border-2 focus-visible:ring-0 ${calcMismatch ? "border-amber-500" : "border-black"}`}
                      />
                    </div>
                  </div>
                  {calcMismatch && (
                    <p className="text-xs text-amber-700">
                      El valor ({amount}) no coincide con cantidad × precio (
                      {(qtyNum * priceNum).toFixed(2)}). Corregí uno de los tres campos.
                    </p>
                  )}
                </>
              )}

              {/* Reglas de ingreso */}
              {hasCap("income") && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase">Reglas de ingreso</Label>
                    <button
                      onClick={addRule}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-black"
                    >
                      <Plus className="h-3 w-3" /> Agregar regla
                    </button>
                  </div>
                  {rules.map((rule, idx) => (
                    <div key={rule.id} className="flex flex-col gap-2 border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">Regla {idx + 1}</span>
                        {rules.length > 1 && (
                          <button
                            onClick={() => removeRule(rule.id)}
                            className="text-gray-400 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Input
                        value={rule.name}
                        onChange={(e) => updateRule(rule.id, "name", e.target.value)}
                        placeholder="Nombre (ej: Sueldo, Capital, Interés)"
                        className="h-8 border border-gray-300 text-sm focus-visible:ring-0"
                      />
                      <div className="flex gap-2">
                        <Select
                          value={rule.recurrenceType}
                          onValueChange={(v) => updateRule(rule.id, "recurrenceType", v)}
                        >
                          <SelectTrigger className="h-8 flex-1 border border-gray-300 text-xs focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(
                              ([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <NumericInput
                          value={rule.expectedAmount}
                          onChange={(v) => updateRule(rule.id, "expectedAmount", v)}
                          placeholder="Monto"
                          className="h-8 w-28 border border-gray-300 text-sm focus-visible:ring-0"
                        />
                        <Select
                          value={rule.currency}
                          onValueChange={(v) => updateRule(rule.id, "currency", v)}
                        >
                          <SelectTrigger className="h-8 w-20 border border-gray-300 text-xs focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex flex-1 flex-col gap-1">
                          <Label className="text-[10px] font-semibold uppercase text-gray-400">
                            Primer cobro
                          </Label>
                          <Input
                            type="date"
                            value={rule.startDate}
                            onChange={(e) => updateRule(rule.id, "startDate", e.target.value)}
                            className="h-8 border border-gray-300 text-sm focus-visible:ring-0"
                          />
                        </div>
                        <label className="flex cursor-pointer items-center gap-1.5 pb-1 text-xs">
                          <input
                            type="checkbox"
                            checked={rule.reducesPrincipal}
                            onChange={(e) =>
                              updateRule(rule.id, "reducesPrincipal", e.target.checked)
                            }
                          />
                          Descuenta capital
                        </label>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500">
                    Podés afinar cada regla —porcentaje, ajuste periódico, cuotas, cobro en
                    especie— desde el detalle del activo una vez creado.
                  </p>
                </div>
              )}

              {!parentId && needsAmount && (
                <label className="flex cursor-pointer items-start gap-2 border border-gray-200 p-3 text-sm hover:border-gray-400">
                  <input
                    type="checkbox"
                    checked={createGasto}
                    onChange={(e) => setCreateGasto(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium">Generar gasto asociado</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      Registra un gasto por el monto invertido: &quot;Inversión en{" "}
                      {name.trim() || "activo"}&quot;
                    </div>
                  </div>
                </label>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t-2 border-black px-4 py-3">
          {step === "details" && (
            <Button
              variant="outline"
              onClick={() => setStep("preset")}
              className="border-2 border-black"
              disabled={saving}
            >
              Atrás
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="border-2 border-black"
            disabled={saving}
          >
            Cancelar
          </Button>
          {step === "details" && (
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-black text-white hover:bg-gray-800"
            >
              {saving ? "Guardando..." : "Crear activo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
