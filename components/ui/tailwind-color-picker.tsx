"use client"

// Predefined Tailwind palette for marker colors.
// Shades chosen for good contrast on white backgrounds (shade 500–600).
export const TAILWIND_COLORS: { name: string; value: string }[] = [
  { name: "Slate",   value: "#475569" }, // slate-600
  { name: "Gray",    value: "#4B5563" }, // gray-600
  { name: "Zinc",    value: "#52525B" }, // zinc-600
  { name: "Neutral", value: "#525252" }, // neutral-600
  { name: "Stone",   value: "#57534E" }, // stone-600
  { name: "Red",     value: "#EF4444" }, // red-500
  { name: "Orange",  value: "#F97316" }, // orange-500
  { name: "Amber",   value: "#F59E0B" }, // amber-500
  { name: "Yellow",  value: "#CA8A04" }, // yellow-600
  { name: "Lime",    value: "#84CC16" }, // lime-500
  { name: "Green",   value: "#22C55E" }, // green-500
  { name: "Emerald", value: "#10B981" }, // emerald-500
  { name: "Teal",    value: "#14B8A6" }, // teal-500
  { name: "Cyan",    value: "#06B6D4" }, // cyan-500
  { name: "Sky",     value: "#0EA5E9" }, // sky-500
  { name: "Blue",    value: "#3B82F6" }, // blue-500
  { name: "Indigo",  value: "#6366F1" }, // indigo-500
  { name: "Violet",  value: "#8B5CF6" }, // violet-500
  { name: "Purple",  value: "#A855F7" }, // purple-500
  { name: "Fuchsia", value: "#D946EF" }, // fuchsia-500
  { name: "Pink",    value: "#EC4899" }, // pink-500
  { name: "Rose",    value: "#F43F5E" }, // rose-500
]

interface TailwindColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function TailwindColorPicker({ value, onChange }: TailwindColorPickerProps) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {TAILWIND_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          title={color.name}
          onClick={() => onChange(color.value)}
          className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: color.value,
            borderColor: value === color.value ? "#000" : "transparent",
            outline: value === color.value ? "2px solid #000" : "none",
            outlineOffset: "1px",
          }}
        />
      ))}
    </div>
  )
}
