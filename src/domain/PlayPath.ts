const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const INDEX = 'index.html'

/**
 * Qué pide la URL: la versión en línea (`/…`) o la vista previa de una versión (`/v/<id>/…`).
 * `preview` es el id de la versión (null en la versión en línea) y `file` la ruta dentro del build.
 */
export class PlayPath {
  private constructor(
    readonly preview: string | null,
    readonly file: string,
    /** `/v/<id>` sin barra: las rutas relativas del index (Build/…) quedarían fuera de la versión */
    readonly needsSlash: boolean,
  ) {}

  /** null si la ruta no es válida (`..`, `\`, codificación rota, `/v/` sin UUID). */
  static parse(pathname: string): PlayPath | null {
    const decoded = decodeSegments(pathname)
    if (!decoded) return null
    if (decoded[0] !== 'v') return PlayPath.inBuild(null, decoded)
    const id = decoded[1] ?? ''
    if (!UUID.test(id)) return null
    const preview = id.toLowerCase()
    if (decoded.length === 2) return new PlayPath(preview, INDEX, true)
    return PlayPath.inBuild(preview, decoded.slice(2))
  }

  private static inBuild(preview: string | null, segments: string[]): PlayPath {
    const file = segments.join('/')
    return new PlayPath(preview, file === '' || file.endsWith('/') ? file + INDEX : file, false)
  }

  get isIndex(): boolean {
    return this.file === INDEX
  }
}

function decodeSegments(pathname: string): string[] | null {
  let segments: string[]
  try {
    segments = pathname.split('/').slice(1).map(decodeURIComponent)
  } catch {
    return null
  }
  return segments.some(s => s === '.' || s === '..' || s.includes('\\')) ? null : segments
}
