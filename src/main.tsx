import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

// Capture install prompt as early as possible so the /install page can use it
// even if the user lands on another route first.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as unknown as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = e;
});

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA service worker
registerServiceWorker();
