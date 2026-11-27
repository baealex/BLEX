// Runs before the stylesheet and the first paint, so a dark page never shows a white frame first.
// It sets only what that paint needs. The site's theme module applies the same rule afterwards and records the
// reader's preference; both read the `blex_theme` cookie from theme-cookie.ts.
(() => {
  const chosen = /(?:^|;\s*)blex_theme=(light|dark)(?:;|$)/.exec(document.cookie)?.[1];
  const theme = chosen ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
