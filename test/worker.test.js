import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { headersFor, parsePath, readCookie, verifyPreviewToken, visitorId } from '../src/lib.js'

const ID = '965e94af-91ae-4d72-9fc3-3be57da6dbbd'
// Igual que la API (deploy.service.js#previewToken)
const sign = (secret, id, exp) => `${exp}.${createHmac('sha256', secret).update(`preview:${id}:${exp}`).digest('base64url')}`

test('headersFor: tipo interno y Content-Encoding de los .br', () => {
  assert.deepEqual(headersFor('Build/x.wasm.br'), { contentType: 'application/wasm', contentEncoding: 'br', cacheControl: 'public, max-age=31536000, immutable' })
  assert.equal(headersFor('Build/x.framework.js.gz').contentEncoding, 'gzip')
  assert.equal(headersFor('Build/x.data.unityweb').contentType, 'application/octet-stream')
  assert.equal(headersFor('index.html').cacheControl, 'no-cache')
})

test('parsePath: versión en línea, vista previa y rutas inválidas', () => {
  assert.deepEqual(parsePath('/'), { preview: null, file: 'index.html', needsSlash: false })
  assert.deepEqual(parsePath('/Build/x.wasm.br'), { preview: null, file: 'Build/x.wasm.br', needsSlash: false })
  assert.deepEqual(parsePath(`/v/${ID}/Build/a.js`), { preview: ID, file: 'Build/a.js', needsSlash: false })
  assert.equal(parsePath(`/v/${ID}`).needsSlash, true)
  assert.equal(parsePath('/v/no-uuid/x'), null)
  assert.equal(parsePath('/Build/../current.json'), null)
  assert.equal(parsePath('/%2e%2e/current.json'), null)
})

test('verifyPreviewToken: firma de la API, vencimiento y otra versión', async () => {
  const exp = Math.floor(Date.now() / 1000) + 60
  const token = sign('s3cret', ID, exp)
  assert.equal(await verifyPreviewToken('s3cret', ID, token), true)
  assert.equal(await verifyPreviewToken('otro', ID, token), false)
  assert.equal(await verifyPreviewToken('s3cret', ID.replace('9', '8'), token), false)
  assert.equal(await verifyPreviewToken('s3cret', ID, sign('s3cret', ID, exp - 120)), false)
  assert.equal(await verifyPreviewToken('s3cret', ID, 'basura'), false)
})

test('readCookie y visitorId', async () => {
  assert.equal(readCookie('a=1; ec_preview=12.ab=c', 'ec_preview'), '12.ab=c')
  assert.equal(readCookie(null, 'x'), null)
  const a = await visitorId('salt', '1.2.3.4')
  assert.equal(a.length, 32)
  assert.equal(a, await visitorId('salt', '1.2.3.4'))
  assert.notEqual(a, await visitorId('salt', '1.2.3.5'))
})
