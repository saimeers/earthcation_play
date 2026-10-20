import { describe, expect, test } from 'vitest'
import { PlayPath } from '../../src/domain/PlayPath'
import { ID } from '../support/fakes'

const fields = (path: PlayPath | null) => path && { preview: path.preview, file: path.file, needsSlash: path.needsSlash }

describe('PlayPath', () => {
  test('versión en línea, vista previa y rutas inválidas (portada de parsePath)', () => {
    expect(fields(PlayPath.parse('/'))).toEqual({ preview: null, file: 'index.html', needsSlash: false })
    expect(fields(PlayPath.parse('/Build/x.wasm.br'))).toEqual({ preview: null, file: 'Build/x.wasm.br', needsSlash: false })
    expect(fields(PlayPath.parse(`/v/${ID}/Build/a.js`))).toEqual({ preview: ID, file: 'Build/a.js', needsSlash: false })
    expect(PlayPath.parse(`/v/${ID}`)?.needsSlash).toBe(true)
    expect(PlayPath.parse('/v/no-uuid/x')).toBeNull()
    expect(PlayPath.parse('/Build/../current.json')).toBeNull()
    expect(PlayPath.parse('/%2e%2e/current.json')).toBeNull()
  })

  test('las carpetas terminan en index.html y el id de la versión va en minúsculas', () => {
    expect(fields(PlayPath.parse(`/v/${ID.toUpperCase()}/`))).toEqual({ preview: ID, file: 'index.html', needsSlash: false })
    expect(PlayPath.parse('/TemplateData/')?.file).toBe('TemplateData/index.html')
    expect(PlayPath.parse('/')?.isIndex).toBe(true)
    expect(PlayPath.parse('/Build/a.js')?.isIndex).toBe(false)
  })

  test('rechaza codificación rota, barras invertidas, "." y /v sin id', () => {
    expect(PlayPath.parse('/%E0%A4%A')).toBeNull()
    expect(PlayPath.parse('/Build/a%5Cb.js')).toBeNull()
    expect(PlayPath.parse('/./index.html')).toBeNull()
    expect(PlayPath.parse('/v')).toBeNull()
  })
})
