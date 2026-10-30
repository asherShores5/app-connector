import { useEffect, useId, useRef } from "react";
import type { Tile } from "./tiles";

/**
 * The Install hint sheet: how to add one App to the home screen so it opens as its own app.
 * A native modal <dialog>, so focus moves into it, stays in it, and returns to the (i) button
 * when it closes. Closes with the Close button, Escape, or a tap outside the sheet.
 * App Connector can't tell whether an App is already installed, so the hint is always offered.
 */
export function InstallHint({ tile, onClose }: { tile: Tile; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="hint"
      aria-labelledby={titleId}
      // Escape closes a modal dialog natively; every way out ends in the "close" event.
      onClose={onClose}
      // The sheet's content fills the dialog box, so a click on the dialog itself is the backdrop.
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="hint-body">
        <img src={tile.icon} alt="" width={56} height={56} />
        <h2 id={titleId}>{tile.name}</h2>
        <a className="hint-url" href={tile.url} target="_blank" rel="noopener noreferrer">
          {tile.url}
        </a>
        <p>To add it to your home screen as its own app:</p>
        <ol>
          <li>
            Tap the address above. If it opens inside Apps, tap the compass button to open it in Safari.
          </li>
          <li>Tap <strong>Share</strong> (the square with an arrow pointing up).</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
        </ol>
        <button type="button" className="hint-close" onClick={close}>Close</button>
      </div>
    </dialog>
  );
}
