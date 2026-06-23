# Historial — Arquitectura de paginación server-side

## Resumen

La página `/historial` usa una arquitectura diferente al resto del dashboard:
- Paginación server-side (no carga todos los registros al cliente)
- Filtros sincronizados con la URL (bookmarkable, navegable con back/forward)
- Tres hooks dedicados con responsabilidades separadas
- Patrón Server Component + Suspense para compatibilidad con `useSearchParams()`

## Por qué es diferente al resto

El `FinanceProvider` carga todo el audit log en memoria al montar. Para un usuario con miles de entradas, cargar todos los movimientos no escala. La solución fue sacar `/historial` del contexto y darle su propia capa de datos con paginación real en la DB.

## Estructura de archivos

```
app/(dashboard)/historial/
├── page.tsx      ← Server Component: envuelve en <Suspense>
└── content.tsx   ← Client Component: todos los hooks y UI

hooks/
├── use-historial-filters.ts   ← filtros sincronizados con URL
├── use-pagination.ts          ← página + tamaño sincronizados con URL
└── use-historial-query.ts     ← fetching + stale-request cancellation + debounce

lib/actions.ts
└── loadHistorial()            ← Server Action paginada
```

## Server Component + Suspense

`useSearchParams()` en App Router requiere que el componente esté dentro de un `<Suspense>` para evitar errores de hidratación. La solución estándar es:

```tsx
// page.tsx — Server Component (sin "use client")
export default function HistorialPage() {
  return (
    <Suspense fallback={<HistorialSkeleton />}>
      <HistorialContent />   {/* Client Component con useSearchParams */}
    </Suspense>
  )
}
```

## Hooks

### `useHistorialFilters`

Gestiona el estado de los 5 filtros sincronizados con query params:

| Parámetro URL | Tipo | Valores |
|---|---|---|
| `action` | string | `"creado"` \| `"editado"` \| `"eliminado"` \| `""` |
| `recordType` | string | `"ingreso"` \| `"gasto"` \| `"activo"` \| `"pasivo"` \| `""` |
| `search` | string | texto libre |
| `dateFrom` | string | `"YYYY-MM-DD"` |
| `dateTo` | string | `"YYYY-MM-DD"` |

Al cambiar cualquier filtro, resetea `page` a 1 vía `router.replace()` (sin push para no saturar el historial del browser).

### `usePagination`

Gestiona `page` y `pageSize` en URL. Tamaños válidos: `10 | 25 | 50 | 100`. Cualquier valor fuera del set se normaliza a `25`.

### `useHistorialQuery`

Llama a `loadHistorial()` con los parámetros actuales y gestiona tres estados: `items`, `total`, `loading`.

Incluye cancelación de requests obsoletos via ref:

```typescript
const reqId = useRef(0)

useEffect(() => {
  const id = ++reqId.current
  setLoading(true)
  loadHistorial({ page, pageSize, ...filters }).then(result => {
    if (id !== reqId.current) return  // request obsoleto, ignorar
    setItems(result.items)
    setTotal(result.total)
  })
}, [page, pageSize, filters.*])
```

Esto evita que una respuesta lenta sobreescriba resultados de una query más nueva.

También gestiona el debounce de 600ms para los comentarios editables:

```typescript
const updateLocalComment = useCallback((id: string, comment: string) => {
  setItems(prev => prev.map(m => m.id === id ? { ...m, comment } : m))
  clearTimeout(commentTimers.current[id])
  commentTimers.current[id] = setTimeout(() => dbUpdateComment(id, comment), 600)
}, [])
```

## Server Action `loadHistorial`

```typescript
export async function loadHistorial(params: HistorialParams): Promise<HistorialResult>
```

Campos de `HistorialParams`: `page`, `pageSize`, `action?`, `recordType?`, `search?`, `dateFrom?`, `dateTo?`

Validaciones de seguridad:
- `pageSize` se valida contra el set `[10, 25, 50, 100]` para evitar queries con `LIMIT` arbitrario
- `page` se clampea a `≥ 1`

Ordenación: `orderBy: { createdAt: "desc" }` — usa el campo `DateTime` real, no el string `date`.

Filtrado de texto: busca en `recordName` y `detail` con `contains + mode: "insensitive"` (PostgreSQL `ILIKE`).

Filtrado de fecha: usa `createdAt` con `gte` + `lte`. El `dateTo` se ajusta a `T23:59:59.999Z` para incluir todo el día.

## Coexistencia con `/movimientos`

La ruta `/movimientos` (`app/(dashboard)/movimientos/page.tsx`) sigue existiendo. Lee del `FinanceContext` (todos los `movements` cargados en memoria). Ambas rutas coexisten sin interferirse. `/historial` es la implementación principal con paginación real; `/movimientos` es la implementación anterior que puede eliminarse en una futura limpieza.
