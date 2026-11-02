// Screenshots of the built web app (web/dist), served from disk. No network: requests to other
// origins are refused, so nothing touches a live App.
//   npm run build:web (repo root), then: cd e2e && npm install && npm run preview
// Writes e2e/out/preview-*.png (desktop light/dark, iPhone light/dark) and checks the title, the
// Home link, that every Tile icon loaded, and that every Tile opens in a new tab.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type BrowserContextOptions } from "playwright";
import { TILES } from "../web/src/tiles";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "..", "web", "dist");
const OUT = path.join(HERE, "out");
const ORIGIN = "https://apps.test";
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json",
};

const problems: string[] = [];

async function shoot(context: BrowserContextOptions, label: string) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(context);
  await ctx.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST + path.sep) || !existsSync(file) || url.pathname === "/") file = path.join(DIST, "index.html");
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[path.extname(file)] ?? "application/octet-stream" });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${label}: ${e.message}`));
  await page.goto(ORIGIN);
  await page.locator("a.tile").first().waitFor();

  const names = await page.locator("a.tile span").allTextContents();
  if (names.join("|") !== TILES.map((t) => t.name).join("|")) problems.push(`${label}: Tiles ${names.join(", ")}`);
  for (const a of await page.locator("a.tile").all()) {
    if ((await a.getAttribute("target")) !== "_blank") problems.push(`${label}: ${await a.textContent()} not a new tab`);
  }
  const broken = await page.locator("a.tile img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
  if (broken.length) problems.push(`${label}: icons not loaded ${broken.join(", ")}`);
  if (await page.locator("iframe, frame, embed, object").count()) problems.push(`${label}: embedded content`);
  if ((await page.locator("h1").textContent()) !== "Asher's Apps") problems.push(`${label}: title`);
  const home = page.locator("a.home");
  if ((await home.getAttribute("href")) !== "https://ashershores.com") problems.push(`${label}: Home link`);
  if (await page.locator("button, dialog").count()) problems.push(`${label}: leftover buttons or sheets`);
  if (context.isMobile) {
    // Each Tile should take roughly 1/8 of the phone screen: two per row, icons at least 110px.
    const vp = page.viewportSize()!;
    const boxes = await page.locator("a.tile img").evaluateAll((imgs) => imgs.map((i) => i.getBoundingClientRect().width));
    if (boxes.some((w) => w < 110)) problems.push(`${label}: icons too small ${boxes.join(",")}`);
    const tops = await page.locator(".tiles li").evaluateAll((lis) => lis.map((l) => Math.round(l.getBoundingClientRect().top)));
    if (tops[0] !== tops[1] || tops[1] === tops[2]) problems.push(`${label}: not two per row (${tops.join(",")}, ${vp.width}px)`);
  }

  await page.screenshot({ path: path.join(OUT, `preview-${label}.png`), fullPage: true });
  await page.locator("a.tile").first().focus();
  await page.screenshot({ path: path.join(OUT, `preview-${label}-focus.png`) });
  await browser.close();
}

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("No web/dist: run `npm run build:web` from the repo root first.");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
await shoot({ viewport: { width: 1100, height: 700 }, colorScheme: "light" }, "desktop-light");
await shoot({ viewport: { width: 1100, height: 700 }, colorScheme: "dark" }, "desktop-dark");
await shoot({ ...devices["iPhone 13"], colorScheme: "light" }, "iphone-light");
await shoot({ ...devices["iPhone 13"], colorScheme: "dark" }, "iphone-dark");
console.log(`Screenshots in ${OUT}`);
if (problems.length) {
  console.error(`Problems:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
