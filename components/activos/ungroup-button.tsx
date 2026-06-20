"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ungroupAssets } from "@/lib/assets-actions"
import { useFinance } from "@/components/finance-store"

interface UngroupButtonProps {
  assetId: string
}

export function UngroupButton({ assetId }: UngroupButtonProps) {
  const router = useRouter()
  const { reload } = useFinance()
  const [confirm, setConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!confirm) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-6 gap-1 border border-gray-300 px-2 text-xs text-gray-500 hover:border-rose-500 hover:text-rose-700"
        onClick={() => setConfirm(true)}
      >
        <Network className="h-3 w-3" />
        Desagrupar
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs">
      <span className="text-rose-700">¿Confirmar desagrupar?</span>
      <button
        className="font-bold text-rose-700 hover:text-rose-900"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await ungroupAssets(assetId)
            await reload()
            router.push("/activos")
          })
        }
      >
        Sí
      </button>
      <button
        className="text-gray-500 hover:text-black"
        onClick={() => setConfirm(false)}
      >
        No
      </button>
    </div>
  )
}
