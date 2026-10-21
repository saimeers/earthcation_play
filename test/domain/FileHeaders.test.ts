import { describe, expect, test } from 'vitest'
import { headersFor } from '../../src/domain/FileHeaders'

describe('headersFor', () => {
  test('tipo interno y Content-Encoding de los .br (portada)', () => {
    expect(headersFor('Build/x.wasm.br')).toEqual({ contentType: 'application/wasm', contentEncoding: 'br', cacheControl: 'public, max-age=31536000, immutable' })
    expect(headersFor('Build/x.framework.js.gz').contentEncoding).toBe('gzip')
    expect(headersFor('Build/x.data.unityweb').contentType).toBe('application/octet-stream')
    expect(headersFor('index.html').cacheControl).toBe('no-cache')
  })

  test('MIME sin compresión, mayúsculas y archivos sin extensión', () => {
    expect(headersFor('TemplateData/style.css')).toEqual({ contentType: 'text/css', contentEncoding: undefined, cacheControl: 'public, max-age=31536000, immutable' })
    expect(headersFor('Build/LOGO.PNG').contentType).toBe('image/png')
    expect(headersFor('Build.d/README').contentType).toBe('application/octet-stream')
    expect(headersFor('sub/index.html').cacheControl).toBe('public, max-age=31536000, immutable')
  })
})
