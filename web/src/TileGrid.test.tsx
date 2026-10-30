import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TileGrid } from "./TileGrid";

const tiles = [
  { name: "First App", url: "https://first.example", icon: "/icons/first.png" },
  { name: "Second & Co", url: "https://second.example/path/", icon: "/icons/second.png" },
];

const links = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map(([, attrs, body]) => {
    const attr = (k: string) => attrs.match(new RegExp(`\\b${k}="([^"]*)"`))?.[1];
    return { href: attr("href"), target: attr("target"), rel: attr("rel"), body };
  });

describe("TileGrid", () => {
  it("renders one link per Tile, in order, to that App's address", () => {
    const html = renderToStaticMarkup(<TileGrid tiles={tiles} />);
    expect(links(html).map((l) => l.href)).toEqual(["https://first.example", "https://second.example/path/"]);
  });

  it("opens each App in a new tab without giving it a handle back to App Connector", () => {
    for (const l of links(renderToStaticMarkup(<TileGrid tiles={tiles} />))) {
      expect(l.target).toBe("_blank");
      expect(l.rel?.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    }
  });

  it("shows each Tile's icon and its name below it", () => {
    const [first, second] = links(renderToStaticMarkup(<TileGrid tiles={tiles} />));
    expect(first.body).toMatch(/<img[^>]*src="\/icons\/first.png"[^>]*>.*First App/);
    expect(second.body).toMatch(/<img[^>]*src="\/icons\/second.png"[^>]*>.*Second &amp; Co/);
  });

  it("never frames or embeds an App", () => {
    expect(renderToStaticMarkup(<TileGrid tiles={tiles} />)).not.toMatch(/<(iframe|frame|embed|object)\b/);
  });

  it("gives every Tile an (i) button, outside its link, that names the App", () => {
    const html = renderToStaticMarkup(<TileGrid tiles={tiles} />);
    for (const l of links(html)) expect(l.body).not.toMatch(/<button\b/);
    const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(([, a]) => a);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toMatch(/type="button"/);
    expect(buttons[0]).toMatch(/aria-label="How to install First App"/);
    expect(buttons[1]).toMatch(/aria-label="How to install Second &amp; Co"/);
  });
});
