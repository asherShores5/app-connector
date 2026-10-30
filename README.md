# App Connector

A home-screen launcher ("Apps") that lists my other web apps as an icon grid and opens any of
them in one tap. See `docs/specs/2026-10-30-v1.md` and `GLOSSARY.md`.

Status: v1 in progress. Hosting and deploy CI are built; nothing deployed yet (see
`docs/first-deploy.md`).

## Layout

npm workspaces: `web` (Vite + React) and `infra` (CDK: S3 + CloudFront + ACM + Route 53, plus
the GitHub deploy role). No backend.
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

## Deploy

Served at https://apps.ashershores.com (us-west-1; certificate in us-east-1). After the one-time
setup in `docs/first-deploy.md`, a push to `prod` deploys through GitHub Actions (OIDC, no
stored keys); pushes to `main` and PRs run tests, typecheck and synth only.

No AWS account or zone IDs go in tracked files: they come from env vars / CDK context locally
and from a GitHub secret (`AWS_ACCOUNT_ID`) and variables (`HOSTED_ZONE_ID`, `HOSTED_ZONE_NAME`)
in CI. Without a zone set, `npm run synth` builds only the web stack. If your shell sets another
`AWS_REGION`, pin `AWS_REGION=us-west-1` for cdk diff/deploy.

## Cost

Expected: about $0.01 a month, effectively free. A static site for two people: S3 storage of a
few hundred KB, CloudFront traffic far inside its always-free tier, free ACM certificate, free
alias queries to CloudFront, and a few seconds of Lambda per deploy (CDK's bucket-deployment
helper). The Route 53 hosted zone ($0.50/month) is shared with HoneyDo and not counted here.
Everything is tagged `app=app-connector`; a $1/month budget on that tag emails at 80% actual
and 100% forecast.
