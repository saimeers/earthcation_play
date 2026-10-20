import { PreviewExpiredError, RouteNotFoundError } from '../domain/errors'
import { NO_STORE } from '../domain/FileHeaders'
import type { PlayPath } from '../domain/PlayPath'
import { PREVIEW_COOKIE, PreviewToken, readCookie } from '../domain/PreviewToken'
import type { ServedFile } from '../domain/ServedFile'
import type { BuildStore } from '../ports/BuildStore'
import type { Clock } from '../ports/Clock'
import type { Crypto } from '../ports/Crypto'
import { readBuildFile } from './readBuildFile'

export interface ServePreviewCommand {
  /** Ruta `/v/<id>/…` ya interpretada */
  path: PlayPath
  /** `?t=` que emite la API al pulsar Probar en el panel */
  queryToken: string | null
  cookieHeader: string | null
  conditions: Headers
}

/**
 * Sirve un archivo de la vista previa de una versión (`builds/<id>/`). El token llega por `?t=` y queda
 * en una cookie limitada a la carpeta de la versión para los archivos del build; sin token válido, 403.
 * Se aceptan el secreto vigente y el anterior (rotación sin tumbar vistas previas abiertas).
 */
export class ServePreview {
  constructor(
    private readonly builds: BuildStore,
    private readonly crypto: Crypto,
    private readonly clock: Clock,
    private readonly secrets: readonly (string | undefined)[],
  ) {}

  async execute({ path, queryToken, cookieHeader, conditions }: ServePreviewCommand): Promise<ServedFile> {
    const id = path.preview
    if (id === null) throw new RouteNotFoundError()
    const setCookie = await this.cookieFromQuery(id, queryToken)
    if (!setCookie && !await this.isValid(id, PreviewToken.parse(readCookie(cookieHeader, PREVIEW_COOKIE)))) {
      throw new PreviewExpiredError()
    }
    const served = await readBuildFile(this.builds, `builds/${id}/`, path.file, conditions)
    const cacheControl = path.isIndex ? NO_STORE : served.headers.cacheControl
    return { ...served, headers: { ...served.headers, cacheControl }, preview: true, setCookie }
  }

  /** Cookie a dejar si el token de la URL es válido; null si no vino o no sirve. */
  private async cookieFromQuery(id: string, queryToken: string | null): Promise<string | null> {
    const token = PreviewToken.parse(queryToken)
    return token && await this.isValid(id, token) ? token.cookieFor(id, this.clock.now()) : null
  }

  private async isValid(id: string, token: PreviewToken | null): Promise<boolean> {
    return token !== null && token.isValidFor(id, this.secrets, this.crypto, this.clock.now())
  }
}
