"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Asset, BoardConfig } from "@/lib/assets"
import { updateBoards } from "@/lib/assets-actions"
import { DividendsBoard } from "./dividends-board"
import { CustomBoard } from "./custom-board"

interface BoardManagerProps {
  asset: Asset
}

export function BoardManager({ asset }: BoardManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const boards = asset.boards

  const addBoard = (type: "dividends" | "custom") => {
    startTransition(async () => {
      const newBoard: BoardConfig = {
        id: crypto.randomUUID(),
        type,
        title: type === "dividends" ? "Dividendos" : "Tablero personalizado",
        order: boards.length,
        ...(type === "dividends" ? { dividends: [] } : { config: { columns: [], rows: [] } }),
      }
      await updateBoards(asset.id, [...boards, newBoard])
      router.refresh()
    })
  }

  const deleteBoard = (boardId: string) => {
    startTransition(async () => {
      await updateBoards(asset.id, boards.filter((b) => b.id !== boardId))
      router.refresh()
      setConfirmDeleteId(null)
    })
  }

  return (
    <div data-testid="asset-board-manager" className="flex flex-col gap-6">
      {/* Existing boards */}
      {boards.map((board) => (
        <div key={board.id} className="group relative">
          {board.type === "dividends" ? (
            <DividendsBoard asset={asset} board={board} />
          ) : (
            <CustomBoard asset={asset} board={board} />
          )}
          {/* Delete button — shown on hover */}
          {confirmDeleteId === board.id ? (
            <div className="mt-1 flex items-center justify-end gap-2 text-xs">
              <span className="text-gray-500">¿Eliminar tablero?</span>
              <button
                onClick={() => deleteBoard(board.id)}
                disabled={isPending}
                className="font-bold text-rose-700 hover:text-rose-900"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-gray-500 hover:text-black"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteId(board.id)}
              className="absolute right-0 top-0 mt-0.5 mr-0.5 hidden items-center gap-1 rounded px-2 py-0.5 text-[10px] text-gray-400 hover:text-rose-700 group-hover:flex"
              aria-label="Eliminar tablero"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar tablero
            </button>
          )}
        </div>
      ))}

      {/* Add board */}
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-2 border-black border-dashed text-gray-500 hover:border-solid hover:text-black"
              disabled={isPending}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar tablero
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="rounded-none border-2 border-black">
            <DropdownMenuItem
              onClick={() => addBoard("dividends")}
              className="cursor-pointer text-sm font-medium"
            >
              Dividendos
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => addBoard("custom")}
              className="cursor-pointer text-sm font-medium"
            >
              Tablero personalizado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
