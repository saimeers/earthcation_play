import { FileNotFoundError } from '../domain/errors'
import { headersFor } from '../domain/FileHeaders'
import type { ServedFile } from '../domain/ServedFile'
import type { BuildStore } from '../ports/BuildStore'

/** Lee `prefix + file` del almacén; FileNotFoundError si esa versión no lo tiene. */
export async function readBuildFile(builds: BuildStore, prefix: string, file: string, conditions: Headers): Promise<ServedFile> {
  const stored = await builds.get(prefix + file, conditions)
  if (!stored) throw new FileNotFoundError()
  return { file, headers: headersFor(file), etag: stored.httpEtag, body: stored.body, preview: false, setCookie: null }
}
