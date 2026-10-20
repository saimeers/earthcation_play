import { describe, expect, test } from 'vitest'
import { buildVisit, visitorId } from '../../src/domain/Visit'
import { WebCryptoHmac } from '../../src/infrastructure/WebCryptoHmac'

const hmac = new WebCryptoHmac()

describe('visitorId', () => {
  test('estable, 32 hex y distinto por IP y por navegador (portada)', async () => {
    const a = await visitorId(hmac, 'salt', '1.2.3.4')
    expect(a).toHaveLength(32)
    expect(a).toBe(await visitorId(hmac, 'salt', '1.2.3.4'))
    expect(a).not.toBe(await visitorId(hmac, 'salt', '1.2.3.5'))
    // Misma red (wifi del salón), otro celular: otro visitante
    expect(await visitorId(hmac, 'salt', '1.2.3.4', 'Android')).not.toBe(await visitorId(hmac, 'salt', '1.2.3.4', 'iPhone'))
  })

  test('igual que HMAC-SHA256 de node:crypto (vector fijo); null sin sal o sin IP', async () => {
    expect(await visitorId(hmac, 'salt', '1.2.3.4', 'Android')).toBe('54141d36667ccb701eb8e36f34855d2b')
    expect(await visitorId(hmac, undefined, '1.2.3.4')).toBeNull()
    expect(await visitorId(hmac, 'salt', null)).toBeNull()
  })
})

describe('buildVisit', () => {
  test('mapea request.cf al contrato de la API', () => {
    const visit = buildVisit({
      visitor: 'v',
      versionId: 7,
      origin: { country: 'CO', region: 'Norte de Santander', city: 'Cúcuta', colo: 'BOG', latitude: '7.89', longitude: '-72.5', asn: 3816, asOrganization: 'Colombia Telecom' },
      userAgent: 'Android',
      sala: '123',
    })
    expect(visit).toEqual({
      visitor: 'v', version_id: 7, country: 'CO', region: 'Norte de Santander', city: 'Cúcuta', colo: 'BOG',
      latitude: 7.89, longitude: -72.5, asn: 3816, as_organization: 'Colombia Telecom', user_agent: 'Android', session_code: '123',
    })
  })

  test('sin datos de Cloudflare todo es null; sala solo con tres dígitos; user-agent hasta 400', () => {
    const visit = buildVisit({ visitor: null, versionId: undefined, origin: {}, userAgent: 'x'.repeat(500), sala: '12a' })
    expect(visit).toMatchObject({ country: null, region: null, city: null, colo: null, latitude: null, longitude: null, asn: null, as_organization: null, session_code: null })
    expect(visit.user_agent).toHaveLength(400)
    expect(buildVisit({ visitor: null, versionId: 1, origin: {}, userAgent: null, sala: '1234' })).toMatchObject({ user_agent: null, session_code: null })
  })
})
