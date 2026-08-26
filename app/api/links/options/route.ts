import { handle } from "@/lib/api-helpers"
import { loadIngresoOptions, loadGastoOptions } from "@/lib/link-actions"

/** Opciones para los selectores de "vincular ingreso/gasto" — ambas en paralelo */
export async function GET() {
  return handle(async () => {
    const [ingresos, gastos] = await Promise.all([loadIngresoOptions(), loadGastoOptions()])
    return { ingresos, gastos }
  })
}
