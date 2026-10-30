/**
 * The Tiles, in grid order (HoneyDo top left). To add an App: copy its icon into
 * web/public/icons/ and add an entry here. Icons are committed copies, never live links.
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
  { name: "Exam Prep Lab", url: "https://exampreplab.com", icon: "/icons/exam-prep-lab.png" },
];
