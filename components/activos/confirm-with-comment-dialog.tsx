"use client"

import { useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface ConfirmWithCommentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onConfirm: (comment: string) => void
}

export function ConfirmWithCommentDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: ConfirmWithCommentDialogProps) {
  const [comment, setComment] = useState("")

  const handleConfirm = () => {
    onConfirm(comment)
    setComment("")
    onOpenChange(false)
  }

  const handleCancel = () => {
    setComment("")
    onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12%] z-50 w-full max-w-sm -translate-x-1/2 border-2 border-black bg-white p-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-8 data-[state=closed]:slide-out-to-top-8 duration-200">
          <div className="border-b-2 border-black bg-black px-4 py-3">
            <DialogPrimitive.Title className="font-bold italic text-white">
              {title}
            </DialogPrimitive.Title>
          </div>
          <div className="flex flex-col gap-4 px-4 py-4">
            {description && (
              <p className="text-sm text-gray-600">{description}</p>
            )}
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold uppercase">
                Comentario <span className="font-normal normal-case text-gray-400">(opcional)</span>
              </Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Por qué realizás este cambio?"
                className="resize-none rounded-none border-2 border-black focus-visible:ring-0"
                rows={3}
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t-2 border-black px-4 py-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-2 border-black"
            >
              Cancelar
            </Button>
            <Button
              className="bg-black text-white hover:bg-gray-800"
              onClick={handleConfirm}
            >
              Confirmar
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
