export type EntityType = "RECORD" | "OBLIGATION"

export interface MarkerDefinition {
  id: string
  name: string
  color: string
  order: number
  createdAt: string
}

export interface EntityMarkerEntry {
  id: string
  markerId: string
  entityId: string
  entityType: EntityType
}
