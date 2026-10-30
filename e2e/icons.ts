// Renders App Connector's own icon (web/public/icon.svg) to the PNG sizes the manifest and iOS use:
// icon-180.png (Apple touch icon), icon-192.png and icon-512.png. Re-run after editing the SVG:
//   cd e2e && npm install && npm run icons
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "public");
const svg = readFileSync(path.join(PUBLIC, "icon.svg"), "utf8");

const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: path.join(PUBLIC, `icon-${size}.png`), omitBackground: false });
  await page.close();
}
await browser.close();
console.log(`Wrote icon-180/192/512.png in ${PUBLIC}`);
