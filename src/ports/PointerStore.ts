/** current.json: lo escribe la API al activar una versión desde el panel. */
export interface LivePointer {
  /** Carpeta de la versión en línea, p. ej. `builds/<id>/` */
  prefix?: string
  version_id?: unknown
}

export interface PointerStore {
  /** null si todavía no hay versión en línea. */
  current(): Promise<LivePointer | null>
}
