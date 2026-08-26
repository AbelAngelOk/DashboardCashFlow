// Router mínimo sobre History API. ~40 líneas a propósito: el shell (header,
// sidebar, notificaciones) se monta UNA vez en index.html; navegar solo
// reemplaza el contenido de <main>. Cada pantalla carga su JS con import()
// dinámico, así que el bundle inicial no incluye código que todavía no hace falta.

const routes = [] // { pattern: RegExp, keys: string[], load: () => Promise<Module> }

/** Registra una ruta. `pattern` usa `:param` para segmentos dinámicos. */
export function route(pattern, load) {
  const keys = []
  const regex = new RegExp(
    "^" +
      pattern.replace(/:[^/]+/g, (m) => {
        keys.push(m.slice(1))
        return "([^/]+)"
      }) +
      "$",
  )
  routes.push({ regex, keys, load })
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.regex)
    if (!m) continue
    const params = {}
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]) })
    return { load: r.load, params }
  }
  return null
}

let current = null // función de limpieza de la página activa, si la define

/**
 * Reduce location.pathname a la ruta "logica" que registran las paginas.
 * Cubre las tres formas de llegar a la raiz del shell: /app, /app/, y
 * /app/index.html (el archivo real detras del rewrite de next.config.mjs).
 */
function normalizedPath() {
  let p = location.pathname
  if (p.startsWith("/app")) p = p.slice(4)
  p = p.replace(/\/index\.html$/, "")
  return p || "/"
}

async function render() {
  const path = normalizedPath()
  const found = match(path)
  const main = document.getElementById("main")

  if (typeof current === "function") current() // limpieza de la página anterior
  current = null

  if (!found) {
    main.textContent = "Página no encontrada."
    return
  }

  const mod = await found.load()
  current = await mod.render(main, found.params)
  // Compara rutas NORMALIZADAS, no location.pathname crudo: un link con
  // href="/app" debe marcarse activo incluso si el usuario llego via
  // /app/index.html (misma pagina, distinta forma de la URL).
  document.querySelectorAll("[data-nav-link]").forEach((a) => {
    const hrefPath = a.getAttribute("href").startsWith("/app")
      ? a.getAttribute("href").slice(4) || "/"
      : a.getAttribute("href")
    a.classList.toggle("active", hrefPath === path)
  })
}

/** Navega sin recargar la página. */
export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, "", path)
  else history.pushState({}, "", path)
  render()
}

export function startRouter() {
  window.addEventListener("popstate", render)
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-link]")
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    navigate(a.getAttribute("href"))
  })
  render()
}
