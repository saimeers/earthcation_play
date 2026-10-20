# Cómo trabajar en Worker (earthcation_play)

## Git flow

| Rama | Para qué | Sale de | Vuelve a |
|---|---|---|---|
| `main` | Producción. Solo recibe merges de `release/*` y `hotfix/*` | — | — |
| `develop` | Integración de lo que va en la próxima versión | `main` | — |
| `feature/<tema>` | Un cambio (funcionalidad, refactor, docs) | `develop` | `develop` por PR |
| `release/vX.Y.Z` | Estabilizar una versión (solo correcciones) | `develop` | `main` y `develop`, con tag `vX.Y.Z` |
| `hotfix/<tema>` | Arreglo urgente en producción | `main` | `main` y `develop`, con tag de parche |

- Todo entra por **pull request** con el CI en verde; no se hace push directo a `main` ni a `develop`.
- Las versiones siguen **SemVer**: mayor = cambio incompatible de contrato, menor = funcionalidad, parche = corrección.

## Commits

Conventional Commits en **una línea**, en español, sin coautoría:

```
feat: QR de la sala en el informe
fix: el jugador ya no puede cambiar su propio rol
refactor: casos de uso de sesiones como funciones puras
docs | test | chore | ci | perf: ...
```

## Código

- TypeScript estricto en arquitectura limpia (ver la sección Estructura del README): `domain` → `ports` →
  `usecases` → `infrastructure` → `entry`, con las dependencias siempre hacia adentro. Una regla nueva va
  al dominio o a un caso de uso (clase con `execute`), no a `entry/worker.ts`; algo de Cloudflare o de la
  API va detrás de un puerto en `infrastructure`.
- Cada cambio trae su prueba en `test/` (vitest, con fakes de los puertos en `test/support/fakes.ts`).
- Dependencias con versión exacta y con al menos dos semanas de publicadas.
- `npm run check` (lint + tipos + pruebas) debe pasar: es lo mismo que corre el CI.

## Antes de abrir el PR
- Describir qué cambia, cómo se probó y si toca el contrato de la API o los datos.
- Nada de secretos ni datos personales en el código, los commits o los PR (el CI corre gitleaks).
