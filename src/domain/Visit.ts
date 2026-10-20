import type { HmacSigner } from './Hmac'

/** Lo que Cloudflare sabe de la petición (`request.cf`); todo opcional. */
export interface VisitOrigin {
  country?: string | null
  region?: string | null
  city?: string | null
  colo?: string | null
  latitude?: string | null
  longitude?: string | null
  asn?: number | null
  asOrganization?: string | null
}

/** Cuerpo que se reporta a `POST /api/visits/ingest` (contrato de la API, en snake_case). */
export interface Visit {
  visitor: string | null
  version_id: unknown
  country: string | null
  region: string | null
  city: string | null
  colo: string | null
  latitude: number | null
  longitude: number | null
  /** Red de origen: la API descarta como escáner lo que viene de un centro de datos */
  asn: number | null
  as_organization: string | null
  user_agent: string | null
  session_code: string | null
}

export interface VisitInput {
  visitor: string | null
  versionId: unknown
  origin: VisitOrigin
  userAgent: string | null
  /** `?sala=` del QR: solo cuenta si son tres dígitos */
  sala: string | null
}

export function buildVisit({ visitor, versionId, origin: cf, userAgent, sala }: VisitInput): Visit {
  return {
    visitor,
    version_id: versionId,
    country: cf.country ?? null,
    region: cf.region ?? null,
    city: cf.city ?? null,
    colo: cf.colo ?? null,
    latitude: cf.latitude ? Number(cf.latitude) : null,
    longitude: cf.longitude ? Number(cf.longitude) : null,
    asn: cf.asn ?? null,
    as_organization: cf.asOrganization ?? null,
    user_agent: userAgent?.slice(0, 400) ?? null,
    session_code: /^\d{3}$/.test(sala ?? '') ? sala : null,
  }
}

/**
 * Identificador anónimo del visitante: HMAC(VISIT_SALT, ip + user-agent), 16 bytes en hex. Solo la IP no
 * sirve: en un salón todos los celulares salen por el mismo wifi. La IP nunca sale del Worker.
 */
export async function visitorId(hmac: HmacSigner, salt: string | undefined, ip: string | null, userAgent = ''): Promise<string | null> {
  if (!salt || !ip) return null
  const sig = await hmac.signHmac(salt, `${ip}|${userAgent}`)
  return [...sig.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('')
}
