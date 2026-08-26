// Helpers de DOM. El principio de todo el frontend: actualizar SOLO el nodo
// que cambió. Nunca `innerHTML` con datos del usuario (sin JSX, el escapado
// deja de ser automático — usar siempre textContent).

export const qs = (sel, root = document) => root.querySelector(sel)
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel))

/** Vacía un contenedor sin re-crear el árbol (más barato que innerHTML = "") */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

/** Reemplaza el contenido de `el` por un único nodo. */
export function mount(el, node) {
  clear(el)
  el.appendChild(node)
}

/**
 * Clona un <template> del propio HTML y lo llena.
 * `fill(root)` recibe la raíz clonada para setear textContent/atributos.
 * Devuelve el primer elemento del fragmento (útil para insertarlo directo).
 */
export function fromTemplate(templateId, fill) {
  const tpl = document.getElementById(templateId)
  const frag = tpl.content.cloneNode(true)
  if (fill) fill(frag)
  return frag.firstElementChild
}

/**
 * Delegación de eventos: UN listener por contenedor en vez de uno por fila.
 * `handler(event, matchedElement)` — matchedElement es el ancestro más cercano
 * que matchea `selector` dentro de `el`.
 */
export function on(el, eventName, selector, handler) {
  const listener = (e) => {
    const target = e.target.closest(selector)
    if (target && el.contains(target)) handler(e, target)
  }
  el.addEventListener(eventName, listener)
  return () => el.removeEventListener(eventName, listener)
}

/**
 * Crea un <dialog> nativo vacío, ya montado en <body>. El caller pinta su
 * propio contenido y llama showModal()/close(). Un solo helper para no
 * repetir el mismo boilerplate en cada componente que necesita un diálogo.
 */
export function createDialog(className = "modal") {
  const dialogEl = document.createElement("dialog")
  dialogEl.className = className
  document.body.appendChild(dialogEl)
  return dialogEl
}

/** Ícono del sprite inline de index.html (ver <symbol id="...">). */
export function svgIcon(symbolId, size = 14) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", String(size))
  svg.setAttribute("height", String(size))
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use")
  use.setAttribute("href", `#${symbolId}`)
  svg.appendChild(use)
  return svg
}

/** Crea un elemento con atributos y texto, sin pasar por innerHTML. */
export function el(tag, attrs = {}, text) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v
    else if (k.startsWith("data-")) node.setAttribute(k, v)
    else node[k] = v
  }
  if (text != null) node.textContent = text
  return node
}

/**
 * Switch on/off accesible (role="switch"). Devuelve el elemento boton;
 * `onChange(next)` se llama con el nuevo estado en cada click.
 */
export function createSwitch(checked, onChange, label) {
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = `switch${checked ? " checked" : ""}`
  btn.setAttribute("role", "switch")
  btn.setAttribute("aria-checked", String(checked))
  if (label) btn.setAttribute("aria-label", label)
  const thumb = document.createElement("span")
  thumb.className = "switch-thumb"
  btn.appendChild(thumb)
  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("checked")
    btn.classList.toggle("checked", next)
    btn.setAttribute("aria-checked", String(next))
    onChange(next)
  })
  return btn
}
