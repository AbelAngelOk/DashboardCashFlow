// Orquestador del shell. Se monta UNA vez; navegar entre pantallas solo
// reemplaza <main> via router.js. Header, sidebar y notificaciones nunca se
// reconstruyen al navegar (a diferencia de React, que remonta el layout).

import { getSession, logout } from "./auth.js"
import { apiGet, ApiError } from "./api.js"
import { route, startRouter } from "./router.js"
import { qs } from "./dom.js"
import { NotificationsController, renderNotificationsPopover } from "./notifications.js"

const SIDEBAR_KEY = "cashflow:sidebar-collapsed"

// Rutas migradas (SPA, sin recarga) vs. las que todavia viven en la app
// clasica (navegacion completa). Esta lista crece a medida que avanza la
// Fase 4; hoy solo "/" tiene una pagina vanilla real.
const MIGRATED_PATHS = new Set(["/", "/configuracion", "/historial", "/libro-contable", "/snapshots", "/gastos", "/ingresos", "/obligaciones", "/activos"])

function sidebarSections(bootstrap) {
  return [
    { title: "Inicio", items: [
      { href: "/", label: "Dashboard", icon: "icon-dashboard" },
    ] },
    { title: "Patrimonio", items: [
      { href: "/activos", label: "Activos", icon: "icon-trending-up" },
      { href: "/obligaciones", label: "Obligaciones", icon: "icon-file-text" },
    ] },
    { title: "Flujo de Caja", items: [
      { href: "/ingresos", label: "Ingresos", icon: "icon-trending-down" },
      { href: "/gastos", label: "Gastos", icon: "icon-cart" },
    ] },
    { title: "Control", items: [
      { href: "/snapshots", label: "Snapshots", icon: "icon-camera", badge: bootstrap.snapshots.length },
      { href: "/libro-contable", label: "Libro Contable", icon: "icon-book" },
    ] },
    { title: "Auditoria", items: [
      { href: "/historial", label: "Historial", icon: "icon-history", badge: bootstrap.auditCount },
    ] },
    { title: "Configuracion", items: [
      { href: "/configuracion", label: "Personalizacion", icon: "icon-settings" },
    ] },
  ]
}

function renderSidebar(bootstrap) {
  const nav = qs("#sidebar-nav")
  while (nav.firstChild) nav.removeChild(nav.firstChild)

  for (const section of sidebarSections(bootstrap)) {
    const sectionEl = document.createElement("div")
    sectionEl.className = "sidebar-section"

    const titleEl = document.createElement("p")
    titleEl.className = "sidebar-section-title"
    titleEl.textContent = section.title
    sectionEl.appendChild(titleEl)

    const links = document.createElement("div")
    links.className = "sidebar-links"

    for (const item of section.items) {
      const a = document.createElement("a")
      a.className = "sidebar-link"
      a.href = item.href
      a.title = item.label
      // Las rutas aun no migradas navegan de verdad (salen del shell vanilla)
      // en vez de quedar interceptadas por el router — no tiene sentido
      // fingir una SPA completa antes de que exista la pagina real.
      if (MIGRATED_PATHS.has(item.href)) {
        a.setAttribute("data-link", "")
        a.setAttribute("data-nav-link", "")
      } else {
        a.title += " (todavia en la app clasica)"
      }

      const labelWrap = document.createElement("span")
      labelWrap.className = "link-label"
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      svg.setAttribute("class", "icon")
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use")
      use.setAttribute("href", `#${item.icon}`)
      svg.appendChild(use)
      labelWrap.appendChild(svg)
      const textEl = document.createElement("span")
      textEl.className = "link-text"
      textEl.textContent = item.label
      labelWrap.appendChild(textEl)
      a.appendChild(labelWrap)

      if (item.badge !== undefined && item.badge > 0) {
        const badge = document.createElement("span")
        badge.className = "badge"
        badge.textContent = String(item.badge)
        a.appendChild(badge)
      }

      links.appendChild(a)
    }
    sectionEl.appendChild(links)
    nav.appendChild(sectionEl)
  }
}

function initSidebarToggle() {
  const sidebar = qs("#app-sidebar")
  const toggleBtn = qs("#sidebar-toggle")
  const toggleIcon = toggleBtn.querySelector("use")

  const applyState = (collapsed) => {
    sidebar.classList.toggle("collapsed", collapsed)
    toggleIcon.setAttribute("href", collapsed ? "#icon-panel-open" : "#icon-panel-close")
    toggleBtn.title = collapsed ? "Expandir menu" : "Contraer menu"
  }

  let collapsed = false
  try { collapsed = localStorage.getItem(SIDEBAR_KEY) === "true" } catch { /* sin storage disponible */ }
  applyState(collapsed)

  toggleBtn.addEventListener("click", () => {
    collapsed = !collapsed
    applyState(collapsed)
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)) } catch { /* no critico */ }
  })
}

function initSignOut() {
  qs("#signout-btn").addEventListener("click", async () => {
    await logout()
    window.location.href = "/login.html"
  })
}

function initNotifications(bootstrap) {
  const controller = new NotificationsController(bootstrap.records, bootstrap.obligations)
  const trigger = qs("#notif-trigger")
  const countEl = qs("#notif-count")
  const dialog = qs("#notif-dialog")

  const paintCount = () => {
    const n = controller.unreadCount
    countEl.hidden = n === 0
    countEl.textContent = n > 9 ? "9+" : String(n)
  }
  paintCount()

  const closeDialog = () => {
    dialog.close()
    trigger.setAttribute("aria-expanded", "false")
  }

  trigger.addEventListener("click", () => {
    if (dialog.open) { closeDialog(); return }
    renderNotificationsPopover(dialog, controller, { onResolved: paintCount })
    // Posiciona el popover bajo la campana sin depender de un framework
    const rect = trigger.getBoundingClientRect()
    dialog.style.position = "fixed"
    dialog.style.top = `${rect.bottom + 8}px`
    dialog.style.right = `${window.innerWidth - rect.right}px`
    dialog.style.margin = "0"
    dialog.show() // no modal: permite seguir interactuando con el resto del shell
    trigger.setAttribute("aria-expanded", "true")
  })

  // Cerrar al hacer click afuera (dialog "show" no trae backdrop propio)
  document.addEventListener("click", (e) => {
    if (!dialog.open) return
    if (dialog.contains(e.target) || trigger.contains(e.target)) return
    closeDialog()
  })

  // dialog.show() (no modal, a proposito: deja interactuar con el resto del
  // shell) NO cierra solo con Escape ni dispara "cancel" -- eso es exclusivo
  // de showModal(). Se replica a mano para que Escape siga funcionando.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialog.open) closeDialog()
  })
}

function registerRoutes() {
  route("/", () => import("./pages/home.js"))
  route("/configuracion", () => import("./pages/configuracion.js"))
  route("/historial", () => import("./pages/historial.js"))
  route("/libro-contable", () => import("./pages/libro-contable.js"))
  route("/snapshots", () => import("./pages/snapshots.js"))
  route("/snapshots/:id", () => import("./pages/snapshot-detail.js"))
  route("/gastos", () => import("./pages/gastos.js"))
  route("/gastos/:id", () => import("./pages/gasto-detail.js"))
  route("/ingresos", () => import("./pages/ingresos.js"))
  route("/ingresos/:id", () => import("./pages/ingreso-detail.js"))
  route("/obligaciones", () => import("./pages/obligaciones.js"))
  route("/obligaciones/:id", () => import("./pages/obligacion-detail.js"))
  route("/activos", () => import("./pages/activos.js"))
  route("/activos/:id", () => import("./pages/activo-detail.js"))
}

async function boot() {
  let session, bootstrap
  try {
    ;[session, bootstrap] = await Promise.all([getSession(), apiGet("/api/bootstrap")])
  } catch (err) {
    if (err instanceof ApiError && err.isAuth) return // api.js ya redirigio a /login.html
    qs("#main").textContent = "No se pudo cargar la aplicacion. Reintenta en unos segundos."
    return
  }
  if (!session) {
    window.location.href = "/login.html"
    return
  }

  qs("#user-name").textContent = session.user.name ?? session.user.email

  renderSidebar(bootstrap)
  initSidebarToggle()
  initSignOut()
  initNotifications(bootstrap)

  registerRoutes()
  startRouter()
}

boot()
