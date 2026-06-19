"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatAmount, type FinancialRecord } from "@/lib/finance"
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/assets"

interface GroupBreakdownDialogProps {
  parentRecord: FinancialRecord
  allRecords: FinancialRecord[]
  onClose: () => void
}

export function GroupBreakdownDialog({
  parentRecord,
  allRecords,
  onClose,
}: GroupBreakdownDialogProps) {
  const children = allRecords.filter((r) => r.parentId === parentRecord.id)

  const sameCurrencyChildren = children.filter((c) => c.currency === parentRecord.currency)
  const total = sameCurrencyChildren.reduce((sum, c) => sum + c.amount, 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-none border-2 border-black p-0">
        <DialogHeader className="border-b-2 border-black bg-black px-4 py-3">
          <DialogTitle className="font-bold italic text-white">
            Desglose: {parentRecord.name}
          </DialogTitle>
        </DialogHeader>

        <div className="p-0">
          <div className="flex bg-gray-100 text-xs font-bold">
            <div className="flex-1 px-3 py-2">Activo</div>
            <div className="w-32 px-3 py-2">Tipo</div>
            <div className="w-40 px-3 py-2 text-right">Valor</div>
          </div>

          {children.map((child) => (
            <div key={child.id} className="flex border-t border-black text-sm">
              <div className="flex-1 px-3 py-2">
                <Link
                  href={`/activos/${child.id}`}
                  className="font-medium hover:underline"
                  onClick={onClose}
                >
                  {child.name}
                </Link>
              </div>
              <div className="w-32 px-3 py-2 text-xs text-gray-500">
                {child.assetType
                  ? (ASSET_TYPE_LABELS[child.assetType as AssetType] ?? child.assetType)
                  : "—"}
              </div>
              <div className="w-40 px-3 py-2 text-right">
                {formatAmount(child.amount, child.currency)}{" "}
                <span className="text-xs text-gray-400">{child.currency}</span>
              </div>
            </div>
          ))}

          {children.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              Este grupo no tiene activos hijos.
            </div>
          )}

          {children.some((c) => c.currency !== parentRecord.currency) && (
            <div className="border-t border-black bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ Activos en otras monedas no incluidos en el total. Activá la conversión de divisas para ver el total consolidado.
            </div>
          )}

          {sameCurrencyChildren.length > 0 && (
            <div className="flex border-t-2 border-black bg-gray-50 text-sm font-bold">
              <div className="flex-1 px-3 py-2">Total ({parentRecord.currency})</div>
              <div className="w-40 px-3 py-2 text-right">
                {formatAmount(total, parentRecord.currency)}{" "}
                <span className="text-xs font-normal text-gray-400">{parentRecord.currency}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
