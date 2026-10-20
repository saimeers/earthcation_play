# earthcation_play

Cloudflare Worker que sirve el juego WebGL de Earthcation en **play.earthcation.saimers.dev** desde un
bucket privado de R2. La API (`../earthcation_be`, `deploy.service.js`) publica cada versión en
`builds/<id>/` y, al activarla desde el panel (Versiones del juego), escribe `current.json`.

| Ruta | Qué sirve |
|---|---|
| `/…` | Versión en línea (`current.json`, releído cada 30 s por isolate). `/?sala=123` abre el juego con el código de la sala (QR). |
| `/v/<id>/…` | Vista previa de una versión, solo con el token `?t=` que emite la API (`GET /api/deploy/versions/:id/preview`); el token queda en la cookie `ec_preview` limitada a esa carpeta. |

- Headers por nombre de archivo (`src/domain/FileHeaders.ts`, igual que la API): `x.wasm.br` →
  `application/wasm` + `Content-Encoding: br` con `encodeBody: 'manual'`; todo inmutable un año salvo
  `index.html` (`no-cache`; `no-store` en vista previa). ETag de R2 → `304` con `If-None-Match`.
- Sin Cache API: cada versión vive en su propia carpeta con caché inmutable en el navegador, y leer de R2
  es barato. (Guardar en la caché respuestas con `encodeBody: 'manual'` no es fiable.)
- **Visitas**: al servir el `index.html` de la versión en línea (GET, no 304), `ctx.waitUntil` manda a
  `API_URL/api/visits/ingest` (header `x-ingest-secret`) país/región/ciudad/colo/coordenadas de
  `request.cf`, user-agent, versión y el código `?sala=`. También manda ASN y organización de red (la API
  descarta centros de datos como robots). El visitante va como `HMAC(VISIT_SALT, ip + user-agent)` (un
  salón comparte la IP del wifi); la IP no sale del Worker. Sin `VISITS_INGEST_SECRET` no se registra nada.

## Estructura

TypeScript estricto en arquitectura limpia, con la misma filosofía que la API: las dependencias apuntan
hacia adentro y cada caso de uso expone `execute`.

```
src/
  domain/          PlayPath (versión en línea vs /v/<id>/), PreviewToken (exp + HMAC, cookie), FileHeaders
                   (MIME, .br/.gz, caché), Visit (cuerpo que se reporta, visitante anónimo), errores
  ports/           BuildStore, PointerStore, VisitReporter, Crypto (HMAC), Clock
  usecases/        ServeLiveVersion, ServePreview, RecordVisit
  infrastructure/  R2BuildStore, CachedPointerStore (TTL 30 s por isolate), ApiVisitReporter, WebCryptoHmac,
                   SystemClock
  entry/           worker.ts (fetch: enruta y traduce a Response), container.ts (arma todo con `env`),
                   pages.ts (páginas de error), env.ts (bindings)
test/              vitest con fakes de los puertos, por capa, y de punta a punta del Worker (R2 y API falsos)
```

`domain` no importa nada; `ports` solo de `domain`; `usecases` de `domain` y `ports`; `infrastructure`
implementa los puertos; `entry` es el único que conoce `env`. ESLint (`no-restricted-imports`) lo vigila.

## Desplegar

Lo hace el CI al fusionar en `main`. A mano:

```
npx wrangler login
npx wrangler r2 bucket create earthcation-play
npx wrangler secret put PLAY_SIGNING_SECRET     # el mismo valor que en la API
npx wrangler secret put VISITS_INGEST_SECRET    # el mismo valor que en la API
npx wrangler secret put VISIT_SALT              # cualquier texto largo aleatorio
npm run deploy
```

Para rotar `PLAY_SIGNING_SECRET` sin cortar vistas previas abiertas: pasa el viejo a
`PLAY_SIGNING_SECRET_PREVIOUS`, pon el nuevo en el Worker y en la API.

La API necesita un token de R2 con permiso de escritura sobre el bucket (`R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=earthcation-play`).

## Probar

```
npm ci
npm run check                              # lint + tipos (tsc) + pruebas (vitest)
echo PLAY_SIGNING_SECRET=dev > .dev.vars
npx wrangler r2 object put earthcation-play/current.json --file current.json --local
npm run dev                                # R2 local en .wrangler/
```

Requiere Node 22.12 o superior. `.npmrc` usa `legacy-peer-deps` (npm falla resolviendo los peers
opcionales de vitest); por eso `vite` y `@cloudflare/workers-types` están declarados explícitamente.
