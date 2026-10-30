// Real-browser check of the service worker (ticket 03), against the built web app (web/dist).
//   npm run build:web (repo root), then: cd e2e && npm install && npm run offline
// Serves dist from a throwaway HTTP server on 127.0.0.1 (a secure context, so the worker really
// registers) with the same CSP as CloudFront, and checks:
//   1. after one online load, an offline reload still shows every Tile and its icon;
//   2. a new build replaces the cached shell on the next launch (no stale shell forever).
// "Offline" is both the browser's offline flag and the server dropping every connection.
import { existsSync, readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type BrowserContext, type Page } from "playwright";
// The policy CloudFront sends, so a CSP the worker breaks fails here too.
import { CONTENT_SECURITY_POLICY as CSP } from "../infra/lib/csp";
import { TILES as TILE_LIST } from "../web/src/tiles";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "..", "web", "dist");
const TILES = TILE_LIST.map((t) => t.name).join("|");
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json",
};

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("No web/dist: run `npm run build:web` from the repo root first.");
  process.exit(2);
}

let down = false;
/** Rewrites a served file, to stand in for the next deploy. */
let nextBuild: ((name: string, body: Buffer) => Buffer) | undefined;

const server = createServer((req, res: ServerResponse) => {
  if (down) return req.socket.destroy();
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let file = path.join(DIST, pathname);
  if (!file.startsWith(DIST + path.sep) || !existsSync(file) || pathname === "/") file = path.join(DIST, "index.html");
  let body = readFileSync(file);
  if (nextBuild) body = nextBuild(path.relative(DIST, file), body);
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache", // what the deploy sets on every object
    "content-security-policy": CSP,
  });
  res.end(body);
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const problems: string[] = [];
const results: string[] = [];

async function setOffline(ctx: BrowserContext, offline: boolean) {
  down = offline;
  await ctx.setOffline(offline);
}

/** Every Tile, in order, with every icon decoded. */
async function tilesShown(page: Page, label: string) {
  await page.locator("a.tile").first().waitFor({ timeout: 5000 });
  const names = (await page.locator("a.tile span").allTextContents()).join("|");
  if (names !== TILES) problems.push(`${label}: Tiles ${names}`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 });
  const broken = await page.locator("a.tile img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).filter((i) => i.naturalWidth === 0).map((i) => i.src));
  if (broken.length) problems.push(`${label}: icons not loaded ${broken.join(", ")}`);
  const count = await page.locator("a.tile img").count();
  if (count !== TILE_LIST.length) problems.push(`${label}: ${count} icons`);
}

/** Opens App Connector like a launch from the home screen and waits for the worker to control it. */
async function launch(ctx: BrowserContext, label: string): Promise<Page> {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${label}: ${e.message}`));
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(`${label}: ${m.text()}`);
  });
  await page.goto(ORIGIN);
  return page;
}

/** Polls an async check (waitForFunction would treat a returned Promise as truthy). */
async function until(check: () => Promise<boolean>, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 200))) {
    if (await check()) return true;
  }
  return check();
}

const shellCaches = (page: Page) =>
  page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("apps-shell-")));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], colorScheme: "light" });

  // 1. One online load, then offline reload and offline cold launch.
  const first = await launch(ctx, "online");
  await tilesShown(first, "online");
  await first.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 5000 })
    .catch(() => { throw new Error("online: no service worker took control"); });
  const [cacheA] = await shellCaches(first);
  if (!cacheA) throw new Error("online: no shell cache after first load");
  const precached = await first.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname), cacheA ?? "");
  for (const p of ["/index.html", "/manifest.webmanifest", "/icon-180.png", ...TILE_LIST.map((t) => t.icon)]) {
    if (!precached.includes(p)) problems.push(`online: ${p} not precached`);
  }

  await setOffline(ctx, true);
  await first.reload();
  await tilesShown(first, "offline reload");
  await first.close();
  const cold = await launch(ctx, "offline launch");
  await tilesShown(cold, "offline launch");
  await cold.close();
  results.push(`offline: reload and cold launch show all ${TILE_LIST.length} Tiles and icons (${precached.length} files precached)`);

  // 2. Next deploy: index.html and the worker's baked-in build version both change.
  await setOffline(ctx, false);
  const versionA = cacheA.replace("apps-shell-", "");
  nextBuild = (name, body) => {
    if (name === "index.html") return Buffer.from(body.toString().replace("<head>", '<head>\n    <meta name="build" content="next" />'));
    if (name === "sw.js") return Buffer.from(body.toString().split(versionA).join(`${versionA}next`));
    return body;
  };
  const relaunch = await launch(ctx, "relaunch after deploy");
  await tilesShown(relaunch, "relaunch after deploy");
  const want = `apps-shell-${versionA}next`;
  if (!(await until(async () => (await shellCaches(relaunch)).join() === want, 10000))) {
    problems.push(`deploy: shell caches after relaunch ${(await shellCaches(relaunch)).join(", ")}, want only ${want}`);
  }
  await relaunch.close();

  await setOffline(ctx, true);
  const afterDeploy = await launch(ctx, "offline after deploy");
  await tilesShown(afterDeploy, "offline after deploy");
  const build = await afterDeploy.locator('meta[name="build"]').getAttribute("content").catch(() => null);
  if (build !== "next") problems.push("deploy: offline launch still shows the old shell");
  const left = await shellCaches(afterDeploy);
  if (left.join() !== want) problems.push(`deploy: shell caches ${left.join(", ")}`);
  results.push("deploy: next launch installs the new build, old shell cache deleted, offline shows new shell");
  await ctx.close();
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}

if (problems.length) {
  console.error(`Problems:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(results.map((r) => `ok  ${r}`).join("\n"));
