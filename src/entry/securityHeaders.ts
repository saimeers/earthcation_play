// Cabeceras de seguridad de todo lo que sirve el Worker. No lleva una CSP completa: el build de Unity WebGL usa scripts
// en línea, WebAssembly y llama a la API, y una política estricta lo rompería; solo se impide que otra página lo enmarque.
const BASE: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  // El juego pide pantalla completa; nada más de lo que el navegador ofrece
  'permissions-policy': 'fullscreen=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

const isHtml = (contentType: string): boolean => contentType.startsWith('text/html')

export function securityHeaders(contentType: string): Record<string, string> {
  return isHtml(contentType) ? { ...BASE, 'content-security-policy': "frame-ancestors 'self'" } : { ...BASE }
}
