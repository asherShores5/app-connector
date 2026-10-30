## Agent skills (this repo overrides /workplace/shoresaj/CLAUDE.md)

Personal project in a public repo. Don't use Taskei, builder-mcp or any Amazon tool here,
and never put Amazon-internal content in files or commits. Keep AWS account IDs out of
tracked files.

### Issue tracker

Local files. One ticket per file in `.scratch/<milestone>/issues/NN-<slug>.md` (gitignored),
numbered in dependency order. Blocking edges go in each file's "Blocked by" line. Close a ticket
by setting its `Status:` line to `done`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`) go in each ticket's `Status:` line.

### Domain docs

Single context: `GLOSSARY.md` and `docs/adr/` at the repo root. Specs live in `docs/specs/`,
mirrored on the Notion To Do card "Make home screen app to link to all my other apps all as PWAs".

## Working rules

- Commit locally; push only when Asher says so. Once deploy CI exists, pushes to `prod` deploy.
- Commit as `asher.shores5@gmail.com` (set in this repo's git config).
- Live AWS changes (deploys, deleting data or DNS records) need Asher's explicit go each time.
- Stack mirrors `../games-catalog` without its backend (TS workspaces web/infra, CDK, S3 +
  CloudFront PWA). Reuse its patterns before inventing new ones.
- Pin `AWS_REGION=us-west-1` for cdk diff/deploy (the dev desktop defaults to us-west-2).
