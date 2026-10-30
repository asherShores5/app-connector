/**
 * The Tiles, in grid order (HoneyDo top left). Icons are committed copies, never live links.
 * Adding an App means: an entry here, its icon file in web/public/icons/, and updating the pinned
 * list in tiles.test.ts (it pins the spec's order and addresses on purpose). The e2e checks read
 * names and icons from here.
 */
export interface Tile {
  name: string;
  /** Where tapping the Tile goes. */
  url: string;
  /** Path under web/public. */
  icon: string;
}

export const TILES: readonly Tile[] = [
  { name: "HoneyDo", url: "https://honeydo.ashershores.com", icon: "/icons/honeydo.png" },
  { name: "NutriSageAI", url: "https://ashershores5.github.io/NutriSageAI/docs/", icon: "/icons/nutrisageai.png" },
  { name: "Games Catalog", url: "https://games.ashershores.com", icon: "/icons/games-catalog.png" },
  { name: "Exam Prep Lab", url: "https://exampreplab.ashershores.com/", icon: "/icons/exam-prep-lab.png" },
];
