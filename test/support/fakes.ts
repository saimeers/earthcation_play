import type { Visit } from '../../src/domain/Visit'
import { WebCryptoHmac } from '../../src/infrastructure/WebCryptoHmac'
import type { BuildStore, StoredFile } from '../../src/ports/BuildStore'
import type { Clock } from '../../src/ports/Clock'
import type { LivePointer, PointerStore } from '../../src/ports/PointerStore'
import type { VisitReporter } from '../../src/ports/VisitReporter'

export const ID = '965e94af-91ae-4d72-9fc3-3be57da6dbbd'

/** Token como lo firma la API (deploy.service.js#previewToken): `<exp>.<base64url(HMAC)>`. */
export async function sign(secret: string, id: string, exp: number): Promise<string> {
  const sig = await new WebCryptoHmac().signHmac(secret, `preview:${id}:${String(exp)}`)
  const base64 = btoa(String.fromCharCode(...sig))
  return `${String(exp)}.${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

export const body = (text = 'x'): ReadableStream => new Response(text).body as ReadableStream

export class FakeClock implements Clock {
  constructor(public ms = Date.UTC(2026, 9, 1)) {}
  now(): number {
    return this.ms
  }
}

export class FakeBuildStore implements BuildStore {
  readonly requested: string[] = []
  constructor(private readonly files: Record<string, StoredFile> = {}) {}
  async get(key: string): Promise<StoredFile | null> {
    this.requested.push(key)
    return this.files[key] ?? null
  }
}

export class FakePointerStore implements PointerStore {
  constructor(private readonly pointer: LivePointer | null) {}
  async current(): Promise<LivePointer | null> {
    return this.pointer
  }
}

export class FakeVisitReporter implements VisitReporter {
  readonly visits: Visit[] = []
  async report(visit: Visit): Promise<void> {
    this.visits.push(visit)
  }
}

interface FakeObject {
  etag: string
  text: string
}

/** Bucket de R2 en memoria: `get` con `onlyIf` (If-None-Match) y `json()` como R2. */
export class FakeR2Bucket {
  readonly gets: string[] = []
  readonly objects: Record<string, FakeObject> = {}

  put(key: string, text: string, etag = `"${key}"`): this {
    this.objects[key] = { etag, text }
    return this
  }

  async get(key: string, options?: { onlyIf?: Headers }): Promise<object | null> {
    this.gets.push(key)
    const object = this.objects[key]
    if (!object) return null
    const meta = { key, httpEtag: object.etag }
    if (options?.onlyIf?.get('if-none-match') === object.etag) return meta
    return { ...meta, body: body(object.text), json: async (): Promise<unknown> => JSON.parse(object.text) }
  }

  asR2(): R2Bucket {
    return this as unknown as R2Bucket
  }
}
