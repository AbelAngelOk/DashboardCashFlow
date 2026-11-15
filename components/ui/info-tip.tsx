"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface InfoTipProps {
  children: React.ReactNode
  label?: string
  className?: string
  side?: "top" | "right" | "bottom" | "left"
}

export function InfoTip({ children, label = "Más información", className, side = "top" }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn("inline-flex shrink-0 text-gray-400 hover:text-black", className)}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs whitespace-pre-line rounded-none">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
