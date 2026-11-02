import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App, HOME_URL } from "./App";

const html = () => renderToStaticMarkup(<App tiles={[{ name: "One", url: "https://one.example", icon: "/icons/one.png" }]} />);

describe("App", () => {
  it("is titled Asher's Apps", () => {
    expect(html()).toMatch(/<h1[^>]*>Asher(&#x27;|')s Apps<\/h1>/);
  });

  it("has a Home link to ashershores.com above the Tiles, styled apart from them", () => {
    expect(HOME_URL).toBe("https://ashershores.com");
    const out = html();
    const home = out.match(/<a\b[^>]*class="home"[^>]*>/)?.[0];
    expect(home).toMatch(/href="https:\/\/ashershores.com"/);
    expect(home).not.toMatch(/class="tile"/);
    expect(out.indexOf('class="home"')).toBeLessThan(out.indexOf('class="tiles"'));
  });

  it("names the Home link for screen readers", () => {
    expect(html()).toMatch(/<a\b[^>]*class="home"[^>]*>[\s\S]*ashershores\.com[\s\S]*<\/a>/);
  });
});
