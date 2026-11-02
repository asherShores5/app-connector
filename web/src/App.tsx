import { TileGrid } from "./TileGrid";
import type { Tile } from "./tiles";

export const HOME_URL = "https://ashershores.com";

/** Header (title + Home link to my home domain) above the Tile grid. */
export function App({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <main>
      <header>
        <h1>Asher's Apps</h1>
        <a className="home" href={HOME_URL} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>ashershores.com</span>
        </a>
      </header>
      <TileGrid tiles={tiles} />
    </main>
  );
}
