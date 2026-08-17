"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ── Safe Math Parser ──────────────────────────────────────────────────────────
// Recursive descent parser supporting +, -, *, /, (), %

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === " " || ch === "\t") { i++; continue }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch as "+" | "-" | "*" | "/" })
      i++
    } else if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch })
      i++
    } else if (ch === "%") {
      // % means / 100: inject "/ 100" after the preceding value
      tokens.push({ type: "op", value: "/" })
      tokens.push({ type: "number", value: 100 })
      i++
    } else if ((ch >= "0" && ch <= "9") || ch === ".") {
      let num = ""
      while (i < expr.length && ((expr[i] >= "0" && expr[i] <= "9") || expr[i] === ".")) {
        num += expr[i++]
      }
      const n = parseFloat(num)
      if (isNaN(n)) throw new Error("Invalid number: " + num)
      tokens.push({ type: "number", value: n })
    } else {
      throw new Error("Unexpected character: " + ch)
    }
  }
  return tokens
}

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private consume(): Token {
    const t = this.tokens[this.pos]
    if (!t) throw new Error("Unexpected end of expression")
    this.pos++
    return t
  }

  parse(): number {
    const result = this.parseExpr()
    if (this.pos < this.tokens.length) throw new Error("Unexpected token")
    return result
  }

  private parseExpr(): number {
    let left = this.parseTerm()
    while (this.peek()?.type === "op" && (this.peek()?.value === "+" || this.peek()?.value === "-")) {
      const op = (this.consume() as { type: "op"; value: "+" | "-" }).value
      const right = this.parseTerm()
      left = op === "+" ? left + right : left - right
    }
    return left
  }

  private parseTerm(): number {
    let left = this.parseFactor()
    while (this.peek()?.type === "op" && (this.peek()?.value === "*" || this.peek()?.value === "/")) {
      const op = (this.consume() as { type: "op"; value: "*" | "/" }).value
      const right = this.parseFactor()
      if (op === "/" && right === 0) throw new Error("Division by zero")
      left = op === "*" ? left * right : left / right
    }
    return left
  }

  private parseFactor(): number {
    const token = this.peek()
    if (!token) throw new Error("Unexpected end of expression")

    if (token.type === "op" && (token.value === "+" || token.value === "-")) {
      this.consume()
      const val = this.parseFactor()
      return token.value === "-" ? -val : val
    }

    if (token.type === "paren" && token.value === "(") {
      this.consume()
      const val = this.parseExpr()
      const closing = this.consume()
      if (closing.type !== "paren" || closing.value !== ")") throw new Error("Missing closing parenthesis")
      return val
    }

    if (token.type === "number") {
      this.consume()
      return token.value
    }

    throw new Error("Unexpected token: " + JSON.stringify(token))
  }
}

function evaluateExpression(raw: string): number | null {
  try {
    const tokens = tokenize(raw.trim())
    if (tokens.length === 0) return null
    const result = new Parser(tokens).parse()
    return isFinite(result) ? result : null
  } catch {
    return null
  }
}

// ── NumericInput Component ────────────────────────────────────────────────────

export interface NumericInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string
  onChange: (value: string) => void
  allowNegative?: boolean
}

export function NumericInput({ value, onChange, allowNegative = false, className, ...props }: NumericInputProps) {
  const [rawValue, setRawValue] = React.useState(value)
  const prevCleanValue = React.useRef(value)

  // Sync controlled value when it changes externally
  React.useEffect(() => {
    if (!rawValue.startsWith("=")) {
      setRawValue(value)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const isExpression = rawValue.startsWith("=")

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRawValue(e.target.value)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (rawValue.startsWith("=")) {
      const expr = rawValue.slice(1)
      const result = evaluateExpression(expr)
      if (result !== null && (!(!allowNegative && result < 0))) {
        const rounded = parseFloat(result.toFixed(10)).toString()
        setRawValue(rounded)
        prevCleanValue.current = rounded
        onChange(rounded)
      } else {
        setRawValue(prevCleanValue.current)
      }
    } else {
      prevCleanValue.current = rawValue
      onChange(rawValue)
    }
    props.onBlur?.(e)
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    props.onFocus?.(e)
  }

  return (
    <div className="relative">
      <input
        {...props}
        type="text"
        inputMode="decimal"
        value={rawValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={cn(
          "flex h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isExpression && "border-l-2 border-l-blue-400",
          className,
        )}
      />
      {isExpression && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 select-none">
          =
        </span>
      )}
    </div>
  )
}
