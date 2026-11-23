import MarkdownIt from 'markdown-it';
import markdownItCjkFriendly from 'markdown-it-cjk-friendly';
import { sanitizePostHtml } from '../post-html.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  })[character] ?? character);
}

function safeLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^[\\/]{2}/.test(trimmed) || /[\\\u0000-\u001f\u007f]/.test(trimmed)) return null;
  const parsed = URL.parse(trimmed, 'https://blex.invalid');
  if (!parsed || !['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  return trimmed;
}

function safeUploadedVideo(value: string): { url: string; type: string } | null {
  const safe = safeLink(value);
  if (!safe?.startsWith('/resources/media/') || /[?#]/.test(safe)) return null;
  let segments: string[];
  try {
    segments = safe.slice('/resources/media/'.length).split('/').map(decodeURIComponent);
  } catch {
    return null;
  }
  if (segments.length < 2 || segments.some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9._-]+$/.test(part))) {
    return null;
  }
  const extension = segments.at(-1)?.match(/\.(mp4|webm)$/i)?.[1]?.toLowerCase();
  if (!extension) return null;
  return { url: safe, type: extension === 'mp4' ? 'video/mp4' : 'video/webm' };
}

function uploadedVideoFigure(caption: string, video: { url: string; type: string }): string {
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';
  return `<figure><video controls playsinline preload="metadata"><source src="${escapeHtml(video.url)}" type="${video.type}"></video>${figcaption}</figure>`;
}

const parser = new MarkdownIt({ html: false, breaks: true });
parser.use(markdownItCjkFriendly);
// Every reference repeats its definition's URL, which would let a short document expand without limit.
parser.disable('reference');
parser.validateLink = (url) => safeLink(url) !== null;
parser.core.ruler.push('blex_blocks', (state) => {
  const tokens: typeof state.tokens = [];
  for (let index = 0; index < state.tokens.length; index += 1) {
    const token = state.tokens[index]!;
    if (token.type === 'fence') {
      const language = token.info.trim().split(/\s+/)[0] ?? '';
      token.info = /^[a-zA-Z0-9_-]{1,32}$/.test(language) ? language : '';
    }
    const inline = token.type === 'paragraph_open' ? state.tokens[index + 1] : undefined;
    const image = inline?.children?.length === 1 && inline.children[0]!.type === 'image' ? inline.children[0]! : null;
    const video = image ? safeUploadedVideo(String(image.attrGet('src') ?? '')) : null;
    if (image && video) {
      const figure = new state.Token('html_block', '', 0);
      figure.content = uploadedVideoFigure(image.content, video);
      tokens.push(figure);
      index += 2;
      continue;
    }
    tokens.push(token);
  }
  state.tokens = tokens;
});

export function markdownToHtml(markdown: string): string {
  return sanitizePostHtml(parser.render(markdown)).trimEnd();
}
