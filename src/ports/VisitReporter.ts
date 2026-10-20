import type { Visit } from '../domain/Visit'

/** Destino de las visitas (la API). Nunca falla: perder una visita no debe afectar al jugador. */
export interface VisitReporter {
  report(visit: Visit): Promise<void>
}
