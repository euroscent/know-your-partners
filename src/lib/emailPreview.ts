/**
 * Wrap arbitrary email HTML so links behave predictably inside srcDoc iframes.
 * - Ensures relative links resolve against a known baseUrl
 * - Forces anchors to open in a new tab/window
 */
export function wrapEmailHtmlForPreview(rawHtml: string, baseUrl: string) {
  const safeBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  const baseTag = `<base href="${safeBase}" target="_blank" />`;
  const metaTag = `<meta charset="utf-8" />`;

  const hasHtmlTag = /<html[^>]*>/i.test(rawHtml);
  const hasHeadTag = /<head[^>]*>/i.test(rawHtml);

  let html = rawHtml;

  // Ensure anchors open in a new tab/window unless explicitly set.
  html = html.replace(
    /<a(?![^>]*\btarget=)([^>]*)>/gi,
    '<a target="_blank" rel="noopener noreferrer"$1>'
  );

  // Remove existing base tags to avoid conflicts.
  html = html.replace(/<base[^>]*>/gi, "");

  if (hasHtmlTag) {
    if (hasHeadTag) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${metaTag}${baseTag}`);
    }

    // Has <html> but no <head>
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${metaTag}${baseTag}</head>`);
  }

  // Fragment only: wrap into a minimal document
  return `<!doctype html><html><head>${metaTag}${baseTag}</head><body>${html}</body></html>`;
}
