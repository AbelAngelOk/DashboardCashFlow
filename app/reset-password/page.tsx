import { Suspense } from "react"
import { ResetPasswordForm } from "./reset-password-form"

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm border-2 border-black">
        <div className="border-b-2 border-black bg-black px-6 py-3">
          <span className="font-bold text-white">Cash Flow — Nueva contraseña</span>
        </div>
        <Suspense fallback={<p className="p-6 text-sm text-gray-400">Cargando...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
