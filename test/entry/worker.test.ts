import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import worker from '../../src/entry/worker'
import type { Env } from '../../src/entry/env'
import { FakeR2Bucket, ID, sign } from '../support/fakes'

// De punta a punta con R2 y la API falsos. La caché de current.json es del módulo (isolate): cada prueba
// avanza el reloj más de 30 s para no heredar el puntero de la anterior.
let now = Date.UTC(2026, 9, 1)
let bucket: FakeR2Bucket
let api: ReturnType<typeof vi.fn<typeof fetch>>
let pending: Promise<unknown>[]

const ctx = (): ExecutionContext => ({
  waitUntil: (p: Promise<unknown>) => { pending.push(p) },
  passThroughOnException: () => undefined,
  props: {},
}) as unknown as ExecutionContext

const env = (extra: Partial<Env> = {}): Env => ({
  BUCKET: bucket.asR2(),
  API_URL: 'https://api.test',
  PLAY_SIGNING_SECRET: 's3cret',
  VISITS_INGEST_SECRET: 'ingest',
  VISIT_SALT: 'salt',
  ...extra,
})

type Init = RequestInit & { cf?: Record<string, unknown> }
async function call(path: string, init: Init = {}, e: Env = env()): Promise<Response> {
  const request = new Request(`https://play.test${path}`, init)
  if (init.cf) Object.assign(request, { cf: init.cf })
  const response = await worker.fetch(request as Parameters<typeof worker.fetch>[0], e, ctx())
  await Promise.all(pending)
  return response
}

beforeEach(() => {
  now += 60_000
  vi.spyOn(Date, 'now').mockReturnValue(now)
  bucket = new FakeR2Bucket()
    .put('current.json', JSON.stringify({ prefix: 'builds/live/', version_id: 'live' }))
    .put('builds/live/index.html', '<html>en línea</html>', '"idx"')
    .put('builds/live/Build/x.wasm.br', 'wasm', '"wasm"')
    .put(`builds/${ID}/index.html`, '<html>previa</html>', '"pidx"')
    .put(`builds/${ID}/Build/a.js`, 'js', '"pjs"')
  api = vi.fn<typeof fetch>(() => Promise.resolve(new Response('ok')))
  vi.stubGlobal('fetch', api)
  pending = []
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('versión en línea', () => {
  test('index.html: headers, cuerpo y visita registrada con waitUntil', async () => {
    const res = await call('/?sala=123', { headers: { 'cf-connecting-ip': '1.2.3.4', 'user-agent': 'Android' }, cf: { country: 'CO', latitude: '7.89', asn: 3816 } })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>en línea</html>')
    expect(Object.fromEntries(res.headers)).toEqual({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      etag: '"idx"',
      'x-content-type-options': 'nosniff',
    })
    expect(pending).toHaveLength(1)
    expect(api).toHaveBeenCalledTimes(1)
    const [url, init] = api.mock.calls[0] ?? []
    expect(url).toBe('https://api.test/api/visits/ingest')
    expect(init?.headers).toEqual({ 'content-type': 'application/json', 'x-ingest-secret': 'ingest' })
    const sent = init?.body as string
    const visit = JSON.parse(sent) as Record<string, unknown>
    expect(visit).toMatchObject({ visitor: '54141d36667ccb701eb8e36f34855d2b', version_id: 'live', country: 'CO', latitude: 7.89, asn: 3816, user_agent: 'Android', session_code: '123' })
    expect(sent).not.toContain('1.2.3.4')
  })

  test('archivo .br: tipo interno, Content-Encoding y caché inmutable, sin visita', async () => {
    const res = await call('/Build/x.wasm.br')
    expect(res.headers.get('content-type')).toBe('application/wasm')
    expect(res.headers.get('content-encoding')).toBe('br')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(api).not.toHaveBeenCalled()
  })

  test('If-None-Match coincide: 304 sin cuerpo y sin visita', async () => {
    const res = await call('/', { headers: { 'if-none-match': '"idx"' } })
    expect(res.status).toBe(304)
    expect(res.headers.get('etag')).toBe('"idx"')
    expect(api).not.toHaveBeenCalled()
  })

  test('HEAD: headers sin cuerpo y sin visita', async () => {
    const res = await call('/', { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe('"idx"')
    expect(await res.text()).toBe('')
    expect(api).not.toHaveBeenCalled()
  })

  test('sin VISITS_INGEST_SECRET no se registran visitas', async () => {
    const res = await call('/', {}, env({ VISITS_INGEST_SECRET: undefined }))
    expect(res.status).toBe(200)
    expect(pending).toHaveLength(0)
    expect(api).not.toHaveBeenCalled()
  })

  test('sin current.json: 503 "se está actualizando"', async () => {
    delete bucket.objects['current.json']
    const res = await call('/')
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toContain('Earthcation se está actualizando')
  })

  test('current.json se lee una vez por isolate durante 30 s', async () => {
    await call('/')
    await call('/Build/x.wasm.br')
    expect(bucket.gets.filter(k => k === 'current.json')).toHaveLength(1)
  })

  test('archivo que no está en la versión: 404', async () => {
    const res = await call('/Build/nada.js')
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('Ese archivo no está en esta versión del juego.')
  })
})

describe('rutas', () => {
  test('método distinto de GET/HEAD: 405', async () => {
    const res = await call('/', { method: 'POST' })
    expect(res.status).toBe(405)
    expect(await res.text()).toBe('Method not allowed')
  })

  test('ruta inválida: 404 "Esta dirección no existe."', async () => {
    const res = await call('/v/no-uuid/x')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('Esta dirección no existe.')
  })

  test('/v/<id> sin barra: 301 a la carpeta conservando la consulta', async () => {
    const res = await call(`/v/${ID}?t=abc`)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`https://play.test/v/${ID}/?t=abc`)
  })

  test('un fallo de R2 no se disfraza de página de error', async () => {
    vi.spyOn(bucket, 'get').mockRejectedValue(new Error('R2 caído'))
    await expect(call('/')).rejects.toThrow('R2 caído')
  })
})

describe('vista previa', () => {
  test('?t= válido: index sin caché, noindex y cookie de la carpeta; luego basta la cookie', async () => {
    const exp = Math.floor(now / 1000) + 600
    const token = await sign('s3cret', ID, exp)
    const res = await call(`/v/${ID}/?t=${token}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>previa</html>')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    expect(res.headers.get('set-cookie')).toBe(`ec_preview=${token}; Path=/v/${ID}/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`)
    expect(api).not.toHaveBeenCalled()

    const asset = await call(`/v/${ID}/Build/a.js`, { headers: { cookie: `ec_preview=${token}` } })
    expect(asset.status).toBe(200)
    expect(asset.headers.get('set-cookie')).toBeNull()
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })

  test('PLAY_SIGNING_SECRET_PREVIOUS durante la rotación', async () => {
    const token = await sign('viejo', ID, Math.floor(now / 1000) + 600)
    const res = await call(`/v/${ID}/?t=${token}`, {}, env({ PLAY_SIGNING_SECRET: 'nuevo', PLAY_SIGNING_SECRET_PREVIOUS: 'viejo' }))
    expect(res.status).toBe(200)
  })

  test('sin token o vencido: 403 "Vista previa vencida"', async () => {
    const expired = await sign('s3cret', ID, Math.floor(now / 1000) - 1)
    for (const path of [`/v/${ID}/`, `/v/${ID}/?t=${expired}`]) {
      const res = await call(path)
      expect(res.status).toBe(403)
      expect(await res.text()).toContain('Vista previa vencida')
    }
  })
})
