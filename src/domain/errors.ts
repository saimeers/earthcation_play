/** Errores del dominio; la entrada los traduce a páginas de error (ver entry/pages.ts). */
export abstract class PlayError extends Error {
  abstract readonly status: number
}

/** La ruta no existe o no es válida. */
export class RouteNotFoundError extends PlayError {
  readonly status = 404
}

/** El archivo no está en esa versión del juego. */
export class FileNotFoundError extends PlayError {
  readonly status = 404
}

/** Sin token válido de vista previa (ni en `?t=` ni en la cookie). */
export class PreviewExpiredError extends PlayError {
  readonly status = 403
}

/** current.json no existe o no tiene `prefix`: la API está cambiando de versión. */
export class LiveVersionUnavailableError extends PlayError {
  readonly status = 503
}
