import { notFound } from "next/navigation"
import { loadObligation } from "@/lib/obligation-actions"
import { ObligationDetail } from "@/components/obligations/obligation-detail"

export default async function ObligationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const obligation = await loadObligation(id)
  if (!obligation) notFound()

  return <ObligationDetail initialObligation={obligation} />
}
