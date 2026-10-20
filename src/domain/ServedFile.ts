import type { FileHeaders } from './FileHeaders'

/** Archivo del build listo para responder; `body` null = la condición (If-None-Match…) no se cumplió → 304. */
export interface ServedFile {
  file: string
  headers: FileHeaders
  etag: string
  body: ReadableStream | null
  /** Solo en vista previa */
  preview: boolean
  /** Cookie de vista previa a dejar (cuando el token llegó por `?t=`) */
  setCookie: string | null
  /** Versión en línea servida (current.json#version_id), para registrar la visita */
  versionId?: unknown
}
