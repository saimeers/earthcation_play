// Funciones puras del Worker (probadas en test/worker.test.js)

const encoder = new TextEncoder()

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
}
const ENCODINGS = { '.br': 'br', '.gz': 'gzip' }

const extOf = (file) => {
  const dot = file.lastIndexOf('.')
  return dot > file.lastIndexOf('/') ? file.slice(dot).toLowerCase() : ''
}

/**
 * Headers de un archivo del build, por su nombre (igual que deploy.service.js#headersFor en la API):
 * "Build/x.wasm.br" es application/wasm con Content-Encoding br; todo inmutable salvo index.html.
 */
export function headersFor(file) {
  const ext = extOf(file)
  const contentEncoding = ENCODINGS[ext]
  const inner = contentEncoding ? file.slice(0, -ext.length) : file
  return {
    contentType: MIME_TYPES[extOf(inner)] ?? 'application/octet-stream',
    contentEncoding,
    cacheControl: file === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Qué pide la URL: la versión en línea (`/…`) o la vista previa de una versión (`/v/<id>/…`).
 * @returns {{ preview: string|null, file: string, needsSlash: boolean } | null} null si la ruta no es válida
 */
export function parsePath(pathname) {
  let segments
  try {
    segments = pathname.split('/').slice(1).map(decodeURIComponent)
  } catch {
    return null
  }
  if (segments.some(s => s === '.' || s === '..' || s.includes('\\'))) return null

  let preview = null
  if (segments[0] === 'v') {
    if (!UUID.test(segments[1] ?? '')) return null
    preview = segments[1].toLowerCase()
    // /v/<id> sin barra: las rutas relativas del index (Build/…) quedarían fuera de la versión
    if (segments.length === 2) return { preview, file: 'index.html', needsSlash: true }
    segments = segments.slice(2)
  }
  let file = segments.join('/')
  if (file === '' || file.endsWith('/')) file += 'index.html'
  return { preview, file, needsSlash: false }
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

/**
 * Token de vista previa `<exp>.<firma>` que emite la API (deploy.service.js#previewToken):
 * HMAC-SHA256(PLAY_SIGNING_SECRET, "preview:<id>:<exp>"). Comparación en tiempo constante (WebCrypto).
 */
export async function verifyPreviewToken(secret, id, token, nowMs = Date.now()) {
  const match = /^(\d{1,12})\.([A-Za-z0-9_-]{20,})$/.exec(token ?? '')
  if (!secret || !match || Number(match[1]) * 1000 <= nowMs) return false
  let sig
  try {
    sig = fromBase64Url(match[2])
  } catch {
    return false
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(`preview:${id}:${match[1]}`))
}

export function readCookie(header, name) {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/**
 * Identificador anónimo del visitante: HMAC(VISIT_SALT, ip + user-agent). Solo la IP no sirve: en un
 * salón todos los celulares salen por el mismo wifi. La IP nunca sale del Worker.
 */
export async function visitorId(salt, ip, userAgent = '') {
  if (!salt || !ip) return null
  const key = await crypto.subtle.importKey('raw', encoder.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${ip}|${userAgent}`)))
  return [...sig.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('')
}
