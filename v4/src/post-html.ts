import { DomUtils, parseDocument } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';

const youtubeHosts = new Set([
  'youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);

export const youtubeFrameSources = [...youtubeHosts].map((host) => `https://${host}`).join(' ');

const mediaSchemes = ['http', 'https'];
const lengthValue = /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw))$/i;
const boxLengths = /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))(?:\s+(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))){0,3}$/i;
const colorValue = /^(?:#[a-f\d]{3,8}|[a-z]{1,24}|rgba?\([\d.,% /]+\))$/i;

function mediaUrl(value: string | undefined): string | undefined {
  const input = value?.trim();
  if (!input || /^[\/\\]{2}/.test(input) || /[\\\u0000-\u001f\u007f]/.test(input)) return;

  const url = URL.parse(input, 'https://blex.invalid');
  if (url?.protocol === 'http:' || url?.protocol === 'https:') return input;
}

function renderMedia(tagName: string, attributes: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  // Older BLEX content stored the real source in data-src for its lazy loader.
  const { 'data-src': lazySource, ...attribs } = attributes;
  const source = mediaUrl(lazySource) ?? mediaUrl(attribs.src);
  if (source) attribs.src = source;
  else delete attribs.src;

  if (tagName === 'img' && lazySource) attribs.loading ??= 'lazy';
  if (attribs.srcset) {
    const candidates = attribs.srcset.split(',').map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      if (!mediaUrl(url)) return '';
      return descriptor && /^\d+(?:\.\d+)?[wx]$/.test(descriptor) ? `${url} ${descriptor}` : url;
    });
    attribs.srcset = candidates.filter(Boolean).join(', ');
  }
  return { tagName, attribs };
}

const postHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption', 'figure',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe', 'img', 'li', 'mark',
    'ol', 'p', 'pre', 's', 'small', 'source', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'video',
  ],
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'title', 'target', 'rel'],
    div: ['id', 'style'],
    figure: ['style'],
    figcaption: ['style'],
    h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
    iframe: ['src', 'title', 'width', 'height', 'loading', 'allowfullscreen', 'referrerpolicy'],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'style'],
    ol: ['start'],
    p: ['id', 'style'],
    source: ['src', 'type'],
    span: ['id', 'style'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    video: ['src', 'poster', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload', 'style'],
  },
  allowedStyles: {
    '*': {
      'align-items': [/^(?:start|end|center|flex-start|flex-end|stretch|baseline)$/],
      'aspect-ratio': [/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/],
      'background-color': [colorValue],
      color: [colorValue],
      display: [/^(?:block|flex|grid|inline|inline-block|inline-flex)$/],
      'flex-direction': [/^(?:row|row-reverse|column|column-reverse)$/],
      'justify-content': [/^(?:start|end|center|flex-start|flex-end|space-between|space-around|space-evenly)$/],
      'object-fit': [/^(?:contain|cover|fill|none|scale-down)$/],
      'text-align': [/^(?:left|right|start|end|center|justify)$/],
      'border-radius': [boxLengths],
      margin: [boxLengths],
      'margin-right': [lengthValue],
      padding: [boxLengths],
      width: [lengthValue], height: [lengthValue],
      'min-width': [lengthValue], 'max-width': [lengthValue],
      'min-height': [lengthValue], 'max-height': [lengthValue],
    },
  },
  allowedSchemes: [...mediaSchemes, 'mailto'],
  allowedSchemesByTag: { img: mediaSchemes, video: mediaSchemes, source: mediaSchemes, iframe: ['https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'poster'],
  allowProtocolRelative: false,
  allowedIframeHostnames: [...youtubeHosts],
  allowIframeRelativeUrls: false,
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
  transformTags: {
    a: (tagName, attributes) => {
      const { target, ...attribs } = attributes;
      if (target === '_blank') {
        attribs.target = target;
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName, attribs };
    },
    img: renderMedia,
    video: renderMedia,
    source: renderMedia,
    iframe: (tagName, attributes) => {
      const { src, ...attribs } = attributes;
      const url = URL.parse(src ?? '');
      if (url?.protocol === 'https:' && youtubeHosts.has(url.hostname) && !url.port &&
          !url.username && !url.password && /^\/embed\/[a-zA-Z0-9_-]{1,64}$/.test(url.pathname)) {
        attribs.src = url.href;
        attribs.loading = 'lazy';
        attribs.referrerpolicy = 'strict-origin-when-cross-origin';
        attribs.allowfullscreen = '';
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, postHtmlOptions);
}

export function postOutline(html: string) {
  if (!/<h[1-6][\s>]/.test(html)) return { html, headings: [] };
  const document = parseDocument(html, { withStartIndices: true });
  const elements = DomUtils.getElementsByTagName((name) => /^h[1-6]$/.test(name), document.children);
  const used = new Set(elements.flatMap((element) => element.attribs.id || []));
  let body = '';
  let cursor = 0;
  const headings = elements.flatMap((element) => {
    const text = DomUtils.textContent(element).trim();
    if (!text) return [];
    let id = element.attribs.id;
    if (!id) {
      const base = text.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/[-\s]+/g, '-').replace(/^-|-$/g, '') || 'heading';
      id = base;
      for (let suffix = 1; used.has(id); suffix += 1) id = `${base}-${suffix}`;
      used.add(id);
      const offset = (element.startIndex ?? 0) + element.name.length + 1;
      body += html.slice(cursor, offset) + ` id="${id}"`;
      cursor = offset;
    }
    return [{ id, text, level: Number(element.name[1]) }];
  });
  return { html: body + html.slice(cursor), headings };
}
