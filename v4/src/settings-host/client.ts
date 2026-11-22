declare global {
  interface Window { configuration?: unknown }
}

const config = document.getElementById('blex-island-config');
if (config?.textContent) window.configuration = JSON.parse(config.textContent);
document.dispatchEvent(new CustomEvent('blex:page-change', { bubbles: true }));

export {};
