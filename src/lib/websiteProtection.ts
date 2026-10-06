/**
 * Website Protection Module
 * Prevents copying, cloning, and unauthorized code access.
 */

export const initWebsiteProtection = () => {
  // 1. Disable right-click context menu
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  });

  // 2. Disable text selection via CSS
  const style = document.createElement("style");
  style.textContent = `
    body {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    input, textarea, [contenteditable="true"], pre, code {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
  `;
  document.head.appendChild(style);

  // 3. Disable keyboard shortcuts for copy/save/print/view-source
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey && (e.key === "u" || e.key === "U")) ||
      (e.ctrlKey && (e.key === "s" || e.key === "S")) ||
      (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I")) ||
      (e.ctrlKey && e.shiftKey && (e.key === "j" || e.key === "J")) ||
      (e.ctrlKey && e.shiftKey && (e.key === "c" || e.key === "C")) ||
      e.key === "F12"
    ) {
      e.preventDefault();
      return false;
    }
  });

  // 4. Disable drag & drop of images and content
  document.addEventListener("dragstart", (e) => {
    e.preventDefault();
    return false;
  });

  // 5. Disable print
  const printStyle = document.createElement("style");
  printStyle.setAttribute("media", "print");
  printStyle.textContent = `body { display: none !important; }`;
  document.head.appendChild(printStyle);

  // 6. DevTools detection warning
  let devtoolsOpen = false;
  const threshold = 160;

  const checkDevTools = () => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;

    if (widthDiff || heightDiff) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        console.clear();
        console.log(
          "%c⚠️ WARNUNG: Diese Webseite ist urheberrechtlich geschützt.",
          "color: red; font-size: 24px; font-weight: bold;"
        );
        console.log(
          "%cJeder Versuch, den Code oder Inhalte dieser Webseite zu kopieren, zu klonen oder zu extrahieren, verstößt gegen das Urheberrecht und wird strafrechtlich verfolgt.",
          "color: red; font-size: 14px;"
        );
      }
    } else {
      devtoolsOpen = false;
    }
  };

  setInterval(checkDevTools, 1000);

  // 7. Noscript warning
  const noscript = document.createElement("noscript");
  noscript.innerHTML = "<p>Diese Seite benötigt JavaScript. Bitte aktivieren Sie JavaScript in Ihrem Browser.</p>";
  document.body.prepend(noscript);
};
