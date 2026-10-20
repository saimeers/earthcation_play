/**
 * HMAC-SHA256 tal como lo necesita el dominio. Son tipos estructurales: el puerto `Crypto` los
 * extiende y la infraestructura (WebCrypto) los implementa, así el dominio no depende de nadie.
 */
export interface HmacVerifier {
  /** Comparación en tiempo constante de `signature` contra HMAC(secret, message). */
  verifyHmac(secret: string, message: string, signature: Uint8Array): Promise<boolean>
}

export interface HmacSigner {
  signHmac(secret: string, message: string): Promise<Uint8Array>
}
