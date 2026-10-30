import type { Tile } from "./tiles";

/**
 * iOS-style icon grid. Each Tile is a plain link that opens its App in a new tab (on iPhone,
 * a Safari sheet), so App Connector stays open. Apps are never framed or embedded.
 */
export function TileGrid({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <ul className="tiles">
      {tiles.map((t) => (
        <li key={t.url}>
          <a className="tile" href={t.url} target="_blank" rel="noopener noreferrer">
            {/* The name below is the accessible label, so the icon is decorative. */}
            <img src={t.icon} alt="" width={64} height={64} />
            <span>{t.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
