import type { Crypto } from '../ports/Crypto'

const encoder = new TextEncoder()
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' }

/** HMAC-SHA256 con WebCrypto (`crypto.subtle`); `verify` compara en tiempo constante. */
export class WebCryptoHmac implements Crypto {
  async signHmac(secret: string, message: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), ALGORITHM, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
  }

  async verifyHmac(secret: string, message: string, signature: Uint8Array): Promise<boolean> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), ALGORITHM, false, ['verify'])
    return crypto.subtle.verify('HMAC', key, signature, encoder.encode(message))
  }
}
