import { describe, expect, test } from 'vitest'
import { securityHeaders } from '../../src/entry/securityHeaders'

describe('securityHeaders', () => {
  test('todo archivo lleva nosniff, referrer, HSTS y permisos acotados con pantalla completa', () => {
    expect(securityHeaders('application/wasm')).toEqual({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'permissions-policy': 'fullscreen=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    })
  })

  test('el HTML además impide que otra página lo enmarque', () => {
    expect(securityHeaders('text/html; charset=utf-8')['content-security-policy']).toBe("frame-ancestors 'self'")
    expect(securityHeaders('application/javascript')['content-security-policy']).toBeUndefined()
  })
})
