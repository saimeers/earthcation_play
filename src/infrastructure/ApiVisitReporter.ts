import type { Visit } from '../domain/Visit'
import type { VisitReporter } from '../ports/VisitReporter'

/** `POST <API_URL>/api/visits/ingest` con el secreto compartido en `x-ingest-secret`. */
export class ApiVisitReporter implements VisitReporter {
  constructor(
    private readonly apiUrl: string,
    private readonly ingestSecret: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async report(visit: Visit): Promise<void> {
    await this.fetcher(`${this.apiUrl}/api/visits/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-secret': this.ingestSecret },
      body: JSON.stringify(visit),
    }).catch(() => undefined)
  }
}
