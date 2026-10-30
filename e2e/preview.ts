// Screenshots of the built web app (web/dist), served from disk. No network: requests to other
// origins are refused, so nothing touches a live App.
//   npm run build:web (repo root), then: cd e2e && npm install && npm run preview
// Writes e2e/out/preview-*.png (desktop light/dark, iPhone light/dark, plus the open Install hint
// on iPhone light/dark) and checks that every Tile icon loaded, every Tile opens in a new tab,
// and the Install hint opens from (i), closes with Escape, Close or a tap outside.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices, type BrowserContextOptions, type Locator, type Page } from "playwright";

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
    if (!file.startsWith(DIST) || !existsSync(file) || url.pathname === "/") file = path.join(DIST, "index.html");
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[path.extname(file)] ?? "application/octet-stream" });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${label}: ${e.message}`));
  await page.goto(ORIGIN);
  await page.locator("a.tile").first().waitFor();

  const names = await page.locator("a.tile span").allTextContents();
  if (names.join("|") !== "HoneyDo|NutriSageAI|Games Catalog|Exam Prep Lab") problems.push(`${label}: Tiles ${names.join(", ")}`);
  for (const a of await page.locator("a.tile").all()) {
    if ((await a.getAttribute("target")) !== "_blank") problems.push(`${label}: ${await a.textContent()} not a new tab`);
  }
  const broken = await page.locator("a.tile img").evaluateAll((imgs) =>
    (imgs as HTMLImageElement[]).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
  if (broken.length) problems.push(`${label}: icons not loaded ${broken.join(", ")}`);
  if (await page.locator("iframe, frame, embed, object").count()) problems.push(`${label}: embedded content`);

  await page.screenshot({ path: path.join(OUT, `preview-${label}.png`), fullPage: true });
  await page.locator("a.tile").first().focus();
  await page.screenshot({ path: path.join(OUT, `preview-${label}-focus.png`) });
  await checkInstallHint(page, label, Boolean(context.isMobile));
  await browser.close();
}

/** Install hint: (i) opens the right sheet without opening the App; Tile tap still opens it. */
async function checkInstallHint(page: Page, label: string, phone: boolean) {
  const fail = (m: string) => problems.push(`${label}: Install hint ${m}`);
  const sheet = page.locator("dialog.hint");
  const popups: string[] = [];
  // Other origins are refused, so a new tab lands on an error page; record what it asked for.
  page.context().on("request", (r) => {
    if (r.isNavigationRequest() && new URL(r.url()).origin !== ORIGIN) popups.push(r.url());
  });
  const tap = (l: Locator) => (phone ? l.tap() : l.click());
  const settle = () => page.waitForTimeout(150);

  const infos = page.locator("button.info");
  if ((await infos.count()) !== 4) fail(`buttons ${await infos.count()}`);

  // (i) on NutriSageAI opens its sheet, not the App.
  await tap(infos.nth(1));
  await settle();
  if (!(await sheet.isVisible())) return fail("did not open");
  if (popups.length) fail(`(i) also opened ${popups.join(", ")}`);
  if ((await sheet.locator("h2").textContent()) !== "NutriSageAI") fail(`title ${await sheet.locator("h2").textContent()}`);
  if (!(await sheet.textContent())?.includes("https://ashershores5.github.io/NutriSageAI/docs/")) fail("no address");
  if (!(await sheet.evaluate((d) => d.contains(document.activeElement)))) fail("focus not in sheet");
  if (phone) await page.screenshot({ path: path.join(OUT, `preview-${label}-hint.png`) });

  // Escape closes it and focus goes back to the (i) button.
  await page.keyboard.press("Escape");
  await settle();
  if (await sheet.count()) fail("still open after Escape");
  if (!(await infos.nth(1).evaluate((b) => b === document.activeElement))) fail("focus not back on (i) after Escape");

  // Keyboard: Enter on a focused (i) opens; the Close button closes.
  await infos.nth(2).focus();
  await page.keyboard.press("Enter");
  await settle();
  if ((await sheet.locator("h2").textContent()) !== "Games Catalog") fail("Enter on (i) did not open Games Catalog");
  await tap(sheet.getByRole("button", { name: "Close" }));
  await settle();
  if (await sheet.count()) fail("still open after Close");

  // A tap outside the sheet (top of the screen, on the backdrop) closes it.
  await tap(infos.nth(0));
  await settle();
  if (phone) {
    await page.touchscreen.tap(20, 20);
  } else {
    await page.mouse.click(10, 10);
  }
  await settle();
  if (await sheet.count()) fail("still open after tapping outside");

  // A tap inside the sheet, off any control, leaves it open.
  await tap(infos.nth(0));
  await settle();
  await tap(sheet.locator("p"));
  await settle();
  if (!(await sheet.isVisible())) fail("closed on a tap inside");
  await page.keyboard.press("Escape");
  await settle();

  // The Tile itself still opens its App.
  await tap(page.locator("a.tile").nth(3));
  await settle();
  if (!popups.some((u) => u.startsWith("https://exampreplab.com"))) fail(`Tile tap opened ${popups.join(", ") || "nothing"}`);
  if (await sheet.count()) fail("Tile tap opened the sheet");
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
