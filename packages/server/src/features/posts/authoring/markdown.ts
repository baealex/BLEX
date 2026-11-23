import { sanitizePostHtml } from '../post-html.js';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      })[character] ?? character,
  );
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
  if (
    segments.length < 2 ||
    segments.some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9._-]+$/.test(part))
  ) {
    return null;
  }
  const extension = segments
    .at(-1)
    ?.match(/\.(mp4|webm)$/i)?.[1]
    ?.toLowerCase();
  if (!extension) return null;
  return { url: safe, type: extension === 'mp4' ? 'video/mp4' : 'video/webm' };
}

function uploadedVideoFigure(caption: string, video: { url: string; type: string }): string {
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';
  return `<figure><video controls playsinline preload="metadata"><source src="${escapeHtml(video.url)}" type="${video.type}"></video>${figcaption}</figure>`;
}

function inlineMarkdown(raw: string): string {
  const tokens: string[] = [];
  const protect = (html: string) => {
    const token = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };

  let prepared = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, target: string) => {
    const safe = safeLink(target);
    return protect(safe ? `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}">` : escapeHtml(alt));
  });
  prepared = prepared.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, target: string) => {
    const safe = safeLink(target);
    return protect(safe ? `<a href="${escapeHtml(safe)}">${escapeHtml(label)}</a>` : escapeHtml(label));
  });
  prepared = prepared.replace(/`([^`]+)`/g, (_match, code: string) => protect(`<code>${escapeHtml(code)}</code>`));

  let html = escapeHtml(prepared)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  html = html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => tokens[Number(index)] ?? '');
  return html;
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  return /^\s{0,3}(?:#{1,6}\s|```|~~~|>|[-*+]\s|\d+\.\s|(?:---+|___+|\*\*\*+)\s*$)/.test(line);
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const videoImage = line.match(/^\s{0,3}!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    const video = videoImage ? safeUploadedVideo(videoImage[2] ?? '') : null;
    if (videoImage && video) {
      blocks.push(uploadedVideoFigure(videoImage[1] ?? '', video));
      index += 1;
      continue;
    }

    const fence = line.match(/^\s{0,3}(```+|~~~+)(.*)$/);
    if (fence) {
      const marker = fence[1]![0];
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !new RegExp(`^\\s{0,3}${marker}{3,}\\s*$`).test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      const language = (fence[2] ?? '').trim().split(/\s+/)[0];
      const className = /^[a-zA-Z0-9_-]{1,32}$/.test(language) ? ` class="language-${escapeHtml(language)}"` : '';
      blocks.push(`<pre><code${className}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s{0,3}(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s{0,3}>/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^\s{0,3}>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote><p>${quote.map(inlineMarkdown).join('<br>')}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s{0,3}[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s{0,3}\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const kind = unordered ? 'ul' : 'ol';
      const items: string[] = [];
      while (index < lines.length) {
        const match = (lines[index] ?? '').match(kind === 'ul' ? /^\s{0,3}[-*+]\s+(.+)$/ : /^\s{0,3}\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${inlineMarkdown(match[1]!)}</li>`);
        index += 1;
      }
      blocks.push(`<${kind}>${items.join('')}</${kind}>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? '').trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
  }

  return sanitizePostHtml(blocks.join('\n'));
}
