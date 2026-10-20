import type { Clock } from '../ports/Clock'
import type { LivePointer, PointerStore } from '../ports/PointerStore'

export const POINTER_KEY = 'current.json'
export const POINTER_TTL_MS = 30_000

/** Dónde vive la caché: un objeto de módulo, así dura lo que dura el isolate y no cada petición. */
export interface PointerCache {
  entry: { value: LivePointer | null; at: number } | null
}

/** current.json de R2, releído como mucho cada 30 s por isolate (también se recuerda que no existe). */
export class CachedPointerStore implements PointerStore {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly clock: Clock,
    private readonly cache: PointerCache,
    private readonly ttlMs = POINTER_TTL_MS,
  ) {}

  async current(): Promise<LivePointer | null> {
    const cached = this.cache.entry
    if (cached && this.clock.now() - cached.at < this.ttlMs) return cached.value
    const object = await this.bucket.get(POINTER_KEY)
    const value = object ? await object.json<LivePointer | null>() : null
    this.cache.entry = { value, at: this.clock.now() }
    return value
  }
}
