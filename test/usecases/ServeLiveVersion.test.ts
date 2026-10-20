import { describe, expect, test } from 'vitest'
import { FileNotFoundError, LiveVersionUnavailableError } from '../../src/domain/errors'
import { PlayPath } from '../../src/domain/PlayPath'
import { ServeLiveVersion } from '../../src/usecases/ServeLiveVersion'
import { body, FakeBuildStore, FakePointerStore } from '../support/fakes'

const path = (p: string) => PlayPath.parse(p) as PlayPath
const conditions = new Headers()

describe('ServeLiveVersion', () => {
  test('sirve el archivo de la carpeta a la que apunta current.json', async () => {
    const builds = new FakeBuildStore({ 'builds/a/Build/x.wasm.br': { httpEtag: '"e"', body: body() } })
    const served = await new ServeLiveVersion(new FakePointerStore({ prefix: 'builds/a/', version_id: 'a' }), builds)
      .execute({ path: path('/Build/x.wasm.br'), conditions })
    expect(served).toMatchObject({ file: 'Build/x.wasm.br', etag: '"e"', preview: false, setCookie: null, versionId: 'a' })
    expect(served.headers).toEqual({ contentType: 'application/wasm', contentEncoding: 'br', cacheControl: 'public, max-age=31536000, immutable' })
  })

  test('index.html de la versión en línea con no-cache', async () => {
    const builds = new FakeBuildStore({ 'builds/a/index.html': { httpEtag: '"i"', body: body() } })
    const served = await new ServeLiveVersion(new FakePointerStore({ prefix: 'builds/a/' }), builds).execute({ path: path('/'), conditions })
    expect(served.headers.cacheControl).toBe('no-cache')
  })

  test('sin current.json o sin prefix: se está actualizando (sin tocar el bucket)', async () => {
    const builds = new FakeBuildStore()
    for (const pointer of [null, {}, { prefix: '' }]) {
      await expect(new ServeLiveVersion(new FakePointerStore(pointer), builds).execute({ path: path('/'), conditions }))
        .rejects.toBeInstanceOf(LiveVersionUnavailableError)
    }
    expect(builds.requested).toEqual([])
  })

  test('archivo que no está en la versión', async () => {
    await expect(new ServeLiveVersion(new FakePointerStore({ prefix: 'builds/a/' }), new FakeBuildStore()).execute({ path: path('/x.js'), conditions }))
      .rejects.toBeInstanceOf(FileNotFoundError)
  })
})
