import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstallHint } from "./InstallHint";

const tile = { name: "Second & Co", url: "https://second.example/path/", icon: "/icons/second.png" };
const render = () => renderToStaticMarkup(<InstallHint tile={tile} onClose={() => {}} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("InstallHint", () => {
  it("is a dialog titled with the App's name", () => {
    const html = render();
    const id = html.match(/<dialog\b[^>]*aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(new RegExp(`<h2[^>]*id="${id}"[^>]*>Second &amp; Co</h2>`));
  });

  it("shows the App's address as a link that opens it in a new tab", () => {
    const html = render();
    expect(text(html)).toContain("https://second.example/path/");
    expect(html).toMatch(/<a\b[^>]*href="https:\/\/second.example\/path\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });

  it("gives the Share > Add to Home Screen steps, starting from opening the App in Safari", () => {
    const steps = [...render().matchAll(/<li>(.*?)<\/li>/g)].map(([, s]) => text(s).trim());
    expect(steps).toHaveLength(3);
    // Tapped from the installed Apps, iOS opens the link in a sheet inside Apps, which may lack
    // Add to Home Screen, so step 1 also says how to get from that sheet to Safari.
    expect(steps[0]).toMatch(/^Tap the address above\./);
    expect(steps[0]).toMatch(/If it opens inside Apps, tap the compass button to open it in Safari\./);
    expect(steps[1]).toMatch(/Share/);
    expect(steps[2]).toMatch(/Add to Home Screen/);
  });

  it("has a close button", () => {
    expect(render()).toMatch(/<button[^>]*type="button"[^>]*>Close<\/button>/);
  });
});
