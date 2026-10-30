import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TILES } from "./tiles";

const PUBLIC = fileURLToPath(new URL("../public", import.meta.url));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Tiles", () => {
  it("lists the four Apps in spec order, HoneyDo first", () => {
    expect(TILES.map(({ name, url }) => ({ name, url }))).toEqual([
      { name: "HoneyDo", url: "https://honeydo.ashershores.com" },
      { name: "NutriSageAI", url: "https://ashershores5.github.io/NutriSageAI/docs/" },
      { name: "Games Catalog", url: "https://games.ashershores.com" },
      { name: "Exam Prep Lab", url: "https://exampreplab.com" },
    ]);
  });

  it("every icon is a committed PNG in web/public, not a link to the App", () => {
    for (const tile of TILES) {
      expect(tile.icon, tile.name).toMatch(/^\/icons\/[a-z0-9-]+\.png$/);
      const file = path.join(PUBLIC, tile.icon);
      expect(existsSync(file), `${tile.name}: ${file}`).toBe(true);
      expect(readFileSync(file).subarray(0, 8).equals(PNG), `${tile.name} icon is a PNG`).toBe(true);
    }
  });

  it("every App address is https", () => {
    for (const tile of TILES) expect(new URL(tile.url).protocol, tile.name).toBe("https:");
  });
});
