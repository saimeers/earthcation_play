import type { HmacSigner, HmacVerifier } from '../domain/Hmac'

/** HMAC-SHA256: firmar (visitante anónimo) y verificar (token de vista previa). */
export interface Crypto extends HmacSigner, HmacVerifier {}
