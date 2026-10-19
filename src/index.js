import { headersFor, parsePath, readCookie, verifyPreviewToken, visitorId } from './lib.js'

/**
 * play.earthcation.saimers.dev — sirve el juego WebGL desde R2.
 * - `/…`        versión en línea: la que apunta current.json (lo escribe la API al activar).
 * - `/v/<id>/…` vista previa de una versión: token `?t=` de la API, que luego queda en una cookie
 *               limitada a esa carpeta para los archivos del build.
 * Al abrir el index de la versión en línea se registra la visita en la API (país/región/ciudad de
 * Cloudflare, dispositivo, si llegó por QR) sin demorar la respuesta.
 */

const POINTER_TTL_MS = 30_000
let pointer = null // { value, at } — caché por isolate de current.json

const page = (status, title, message) => new Response(
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14110f;color:#f4ead8;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:22px;margin:0 0 8px}p{opacity:.8;margin:0}</style></head>
<body><div><h1>${title}</h1><p>${message}</p></div></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
)

async function currentPointer(env) {
  if (pointer && Date.now() - pointer.at < POINTER_TTL_MS) return pointer.value
  const object = await env.BUCKET.get('current.json')
  const value = object ? await object.json() : null
  pointer = { value, at: Date.now() }
  return value
}

async function recordVisit(request, env, url, current) {
  if (!env.VISITS_INGEST_SECRET) return
  const cf = request.cf ?? {}
  const sala = url.searchParams.get('sala')
  const body = {
    visitor: await visitorId(env.VISIT_SALT, request.headers.get('cf-connecting-ip'), request.headers.get('user-agent') ?? ''),
    version_id: current.version_id,
    country: cf.country ?? null,
    region: cf.region ?? null,
    city: cf.city ?? null,
    colo: cf.colo ?? null,
    latitude: cf.latitude ? Number(cf.latitude) : null,
    longitude: cf.longitude ? Number(cf.longitude) : null,
    // Red de origen: la API descarta como escáner lo que viene de un centro de datos
    asn: cf.asn ?? null,
    as_organization: cf.asOrganization ?? null,
    user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    session_code: /^\d{3}$/.test(sala ?? '') ? sala : null,
  }
  await fetch(`${env.API_URL}/api/visits/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ingest-secret': env.VISITS_INGEST_SECRET },
    body: JSON.stringify(body),
  }).catch(() => {})
}

/** Token válido con el secreto vigente o el anterior (para rotarlo sin tumbar vistas previas abiertas). */
async function validPreview(env, id, token) {
  for (const secret of [env.PLAY_SIGNING_SECRET, env.PLAY_SIGNING_SECRET_PREVIOUS]) {
    if (secret && await verifyPreviewToken(secret, id, token)) return true
  }
  return false
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

    const url = new URL(request.url)
    const target = parsePath(url.pathname)
    if (!target) return page(404, 'No encontrado', 'Esta dirección no existe.')
    if (target.needsSlash) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301)

    let prefix
    let setCookie = null
    let current = null
    if (target.preview) {
      const id = target.preview
      const fromQuery = url.searchParams.get('t')
      if (fromQuery && await validPreview(env, id, fromQuery)) {
        const maxAge = Math.max(0, Number(fromQuery.split('.')[0]) - Math.floor(Date.now() / 1000))
        setCookie = `ec_preview=${fromQuery}; Path=/v/${id}/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
      } else if (!await validPreview(env, id, readCookie(request.headers.get('cookie'), 'ec_preview'))) {
        return page(403, 'Vista previa vencida', 'Ábrela otra vez desde el panel: Versiones del juego → Probar.')
      }
      prefix = `builds/${id}/`
    } else {
      current = await currentPointer(env)
      if (!current?.prefix) return page(503, 'Earthcation se está actualizando', 'Vuelve a intentarlo en unos minutos.')
      prefix = current.prefix
    }

    const object = await env.BUCKET.get(prefix + target.file, { onlyIf: request.headers })
    if (!object) return page(404, 'No encontrado', 'Ese archivo no está en esta versión del juego.')

    const { contentType, contentEncoding, cacheControl } = headersFor(target.file)
    const headers = new Headers({
      'content-type': contentType,
      'cache-control': target.preview && target.file === 'index.html' ? 'no-store' : cacheControl,
      etag: object.httpEtag,
      'x-content-type-options': 'nosniff',
    })
    if (target.preview) headers.set('x-robots-tag', 'noindex')
    if (setCookie) headers.append('set-cookie', setCookie)
    if (contentEncoding) headers.set('content-encoding', contentEncoding)

    // R2 devuelve el objeto sin cuerpo cuando If-None-Match coincide
    if (!('body' in object)) return new Response(null, { status: 304, headers })

    if (!target.preview && target.file === 'index.html' && request.method === 'GET') {
      ctx.waitUntil(recordVisit(request, env, url, current))
    }
    if (request.method === 'HEAD') return new Response(null, { headers })
    // encodeBody manual: el .br ya viene comprimido, Cloudflare no debe volver a comprimirlo
    return new Response(object.body, { headers, encodeBody: contentEncoding ? 'manual' : 'automatic' })
  },
}
