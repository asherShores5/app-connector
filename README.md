# App Connector

A home-screen launcher ("Apps") that lists my other web apps as an icon grid and opens any of
them in one tap. See `docs/specs/2026-10-30-v1.md` and `GLOSSARY.md`.

Status: walking skeleton (Tile grid; hosting stack synths, nothing deployed yet).

## Layout

npm workspaces: `web` (Vite + React) and `infra` (CDK: S3 + CloudFront). No backend.
`e2e/` is a separate Playwright screenshot harness, not a workspace.

## Develop

Node 22.

```sh
npm install
npm test            # vitest in web and infra
npm run typecheck   # tsc in web and infra
npm run build:web   # typecheck + vite build into web/dist
npm run synth       # builds web, then cdk synth into infra/cdk.out (no deploy)
npm run dev -w web  # local dev server
```

Screenshots (phone, desktop, light and dark) of the built app, served from disk with no network:

```sh
npm run build:web
cd e2e && npm install && npm run preview   # writes e2e/out/preview-*.png
```

## Adding an App

Copy its icon (a square PNG, 192px is plenty) into `web/public/icons/`, add an entry to
`web/src/tiles.ts` in grid order, and run `npm test` (it checks every icon file exists).

## Deploy notes

No AWS account IDs go in tracked files; the account comes from the deploying credentials. The
region defaults to us-west-1 (`-c region=...` to override). If your shell sets another
`AWS_REGION`, pin `AWS_REGION=us-west-1` for cdk diff/deploy.
