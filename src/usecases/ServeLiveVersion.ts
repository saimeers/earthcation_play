import { LiveVersionUnavailableError } from '../domain/errors'
import type { PlayPath } from '../domain/PlayPath'
import type { ServedFile } from '../domain/ServedFile'
import type { BuildStore } from '../ports/BuildStore'
import type { PointerStore } from '../ports/PointerStore'
import { readBuildFile } from './readBuildFile'

export interface ServeLiveVersionCommand {
  path: PlayPath
  conditions: Headers
}

/** Sirve un archivo de la versión en línea: la carpeta a la que apunta current.json. */
export class ServeLiveVersion {
  constructor(
    private readonly pointers: PointerStore,
    private readonly builds: BuildStore,
  ) {}

  async execute({ path, conditions }: ServeLiveVersionCommand): Promise<ServedFile> {
    const current = await this.pointers.current()
    if (!current?.prefix) throw new LiveVersionUnavailableError()
    const served = await readBuildFile(this.builds, current.prefix, path.file, conditions)
    return { ...served, versionId: current.version_id }
  }
}
