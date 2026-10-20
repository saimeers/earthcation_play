import { ApiVisitReporter } from '../infrastructure/ApiVisitReporter'
import { CachedPointerStore, type PointerCache } from '../infrastructure/CachedPointerStore'
import { R2BuildStore } from '../infrastructure/R2BuildStore'
import { SystemClock } from '../infrastructure/SystemClock'
import { WebCryptoHmac } from '../infrastructure/WebCryptoHmac'
import { RecordVisit } from '../usecases/RecordVisit'
import { ServeLiveVersion } from '../usecases/ServeLiveVersion'
import { ServePreview } from '../usecases/ServePreview'
import type { Env } from './env'

export interface Container {
  serveLiveVersion: ServeLiveVersion
  servePreview: ServePreview
  /** null cuando no hay VISITS_INGEST_SECRET: no se registran visitas */
  recordVisit: RecordVisit | null
}

/** Caché de current.json por isolate: vive en el módulo, no en cada petición. */
const pointerCache: PointerCache = { entry: null }

/** Arma los casos de uso con los adaptadores reales a partir de `env`. */
export function buildContainer(env: Env, cache: PointerCache = pointerCache): Container {
  const clock = new SystemClock()
  const crypto = new WebCryptoHmac()
  const builds = new R2BuildStore(env.BUCKET)
  const secrets = [env.PLAY_SIGNING_SECRET, env.PLAY_SIGNING_SECRET_PREVIOUS]
  return {
    serveLiveVersion: new ServeLiveVersion(new CachedPointerStore(env.BUCKET, clock, cache), builds),
    servePreview: new ServePreview(builds, crypto, clock, secrets),
    recordVisit: env.VISITS_INGEST_SECRET
      ? new RecordVisit(new ApiVisitReporter(env.API_URL, env.VISITS_INGEST_SECRET), crypto, env.VISIT_SALT)
      : null,
  }
}
