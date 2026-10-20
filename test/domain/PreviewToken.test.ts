import { describe, expect, test } from 'vitest'
import { PreviewToken, readCookie } from '../../src/domain/PreviewToken'
import { WebCryptoHmac } from '../../src/infrastructure/WebCryptoHmac'
import { ID, sign } from '../support/fakes'

const hmac = new WebCryptoHmac()
const now = Date.UTC(2026, 9, 1)
const exp = Math.floor(now / 1000) + 60
const valid = async (raw: string | null, secrets: (string | undefined)[] = ['s3cret'], id = ID): Promise<boolean> => {
  const token = PreviewToken.parse(raw)
  return token !== null && token.isValidFor(id, secrets, hmac, now)
}

describe('PreviewToken', () => {
  test('firma de la API, vencimiento y otra versión (portada de verifyPreviewToken)', async () => {
    const token = await sign('s3cret', ID, exp)
    expect(await valid(token)).toBe(true)
    expect(await valid(token, ['otro'])).toBe(false)
    expect(await valid(token, ['s3cret'], ID.replace('9', '8'))).toBe(false)
    expect(await valid(await sign('s3cret', ID, exp - 120))).toBe(false)
    expect(await valid('basura')).toBe(false)
  })

  test('acepta un token firmado con node:crypto como la API (vector fijo)', async () => {
    // createHmac('sha256', 's3cret').update(`preview:${ID}:4102444800`).digest('base64url')
    expect(await valid('4102444800.vlikSURM9dnL-nK29-enhVjPSO-59NToUsUYRlVo7kM')).toBe(true)
  })

  test('secreto vigente o anterior; sin secretos no hay vista previa', async () => {
    const token = await sign('viejo', ID, exp)
    expect(await valid(token, ['nuevo', 'viejo'])).toBe(true)
    expect(await valid(token, [undefined, undefined])).toBe(false)
    expect(await valid(token, ['', 'nuevo'])).toBe(false)
  })

  test('vence exactamente en exp', () => {
    const token = PreviewToken.parse(`${String(exp)}.${'A'.repeat(43)}`)
    expect(token?.isExpired(exp * 1000 - 1)).toBe(false)
    expect(token?.isExpired(exp * 1000)).toBe(true)
  })

  test('parse rechaza formatos inválidos y base64url imposible', () => {
    expect(PreviewToken.parse(null)).toBeNull()
    expect(PreviewToken.parse('')).toBeNull()
    expect(PreviewToken.parse('12.corta')).toBeNull()
    expect(PreviewToken.parse(`1234567890123.${'A'.repeat(43)}`)).toBeNull()
    expect(PreviewToken.parse(`12.${'A'.repeat(21)}`)).toBeNull() // longitud ≡ 1 (mod 4): atob falla
  })

  test('cookie limitada a la carpeta de la versión hasta que vence', () => {
    const raw = `${String(exp)}.${'A'.repeat(43)}`
    const token = PreviewToken.parse(raw)
    expect(token?.cookieFor(ID, now)).toBe(`ec_preview=${raw}; Path=/v/${ID}/; Max-Age=60; HttpOnly; Secure; SameSite=Lax`)
    expect(token?.cookieFor(ID, (exp + 10) * 1000)).toContain('Max-Age=0;')
  })

  test('readCookie (portada)', () => {
    expect(readCookie('a=1; ec_preview=12.ab=c', 'ec_preview')).toBe('12.ab=c')
    expect(readCookie(null, 'x')).toBeNull()
    expect(readCookie('a=1', 'ec_preview')).toBeNull()
  })
})
