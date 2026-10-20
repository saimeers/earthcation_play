import { buildVisit, visitorId, type VisitOrigin } from '../domain/Visit'
import type { Crypto } from '../ports/Crypto'
import type { VisitReporter } from '../ports/VisitReporter'

export interface RecordVisitCommand {
  /** `cf-connecting-ip`: solo se usa para el HMAC, nunca se reporta */
  ip: string | null
  userAgent: string | null
  origin: VisitOrigin
  sala: string | null
  versionId: unknown
}

/** Reporta a la API que alguien abrió la versión en línea (país, dispositivo, sala del QR…). */
export class RecordVisit {
  constructor(
    private readonly reporter: VisitReporter,
    private readonly crypto: Crypto,
    private readonly salt: string | undefined,
  ) {}

  async execute({ ip, userAgent, origin, sala, versionId }: RecordVisitCommand): Promise<void> {
    const visitor = await visitorId(this.crypto, this.salt, ip, userAgent ?? '')
    await this.reporter.report(buildVisit({ visitor, versionId, origin, userAgent, sala }))
  }
}
