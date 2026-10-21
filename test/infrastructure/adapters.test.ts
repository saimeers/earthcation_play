import { describe, expect, test, vi } from 'vitest'
import { buildVisit } from '../../src/domain/Visit'
import { ApiVisitReporter } from '../../src/infrastructure/ApiVisitReporter'
import { CachedPointerStore, type PointerCache } from '../../src/infrastructure/CachedPointerStore'
import { R2BuildStore } from '../../src/infrastructure/R2BuildStore'
import { FakeClock, FakeR2Bucket } from '../support/fakes'

describe('CachedPointerStore', () => {
  test('relee current.json como mucho cada 30 s y recuerda también que no existe', async () => {
    const bucket = new FakeR2Bucket()
    const clock = new FakeClock()
    const cache: PointerCache = { entry: null }
    const store = new CachedPointerStore(bucket.asR2(), clock, cache)

    expect(await store.current()).toBeNull()
    bucket.put('current.json', JSON.stringify({ prefix: 'builds/a/', version_id: 'a' }))
    clock.ms += 29_999
    expect(await store.current()).toBeNull()
    clock.ms += 1
    expect(await store.current()).toEqual({ prefix: 'builds/a/', version_id: 'a' })
    expect(bucket.gets).toEqual(['current.json', 'current.json'])
  })

  test('la caché es del isolate: la comparten instancias nuevas (una por petición)', async () => {
    const bucket = new FakeR2Bucket().put('current.json', '{"prefix":"builds/a/"}')
    const clock = new FakeClock()
    const cache: PointerCache = { entry: null }
    await new CachedPointerStore(bucket.asR2(), clock, cache).current()
    await new CachedPointerStore(bucket.asR2(), clock, cache).current()
    expect(bucket.gets).toHaveLength(1)
  })
})

describe('R2BuildStore', () => {
  test('objeto con cuerpo, sin cuerpo (304) o inexistente', async () => {
    const bucket = new FakeR2Bucket().put('builds/a/index.html', '<html>', '"e"')
    const store = new R2BuildStore(bucket.asR2())
    const full = await store.get('builds/a/index.html', new Headers())
    expect(full?.httpEtag).toBe('"e"')
    expect(await new Response(full?.body).text()).toBe('<html>')
    expect(await store.get('builds/a/index.html', new Headers({ 'if-none-match': '"e"' }))).toEqual({ httpEtag: '"e"', body: null })
    expect(await store.get('builds/a/nada', new Headers())).toBeNull()
  })
})

describe('ApiVisitReporter', () => {
  const visit = buildVisit({ visitor: 'v', versionId: 1, origin: {}, userAgent: 'ua', sala: null })

  test('POST /api/visits/ingest con x-ingest-secret y la visita en JSON', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response('ok')))
    await new ApiVisitReporter('https://api.test', 'ingest', fetcher).report(visit)
    expect(fetcher).toHaveBeenCalledWith('https://api.test/api/visits/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-secret': 'ingest' },
      body: JSON.stringify(visit),
    })
  })

  test('un fallo de red no se propaga', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new Error('caída')))
    await expect(new ApiVisitReporter('https://api.test', 'ingest', fetcher).report(visit)).resolves.toBeUndefined()
  })
})
