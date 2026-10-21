import type { BuildStore, StoredFile } from '../ports/BuildStore'

/** Archivos del build en el bucket privado de R2. */
export class R2BuildStore implements BuildStore {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string, conditions: Headers): Promise<StoredFile | null> {
    const object = await this.bucket.get(key, { onlyIf: conditions })
    if (!object) return null
    // R2 devuelve el objeto sin cuerpo cuando la condición (If-None-Match…) no se cumple
    return { httpEtag: object.httpEtag, body: 'body' in object ? object.body : null }
  }
}
