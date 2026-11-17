# ATS V2 frontend

The Bosch frontend in `web/` is the single maintained application.

Main URL: https://phucphamdinh18.github.io/ats-v2-frontend/

`/preview/`, `/next/`, `qa.html` and `responsive-check.html` are compatibility redirects to the main application. Their former frontend bundles are no longer published. Legacy approval links preserve the approval route, query parameters and OAuth fragments.

Development: `npm ci --prefix web`, then `npm --prefix web run dev`.
Checks: `node --test tests/*.test.cjs`, `npm --prefix web test`, `npm --prefix web run typecheck`, `npm --prefix web run build`.
Publishing: manually run **Publish ATS Pages** from `main`. Pull requests validate only and cannot publish. There are no selectable legacy release modes.

Release and rollback details: [docs/single-frontend-release.md](docs/single-frontend-release.md).
