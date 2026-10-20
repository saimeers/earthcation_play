import { INDEX } from './PlayPath'

const MIME_TYPES: Readonly<Record<string, string>> = {
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
const ENCODINGS: Readonly<Record<string, string>> = { '.br': 'br', '.gz': 'gzip' }

export const IMMUTABLE = 'public, max-age=31536000, immutable'
export const NO_STORE = 'no-store'

export interface FileHeaders {
  contentType: string
  /** `br` o `gzip` cuando el archivo ya viene comprimido (Cloudflare no debe volver a comprimirlo) */
  contentEncoding: string | undefined
  cacheControl: string
}

const extOf = (file: string): string => {
  const dot = file.lastIndexOf('.')
  return dot > file.lastIndexOf('/') ? file.slice(dot).toLowerCase() : ''
}

/**
 * Headers de un archivo del build, por su nombre (igual que deploy.service.js#headersFor en la API):
 * "Build/x.wasm.br" es application/wasm con Content-Encoding br; todo inmutable salvo index.html.
 */
export function headersFor(file: string): FileHeaders {
  const ext = extOf(file)
  const contentEncoding = ENCODINGS[ext]
  const inner = contentEncoding ? file.slice(0, -ext.length) : file
  return {
    contentType: MIME_TYPES[extOf(inner)] ?? 'application/octet-stream',
    contentEncoding,
    cacheControl: file === INDEX ? 'no-cache' : IMMUTABLE,
  }
}
