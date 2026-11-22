import { Chart } from 'frappe-charts';

const lightScale = ['#f9fafb', '#d1d5db', '#9ca3af', '#6b7280', '#1f2937'];
const darkScale = ['#222222', '#393939', '#555555', '#737373', '#969696'];

function endDate() {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }).formatToParts();
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(part('year'), part('month') - 1, part('day'));
}

function paint(target: HTMLElement, scale: string[]) {
  const days = [...target.querySelectorAll<SVGRectElement>('rect.day')];
  if (!days.length) return;
  const legend = target.querySelector<SVGGElement>('g.chart-legend');
  if (legend && !legend.dataset.originalTransform) {
    const transform = legend.getAttribute('transform') ?? '';
    legend.dataset.originalTransform = transform;
    const match = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    if (match) legend.setAttribute('transform', `translate(${match[1]}, ${Number(match[2]) + 8})`);
  }
  const value = (cell: SVGRectElement) => Number(cell.getAttribute('data-value')) || 0;
  const max = Math.max(...days.map(value));
  const top = scale.length - 1;
  for (const cell of days) {
    const count = value(cell);
    cell.setAttribute('fill', scale[count <= 0 || max <= 0 ? 0 : Math.max(1, Math.min(top, Math.round(Math.sqrt(count / max) * top)))]);
    cell.setAttribute('rx', '3');
  }
  target.querySelectorAll<SVGRectElement>('rect.heatmap-legend-unit').forEach((cell, index) => {
    cell.setAttribute('fill', scale[Math.min(top, index + 1)]);
    cell.setAttribute('rx', '3');
  });
}

function draw(target: HTMLElement, signal: AbortSignal) {
  const scale = document.documentElement.dataset.theme === 'dark' ? darkScale : lightScale;
  target.replaceChildren();
  new Chart(target, {
    type: 'heatmap',
    data: { dataPoints: JSON.parse(target.dataset.heatmapDays ?? '{}'), end: endDate() },
    countLabel: '활동',
    colors: scale,
    height: 150,
    radius: 2,
    discreteDomains: 0,
  });
  // The chart finishes drawing after its first frames.
  for (const delay of [0, 220, 520]) {
    const id = window.setTimeout(() => paint(target, scale), delay);
    signal.addEventListener('abort', () => window.clearTimeout(id), { once: true });
  }
}

export function mountAuthorHeatmaps(signal: AbortSignal) {
  const targets = [...document.querySelectorAll<HTMLElement>('[data-heatmap-days]')];
  const render = () => targets.forEach((target) => draw(target, signal));
  render();
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
