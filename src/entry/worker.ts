import { PlayError, RouteNotFoundError } from '../domain/errors'
import { PlayPath } from '../domain/PlayPath'
import type { ServedFile } from '../domain/ServedFile'
import { buildContainer, type Container } from './container'
import type { Env } from './env'
import { errorPage } from './pages'

type IncomingRequest = Request<unknown, IncomingRequestCfProperties>

/**
 * play.earthcation.saimers.dev — sirve el juego WebGL desde R2.
 * - `/…`        versión en línea: la que apunta current.json (lo escribe la API al activar).
 * - `/v/<id>/…` vista previa de una versión: token `?t=` de la API, que luego queda en una cookie
 *               limitada a esa carpeta para los archivos del build.
 * Al abrir el index de la versión en línea se registra la visita en la API (país/región/ciudad de
 * Cloudflare, dispositivo, si llegó por QR) sin demorar la respuesta.
 */
export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })
    const url = new URL(request.url)
    const path = PlayPath.parse(url.pathname)
    if (!path) return errorPage(new RouteNotFoundError())
    if (path.needsSlash) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301)
    try {
      const container = buildContainer(env)
      const served = await serve(container, request, url, path)
      return respond(container, request, url, served, ctx)
    } catch (error) {
      if (error instanceof PlayError) return errorPage(error)
      throw error
    }
  },
} satisfies ExportedHandler<Env>

function serve(container: Container, request: IncomingRequest, url: URL, path: PlayPath): Promise<ServedFile> {
  const conditions = request.headers
  if (path.preview === null) return container.serveLiveVersion.execute({ path, conditions })
  return container.servePreview.execute({
    path,
    queryToken: url.searchParams.get('t'),
    cookieHeader: request.headers.get('cookie'),
    conditions,
  })
}

function respond(container: Container, request: IncomingRequest, url: URL, served: ServedFile, ctx: ExecutionContext): Response {
  const headers = headersOf(served)
  if (!served.body) return new Response(null, { status: 304, headers })
  if (!served.preview && served.file === 'index.html' && request.method === 'GET' && container.recordVisit) {
    ctx.waitUntil(container.recordVisit.execute({
      ip: request.headers.get('cf-connecting-ip'),
      userAgent: request.headers.get('user-agent'),
      origin: request.cf ?? {},
      sala: url.searchParams.get('sala'),
      versionId: served.versionId,
    }))
  }
  if (request.method === 'HEAD') return new Response(null, { headers })
  // encodeBody manual: el .br ya viene comprimido, Cloudflare no debe volver a comprimirlo
  return new Response(served.body, { headers, encodeBody: served.headers.contentEncoding ? 'manual' : 'automatic' })
}

function headersOf({ headers: file, etag, preview, setCookie }: ServedFile): Headers {
  const headers = new Headers({
    'content-type': file.contentType,
    'cache-control': file.cacheControl,
    etag,
    'x-content-type-options': 'nosniff',
  })
  if (preview) headers.set('x-robots-tag', 'noindex')
  if (setCookie) headers.append('set-cookie', setCookie)
  if (file.contentEncoding) headers.set('content-encoding', file.contentEncoding)
  return headers
}
