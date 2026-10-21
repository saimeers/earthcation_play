import { describe, expect, test } from 'vitest'
import { FileNotFoundError, PreviewExpiredError, RouteNotFoundError } from '../../src/domain/errors'
import { PlayPath } from '../../src/domain/PlayPath'
import { WebCryptoHmac } from '../../src/infrastructure/WebCryptoHmac'
import { ServePreview } from '../../src/usecases/ServePreview'
import { body, FakeBuildStore, FakeClock, ID, sign } from '../support/fakes'

const clock = new FakeClock()
const exp = Math.floor(clock.ms / 1000) + 3600
const path = (file = '') => PlayPath.parse(`/v/${ID}/${file}`) as PlayPath
const builds = () => new FakeBuildStore({
  [`builds/${ID}/index.html`]: { httpEtag: '"i"', body: body() },
  [`builds/${ID}/Build/a.js`]: { httpEtag: '"a"', body: body() },
})
const useCase = (store = builds(), secrets: (string | undefined)[] = ['s3cret', undefined]) =>
  new ServePreview(store, new WebCryptoHmac(), clock, secrets)
const run = (cmd: { file?: string; queryToken?: string | null; cookieHeader?: string | null }, uc = useCase()) =>
  uc.execute({ path: path(cmd.file), queryToken: cmd.queryToken ?? null, cookieHeader: cmd.cookieHeader ?? null, conditions: new Headers() })

describe('ServePreview', () => {
  test('token válido en ?t=: sirve builds/<id>/ y deja la cookie de la carpeta', async () => {
    const token = await sign('s3cret', ID, exp)
    const served = await run({ queryToken: token })
    expect(served).toMatchObject({ file: 'index.html', preview: true, etag: '"i"' })
    expect(served.setCookie).toBe(`ec_preview=${token}; Path=/v/${ID}/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax`)
    expect(served.headers.cacheControl).toBe('no-store')
  })

  test('con la cookie sirve los archivos del build, sin volver a dejarla y con caché inmutable', async () => {
    const token = await sign('s3cret', ID, exp)
    const served = await run({ file: 'Build/a.js', cookieHeader: `x=1; ec_preview=${token}` })
    expect(served.setCookie).toBeNull()
    expect(served.headers.cacheControl).toBe('public, max-age=31536000, immutable')
  })

  test('?t= inválido pero cookie válida: sirve sin dejar cookie nueva', async () => {
    const token = await sign('s3cret', ID, exp)
    const served = await run({ queryToken: await sign('otro', ID, exp), cookieHeader: `ec_preview=${token}` })
    expect(served.setCookie).toBeNull()
  })

  test('secreto anterior durante la rotación', async () => {
    const token = await sign('viejo', ID, exp)
    expect((await run({ queryToken: token }, useCase(builds(), ['nuevo', 'viejo']))).setCookie).toContain(token)
  })

  test('sin token, vencido o de otra versión: 403 sin leer el bucket', async () => {
    const store = builds()
    const other = '00000000-0000-4000-8000-000000000000'
    for (const cmd of [{}, { queryToken: await sign('s3cret', ID, exp - 7200) }, { cookieHeader: `ec_preview=${await sign('s3cret', other, exp)}` }]) {
      await expect(run(cmd, useCase(store))).rejects.toBeInstanceOf(PreviewExpiredError)
    }
    expect(store.requested).toEqual([])
  })

  test('archivo que no existe en la versión', async () => {
    await expect(run({ file: 'nada.js', queryToken: await sign('s3cret', ID, exp) })).rejects.toBeInstanceOf(FileNotFoundError)
  })

  test('una ruta de la versión en línea no es vista previa', async () => {
    await expect(useCase().execute({ path: PlayPath.parse('/') as PlayPath, queryToken: null, cookieHeader: null, conditions: new Headers() }))
      .rejects.toBeInstanceOf(RouteNotFoundError)
  })
})
