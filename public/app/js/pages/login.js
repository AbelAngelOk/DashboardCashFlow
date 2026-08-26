import { login, getSession } from "/app/js/auth.js"

const form = document.getElementById("login-form")
const errorEl = document.getElementById("error")
const submitBtn = document.getElementById("submit-btn")

function showError(msg) {
  errorEl.textContent = msg
  errorEl.hidden = false
}
function clearError() {
  errorEl.hidden = true
  errorEl.textContent = ""
}
function setLoading(loading) {
  submitBtn.disabled = loading
  submitBtn.textContent = loading ? "Ingresando..." : "Ingresar"
}

// Si ya hay sesión, no tiene sentido mostrar el login
getSession().then((session) => {
  if (session) window.location.href = "/app"
})

form.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearError()
  setLoading(true)
  try {
    const email = form.email.value
    const password = form.password.value
    const result = await login(email, password)
    if (!result.ok) {
      showError(result.error)
      return
    }
    window.location.href = "/app"
  } catch {
    showError("No se pudo conectar con el servidor")
  } finally {
    setLoading(false)
  }
})
