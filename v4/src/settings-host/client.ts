declare global {
  interface Window { configuration?: unknown }
}

const config = document.getElementById('blex-island-config');
if (config?.textContent) window.configuration = JSON.parse(config.textContent);
const globals = document.getElementById('blex-island-globals');
if (globals?.textContent) Object.assign(window, JSON.parse(globals.textContent));
document.dispatchEvent(new CustomEvent('blex:page-change', { bubbles: true }));

export {};
