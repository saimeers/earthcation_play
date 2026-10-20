/** Bindings del Worker (wrangler.toml) y secretos (`wrangler secret put`). */
export interface Env {
  BUCKET: R2Bucket
  API_URL: string
  PLAY_SIGNING_SECRET?: string
  /** El secreto anterior mientras se rota, para no tumbar vistas previas abiertas */
  PLAY_SIGNING_SECRET_PREVIOUS?: string
  /** Sin él no se registran visitas */
  VISITS_INGEST_SECRET?: string
  VISIT_SALT?: string
}
