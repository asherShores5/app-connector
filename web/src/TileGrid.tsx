import { useState } from "react";
import { InstallHint } from "./InstallHint";
import type { Tile } from "./tiles";

/**
 * iOS-style icon grid. Each Tile is a plain link that opens its App in a new tab (on iPhone,
 * a Safari sheet), so App Connector stays open. Apps are never framed or embedded.
 * A small (i) button beside each link opens that App's Install hint; it sits outside the link
 * so tapping it never opens the App.
 */
export function TileGrid({ tiles }: { tiles: readonly Tile[] }) {
  const [hintFor, setHintFor] = useState<Tile | null>(null);
  return (
    <>
      <ul className="tiles">
        {tiles.map((t) => (
          <li key={t.url}>
            <a className="tile" href={t.url} target="_blank" rel="noopener noreferrer">
              {/* The name below is the accessible label, so the icon is decorative. */}
              <img src={t.icon} alt="" width={64} height={64} />
              <span>{t.name}</span>
            </a>
            <button type="button" className="info" aria-label={`How to install ${t.name}`} onClick={() => setHintFor(t)}>
              i
            </button>
          </li>
        ))}
      </ul>
      {hintFor && <InstallHint tile={hintFor} onClose={() => setHintFor(null)} />}
    </>
  );
}
