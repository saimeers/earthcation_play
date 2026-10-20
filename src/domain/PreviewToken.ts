import type { HmacVerifier } from './Hmac'

const FORMAT = /^(\d{1,12})\.([A-Za-z0-9_-]{20,})$/
export const PREVIEW_COOKIE = 'ec_preview'

/**
 * Token de vista previa `<exp>.<firma>` que emite la API (deploy.service.js#previewToken):
 * HMAC-SHA256(PLAY_SIGNING_SECRET, "preview:<id>:<exp>") en base64url, `exp` en segundos.
 */
export class PreviewToken {
  private constructor(
    readonly raw: string,
    /** Vencimiento en segundos desde la época */
    readonly exp: number,
    private readonly expText: string,
    private readonly signature: Uint8Array,
  ) {}

  /** null si no tiene el formato o la firma no es base64url válida. */
  static parse(raw: string | null | undefined): PreviewToken | null {
    const match = FORMAT.exec(raw ?? '')
    if (!raw || !match) return null
    const [, expText = '', sigText = ''] = match
    const signature = fromBase64Url(sigText)
    return signature ? new PreviewToken(raw, Number(expText), expText, signature) : null
  }

  isExpired(nowMs: number): boolean {
    return this.exp * 1000 <= nowMs
  }

  /** Válido para la versión `id` con alguno de los secretos (el vigente o el anterior, para rotarlo). */
  async isValidFor(id: string, secrets: readonly (string | undefined)[], hmac: HmacVerifier, nowMs: number): Promise<boolean> {
    if (this.isExpired(nowMs)) return false
    for (const secret of secrets) {
      if (secret && await hmac.verifyHmac(secret, `preview:${id}:${this.expText}`, this.signature)) return true
    }
    return false
  }

  /** Cookie que guarda el token solo para la carpeta de esa versión, hasta que venza. */
  cookieFor(id: string, nowMs: number): string {
    const maxAge = Math.max(0, this.exp - Math.floor(nowMs / 1000))
    return `${PREVIEW_COOKIE}=${this.raw}; Path=/v/${id}/; Max-Age=${String(maxAge)}; HttpOnly; Secure; SameSite=Lax`
  }
}

/** Valor de una cookie en el header `Cookie` (null si no está). */
export function readCookie(header: string | null | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

function fromBase64Url(text: string): Uint8Array | null {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  try {
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    return Uint8Array.from(binary, c => c.charCodeAt(0))
  } catch {
    return null
  }
}
