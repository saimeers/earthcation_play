import { securityHeaders } from './securityHeaders'
import type { PlayError } from '../domain/errors'
import { FileNotFoundError, LiveVersionUnavailableError, PreviewExpiredError } from '../domain/errors'

/** Página de error en HTML, sin caché. */
export const page = (status: number, title: string, message: string): Response => new Response(
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14110f;color:#f4ead8;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:22px;margin:0 0 8px}p{opacity:.8;margin:0}</style></head>
<body><div><h1>${title}</h1><p>${message}</p></div></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders('text/html') } },
)

/** Traduce un error del dominio a la página que ve el jugador. */
export function errorPage(error: PlayError): Response {
  if (error instanceof FileNotFoundError) return page(404, 'No encontrado', 'Ese archivo no está en esta versión del juego.')
  if (error instanceof PreviewExpiredError) {
    return page(403, 'Vista previa vencida', 'Ábrela otra vez desde el panel: Versiones del juego → Probar.')
  }
  if (error instanceof LiveVersionUnavailableError) {
    return page(503, 'Earthcation se está actualizando', 'Vuelve a intentarlo en unos minutos.')
  }
  return page(404, 'No encontrado', 'Esta dirección no existe.')
}
