import { login, getSession } from "/js/auth.js"
import { apiPost, ApiError, NetworkError } from "/js/api.js"

const form = document.getElementById("register-form")
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
  submitBtn.textContent = loading ? "Creando cuenta..." : "Crear cuenta"
}

getSession().then((session) => {
  if (session) window.location.href = "/"
})

form.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearError()

  const name = form.name.value.trim()
  const email = form.email.value.trim()
  const password = form.password.value

  // Mismo umbral que valida el servidor (RB: contraseña >= 8) — se corta acá
  // para no pagar el round-trip, pero el server igual lo revalida.
  if (password.length < 8) {
    showError("La contraseña debe tener al menos 8 caracteres")
    return
  }

  setLoading(true)
  try {
    await apiPost("/api/auth/register", { name, email, password })
    const result = await login(email, password)
    if (!result.ok) {
      showError("Registro exitoso pero el login falló. Intentá iniciar sesión.")
      return
    }
    window.location.href = "/"
  } catch (err) {
    if (err instanceof ApiError) showError(err.message)
    else if (err instanceof NetworkError) showError(err.message)
    else showError("Error al registrar")
  } finally {
    setLoading(false)
  }
})
