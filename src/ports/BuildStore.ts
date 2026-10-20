/** Un archivo guardado del build: `body` null cuando la condición de la petición no se cumplió. */
export interface StoredFile {
  httpEtag: string
  body: ReadableStream | null
}

/** Archivos de las versiones publicadas (R2: `builds/<id>/…`). */
export interface BuildStore {
  /** null si no existe. `conditions` son los headers de la petición (If-None-Match, If-Modified-Since…). */
  get(key: string, conditions: Headers): Promise<StoredFile | null>
}
