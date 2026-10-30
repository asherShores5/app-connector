// What iOS and Chrome read when App Connector is added to the home screen: the web manifest,
// the Apple tags in index.html, and the icon files they point at.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const web = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const publicFile = (src: string) => web(`public${src}`);
const manifest = JSON.parse(readFileSync(publicFile("/manifest.webmanifest"), "utf8"));
const html = readFileSync(web("index.html"), "utf8");

/** Width x height from a PNG's IHDR chunk. */
function pngSize(path: string): string {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

describe("web manifest", () => {
  it("installs as 'Apps' (full name App Connector) and opens standalone at the root", () => {
    expect(manifest).toMatchObject({ name: "App Connector", short_name: "Apps", display: "standalone", start_url: "/", scope: "/" });
  });

  it("has its own 192 and 512 PNG icons at their stated sizes, plus an SVG", () => {
    const icons: { src: string; sizes: string; type: string }[] = manifest.icons;
    const bySize = Object.fromEntries(icons.map((i) => [i.sizes, i]));
    expect(bySize["192x192"].type).toBe("image/png");
    expect(bySize["512x512"].type).toBe("image/png");
    expect(bySize["any"].type).toBe("image/svg+xml");
    for (const i of icons) {
      expect(existsSync(publicFile(i.src)), i.src).toBe(true);
      if (i.type === "image/png") expect(pngSize(publicFile(i.src))).toBe(i.sizes);
    }
    expect(readFileSync(publicFile(bySize["any"].src), "utf8")).toMatch(/^<svg[^>]*viewBox="0 0 512 512"/);
  });
});

describe("index.html", () => {
  it("links the manifest and a 180px Apple touch icon, and names the home-screen icon 'Apps'", () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Apps" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)" \/>/);
    expect(touch).not.toBeNull();
    expect(pngSize(publicFile(touch![1]))).toBe("180x180");
    expect(html).toMatch(/<link rel="icon" href="\/icon\.svg" type="image\/svg\+xml" \/>/);
  });
});
