import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { TILES } from "./tiles";
import "./styles.css";
import { registerServiceWorker } from "./registerSw";

void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App tiles={TILES} />
  </StrictMode>,
);
