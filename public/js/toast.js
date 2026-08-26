// Toast minimo. Reemplaza al sistema de shadcn/ui (Toaster + sonner) que
// arrastraba next-themes como dependencia de un solo componente sin uso real
// fuera de esto. Mismo contrato de llamada: toast({ title, description, variant }).

let container = null

function getContainer() {
  if (container) return container
  container = document.createElement("div")
  container.className = "toast-container"
  container.setAttribute("role", "status")
  container.setAttribute("aria-live", "polite")
  document.body.appendChild(container)
  return container
}

/**
 * @param {{ title: string, description?: string, variant?: "default"|"destructive" }} opts
 */
export function toast({ title, description, variant = "default" }) {
  const root = getContainer()

  const node = document.createElement("div")
  node.className = `toast${variant === "destructive" ? " toast-destructive" : ""}`

  const titleEl = document.createElement("p")
  titleEl.className = "toast-title"
  titleEl.textContent = title
  node.appendChild(titleEl)

  if (description) {
    const descEl = document.createElement("p")
    descEl.className = "toast-description"
    descEl.textContent = description
    node.appendChild(descEl)
  }

  root.appendChild(node)

  // CSS transition, no JS que anime frame a frame (ver CLAUDE.md: transform/opacity)
  requestAnimationFrame(() => node.classList.add("toast-visible"))

  const remove = () => {
    node.classList.remove("toast-visible")
    node.addEventListener("transitionend", () => node.remove(), { once: true })
  }
  const timer = setTimeout(remove, 4000)
  node.addEventListener("click", () => { clearTimeout(timer); remove() })
}
