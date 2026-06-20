"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Table as TableIcon,
  Quote,
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryParseJson(value: string): object | null {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === "object" && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded text-xs ${
        active ? "bg-black text-white" : "text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  )
}

// ── RichEditor ────────────────────────────────────────────────────────────────

export interface RichEditorProps {
  value?: string
  onChange?: (json: string) => void
  onBlur?: () => void
  placeholder?: string
  readOnly?: boolean
  className?: string
}

export function RichEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Escribe aquí...",
  readOnly = false,
  className,
}: RichEditorProps) {
  const jsonContent = value ? tryParseJson(value) : null
  const initialContent = jsonContent ?? (value ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] } : undefined)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: readOnly, HTMLAttributes: { class: "underline text-blue-600 cursor-pointer" } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate({ editor }) {
      onChange?.(JSON.stringify(editor.getJSON()))
    },
    onBlur() {
      onBlur?.()
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[80px] text-sm leading-relaxed",
        "data-placeholder": placeholder,
      },
    },
  })

  if (!editor) return null

  const addLink = () => {
    const url = window.prompt("URL del enlace:")
    if (!url) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  if (readOnly) {
    return (
      <div className={`prose prose-sm max-w-none ${className ?? ""}`}>
        <EditorContent editor={editor} />
      </div>
    )
  }

  return (
    <div className={`border-2 border-black ${className ?? ""}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b-2 border-black bg-gray-50 px-2 py-1">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Subrayado (Ctrl+U)">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>

        <span className="mx-1 h-4 w-px bg-gray-300" />

        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Título 1">
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Título 2">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Título 3">
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>

        <span className="mx-1 h-4 w-px bg-gray-300" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista">
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Lista de tareas">
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolBtn>

        <span className="mx-1 h-4 w-px bg-gray-300" />

        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Cita">
          <Quote className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Código inline">
          <Code2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={addLink} active={editor.isActive("link")} title="Enlace">
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={addTable} title="Tabla">
          <TableIcon className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>

      {/* Editor area */}
      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
