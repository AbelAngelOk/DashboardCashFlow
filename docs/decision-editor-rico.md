# Decisión técnica: Editor de texto enriquecido

## Librería elegida: TipTap

**Paquete**: `@tiptap/react` v3 + `@tiptap/starter-kit` + extensiones individuales

## Motivos

| Criterio | TipTap |
|---|---|
| Licencia | MIT |
| TypeScript | Nativo, sin wrappers |
| Headless | Sí — sin CSS impuesto |
| Extensiones necesarias | Todas disponibles en `@tiptap/*` |
| Persistencia | JSON estructurado nativo |

## Extensiones instaladas

| Paquete | Funcionalidad |
|---|---|
| `@tiptap/starter-kit` | Bold, italic, headings, lists, blockquote, code, strike, etc. |
| `@tiptap/extension-underline` | Subrayado |
| `@tiptap/extension-link` | Hipervínculos |
| `@tiptap/extension-table` | Tablas con filas/columnas/headers |
| `@tiptap/extension-task-list` | Listas con checkboxes |
| `@tiptap/extension-task-item` | Items de lista de tareas |

## Persistencia

El campo `description String?` en el modelo `Record` almacena el JSON serializado de TipTap como string:

```json
{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Texto en negrita"}]}]}
```

**Backwards compatibility**: si el valor no es JSON válido (texto plano heredado), el componente lo muestra como párrafo de texto sin formato.

## Componente

`components/ui/rich-editor.tsx` exporta `RichEditor` con las props:

```ts
interface RichEditorProps {
  value?: string       // JSON TipTap serializado (o texto plano)
  onChange?: (json: string) => void
  onBlur?: () => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}
```

Uso en modo edición (en `AssetInfoSection`):
```tsx
<RichEditor
  value={draft}
  onChange={(json) => setDraft(json)}
  onBlur={() => handleBlur("description")}
/>
```

Uso en modo lectura:
```tsx
<RichEditor value={asset.description} readOnly />
```

## Bundle

TipTap v3 + extensiones: ~180 KB gzipped. Carga en el primer render del componente cliente — aceptable para app interna de usuario único.
