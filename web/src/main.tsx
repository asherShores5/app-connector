import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TileGrid } from "./TileGrid";
import { TILES } from "./tiles";
import "./styles.css";
import { registerServiceWorker } from "./registerSw";

void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>
      <h1>Apps</h1>
      <TileGrid tiles={TILES} />
    </main>
  </StrictMode>,
);
